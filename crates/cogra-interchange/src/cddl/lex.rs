//! The CDDL tokenizer: a hand-written scanner over the lexical
//! productions of RFC 8610 Appendix B.
//!
//! Hand-written and deliberately so. The signed exception admitting a
//! regular-expression engine into this repository is scoped to the
//! `.regexp` control operator's semantics, not to the reading of CDDL
//! source, so the scanning rule stands unamended here
//! (´dec:xchg:regexp-seam´).
//!
//! # The lexical productions
//!
//! ```abnf
//! S      = *WS
//! WS     = SP / NL
//! SP     = %x20
//! NL     = COMMENT / CRLF
//! COMMENT = ";" *PCHAR CRLF
//! PCHAR  = %x20-7E / %x80-10FFFD
//! CRLF   = %x0A / %x0D.0A
//!
//! id     = EALPHA *(*("-" / ".") (EALPHA / DIGIT))
//! EALPHA = ALPHA / "@" / "_" / "$"
//!
//! number   = hexfloat / (int ["." fraction] ["e" exponent])
//! hexfloat = ["-"] "0x" 1*HEXDIG ["." 1*HEXDIG] "p" exponent
//! int      = ["-"] uint
//! uint     = DIGIT1 *DIGIT / "0x" 1*HEXDIG / "0b" 1*BINDIG / "0"
//!
//! text  = %x22 *SCHAR %x22
//! SCHAR = %x20-21 / %x23-5B / %x5D-7E / %x80-10FFFD / SESC
//! SESC  = "\" (%x20-7E / %x80-10FFFD)
//! bytes = [bsqual] %x27 *BCHAR %x27
//! BCHAR = %x20-26 / %x28-5B / %x5D-10FFFD / SESC / CRLF
//! bsqual = "h" / "b64"
//! ```
//!
//! # Three rules that decide everything else
//!
//! **Longest match on `id`.** `id` admits interior `-` and `.`, so
//! `a.size` is one identifier and not `a` followed by the control
//! operator `.size`. This is not a liberty taken by the scanner; it is the
//! reading RFC 8610 states, in the comment it hangs on `type1`: "space may
//! be needed before the operator if type2 ends in a name". A control
//! operator after a name therefore requires the space, and the scanner
//! makes that true by consuming the dot into the name.
//!
//! **A dot is a fraction only before a digit.** `1..2` must be the integer
//! `1`, the range operator, and the integer `2` — never the float `1.`
//! followed by `.2`. The `fraction` production requires `1*DIGIT`, so the
//! scanner looks one character past the dot before committing to it, and
//! the same one-character look decides `#6.24` against `#6` `.24`.
//!
//! **ABNF string literals are case insensitive.** RFC 8610 says so in the
//! preamble to Appendix B, and the scanner obeys it: `0X1F`, `0B01`, `1E5`,
//! `0x1P3`, `H'ff'`, and `B64'aGk'` are all admitted. Only string *values*
//! and names are case sensitive, and those the scanner carries through
//! byte for byte.
//!
//! # What the scanner refuses
//!
//! Whitespace in CDDL is the space character and the line ending, and
//! nothing else: `WS = SP / NL`, `SP = %x20`. A horizontal tab is not
//! whitespace, and `PCHAR` excludes it from comments too, so a tab is a
//! located refusal wherever it appears outside a byte string. A lone
//! carriage return is likewise not a line ending — `CRLF = %x0A / %x0D.0A`
//! pairs it with a line feed or not at all.

use std::fmt;

/// Where a token or a syntax tree node sits in the source.
///
/// Byte offsets slice the source; the line and column locate the *start*
/// for a human, both 1-based, the column counted in characters rather than
/// bytes so that a multi-byte name does not push the reported column past
/// what the reader sees.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub(crate) struct Span {
    /// Byte offset of the first byte.
    pub(crate) start: usize,
    /// Byte offset one past the last byte.
    pub(crate) end: usize,
    /// 1-based line of [`Span::start`].
    pub(crate) line: u32,
    /// 1-based character column of [`Span::start`].
    pub(crate) column: u32,
}

impl Span {
    /// A span reaching from the start of `self` to the end of `other`.
    ///
    /// The line and column stay those of `self`, because a node is located
    /// where it begins.
    pub(crate) fn to(self, other: Span) -> Span {
        Span {
            start: self.start,
            end: other.end,
            line: self.line,
            column: self.column,
        }
    }
}

/// A refusal to read the source, located at the character that caused it.
///
/// Crate-internal on purpose: the public failure is `TheoryError::Syntax`,
/// which this becomes when the theory surface wraps it (`design.md`, the
/// error taxonomy). Keeping the two apart lets the parser carry a detail
/// string that is free to name ABNF productions.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct SyntaxError {
    /// 1-based line.
    pub(crate) line: u32,
    /// 1-based character column.
    pub(crate) column: u32,
    /// What was wrong, in a sentence.
    pub(crate) detail: String,
}

impl SyntaxError {
    /// A refusal at a location.
    pub(crate) fn new(line: u32, column: u32, detail: impl Into<String>) -> SyntaxError {
        SyntaxError {
            line,
            column,
            detail: detail.into(),
        }
    }

    /// A refusal at the start of a span.
    pub(crate) fn at(span: Span, detail: impl Into<String>) -> SyntaxError {
        SyntaxError::new(span.line, span.column, detail)
    }
}

impl fmt::Display for SyntaxError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "line {}, column {}: {}",
            self.line, self.column, self.detail
        )
    }
}

