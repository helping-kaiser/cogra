//! Rust's lexical structure: strings, raw strings, chars, comments.
//!
//! A hand-written lexer, over bytes, total on arbitrary input. It exists
//! because the ban of `[banned-tokens]` is a *lexical* fact and not a
//! textual one — a `//` inside a string, a raw string, or a character
//! literal is not a comment — and because the classification has to survive
//! a file `syn` cannot parse at all (´[ARCH-dec:linter:pretokenizer]´).
//!
//! # What the grammar decides, and where
//!
//! Four discriminations carry the file, each read off the Rust Reference's
//! own productions rather than guessed:
//!
//! * `///` is an outer line doc comment unless a fourth slash follows, and
//!   `////` is a plain comment. `//!` is an inner line doc comment.
//! * `/**` opens an outer block doc comment unless the next byte is `*` or
//!   `/`, which is why `/**/` and `/***/` are plain. `/*!` opens an inner
//!   one. Block comments **nest**, and the form is the outermost opener's.
//! * A literal prefix — `b`, `c`, `r`, `br`, `cr` — only counts at an
//!   identifier boundary, so `abr"x"` is the identifier `abr` beside a
//!   string and not a raw byte string. Prefixes are therefore recognized
//!   after consuming a whole identifier run, never by peeking backwards.
//! * An apostrophe opens a character literal exactly when an escape
//!   follows, or when exactly one character sits between it and the next
//!   apostrophe; otherwise it opens a lifetime or a loop label, which is
//!   ordinary code. `'a'` is a literal, `'a` is not, and `'_'` and `'_`
//!   split the same way.
//!
//! # Unterminated forms
//!
//! Every unterminated form is a located diagnostic beside a lexeme that
//! runs to the end of the input, so (´inv:lint:lexeme-partition´) holds in
//! the failure case too. A character literal is bounded by its own line: an
//! apostrophe that opens an escape and never closes would otherwise swallow
//! the rest of the file, and a one-line loss is the smaller wrong answer.

use super::{
    CommentForm, LexClass, LiteralForm, Partitioning, PreTokenized, UNTERMINATED_BLOCK_COMMENT,
    UNTERMINATED_CHARACTER, UNTERMINATED_STRING, unclassified,
};
use crate::diag::{ByteSpan, Diagnostic};

/// The language token `[scanned-regions]` gives this frontend.
///
/// It lives beside the lexer rather than beside the frontend because the
/// pre-tokenizer is the more primitive of the two: a file is pre-tokenized
/// whether or not `syn` can parse it.
pub(crate) const RUST: &str = "rust";

/// Pre-tokenize Rust source.
pub(crate) fn pretokenize(bytes: &[u8]) -> PreTokenized {
    let mut lexer = Lexer {
        bytes,
        out: Partitioning::new(bytes.len()),
        unclassified: Vec::new(),
    };
    lexer.run();
    PreTokenized {
        lexemes: lexer.out.finish(),
        unclassified: lexer.unclassified,
    }
}

struct Lexer<'a> {
    bytes: &'a [u8],
    out: Partitioning,
    unclassified: Vec<Diagnostic>,
}

