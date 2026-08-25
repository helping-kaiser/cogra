//! The pre-tokenizer contract: comment regions and ban findings.
//!
//! The pre-tokenizer is a lexer with a small, testable contract, held to the
//! same standard as any frontend (´sig:lint:pretokenizer-api´). It runs per
//! language, over the file's own lexical structure, and it produces two
//! things: the located comment regions the AST drops, and the ground the
//! banned-token findings of [`crate::bans`] stand on.
//!
//! # The partition
//!
//! [`PreTokenized::lexemes`] is a *partition* of the input: the spans are
//! non-overlapping, ascending, and cover every byte exactly once
//! (´inv:lint:lexeme-partition´). The invariant is what makes the
//! pre-tokenizer checkable at all — without it, "text it cannot classify is
//! a hard diagnostic, not a guess" has no subject, because a lexer that
//! silently skips a byte has classified nothing and reported nothing.
//!
//! It is guaranteed structurally rather than by inspection. A language's
//! lexer never appends a lexeme itself: it hands spans to [`Partitioning`],
//! which fills the run before each one with a [`LexClass::Code`] lexeme and
//! closes the tail at the end of the input. A lexer that forgets a stretch
//! therefore produces `Code` over it, which is the invariant's own failure
//! case — a lexeme, with a diagnostic beside it, never a gap.
//!
//! # Totality
//!
//! [`pretokenize`] is total on arbitrary bytes. It never panics, never
//! rejects, and never requires UTF-8: a Rust source that is not UTF-8 still
//! pre-tokenizes, because the ban is a lexical fact and holds whether or not
//! `syn` can read the file (´crit:lint:error-or-finding´). Unterminated
//! forms — a block comment with no `*/`, a string with no closing quote —
//! are located diagnostics beside a lexeme that runs to the end of the
//! input.

pub mod rust;

use std::path::Path;

use crate::adopt::Language;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};

/// A block comment the input never closes.
pub const UNTERMINATED_BLOCK_COMMENT: RuleId =
    RuleId::new("pretokenize-unterminated-block-comment");

/// A string, raw string, or byte string the input never closes.
pub const UNTERMINATED_STRING: RuleId = RuleId::new("pretokenize-unterminated-string");

/// A character or byte literal the input never closes.
pub const UNTERMINATED_CHARACTER: RuleId = RuleId::new("pretokenize-unterminated-character");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 3] = [
    UNTERMINATED_BLOCK_COMMENT,
    UNTERMINATED_STRING,
    UNTERMINATED_CHARACTER,
];

/// One lexical unit of a source, as the pre-tokenizer classifies it.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub struct Lexeme {
    /// Where it sits, in whole-file coordinates.
    pub span: ByteSpan,
    /// What it is.
    pub class: LexClass,
}

/// What one lexeme is.
///
/// The class is the whole of what a ban rule names (´sig:lint:bans-api´): a
/// rule forbids a class the lexer already decided, so a `//` inside a raw
/// string is not a comment and cannot be a finding.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum LexClass {
    /// Everything that is neither a comment nor a literal: identifiers,
    /// punctuation, numbers, whitespace, and any stretch the lexer could
    /// not classify further.
    Code,
    /// A comment, with the form the language gives it.
    Comment(CommentForm),
    /// A string, raw string, byte string, or character literal.
    Literal(LiteralForm),
}

impl LexClass {
    /// The comment form, where this class is a comment.
    #[must_use]
    pub const fn comment(&self) -> Option<CommentForm> {
        match self {
            LexClass::Comment(form) => Some(*form),
            _ => None,
        }
    }
}

/// The form a language gives a comment.
///
/// Rust's six, which are the classes `[banned-tokens]` and
/// `[scanned-regions]` both name: the two plain forms are contraband, and
/// the four documentation forms are this corpus's scanned regions.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum CommentForm {
    /// `///`
    LineOuterDoc,
    /// `//!`
    LineInnerDoc,
    /// `//`
    LinePlain,
    /// `/** */`
    BlockOuterDoc,
    /// `/*! */`
    BlockInnerDoc,
    /// `/* */`
    BlockPlain,
}

impl CommentForm {
    /// Whether the form is a documentation comment.
    #[must_use]
    pub const fn is_doc(&self) -> bool {
        matches!(
            self,
            CommentForm::LineOuterDoc
                | CommentForm::LineInnerDoc
                | CommentForm::BlockOuterDoc
                | CommentForm::BlockInnerDoc
        )
    }

    /// Whether the form is written a line at a time, so that a run of them
    /// is one logical region (´conv:lint:rust-surface´).
    #[must_use]
    pub const fn is_line(&self) -> bool {
        matches!(
            self,
            CommentForm::LineOuterDoc | CommentForm::LineInnerDoc | CommentForm::LinePlain
        )
    }