impl std::error::Error for SyntaxError {}

/// The qualifier in front of a byte-string literal (`bsqual`).
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub(crate) enum ByteQual {
    /// No qualifier: `'...'`, the characters' own bytes.
    None,
    /// `h'...'`: base 16.
    Hex,
    /// `b64'...'`: base 64.
    Base64,
}

impl ByteQual {
    /// The qualifier as it is written, normalized to lower case.
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            ByteQual::None => "",
            ByteQual::Hex => "h",
            ByteQual::Base64 => "b64",
        }
    }
}

/// A numeric literal, kept as it was written.
///
/// The lexeme is carried verbatim rather than converted, because a
/// normalized printing that turned `0x18` into `24` or `1.0` into `1`
/// would be rewriting the theory rather than laying it out. Conversion is
/// the evaluator's business, and it has the digits it needs here.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct NumberToken {
    /// The lexeme, byte for byte, sign included.
    pub(crate) text: String,
    /// Whether the literal carries a fraction or an exponent — the
    /// distinction RFC 8610 draws in its comment on `number`.
    pub(crate) is_float: bool,
}

/// One token of CDDL source.
#[derive(Clone, Debug)]
pub(crate) struct Token {
    /// What the token is.
    pub(crate) kind: TokenKind,
    /// Where it sits.
    pub(crate) span: Span,
}

/// The token vocabulary of RFC 8610 Appendix B.
///
/// Every terminal of the grammar appears here exactly once, including the
/// compound forms the scanner must settle before the parser sees them:
/// [`TokenKind::Control`] carries the name of a `ctlop` because `"." id`
/// admits no space, and [`TokenKind::Hash`] carries the whole
/// `"#" DIGIT ["." uint]` head because `#6.24` would otherwise reach the
/// parser as the float `6.24`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum TokenKind {
    /// `=`
    Assign,
    /// `/=`
    TypeChoiceAssign,
    /// `//=`
    GroupChoiceAssign,
    /// `/`
    Slash,
    /// `//`
    DoubleSlash,
    /// `=>`
    Arrow,
    /// `[`
    LBracket,
    /// `]`
    RBracket,
    /// `{`
    LBrace,
    /// `}`
    RBrace,
    /// `(`
    LParen,
    /// `)`
    RParen,
    /// `<`
    Lt,
    /// `>`
    Gt,
    /// `,`
    Comma,
    /// `:`
    Colon,
    /// `*`
    Star,
    /// `+`
    Plus,
    /// `?`
    Question,
    /// `&`
    Ampersand,
    /// `~`
    Tilde,
    /// `^`
    Caret,
    /// `..`, the range including its upper bound.
    RangeInclusive,
    /// `...`, the range excluding its upper bound.
    RangeExclusive,
    /// `.name`: a control operator, the leading dot stripped.
    Control(String),
    /// `#`, `#6`, `#7.25`: the head of a representation type.
    Hash {
        /// The major type, absent for a bare `#`.
        major: Option<u8>,
        /// The additional information, kept as written (`24`, `0x18`).
        ai: Option<String>,
    },
    /// An `id`: a type name, group name, bareword, or socket.
    Ident(String),
    /// A numeric literal.
    Number(NumberToken),
    /// A text literal, the delimiters stripped and the escapes intact.
    Text(String),
    /// A byte-string literal, the delimiters stripped and the escapes
    /// intact.
    Bytes {
        /// The `bsqual` in front of it.
        qual: ByteQual,
        /// The characters between the quotes, byte for byte.
        raw: String,
    },
    /// The end of the source.
    Eof,
}

impl TokenKind {
    /// How to name this token in a message, quoted as it would be written.
    pub(crate) fn describe(&self) -> String {
        match self {
            TokenKind::Assign => "`=`".to_owned(),
            TokenKind::TypeChoiceAssign => "`/=`".to_owned(),
            TokenKind::GroupChoiceAssign => "`//=`".to_owned(),
            TokenKind::Slash => "`/`".to_owned(),
            TokenKind::DoubleSlash => "`//`".to_owned(),
            TokenKind::Arrow => "`=>`".to_owned(),
            TokenKind::LBracket => "`[`".to_owned(),
            TokenKind::RBracket => "`]`".to_owned(),
            TokenKind::LBrace => "`{`".to_owned(),
            TokenKind::RBrace => "`}`".to_owned(),
            TokenKind::LParen => "`(`".to_owned(),
            TokenKind::RParen => "`)`".to_owned(),
            TokenKind::Lt => "`<`".to_owned(),
            TokenKind::Gt => "`>`".to_owned(),
            TokenKind::Comma => "`,`".to_owned(),
            TokenKind::Colon => "`:`".to_owned(),
            TokenKind::Star => "`*`".to_owned(),
            TokenKind::Plus => "`+`".to_owned(),
            TokenKind::Question => "`?`".to_owned(),
            TokenKind::Ampersand => "`&`".to_owned(),
            TokenKind::Tilde => "`~`".to_owned(),
            TokenKind::Caret => "`^`".to_owned(),
            TokenKind::RangeInclusive => "`..`".to_owned(),
            TokenKind::RangeExclusive => "`...`".to_owned(),
            TokenKind::Control(name) => format!("`.{name}`"),
            TokenKind::Hash { .. } => "`#`".to_owned(),
            TokenKind::Ident(name) => format!("the name `{name}`"),
            TokenKind::Number(number) => format!("the number `{}`", number.text),
            TokenKind::Text(_) => "a text literal".to_owned(),
            TokenKind::Bytes { .. } => "a byte-string literal".to_owned(),
            TokenKind::Eof => "the end of the input".to_owned(),
        }
    }
}