impl Lexer<'_> {
    fn run(&mut self) {
        let mut at = 0;
        while at < self.bytes.len() {
            at = self.step(at);
        }
    }

    /// Classify whatever begins at `at`, and answer with the next position.
    ///
    /// Every branch answers with a strictly greater position, which is what
    /// makes the loop terminate on arbitrary bytes; the default branch
    /// advances one byte and records nothing, leaving the stretch to
    /// [`Partitioning`] as `Code`.
    fn step(&mut self, at: usize) -> usize {
        match self.byte(at) {
            Some(b'/') if self.byte(at + 1) == Some(b'/') => self.line_comment(at),
            Some(b'/') if self.byte(at + 1) == Some(b'*') => self.block_comment(at),
            Some(b'"') => self.quoted(at, at, LiteralForm::Str),
            Some(b'\'') => self.apostrophe(at, at),
            Some(byte) if starts_identifier(byte) => self.identifier(at),
            _ => at + 1,
        }
    }

    fn byte(&self, at: usize) -> Option<u8> {
        self.bytes.get(at).copied()
    }

    /// A line comment, in the form its leader gives it.
    ///
    /// The lexeme stops before the newline: the terminator is not part of
    /// the token, and leaving it out is what lets a run of `///` lines be
    /// assembled into one logical region whose pieces are the lines alone.
    fn line_comment(&mut self, at: usize) -> usize {
        let form = match (self.byte(at + 2), self.byte(at + 3)) {
            (Some(b'/'), Some(b'/')) => CommentForm::LinePlain,
            (Some(b'/'), _) => CommentForm::LineOuterDoc,
            (Some(b'!'), _) => CommentForm::LineInnerDoc,
            _ => CommentForm::LinePlain,
        };
        let end = self.bytes[at..]
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(self.bytes.len(), |offset| at + offset);
        self.out.push(at, end, LexClass::Comment(form));
        end.max(at + 1)
    }

    /// A block comment, nesting, in the form its opener gives it.
    fn block_comment(&mut self, at: usize) -> usize {
        let form = match (self.byte(at + 2), self.byte(at + 3)) {
            (Some(b'!'), _) => CommentForm::BlockInnerDoc,
            (Some(b'*'), Some(b'*' | b'/')) | (Some(b'*'), None) => CommentForm::BlockPlain,
            (Some(b'*'), Some(_)) => CommentForm::BlockOuterDoc,
            _ => CommentForm::BlockPlain,
        };
        let mut depth = 1usize;
        let mut scan = at + 2;
        let mut end = None;
        while scan < self.bytes.len() {
            match (self.byte(scan), self.byte(scan + 1)) {
                (Some(b'/'), Some(b'*')) => {
                    depth += 1;
                    scan += 2;
                }
                (Some(b'*'), Some(b'/')) => {
                    depth -= 1;
                    scan += 2;
                    if depth == 0 {
                        end = Some(scan);
                        break;
                    }
                }
                _ => scan += 1,
            }
        }
        let end = end.unwrap_or_else(|| {
            self.fail(
                UNTERMINATED_BLOCK_COMMENT,
                ByteSpan::new(at, (at + 2).min(self.bytes.len())),
                "this block comment is never closed",
            );
            self.bytes.len()
        });
        self.out.push(at, end, LexClass::Comment(form));
        end.max(at + 1)
    }

    /// An identifier run, and the literal prefixes only a whole run can be.
    ///
    /// The run is consumed first and matched afterwards, which is the whole
    /// reason `abr"x"` lexes as an identifier beside a string: a prefix is
    /// a complete identifier, never a suffix of one.
    fn identifier(&mut self, at: usize) -> usize {
        let mut end = at + 1;
        while self.byte(end).is_some_and(continues_identifier) {
            end += 1;
        }
        let run = &self.bytes[at..end];
        if let Some(form) = raw_prefix(run)
            && let Some(hashes) = raw_opener(self.bytes, end)
        {
            return self.raw(at, end + hashes, hashes, form);
        }
        if let Some(form) = quoted_prefix(run)
            && self.byte(end) == Some(b'"')
        {
            return self.quoted(at, end, form);
        }
        if run == b"b"
            && self.byte(end) == Some(b'\'')
            && let Some(close) = self.character(end)
        {
            self.out
                .push(at, close, LexClass::Literal(LiteralForm::Byte));
            return close;
        }
        end
    }

    /// A quoted literal, from `start`, whose opening quote sits at `quote`.
    fn quoted(&mut self, start: usize, quote: usize, form: LiteralForm) -> usize {
        let mut scan = quote + 1;
        let mut end = None;
        while scan < self.bytes.len() {
            match self.byte(scan) {
                Some(b'\\') => scan += 2,
                Some(b'"') => {
                    end = Some(scan + 1);
                    break;
                }
                _ => scan += 1,
            }
        }
        let end = end.unwrap_or_else(|| {
            self.fail(
                UNTERMINATED_STRING,
                ByteSpan::new(start, (quote + 1).min(self.bytes.len())),
                "this string literal is never closed",
            );
            self.bytes.len()
        });
        self.out.push(start, end, LexClass::Literal(form));
        end.max(start + 1)
    }

    /// A raw literal: no escapes, closed by a quote and `hashes` hashes.
    fn raw(&mut self, start: usize, quote: usize, hashes: usize, form: LiteralForm) -> usize {
        let mut scan = quote + 1;
        let mut end = None;
        while scan < self.bytes.len() {
            if self.byte(scan) == Some(b'"')
                && self.bytes[scan + 1..]
                    .iter()
                    .take(hashes)
                    .filter(|byte| **byte == b'#')
                    .count()
                    == hashes
            {
                end = Some(scan + 1 + hashes);
                break;
            }
            scan += 1;
        }
        let end = end.unwrap_or_else(|| {
            self.fail(
                UNTERMINATED_STRING,
                ByteSpan::new(start, (quote + 1).min(self.bytes.len())),
                "this raw string literal is never closed",
            );
            self.bytes.len()
        });
        self.out.push(start, end, LexClass::Literal(form));
        end.max(start + 1)
    }

    /// An apostrophe: a character literal, or a lifetime and therefore code.
    fn apostrophe(&mut self, start: usize, quote: usize) -> usize {
        match self.character(quote) {
            Some(end) => {
                self.out
                    .push(start, end, LexClass::Literal(LiteralForm::Char));
                end.max(start + 1)
            }
            None => {
                let mut end = quote + 1;
                while self.byte(end).is_some_and(continues_identifier) {
                    end += 1;
                }
                end.max(quote + 1)
            }
        }
    }

    /// Where the character literal opened at `quote` closes, if it is one.
    ///
    /// `None` is the answer for a lifetime, and it is decided before any
    /// scanning: an apostrophe that is not a literal must not be allowed to
    /// hunt for a partner, or `&'a str … 'b` would join two lifetimes into
    /// one enormous literal.
    fn character(&mut self, quote: usize) -> Option<usize> {
        match self.byte(quote + 1) {
            Some(b'\\') => self.escaped_character(quote),
            Some(b'\n') => None,
            Some(_) => {
                let width = utf8_width(self.bytes, quote + 1);
                (self.byte(quote + 1 + width) == Some(b'\'')).then_some(quote + 1 + width + 1)
            }
            None => None,
        }
    }

    /// A character literal opening with an escape, bounded by its own line.
    fn escaped_character(&mut self, quote: usize) -> Option<usize> {
        let mut scan = quote + 1;
        while scan < self.bytes.len() {
            match self.byte(scan) {
                Some(b'\n') => break,
                Some(b'\\') => scan += 2,
                Some(b'\'') => return Some(scan + 1),
                _ => scan += 1,
            }
        }
        let end = scan.min(self.bytes.len());
        self.fail(
            UNTERMINATED_CHARACTER,
            ByteSpan::new(quote, (quote + 1).min(self.bytes.len())),
            "this character literal is never closed",
        );
        Some(end.max(quote + 1))
    }

    fn fail(&mut self, rule: crate::diag::RuleId, span: ByteSpan, message: &str) {
        self.unclassified.push(unclassified(rule, span, message));
    }
}