    /// The class name `[banned-tokens]` and `[scanned-regions]` spell this
    /// form with, and the one a ban rule names it by
    /// (´sig:lint:bans-api´).
    #[must_use]
    pub const fn token(&self) -> &'static str {
        match self {
            CommentForm::LineOuterDoc => "outer line doc comment",
            CommentForm::LineInnerDoc => "inner line doc comment",
            CommentForm::LinePlain => "plain line comment",
            CommentForm::BlockOuterDoc => "outer block doc comment",
            CommentForm::BlockInnerDoc => "inner block doc comment",
            CommentForm::BlockPlain => "plain block comment",
        }
    }

    /// Every form, so a ban rule's class name can be resolved against the
    /// vocabulary the lexer actually decides.
    pub const ALL: [CommentForm; 6] = [
        CommentForm::LineOuterDoc,
        CommentForm::LineInnerDoc,
        CommentForm::LinePlain,
        CommentForm::BlockOuterDoc,
        CommentForm::BlockInnerDoc,
        CommentForm::BlockPlain,
    ];
}

/// The form a language gives a literal.
///
/// Wider than the design's four-word gloss — "a string, raw string, byte
/// string, or character literal" — because the two it does not spell out
/// carry the same weight: a `//` inside a `c"…"` or a `b'…'` is no more a
/// comment than one inside a `"…"`, and a class the lexer does not know is
/// a class the ban would fire inside.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum LiteralForm {
    /// `"…"`
    Str,
    /// `r"…"`, `r#"…"#`
    RawStr,
    /// `b"…"`
    ByteStr,
    /// `br"…"`, `br#"…"#`
    RawByteStr,
    /// `c"…"`
    CStr,
    /// `cr"…"`, `cr#"…"#`
    RawCStr,
    /// `'…'`
    Char,
    /// `b'…'`
    Byte,
}

impl LiteralForm {
    /// The class name a ban rule would name this form by
    /// (´sig:lint:bans-api´).
    #[must_use]
    pub const fn token(&self) -> &'static str {
        match self {
            LiteralForm::Str => "string literal",
            LiteralForm::RawStr => "raw string literal",
            LiteralForm::ByteStr => "byte string literal",
            LiteralForm::RawByteStr => "raw byte string literal",
            LiteralForm::CStr => "C string literal",
            LiteralForm::RawCStr => "raw C string literal",
            LiteralForm::Char => "character literal",
            LiteralForm::Byte => "byte literal",
        }
    }

    /// Every form, so a ban rule's class name can be resolved against the
    /// vocabulary the lexer actually decides.
    pub const ALL: [LiteralForm; 8] = [
        LiteralForm::Str,
        LiteralForm::RawStr,
        LiteralForm::ByteStr,
        LiteralForm::RawByteStr,
        LiteralForm::CStr,
        LiteralForm::RawCStr,
        LiteralForm::Char,
        LiteralForm::Byte,
    ];
}

/// What one pre-tokenizing run produced.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PreTokenized {
    /// Every byte of the input, in order, classified exactly once.
    pub lexemes: Vec<Lexeme>,
    /// Text the lexer could not carry to its close: a hard diagnostic,
    /// never a guess.
    pub unclassified: Vec<Diagnostic>,
}

impl PreTokenized {
    /// The comment lexemes, in order.
    pub fn comments(&self) -> impl Iterator<Item = (ByteSpan, CommentForm)> + '_ {
        self.lexemes
            .iter()
            .filter_map(|one| one.class.comment().map(|form| (one.span, form)))
    }

    /// The class of the lexeme starting exactly at `offset`.
    ///
    /// Exactly, not covering: the caller is matching a span some other
    /// parser produced against the partition — a `syn` attribute against
    /// the comment it was written as — and a span that starts mid-lexeme is
    /// not that comment.
    #[must_use]
    pub fn class_at(&self, offset: usize) -> Option<LexClass> {
        self.lexemes
            .binary_search_by_key(&offset, |one| one.span.start)
            .ok()
            .and_then(|at| self.lexemes.get(at))
            .map(|one| one.class)
    }

    /// Whether the lexemes partition `len` bytes.
    ///
    /// The predicate of (´inv:lint:lexeme-partition´), stated once so that
    /// every fixture, the property obligation, and the audit's fuzz target
    /// assert the same thing rather than each restating it: ascending,
    /// non-overlapping, no empty lexeme, and `len` bytes covered.
    #[must_use]
    pub fn partitions(&self, len: usize) -> bool {
        let mut at = 0;
        for one in &self.lexemes {
            if one.span.start != at || one.span.end <= one.span.start {
                return false;
            }
            at = one.span.end;
        }
        at == len
    }

    /// Stamp the source onto the diagnostics the lexer produced.
    ///
    /// [`pretokenize`] takes bytes and no file, which is what lets the fuzz
    /// target and the partition property feed it arbitrary input; the two
    /// fields of a [`Diagnostic`] that no byte-level lexer can know — which
    /// file the bytes came from, and whether findings there fail the lane —
    /// are therefore filled by the caller that holds the source. Every
    /// caller inside the crate does this before the diagnostics travel.
    pub fn stamp(&mut self, path: &Path, source: &[u8], enforcement: Enforcement) {
        for one in &mut self.unclassified {
            one.enforcement = enforcement;
            one.primary = located(path, one.primary.span, source);
        }
    }
}