/// Read `source` into tokens, or refuse at the first character that is not
/// CDDL.
///
/// The returned vector always ends with [`TokenKind::Eof`], so a parser
/// never has to check for exhaustion separately from checking for the
/// wrong token.
pub(crate) fn tokenize(source: &str) -> Result<Vec<Token>, SyntaxError> {
    let mut lexer = Lexer::new(source);
    let mut tokens = Vec::new();
    loop {
        lexer.skip_trivia()?;
        let start = lexer.mark();
        match lexer.peek() {
            None => {
                tokens.push(Token {
                    kind: TokenKind::Eof,
                    span: lexer.span_from(start),
                });
                return Ok(tokens);
            }
            Some(c) => {
                let kind = lexer.scan_token(c)?;
                tokens.push(Token {
                    kind,
                    span: lexer.span_from(start),
                });
            }
        }
    }
}

/// A saved scanner position, for the productions that need a second look.
#[derive(Copy, Clone)]
struct Mark {
    pos: usize,
    line: u32,
    column: u32,
}

struct Lexer<'a> {
    src: &'a str,
    pos: usize,
    line: u32,
    column: u32,
}

impl<'a> Lexer<'a> {
    fn new(src: &'a str) -> Lexer<'a> {
        Lexer {
            src,
            pos: 0,
            line: 1,
            column: 1,
        }
    }

    fn mark(&self) -> Mark {
        Mark {
            pos: self.pos,
            line: self.line,
            column: self.column,
        }
    }

    fn reset(&mut self, mark: Mark) {
        self.pos = mark.pos;
        self.line = mark.line;
        self.column = mark.column;
    }

    fn span_from(&self, mark: Mark) -> Span {
        Span {
            start: mark.pos,
            end: self.pos,
            line: mark.line,
            column: mark.column,
        }
    }

    /// The unread source. Slicing is safe because `pos` only ever advances by
    /// whole characters, so it is always on a character boundary.
    fn rest(&self) -> &'a str {
        &self.src[self.pos..]
    }

    fn peek(&self) -> Option<char> {
        self.rest().chars().next()
    }

    fn peek_at(&self, n: usize) -> Option<char> {
        self.rest().chars().nth(n)
    }

    fn bump(&mut self) -> Option<char> {
        let c = self.peek()?;
        self.pos += c.len_utf8();
        if c == '\n' {
            self.line += 1;
            self.column = 1;
        } else {
            self.column += 1;
        }
        Some(c)
    }

    fn eat(&mut self, want: char) -> bool {
        if self.peek() == Some(want) {
            self.bump();
            true
        } else {
            false
        }
    }

    fn error(&self, detail: impl Into<String>) -> SyntaxError {
        SyntaxError::new(self.line, self.column, detail)
    }

    fn error_at(&self, mark: Mark, detail: impl Into<String>) -> SyntaxError {
        SyntaxError::new(mark.line, mark.column, detail)
    }

    /// Consume `S`: spaces, line endings, and comments, in any order.
    ///
    /// ```abnf
    /// S = *WS   WS = SP / NL   NL = COMMENT / CRLF
    /// ```
    ///
    /// `CRLF = %x0A / %x0D.0A`, so a carriage return is a line ending only in
    /// front of a line feed, and alone it is an error.
    fn skip_trivia(&mut self) -> Result<(), SyntaxError> {
        loop {
            match self.peek() {
                Some(' ') | Some('\n') => {
                    self.bump();
                }
                Some('\r') => {
                    if self.peek_at(1) == Some('\n') {
                        self.bump();
                        self.bump();
                    } else {
                        return Err(self.error(
                            "carriage return that is not followed by a line feed; \
                             CDDL line endings are LF or CRLF",
                        ));
                    }
                }
                Some(';') => self.skip_comment()?,
                _ => return Ok(()),
            }
        }
    }

    /// Consume `COMMENT = ";" *PCHAR CRLF`.
    ///
    /// The production ends at a line ending, and the scanner also lets the
    /// end of the source end it — see the module documentation on the one
    /// place this scanner is more permissive than the ABNF.
    fn skip_comment(&mut self) -> Result<(), SyntaxError> {
        self.bump();
        loop {
            match self.peek() {
                None => return Ok(()),
                Some('\n') => {
                    self.bump();
                    return Ok(());
                }
                Some('\r') if self.peek_at(1) == Some('\n') => {
                    self.bump();
                    self.bump();
                    return Ok(());
                }
                Some(c) if is_pchar(c) => {
                    self.bump();
                }
                Some(c) => {
                    return Err(self.error(format!(
                        "character {} is not permitted in a comment (PCHAR)",
                        quote_char(c)
                    )));
                }
            }
        }
    }