/// Whether `run` is one of the raw-literal prefixes, and which literal it
/// makes.
fn raw_prefix(run: &[u8]) -> Option<LiteralForm> {
    match run {
        b"r" => Some(LiteralForm::RawStr),
        b"br" => Some(LiteralForm::RawByteStr),
        b"cr" => Some(LiteralForm::RawCStr),
        _ => None,
    }
}

/// Whether `run` is one of the quoted-literal prefixes.
fn quoted_prefix(run: &[u8]) -> Option<LiteralForm> {
    match run {
        b"b" => Some(LiteralForm::ByteStr),
        b"c" => Some(LiteralForm::CStr),
        _ => None,
    }
}

/// How many hashes open a raw literal at `at`, if one opens there at all.
///
/// `r#"…"#` opens a raw string; `r#type` is a raw identifier and opens
/// nothing, which is the discrimination this function exists to make.
fn raw_opener(bytes: &[u8], at: usize) -> Option<usize> {
    let hashes = bytes[at..].iter().take_while(|byte| **byte == b'#').count();
    (bytes.get(at + hashes) == Some(&b'"')).then_some(hashes)
}

fn starts_identifier(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || byte == b'_' || byte >= 0x80
}

fn continues_identifier(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte >= 0x80
}

/// How many bytes the character at `at` occupies.
///
/// Read off the leading byte alone, and one byte for anything that is not a
/// leading byte: the input need not be UTF-8, and a lexer that trusted a
/// continuation byte to introduce a sequence would walk off a literal's end.
fn utf8_width(bytes: &[u8], at: usize) -> usize {
    let width = match bytes.get(at) {
        Some(0x00..=0x7F) => 1,
        Some(0xC0..=0xDF) => 2,
        Some(0xE0..=0xEF) => 3,
        Some(0xF0..=0xF7) => 4,
        _ => 1,
    };
    width.min(bytes.len().saturating_sub(at)).max(1)
}