/// Pre-tokenize one source's bytes under the language that reads it.
///
/// A language with no pre-tokenizer — every language of `[scanned-regions]`
/// but Rust in this slice, and every file with no language at all — yields
/// one `Code` lexeme over the whole input and no diagnostics. That is the
/// partition's answer for "nothing is known about this file's lexical
/// structure", and it is why the invariant is stated over the input rather
/// than over the languages.
///
/// ```
/// use cogra_linter::pretokenize::{CommentForm, LexClass, pretokenize};
/// use cogra_linter::Language;
///
/// let rust = Language::new("rust");
/// let pre = pretokenize(Some(&rust), b"let s = \"// not a comment\"; // one is\n");
/// let comments: Vec<CommentForm> = pre.comments().map(|(_, form)| form).collect();
/// assert_eq!(comments, vec![CommentForm::LinePlain]);
///
/// let none = pretokenize(None, b"// nothing reads this");
/// assert_eq!(none.lexemes.len(), 1);
/// assert_eq!(none.lexemes[0].class, LexClass::Code);
/// ```
#[must_use]
pub fn pretokenize(language: Option<&Language>, bytes: &[u8]) -> PreTokenized {
    match language.map(Language::as_str) {
        Some(rust::RUST) => rust::pretokenize(bytes),
        _ => PreTokenized {
            lexemes: Partitioning::new(bytes.len()).finish(),
            unclassified: Vec::new(),
        },
    }
}

/// The lexeme accumulator that makes (´inv:lint:lexeme-partition´) hold by
/// construction.
///
/// A lexer pushes only the spans it recognized; everything between them
/// becomes `Code`, and so does everything after the last one. The clamping
/// is not defensive decoration: a lexer that computes an end past the input
/// or a start behind the last lexeme would otherwise break the invariant
/// silently, and clamping turns that into a visible misclassification
/// instead of a corrupt partition.
pub(crate) struct Partitioning {
    lexemes: Vec<Lexeme>,
    len: usize,
    at: usize,
}

impl Partitioning {
    pub(crate) fn new(len: usize) -> Partitioning {
        Partitioning {
            lexemes: Vec::new(),
            len,
            at: 0,
        }
    }

    /// Record one recognized lexeme, filling the run before it with `Code`.
    pub(crate) fn push(&mut self, start: usize, end: usize, class: LexClass) {
        let start = start.clamp(self.at, self.len);
        let end = end.clamp(start, self.len);
        if start > self.at {
            self.lexemes.push(Lexeme {
                span: ByteSpan::new(self.at, start),
                class: LexClass::Code,
            });
        }
        if end > start {
            self.lexemes.push(Lexeme {
                span: ByteSpan::new(start, end),
                class,
            });
            self.at = end;
        } else {
            self.at = start;
        }
    }

    /// Close the tail and answer with the partition.
    pub(crate) fn finish(mut self) -> Vec<Lexeme> {
        if self.len > self.at {
            self.lexemes.push(Lexeme {
                span: ByteSpan::new(self.at, self.len),
                class: LexClass::Code,
            });
        }
        self.lexemes
    }
}

/// A diagnostic about the bytes alone, awaiting [`PreTokenized::stamp`].
pub(crate) fn unclassified(rule: RuleId, span: ByteSpan, message: &str) -> Diagnostic {
    Diagnostic {
        rule,
        severity: Severity::Error,
        enforcement: Enforcement::Failing,
        primary: Location::new(std::path::PathBuf::new(), span, 1, 1),
        related: Vec::new(),
        message: String::from(message),
    }
}

/// A location in bytes that need not be UTF-8.
///
/// [`Location::in_source`] takes `&str`, and a Rust source that is not
/// UTF-8 still pre-tokenizes, so the line and column are counted over the
/// bytes: a line is what follows a newline, and a column counts bytes of
/// its line, which is what [`Location`] documents anyway.
pub(crate) fn located(path: &Path, span: ByteSpan, source: &[u8]) -> Location {
    let start = span.start.min(source.len());
    let upto = &source[..start];
    let line = 1 + upto.iter().filter(|byte| **byte == b'\n').count();
    let column = 1 + start
        - upto
            .iter()
            .rposition(|byte| *byte == b'\n')
            .map_or(0, |at| at + 1);
    Location {
        path: path.to_path_buf(),
        span,
        line: u32::try_from(line).unwrap_or(u32::MAX),
        column: u32::try_from(column).unwrap_or(u32::MAX),
    }
}