    fn scan_token(&mut self, first: char) -> Result<TokenKind, SyntaxError> {
        match first {
            '=' => {
                self.bump();
                if self.eat('>') {
                    Ok(TokenKind::Arrow)
                } else {
                    Ok(TokenKind::Assign)
                }
            }
            '/' => {
                self.bump();
                if self.eat('/') {
                    if self.eat('=') {
                        Ok(TokenKind::GroupChoiceAssign)
                    } else {
                        Ok(TokenKind::DoubleSlash)
                    }
                } else if self.eat('=') {
                    Ok(TokenKind::TypeChoiceAssign)
                } else {
                    Ok(TokenKind::Slash)
                }
            }
            '[' => self.single(TokenKind::LBracket),
            ']' => self.single(TokenKind::RBracket),
            '{' => self.single(TokenKind::LBrace),
            '}' => self.single(TokenKind::RBrace),
            '(' => self.single(TokenKind::LParen),
            ')' => self.single(TokenKind::RParen),
            '<' => self.single(TokenKind::Lt),
            '>' => self.single(TokenKind::Gt),
            ',' => self.single(TokenKind::Comma),
            ':' => self.single(TokenKind::Colon),
            '*' => self.single(TokenKind::Star),
            '+' => self.single(TokenKind::Plus),
            '?' => self.single(TokenKind::Question),
            '&' => self.single(TokenKind::Ampersand),
            '~' => self.single(TokenKind::Tilde),
            '^' => self.single(TokenKind::Caret),
            '.' => self.scan_dot(),
            '#' => self.scan_hash(),
            '"' => self.scan_text(),
            '\'' => self.scan_bytes(ByteQual::None),
            '-' => self.scan_number(),
            c if c.is_ascii_digit() => self.scan_number(),
            c if is_ealpha(c) => self.scan_name_or_bytes(),
            c => Err(self.error(format!("unexpected character {}", quote_char(c)))),
        }
    }

    fn single(&mut self, kind: TokenKind) -> Result<TokenKind, SyntaxError> {
        self.bump();
        Ok(kind)
    }

    /// `rangeop = "..." / ".."` and `ctlop = "." id`, told apart by the
    /// character after the dot.
    fn scan_dot(&mut self) -> Result<TokenKind, SyntaxError> {
        if self.peek_at(1) == Some('.') {
            self.bump();
            self.bump();
            if self.eat('.') {
                Ok(TokenKind::RangeExclusive)
            } else {
                Ok(TokenKind::RangeInclusive)
            }
        } else if self.peek_at(1).is_some_and(is_ealpha) {
            self.bump();
            Ok(TokenKind::Control(self.scan_id()))
        } else {
            Err(self.error(
                "expected a range operator (`..` or `...`) or a control-operator \
                 name after `.`",
            ))
        }
    }

    /// The head of a representation type: `"#"`, `"#" DIGIT`, or
    /// `"#" DIGIT "." uint`.
    ///
    /// Scanned whole because `#6.24` would otherwise arrive at the parser
    /// as `#` followed by the float `6.24`. The additional information is
    /// taken only when a digit follows the dot, so `#6 .size 3` still
    /// reaches the parser as a control operator.
    fn scan_hash(&mut self) -> Result<TokenKind, SyntaxError> {
        self.bump();
        let Some(digit) = self.peek().filter(char::is_ascii_digit) else {
            return Ok(TokenKind::Hash {
                major: None,
                ai: None,
            });
        };
        self.bump();
        let major = Some(digit as u8 - b'0');
        if self.peek() == Some('.') && self.peek_at(1).is_some_and(|c| c.is_ascii_digit()) {
            self.bump();
            let start = self.pos;
            if !self.scan_uint() {
                return Err(self.error("expected an unsigned integer after `#N.`"));
            }
            let ai = self.src[start..self.pos].to_owned();
            Ok(TokenKind::Hash {
                major,
                ai: Some(ai),
            })
        } else {
            Ok(TokenKind::Hash { major, ai: None })
        }
    }

    /// `text = %x22 *SCHAR %x22`.
    fn scan_text(&mut self) -> Result<TokenKind, SyntaxError> {
        let open = self.mark();
        self.bump();
        let start = self.pos;
        loop {
            match self.peek() {
                None => {
                    return Err(self.error_at(open, "unterminated text literal"));
                }
                Some('"') => {
                    let raw = self.src[start..self.pos].to_owned();
                    self.bump();
                    return Ok(TokenKind::Text(raw));
                }
                Some('\\') => self.scan_escape()?,
                Some(c) if is_schar(c) => {
                    self.bump();
                }
                Some(c) => {
                    return Err(self.error(format!(
                        "character {} is not permitted in a text literal (SCHAR)",
                        quote_char(c)
                    )));
                }
            }
        }
    }

    /// `bytes = [bsqual] %x27 *BCHAR %x27`, the qualifier already read.
    ///
    /// `BCHAR` admits line endings, so a byte string may span lines; the
    /// scanner counts them so that a later refusal is still located.
    fn scan_bytes(&mut self, qual: ByteQual) -> Result<TokenKind, SyntaxError> {
        let open = self.mark();
        self.bump();
        let start = self.pos;
        loop {
            match self.peek() {
                None => {
                    return Err(self.error_at(open, "unterminated byte-string literal"));
                }
                Some('\'') => {
                    let raw = self.src[start..self.pos].to_owned();
                    self.bump();
                    return Ok(TokenKind::Bytes { qual, raw });
                }
                Some('\\') => self.scan_escape()?,
                Some('\n') => {
                    self.bump();
                }
                Some('\r') if self.peek_at(1) == Some('\n') => {
                    self.bump();
                    self.bump();
                }
                Some(c) if is_bchar(c) => {
                    self.bump();
                }
                Some(c) => {
                    return Err(self.error(format!(
                        "character {} is not permitted in a byte-string literal (BCHAR)",
                        quote_char(c)
                    )));
                }
            }
        }
    }

    /// `SESC = "\" (%x20-7E / %x80-10FFFD)`.
    ///
    /// The production names a character class and not a list of escape
    /// letters, so the scanner checks the class: any printable character
    /// may follow the backslash, and a control character or the end of the
    /// source may not. What the escape *means* is the evaluator's
    /// question, not the scanner's.
    fn scan_escape(&mut self) -> Result<(), SyntaxError> {
        let start = self.mark();
        self.bump();
        match self.peek() {
            None => Err(self.error_at(start, "escape at the end of the input")),
            Some(c) if is_pchar(c) => {
                self.bump();
                Ok(())
            }
            Some(c) => Err(self.error_at(
                start,
                format!("{} cannot follow a backslash (SESC)", quote_char(c)),
            )),
        }
    }

    /// An `id`, or the byte-string literal a `bsqual` introduces.
    ///
    /// `h` and `b64` are ordinary identifiers everywhere except directly in
    /// front of a quote, where `bytes = [bsqual] %x27 ...` claims them.
    fn scan_name_or_bytes(&mut self) -> Result<TokenKind, SyntaxError> {
        match self.peek() {
            Some('h') | Some('H') if self.peek_at(1) == Some('\'') => {
                self.bump();
                return self.scan_bytes(ByteQual::Hex);
            }
            Some('b') | Some('B')
                if self.peek_at(1) == Some('6')
                    && self.peek_at(2) == Some('4')
                    && self.peek_at(3) == Some('\'') =>
            {
                self.bump();
                self.bump();
                self.bump();
                return self.scan_bytes(ByteQual::Base64);
            }
            _ => {}
        }
        Ok(TokenKind::Ident(self.scan_id()))
    }

    /// `id = EALPHA *(*("-" / ".") (EALPHA / DIGIT))`.
    ///
    /// Each round consumes a run of `-` and `.` only when a letter or digit
    /// follows it, so a name never ends on a separator and `a.` leaves the
    /// dot behind for the scanner's next turn.
    fn scan_id(&mut self) -> String {
        let start = self.pos;
        self.bump();
        loop {
            let mark = self.mark();
            while matches!(self.peek(), Some('-') | Some('.')) {
                self.bump();
            }
            match self.peek() {
                Some(c) if is_ealpha(c) || c.is_ascii_digit() => {
                    self.bump();
                }
                _ => {
                    self.reset(mark);
                    return self.src[start..self.pos].to_owned();
                }
            }
        }
    }

    /// `number = hexfloat / (int ["." fraction] ["e" exponent])`.
    ///
    /// `fraction = 1*DIGIT`, so the dot belongs to the number only when a
    /// decimal digit follows it — which is what keeps `1..2` a range. An `e`
    /// the exponent does not complete is rewound: `1e` is the integer 1
    /// followed by the name `e`.
    fn scan_number(&mut self) -> Result<TokenKind, SyntaxError> {
        let start = self.mark();
        if self.scan_hexfloat() {
            return Ok(TokenKind::Number(NumberToken {
                text: self.src[start.pos..self.pos].to_owned(),
                is_float: true,
            }));
        }
        self.eat('-');
        if !self.scan_uint() {
            return Err(self.error_at(start, "expected a number"));
        }
        let mut is_float = false;
        if self.peek() == Some('.') && self.peek_at(1).is_some_and(|c| c.is_ascii_digit()) {
            self.bump();
            while self.peek().is_some_and(|c| c.is_ascii_digit()) {
                self.bump();
            }
            is_float = true;
        }
        if matches!(self.peek(), Some('e') | Some('E')) {
            let mark = self.mark();
            self.bump();
            if self.scan_exponent() {
                is_float = true;
            } else {
                self.reset(mark);
            }
        }
        Ok(TokenKind::Number(NumberToken {
            text: self.src[start.pos..self.pos].to_owned(),
            is_float,
        }))
    }

    /// `hexfloat = ["-"] "0x" 1*HEXDIG ["." 1*HEXDIG] "p" exponent`.
    ///
    /// Tried first, as the ordered choice in `number` has it, and rewound
    /// whole when it does not reach the `p`.
    fn scan_hexfloat(&mut self) -> bool {
        let start = self.mark();
        self.eat('-');
        if !(self.eat('0') && (self.eat('x') || self.eat('X'))) {
            self.reset(start);
            return false;
        }
        if self.take_while(|c| c.is_ascii_hexdigit()) == 0 {
            self.reset(start);
            return false;
        }
        if self.eat('.') && self.take_while(|c| c.is_ascii_hexdigit()) == 0 {
            self.reset(start);
            return false;
        }
        if !(self.eat('p') || self.eat('P')) {
            self.reset(start);
            return false;
        }
        if !self.scan_exponent() {
            self.reset(start);
            return false;
        }
        true
    }

    /// `uint = DIGIT1 *DIGIT / "0x" 1*HEXDIG / "0b" 1*BINDIG / "0"`.
    ///
    /// The ordered choice matters at the last two alternatives: `0x` with
    /// no hexadecimal digit behind it is not a malformed hexadecimal
    /// literal, it is the integer `0` followed by the name `x`.
    fn scan_uint(&mut self) -> bool {
        match self.peek() {
            Some('1'..='9') => {
                self.take_while(|c| c.is_ascii_digit());
                true
            }
            Some('0') => {
                match self.peek_at(1) {
                    Some('x') | Some('X')
                        if self.peek_at(2).is_some_and(|c| c.is_ascii_hexdigit()) =>
                    {
                        self.bump();
                        self.bump();
                        self.take_while(|c| c.is_ascii_hexdigit());
                    }
                    Some('b') | Some('B') if matches!(self.peek_at(2), Some('0') | Some('1')) => {
                        self.bump();
                        self.bump();
                        self.take_while(|c| matches!(c, '0' | '1'));
                    }
                    _ => {
                        self.bump();
                    }
                }
                true
            }
            _ => false,
        }
    }

    /// `exponent = ["+"/"-"] 1*DIGIT`.
    fn scan_exponent(&mut self) -> bool {
        let start = self.mark();
        if !self.eat('+') {
            self.eat('-');
        }
        if self.take_while(|c| c.is_ascii_digit()) == 0 {
            self.reset(start);
            return false;
        }
        true
    }

    fn take_while(&mut self, mut admits: impl FnMut(char) -> bool) -> usize {
        let mut taken = 0;
        while self.peek().is_some_and(&mut admits) {
            self.bump();
            taken += 1;
        }
        taken
    }
}

/// `EALPHA = ALPHA / "@" / "_" / "$"`.
fn is_ealpha(c: char) -> bool {
    matches!(c, 'A'..='Z' | 'a'..='z' | '@' | '_' | '$')
}

/// `PCHAR = %x20-7E / %x80-10FFFD`, which is also the class `SESC` admits
/// after its backslash.
fn is_pchar(c: char) -> bool {
    matches!(c, '\u{20}'..='\u{7e}' | '\u{80}'..='\u{10fffd}')
}

/// `SCHAR = %x20-21 / %x23-5B / %x5D-7E / %x80-10FFFD`, the escape
/// alternative handled separately.
fn is_schar(c: char) -> bool {
    matches!(c, '\u{20}'..='\u{21}' | '\u{23}'..='\u{5b}' | '\u{5d}'..='\u{7e}' | '\u{80}'..='\u{10fffd}')
}

/// `BCHAR = %x20-26 / %x28-5B / %x5D-10FFFD`, the escape and line-ending
/// alternatives handled separately.
fn is_bchar(c: char) -> bool {
    matches!(c, '\u{20}'..='\u{26}' | '\u{28}'..='\u{5b}' | '\u{5d}'..='\u{10fffd}')
}

/// A character as it should appear inside a refusal, with the invisible
/// ones named rather than printed.
fn quote_char(c: char) -> String {
    match c {
        '\t' => "a horizontal tab".to_owned(),
        '\r' => "a carriage return".to_owned(),
        '\n' => "a line feed".to_owned(),
        c if (c as u32) < 0x20 || c as u32 == 0x7f => format!("U+{:04X}", c as u32),
        c => format!("`{c}`"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(source: &str) -> Vec<TokenKind> {
        let mut kinds: Vec<TokenKind> = tokenize(source)
            .expect("source is CDDL")
            .into_iter()
            .map(|token| token.kind)
            .collect();
        assert_eq!(kinds.pop(), Some(TokenKind::Eof), "always ends at Eof");
        kinds
    }

    fn refuse(source: &str) -> SyntaxError {
        tokenize(source).expect_err("source is not CDDL")
    }

    fn ident(name: &str) -> TokenKind {
        TokenKind::Ident(name.to_owned())
    }

    fn int(text: &str) -> TokenKind {
        TokenKind::Number(NumberToken {
            text: text.to_owned(),
            is_float: false,
        })
    }

    fn float(text: &str) -> TokenKind {
        TokenKind::Number(NumberToken {
            text: text.to_owned(),
            is_float: true,
        })
    }

    #[test]
    fn empty_source_is_only_eof() {
        assert_eq!(kinds(""), []);
    }

    #[test]
    fn punctuation_takes_the_longest_match() {
        assert_eq!(
            kinds("= /= //= / // => [ ] { } ( ) < > , : * + ? & ~ ^"),
            [
                TokenKind::Assign,
                TokenKind::TypeChoiceAssign,
                TokenKind::GroupChoiceAssign,
                TokenKind::Slash,
                TokenKind::DoubleSlash,
                TokenKind::Arrow,
                TokenKind::LBracket,
                TokenKind::RBracket,
                TokenKind::LBrace,
                TokenKind::RBrace,
                TokenKind::LParen,
                TokenKind::RParen,
                TokenKind::Lt,
                TokenKind::Gt,
                TokenKind::Comma,
                TokenKind::Colon,
                TokenKind::Star,
                TokenKind::Plus,
                TokenKind::Question,
                TokenKind::Ampersand,
                TokenKind::Tilde,
                TokenKind::Caret,
            ]
        );
    }

    /// The reading RFC 8610 states in its comment on `type1`.
    #[test]
    fn names_swallow_interior_dots_and_hyphens() {
        assert_eq!(kinds("a.size"), [ident("a.size")]);
        assert_eq!(
            kinds("a .size"),
            [ident("a"), TokenKind::Control("size".to_owned())]
        );
        assert_eq!(kinds("normal-rating"), [ident("normal-rating")]);
        assert_eq!(kinds("a--b..c"), [ident("a--b..c")]);
    }

    /// `id` requires a letter or digit after every run of separators, so the
    /// trailing hyphen is not part of the name.
    #[test]
    fn a_name_never_ends_on_a_separator() {
        let error = refuse("a-");
        assert_eq!((error.line, error.column), (1, 2));
    }

    #[test]
    fn sockets_and_plugs_are_ordinary_names() {
        assert_eq!(kinds("$socket"), [ident("$socket")]);
        assert_eq!(kinds("$$group-socket"), [ident("$$group-socket")]);
        assert_eq!(kinds("$"), [ident("$")]);
        assert_eq!(kinds("$$"), [ident("$$")]);
        assert_eq!(kinds("@at _under"), [ident("@at"), ident("_under")]);
    }

    /// `fraction = 1*DIGIT`: the dot needs a digit behind it.
    #[test]
    fn a_range_is_not_a_float() {
        assert_eq!(
            kinds("1..2"),
            [int("1"), TokenKind::RangeInclusive, int("2")]
        );
        assert_eq!(
            kinds("1...2"),
            [int("1"), TokenKind::RangeExclusive, int("2")]
        );
        assert_eq!(
            kinds("1.5..2.5"),
            [float("1.5"), TokenKind::RangeInclusive, float("2.5")]
        );
    }

    /// The upper-case prefixes are read too, ABNF string literals being case
    /// insensitive.
    #[test]
    fn integers_in_every_base() {
        assert_eq!(kinds("0"), [int("0")]);
        assert_eq!(kinds("42"), [int("42")]);
        assert_eq!(kinds("-42"), [int("-42")]);
        assert_eq!(kinds("0x1f"), [int("0x1f")]);
        assert_eq!(kinds("0b1011"), [int("0b1011")]);
        assert_eq!(kinds("0X1F"), [int("0X1F")]);
        assert_eq!(kinds("0B01"), [int("0B01")]);
    }

    /// The ordered choice in `uint` falls through to `"0"`. And since
    /// `DIGIT1 *DIGIT` cannot start at 0, `01` is two numbers.
    #[test]
    fn a_prefix_without_digits_is_the_integer_zero_and_a_name() {
        assert_eq!(kinds("0x"), [int("0"), ident("x")]);
        assert_eq!(kinds("0bz"), [int("0"), ident("bz")]);
        assert_eq!(kinds("01"), [int("0"), int("1")]);
    }

    #[test]
    fn floats_carry_fractions_and_exponents() {
        assert_eq!(kinds("1.5"), [float("1.5")]);
        assert_eq!(kinds("1e5"), [float("1e5")]);
        assert_eq!(kinds("1E5"), [float("1E5")]);
        assert_eq!(kinds("1.5e-3"), [float("1.5e-3")]);
        assert_eq!(kinds("-1.5e+3"), [float("-1.5e+3")]);
        assert_eq!(kinds("0.0"), [float("0.0")]);
    }

    #[test]
    fn an_exponent_without_digits_is_a_name() {
        assert_eq!(kinds("1e"), [int("1"), ident("e")]);
        assert_eq!(kinds("1e+"), [int("1"), ident("e"), TokenKind::Plus]);
    }

    /// Without the `p` the hexfloat alternative fails and the integer
    /// alternative takes `0x1`, leaving the name `p` behind. And `e` is a
    /// hexadecimal digit, so the digits swallow it rather than reading an
    /// exponent.
    #[test]
    fn hexadecimal_floats_need_their_exponent() {
        assert_eq!(kinds("0x1p3"), [float("0x1p3")]);
        assert_eq!(kinds("0x1.8p3"), [float("0x1.8p3")]);
        assert_eq!(kinds("-0xa.bP-2"), [float("-0xa.bP-2")]);
        assert_eq!(kinds("0x1p"), [int("0x1"), ident("p")]);
        assert_eq!(kinds("0x1e5"), [int("0x1e5")]);
    }

    /// An escape the lexer does not recognize is still an escape: SESC names a
    /// character class, not a list of letters.
    #[test]
    fn text_literals_keep_their_escapes() {
        assert_eq!(kinds(r#""hi""#), [TokenKind::Text("hi".to_owned())]);
        assert_eq!(kinds(r#""""#), [TokenKind::Text(String::new())]);
        assert_eq!(kinds(r#""a\"b""#), [TokenKind::Text(r#"a\"b"#.to_owned())]);
        assert_eq!(kinds(r#""a\\b""#), [TokenKind::Text(r"a\\b".to_owned())]);
        assert_eq!(kinds(r#""\q""#), [TokenKind::Text(r"\q".to_owned())]);
        assert_eq!(kinds("\"\u{e4}\""), [TokenKind::Text("\u{e4}".to_owned())]);
    }

    /// The qualifiers are case insensitive, per the preamble to Appendix B.
    #[test]
    fn byte_strings_in_all_three_qualifications() {
        assert_eq!(
            kinds("'abc'"),
            [TokenKind::Bytes {
                qual: ByteQual::None,
                raw: "abc".to_owned()
            }]
        );
        assert_eq!(
            kinds("h'0f0f'"),
            [TokenKind::Bytes {
                qual: ByteQual::Hex,
                raw: "0f0f".to_owned()
            }]
        );
        assert_eq!(
            kinds("b64'aGVsbG8='"),
            [TokenKind::Bytes {
                qual: ByteQual::Base64,
                raw: "aGVsbG8=".to_owned()
            }]
        );
        assert_eq!(
            kinds("H'ff'"),
            [TokenKind::Bytes {
                qual: ByteQual::Hex,
                raw: "ff".to_owned()
            }]
        );
    }

    #[test]
    fn a_qualifier_away_from_a_quote_is_a_name() {
        assert_eq!(kinds("h"), [ident("h")]);
        assert_eq!(kinds("b64"), [ident("b64")]);
        assert_eq!(
            kinds("h 'ff'"),
            [
                ident("h"),
                TokenKind::Bytes {
                    qual: ByteQual::None,
                    raw: "ff".to_owned()
                }
            ]
        );
    }

    /// BCHAR admits CRLF where SCHAR does not, and the line count survives the
    /// literal.
    #[test]
    fn byte_strings_may_span_lines() {
        let tokens = tokenize("'a\nb'").expect("BCHAR admits a line feed");
        assert_eq!(
            tokens[0].kind,
            TokenKind::Bytes {
                qual: ByteQual::None,
                raw: "a\nb".to_owned()
            }
        );
        assert_eq!(tokens[1].span.line, 2);
    }

    /// Without a digit behind the dot the head ends and a control operator
    /// begins.
    #[test]
    fn representation_type_heads_are_scanned_whole() {
        assert_eq!(
            kinds("#"),
            [TokenKind::Hash {
                major: None,
                ai: None
            }]
        );
        assert_eq!(
            kinds("#6"),
            [TokenKind::Hash {
                major: Some(6),
                ai: None
            }]
        );
        assert_eq!(
            kinds("#7.25"),
            [TokenKind::Hash {
                major: Some(7),
                ai: Some("25".to_owned())
            }]
        );
        assert_eq!(
            kinds("#6.0x18"),
            [TokenKind::Hash {
                major: Some(6),
                ai: Some("0x18".to_owned())
            }]
        );
        assert_eq!(
            kinds("#6 .size"),
            [
                TokenKind::Hash {
                    major: Some(6),
                    ai: None
                },
                TokenKind::Control("size".to_owned())
            ]
        );
    }

    /// The ABNF ends COMMENT at a CRLF; the scanner also lets the end of the
    /// source end it.
    #[test]
    fn comments_run_to_the_line_ending() {
        assert_eq!(kinds("a ; comment\nb"), [ident("a"), ident("b")]);
        assert_eq!(kinds("; only a comment\n"), []);
        assert_eq!(kinds("a ; trailing"), [ident("a")]);
        assert_eq!(kinds("; trailing"), []);
    }

    #[test]
    fn line_endings_of_both_shapes_advance_the_line() {
        let tokens = tokenize("a\r\nb\nc").expect("CRLF and LF are both line endings");
        assert_eq!(tokens[0].span.line, 1);
        assert_eq!(tokens[1].span.line, 2);
        assert_eq!(tokens[2].span.line, 3);
    }

    #[test]
    fn columns_count_characters_and_not_bytes() {
        let tokens = tokenize("\"\u{e4}\u{e4}\" a").expect("source is CDDL");
        assert_eq!((tokens[1].span.line, tokens[1].span.column), (1, 6));
    }

    #[test]
    fn refuses_an_unterminated_text_literal_at_its_opening_quote() {
        let error = refuse("a = \"open");
        assert_eq!((error.line, error.column), (1, 5));
        assert!(error.detail.contains("unterminated text"));
    }

    #[test]
    fn refuses_an_unterminated_byte_string_at_its_opening_quote() {
        let error = refuse("a = h'ff");
        assert_eq!((error.line, error.column), (1, 6));
        assert!(error.detail.contains("unterminated byte-string"));
    }

    /// SCHAR excludes the control characters.
    #[test]
    fn refuses_a_line_ending_inside_a_text_literal() {
        let error = refuse("\"a\nb\"");
        assert_eq!((error.line, error.column), (1, 3));
    }

    #[test]
    fn refuses_an_escape_at_the_end_of_the_input() {
        let error = refuse("\"a\\");
        assert_eq!((error.line, error.column), (1, 3));
    }

    #[test]
    fn refuses_an_escaped_control_character() {
        let error = refuse("\"a\\\u{7f}\"");
        assert!(error.detail.contains("SESC"));
    }

    #[test]
    fn refuses_a_tab_because_whitespace_is_the_space_character() {
        let error = refuse("a\t= 1");
        assert_eq!((error.line, error.column), (1, 2));
        assert!(error.detail.contains("horizontal tab"));
    }

    #[test]
    fn refuses_a_tab_in_a_comment_because_pchar_excludes_it() {
        let error = refuse("; a\tb\n");
        assert!(error.detail.contains("comment"));
    }

    #[test]
    fn refuses_a_lone_carriage_return() {
        let error = refuse("a\rb");
        assert!(error.detail.contains("carriage return"));
    }

    #[test]
    fn refuses_a_dot_that_begins_nothing() {
        let error = refuse("a . 1");
        assert_eq!((error.line, error.column), (1, 3));
        assert!(error.detail.contains("control-operator"));
    }

    #[test]
    fn refuses_a_hyphen_that_begins_no_number() {
        let error = refuse("- a");
        assert_eq!((error.line, error.column), (1, 1));
    }

    #[test]
    fn refuses_a_character_outside_the_grammar() {
        let error = refuse("a = !");
        assert_eq!((error.line, error.column), (1, 5));
        assert!(error.detail.contains("unexpected character"));
    }

    #[test]
    fn spans_slice_the_source_they_came_from() {
        let source = "reputation-object = { a: 1 }";
        for token in tokenize(source).expect("source is CDDL") {
            assert!(source.is_char_boundary(token.span.start));
            assert!(source.is_char_boundary(token.span.end));
        }
    }

    #[test]
    fn a_span_reaches_from_one_node_to_another() {
        let tokens = tokenize("a = 1").expect("source is CDDL");
        let whole = tokens[0].span.to(tokens[2].span);
        assert_eq!(&"a = 1"[whole.start..whole.end], "a = 1");
        assert_eq!((whole.line, whole.column), (1, 1));
    }
}
