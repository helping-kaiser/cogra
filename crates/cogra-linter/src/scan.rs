//! The label grammar: labels, the three occurrence forms of both concrete
//! syntaxes, and the near-miss warnings the calculus asks for.
//!
//! This module implements the label language of
//! (´[LBL-lang:labels:label-language]´) and nothing else. It reads region text
//! and returns occurrences; it knows nothing of files, owners, or the graph,
//! and it names no type of the adoption, carrier, or graph modules — the
//! independence the module map draws (´rem:lint:split-lines´).
//!
//! # Coordinates
//!
//! A region's text is logical text with the source's own structure resolved
//! away, so a region is not a run of file bytes (´[LBL-gram:labels:well-formed]´).
//! Every offset handed *in* — the `outer` and `interior` of a
//! [`DelimitedSpan`] — is an index into `text`; every span handed *back* is in
//! whole-file coordinates, `base` plus the region-local offset. The one
//! exception is [`LabelSyntax::at`], which locates a failure inside the string
//! that was parsed, because that string is the subject of the parse and not a
//! position in a file.
//!
//! # Two doors
//!
//! Prose and code enter by different functions because the two delimiter
//! regimes differ in kind (´dec:lint:two-scan-entries´): in prose the format
//! owns the backtick and the frontend has already paired it, so
//! [`scan_prose`] never counts one; in scanned code text the acute belongs to
//! the label syntax and classifies locally, so [`scan_code`] pairs it itself.

use core::fmt;
use core::str::FromStr;

use crate::diag::ByteSpan;

/// The acute accent, U+00B4: the delimiter of the code syntax.
const ACUTE: &str = "´";

/// A registered owner prefix: an uppercase letter followed by uppercase
/// letters and digits (´[LBL-lang:labels:label-language]´).
///
/// ```
/// use cogra_linter::scan::Prefix;
///
/// assert_eq!(Prefix::parse("LBL").map(|p| p.to_string()).as_deref(), Some("LBL"));
/// assert!(Prefix::parse("Lbl").is_none());
/// assert!(Prefix::parse("1BL").is_none());
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Prefix(Box<str>);

impl Prefix {
    /// Parse a prefix. `None` means the text is not prefix-shaped, which the
    /// scanner reads as "this span is not an imported citation" and never as a
    /// failure.
    ///
    /// The answer is an `Option` rather than a `Result` because the prefix
    /// alphabet is outside [`Expectation`], whose four states describe a
    /// label's parse: a prefix defect surfaces as
    /// [`NearMissKind::MisplacedBracket`], which carries no position.
    #[must_use]
    pub fn parse(s: &str) -> Option<Prefix> {
        let bytes = s.as_bytes();
        let mut i = 0;
        if !matches!(bytes.first(), Some(b) if b.is_ascii_uppercase()) {
            return None;
        }
        i += 1;
        while i < bytes.len() && (bytes[i].is_ascii_uppercase() || bytes[i].is_ascii_digit()) {
            i += 1;
        }
        if i == bytes.len() {
            Some(Prefix(s.into()))
        } else {
            None
        }
    }

    /// The prefix as it is written.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Prefix {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// What the label parser wanted where it stopped.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Expectation {
    /// A word character, `[a-z0-9]`: at the start of the kind, of the area, or
    /// of a name word after a hyphen.
    WordChar,
    /// The colon closing the kind or the area.
    Colon,
    /// Inside the name, after a complete word: either a hyphen opening the
    /// next word or a further word character.
    HyphenOrWordChar,
    /// The label was complete and the input was not: a third colon is the
    /// characteristic case, the author having written a fourth field.
    EndOfLabel,
}

/// Why a span is not a label. Never a diagnostic by itself: a delimited span
/// that parses as no form is ordinary text (´[LBL-gram:labels:well-formed]´).
///
/// Surfacing a `LabelSyntax` as a finding is a defect. It is public so that a
/// [`NearMiss`] can say how far the parse got, which is the whole of how the
/// warnings of (´sig:lint:near-miss-api´) are derived — the scanner's own
/// failure position, never a second pass looking for patterns.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LabelSyntax {
    /// The byte offset, within the parsed string, where the parse stopped.
    pub at: usize,
    /// What was wanted there.
    pub expected: Expectation,
}

/// A label: a colon-joined triple of kind, area, and name
/// (´[LBL-lang:labels:label-language]´).
///
/// Held as its rendered text, so the derived `Ord` is the bytewise order every
/// generated register and every diagnostic sequence is fixed to
/// (´prop:lint:label-order´). The two offsets follow the text in declaration
/// order and are functions of it, so they never decide a comparison.
///
/// ```
/// use cogra_linter::scan::Label;
///
/// let l: Label = "sec:labels:syntax".parse().expect("well-formed");
/// assert_eq!((l.kind(), l.area(), l.name()), ("sec", "labels", "syntax"));
///
/// let a: Label = "a1:x:y".parse().expect("well-formed");
/// let b: Label = "a:x:y".parse().expect("well-formed");
/// assert!(a < b);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Label {
    text: Box<str>,
    kind_end: u32,
    area_end: u32,
}

impl Label {
    /// Parse a label. `Err` means the text is not label-shaped, which the
    /// scanner reads as "this span is ordinary text" and never as a failure
    /// (´[LBL-gram:labels:well-formed]´).
    ///
    /// ```
    /// use cogra_linter::scan::{Expectation, Label};
    ///
    /// assert!(Label::parse("inf:labels:mint").is_ok());
    /// assert_eq!(Label::parse("a:b:c:d").map_err(|e| (e.at, e.expected)),
    ///            Err((5, Expectation::EndOfLabel)));
    /// ```
    pub fn parse(s: &str) -> Result<Label, LabelSyntax> {
        let bytes = s.as_bytes();
        let kind_end = word(bytes, 0)?;
        if bytes.get(kind_end) != Some(&b':') {
            return Err(LabelSyntax {
                at: kind_end,
                expected: Expectation::Colon,
            });
        }
        let area_end = word(bytes, kind_end + 1)?;
        if bytes.get(area_end) != Some(&b':') {
            return Err(LabelSyntax {
                at: area_end,
                expected: Expectation::Colon,
            });
        }
        let mut i = word(bytes, area_end + 1)?;
        while i < bytes.len() {
            match bytes[i] {
                b'-' => i = word(bytes, i + 1)?,
                b':' => {
                    return Err(LabelSyntax {
                        at: i,
                        expected: Expectation::EndOfLabel,
                    });
                }
                _ => {
                    return Err(LabelSyntax {
                        at: i,
                        expected: Expectation::HyphenOrWordChar,
                    });
                }
            }
        }
        let (Ok(kind_end), Ok(area_end)) = (u32::try_from(kind_end), u32::try_from(area_end))
        else {
            return Err(LabelSyntax {
                at: s.len(),
                expected: Expectation::EndOfLabel,
            });
        };
        Ok(Label {
            text: s.into(),
            kind_end,
            area_end,
        })
    }

    /// The kind word.
    #[must_use]
    pub fn kind(&self) -> &str {
        &self.text[..self.kind_end as usize]
    }

    /// The area word.
    #[must_use]
    pub fn area(&self) -> &str {
        &self.text[self.kind_end as usize + 1..self.area_end as usize]
    }

    /// The name: one word, or hyphenated words.
    #[must_use]
    pub fn name(&self) -> &str {
        &self.text[self.area_end as usize + 1..]
    }

    /// The rendered triple, which is what `Ord` compares.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl FromStr for Label {
    type Err = LabelSyntax;

    fn from_str(s: &str) -> Result<Label, LabelSyntax> {
        Label::parse(s)
    }
}

impl fmt::Display for Label {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.text)
    }
}

/// Consume one word, `[a-z0-9]+`, returning the offset just past it.
///
/// Only ASCII bytes are consumed, so every offset this returns — and every
/// offset it fails at — is a character boundary of the original string.
fn word(bytes: &[u8], start: usize) -> Result<usize, LabelSyntax> {
    let mut i = start;
    while i < bytes.len() && is_word_byte(bytes[i]) {
        i += 1;
    }
    if i == start {
        Err(LabelSyntax {
            at: start,
            expected: Expectation::WordChar,
        })
    } else {
        Ok(i)
    }
}

fn is_word_byte(b: u8) -> bool {
    b.is_ascii_lowercase() || b.is_ascii_digit()
}

/// The three occurrence forms of (´[LBL-lang:labels:label-language]´), each
/// carrying the span of the whole occurrence — delimiters, brackets, and
/// parentheses included.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Occurrence {
    /// A bare occurrence: the mint form.
    Mint {
        /// The minted label.
        label: Label,
        /// The whole occurrence, delimiters included.
        span: ByteSpan,
    },
    /// A parenthesized bare occurrence: the same-owner citation form.
    SameOwner {
        /// The cited label.
        label: Label,
        /// The whole occurrence, parentheses included.
        span: ByteSpan,
    },
    /// A parenthesized bracketed occurrence: the imported citation form.
    Imported {
        /// The prefix naming the cited owner.
        prefix: Prefix,
        /// The cited label.
        label: Label,
        /// The whole occurrence, parentheses and brackets included.
        span: ByteSpan,
    },
}

impl Occurrence {
    /// The label this occurrence carries, whichever form it takes.
    #[must_use]
    pub fn label(&self) -> &Label {
        match self {
            Occurrence::Mint { label, .. }
            | Occurrence::SameOwner { label, .. }
            | Occurrence::Imported { label, .. } => label,
        }
    }

    /// The whole occurrence's span, in whole-file coordinates.
    #[must_use]
    pub fn span(&self) -> ByteSpan {
        match self {
            Occurrence::Mint { span, .. }
            | Occurrence::SameOwner { span, .. }
            | Occurrence::Imported { span, .. } => *span,
        }
    }
}

/// Which concrete syntax a region carries.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Syntax {
    /// The backtick syntax of prose.
    Prose,
    /// The acute syntax of scanned code text.
    Code,
}

/// A delimited span the prose frontend has already classified: the format owns
/// the backtick, so the frontend decides pairing and run length
/// (´[ARCH-conv:linter:markdown-frontend]´).
///
/// Both spans index the region text handed to [`scan_prose`], and `interior`
/// lies within `outer`. A `displayed` span is material shown but not meant, so
/// it participates in nothing (´[LBL-judg:labels:participation]´) — the
/// scanner reads neither an occurrence nor a near-miss out of one.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct DelimitedSpan {
    /// The span with its delimiters.
    pub outer: ByteSpan,
    /// The span between its delimiters.
    pub interior: ByteSpan,
    /// Whether the format displays the span rather than meaning it: a
    /// double-backtick span in this corpus's prose.
    pub displayed: bool,
}

/// A span the author probably meant as an occurrence.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NearMiss {
    /// The whole span warned about, in whole-file coordinates.
    pub span: ByteSpan,
    /// How it missed.
    pub why: NearMissKind,
}

/// The near-miss classes of (´sig:lint:near-miss-api´). Every position they
/// carry is a whole-file offset, and every one of them is derived from the
/// scanner's own failure position rather than from a second pattern pass.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum NearMissKind {
    /// A label-shaped interior whose only defect is casing.
    WrongCase {
        /// Where the parse stopped, which is the first miscased byte.
        at: usize,
    },
    /// Interior whitespace inside the delimiters.
    InteriorSpacing {
        /// Where the parse stopped, which is the offending space.
        at: usize,
    },
    /// A bracketed interior outside any parenthesis, or a parenthesized
    /// bracketed interior whose bracket is malformed.
    MisplacedBracket,
    /// In scanned code text, a label-shaped backtick span where the acute was
    /// meant.
    BacktickInCode,
    /// Several label-shaped spans inside one parenthesis, which is no citation
    /// form at all.
    SeveralToOneParenthesis {
        /// How many label-shaped spans the parenthesis directly holds.
        count: usize,
    },
}

/// Which delimiter a region's one delimiter failure belongs to.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Delimiter {
    /// The backtick of the prose syntax, whose pairing belongs to the format
    /// and therefore to the frontend.
    Backtick,
    /// The acute of the code syntax, whose pairing belongs to the scanner.
    Acute,
}

/// A region's one delimiter failure: an opening acute the region ends without
/// closing (´[LBL-judg:labels:participation]´).
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct DelimiterFailure {
    /// The opening delimiter, in whole-file coordinates.
    pub at: usize,
    /// Which delimiter it is.
    pub delimiter: Delimiter,
}

/// What one region yields.
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct RegionScan {
    /// The occurrences, in the order they occur.
    pub occurrences: Vec<Occurrence>,
    /// The near-misses, ordered by span.
    pub near_misses: Vec<NearMiss>,
    /// At most one: a delimiter failure ends the region's spans.
    ///
    /// Only [`scan_code`] ever fills this. In prose the failure is the
    /// frontend's, and the [`DelimitedSpan`] contract is how it is expressed:
    /// an unpaired backtick leaves its block's spans undefined, so the
    /// frontend supplies no span for the undefined stretch and the scanner is
    /// structurally unable to read an occurrence out of it.
    pub delimiter_failure: Option<DelimiterFailure>,
}

/// Prose: the frontend supplies the format's own code spans, in order.
///
/// ```
/// use cogra_linter::ByteSpan;
/// use cogra_linter::scan::{DelimitedSpan, Occurrence, scan_prose};
///
/// let text = "as (`inv:labels:unique-mint`) has it";
/// let spans = [DelimitedSpan {
///     outer: ByteSpan { start: 4, end: 28 },
///     interior: ByteSpan { start: 5, end: 27 },
///     displayed: false,
/// }];
/// let scan = scan_prose(text, 100, &spans);
/// assert!(matches!(scan.occurrences[0], Occurrence::SameOwner { .. }));
/// assert_eq!(scan.occurrences[0].span(), ByteSpan { start: 103, end: 129 });
/// ```
#[must_use]
pub fn scan_prose(text: &str, base: usize, spans: &[DelimitedSpan]) -> RegionScan {
    let mut scan = RegionScan::default();
    let mut shaped = Vec::new();
    let mut delimited = Vec::new();
    for span in spans {
        if !well_formed(text, span) {
            continue;
        }
        delimited.push(span.outer);
        if span.displayed {
            continue;
        }
        read_span(
            text,
            base,
            span.outer,
            span.interior,
            &mut scan,
            &mut shaped,
        );
    }
    delimited.sort_unstable();
    shaped.sort_unstable();
    several_to_one(
        text,
        base,
        text.len(),
        &shaped,
        &delimited,
        &mut scan.near_misses,
    );
    scan.near_misses
        .sort_unstable_by_key(|miss| (miss.span.start, miss.span.end));
    scan
}

/// Code: the acute belongs to the label syntax and classifies locally, so the
/// scanner does its own pairing (´[LBL-judg:labels:participation]´).
///
/// # One pass, and the backtick is not in it
///
/// The acute pass is the whole of the reading. The backtick carries no
/// pairing authority here — the calculus gives the acute the local
/// classification, and a delimiter with no authority may not decide what a
/// stretch of code text means, least of all by consuming it. The backtick's
/// own warning is therefore *derived*: after the acutes are read, the text
/// they did not consume is the residue, and a label-shaped backtick span
/// found there can only be the acute written wrongly
/// (´sig:lint:near-miss-api´).
///
/// ```
/// use cogra_linter::scan::{Occurrence, scan_code};
///
/// let scan = scan_code("mints ´def:parser:tokenizer´ here", 0);
/// assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
/// assert_eq!(scan.occurrences[0].label().name(), "tokenizer");
///
/// let stray = scan_code("it isn´t an occurrence", 0);
/// assert!(stray.occurrences.is_empty() && stray.delimiter_failure.is_none());
///
/// // A backtick span neither hides the occurrence nor pairs across it.
/// let both = scan_code("the `Foo type and ´def:x:mint´ then `Bar`", 0);
/// assert_eq!(both.occurrences.len(), 1);
/// ```
#[must_use]
pub fn scan_code(text: &str, base: usize) -> RegionScan {
    let bytes = text.as_bytes();
    let mut scan = RegionScan::default();
    let mut shaped = Vec::new();
    let mut delimited = Vec::new();
    let mut consumed: Vec<ByteSpan> = Vec::new();
    let mut i = 0;
    let mut limit = bytes.len();
    while i < bytes.len() {
        if !is_acute(bytes, i) {
            i += 1;
            continue;
        }
        let after = i + ACUTE.len();
        if !opens(text, after) {
            spacing_look(text, base, i, after, &mut scan.near_misses);
            i = after;
            continue;
        }
        let Some(close) = find_acute(bytes, after) else {
            scan.delimiter_failure = Some(DelimiterFailure {
                at: base + i,
                delimiter: Delimiter::Acute,
            });
            limit = i;
            break;
        };
        let outer = ByteSpan {
            start: i,
            end: close + ACUTE.len(),
        };
        let interior = ByteSpan {
            start: after,
            end: close,
        };
        delimited.push(outer);
        consumed.push(outer);
        read_span(text, base, outer, interior, &mut scan, &mut shaped);
        i = outer.end;
    }
    residue_backticks(
        text,
        base,
        limit,
        &consumed,
        &mut scan.near_misses,
        &mut shaped,
        &mut delimited,
    );
    delimited.sort_unstable();
    shaped.sort_unstable();
    several_to_one(
        text,
        base,
        limit,
        &shaped,
        &delimited,
        &mut scan.near_misses,
    );
    scan.near_misses
        .sort_unstable_by_key(|miss| (miss.span.start, miss.span.end));
    scan
}

/// The backtick's near-miss, read out of the text the acute pass left.
///
/// `consumed` is the acute spans in increasing order, and the stretches
/// between them are the residue. Pairing is per stretch, which needs no rule
/// of its own: no label-shaped span straddles an acute span, the acute being
/// no byte of the label alphabet, so a pair that would have to reach across
/// one was never a candidate.
///
/// A delimiter failure ends the region's spans, so the residue ends at
/// `limit` with everything else.
fn residue_backticks(
    text: &str,
    base: usize,
    limit: usize,
    consumed: &[ByteSpan],
    out: &mut Vec<NearMiss>,
    shaped: &mut Vec<ByteSpan>,
    delimited: &mut Vec<ByteSpan>,
) {
    let end = limit.min(text.len());
    let mut from = 0;
    for span in consumed {
        if span.start > from {
            one_stretch(
                text,
                base,
                from,
                span.start.min(end),
                out,
                shaped,
                delimited,
            );
        }
        from = span.end;
    }
    if from < end {
        one_stretch(text, base, from, end, out, shaped, delimited);
    }
}

/// One residue stretch, its backticks paired left to right within it.
fn one_stretch(
    text: &str,
    base: usize,
    from: usize,
    to: usize,
    out: &mut Vec<NearMiss>,
    shaped: &mut Vec<ByteSpan>,
    delimited: &mut Vec<ByteSpan>,
) {
    let Some(bounded) = text.as_bytes().get(..to) else {
        return;
    };
    let mut i = from;
    while i < to {
        if bounded[i] != b'`' {
            i += 1;
            continue;
        }
        let Some(close) = find_byte(bounded, i + 1, b'`') else {
            return;
        };
        let outer = ByteSpan {
            start: i,
            end: close + 1,
        };
        delimited.push(outer);
        if classify(&text[i + 1..close]).is_ok() {
            shaped.push(outer);
            let (span, _) = with_parentheses(text, outer);
            out.push(NearMiss {
                span: shift(span, base),
                why: NearMissKind::BacktickInCode,
            });
        }
        i = outer.end;
    }
}

/// How far past an acute that opened nothing to look for a closer, in bytes.
///
/// The bound is what keeps the look a look and not a second scan: an
/// interior a label would fit in is short, and this is far longer than the
/// longest this corpus writes.
const SPACING_LOOKAHEAD: usize = 96;

/// The interior-spacing warning an acute that opened nothing still earns.
///
/// [`opens`] deliberately keeps whitespace out of the run it tests, so an
/// interior a space has squeezed apart opens no span at all:
///
/// ```text
/// ´def: fx:spaced´
/// ```
///
/// Without this look the warning (´[LBL-inv:labels:total-resolution]´) asks
/// for would be unreachable in scanned code text.
///
/// The look does not reintroduce what [`opens`] guards against, because that
/// rationale is about *consumption*: admitting whitespace into the run would
/// let an apostrophe accident open a span and swallow the real occurrence
/// after it. This emits a warning and nothing else — no delimited span, no
/// entry in the shaped or delimited sets, and no advance of the scan past
/// the acute that failed — so the closing acute it looked at is examined on
/// its own turn exactly as if the look had never happened.
fn spacing_look(text: &str, base: usize, at: usize, after: usize, out: &mut Vec<NearMiss>) {
    let window = text.len().min(after + SPACING_LOOKAHEAD);
    let Some(bounded) = text.as_bytes().get(..window) else {
        return;
    };
    let Some(close) = find_acute(bounded, after) else {
        return;
    };
    let inner = &text[after..close];
    let Err(defect) = classify(inner) else {
        return;
    };
    if let Some(why @ NearMissKind::InteriorSpacing { .. }) =
        near_miss(inner, &defect, base + after)
    {
        out.push(NearMiss {
            span: shift(
                ByteSpan {
                    start: at,
                    end: close + ACUTE.len(),
                },
                base,
            ),
            why,
        });
    }
}

/// What a delimited span's interior is, when it is anything.
enum Interior {
    Bare(Label),
    Bracketed { prefix: Prefix, label: Label },
}

/// Why an interior is neither form.
enum Defect {
    /// The interior is bracket-shaped and the bracketing is wrong: an unclosed
    /// bracket, an unregistrable prefix, a nested form, a defective label.
    Bracket,
    /// The interior is not bracket-shaped and is not a label.
    NotLabel(LabelSyntax),
}

/// Classify one interior against the two interior shapes of the grammar.
///
/// Nesting needs no rule of its own: a nested form puts a bracket inside the
/// label, and no bracket is a word byte (´[LBL-gram:labels:well-formed]´).
fn classify(interior: &str) -> Result<Interior, Defect> {
    if interior.starts_with('[') || interior.ends_with(']') {
        let inner = interior
            .strip_prefix('[')
            .and_then(|rest| rest.strip_suffix(']'))
            .ok_or(Defect::Bracket)?;
        let (prefix, label) = inner.split_once('-').ok_or(Defect::Bracket)?;
        let prefix = Prefix::parse(prefix).ok_or(Defect::Bracket)?;
        let label = Label::parse(label).map_err(|_| Defect::Bracket)?;
        Ok(Interior::Bracketed { prefix, label })
    } else {
        Label::parse(interior)
            .map(Interior::Bare)
            .map_err(Defect::NotLabel)
    }
}

/// Read one delimited span: an occurrence, a near-miss, or ordinary text.
///
/// The parenthesis immediately around the span decides the form, and nothing
/// further out does: an occurrence is the delimited span with at most one pair
/// of parentheses, and text beyond it is text — which is what lets a citation
/// close a parenthetical remark.
fn read_span(
    text: &str,
    base: usize,
    outer: ByteSpan,
    interior: ByteSpan,
    scan: &mut RegionScan,
    shaped: &mut Vec<ByteSpan>,
) {
    let inner = &text[interior.start..interior.end];
    let (whole, parenthesized) = with_parentheses(text, outer);
    let span = shift(whole, base);
    match classify(inner) {
        Ok(Interior::Bare(label)) => {
            shaped.push(outer);
            scan.occurrences.push(if parenthesized {
                Occurrence::SameOwner { label, span }
            } else {
                Occurrence::Mint { label, span }
            });
        }
        Ok(Interior::Bracketed { prefix, label }) => {
            shaped.push(outer);
            if parenthesized {
                scan.occurrences.push(Occurrence::Imported {
                    prefix,
                    label,
                    span,
                });
            } else {
                scan.near_misses.push(NearMiss {
                    span,
                    why: NearMissKind::MisplacedBracket,
                });
            }
        }
        Err(defect) => {
            if let Some(why) = near_miss(inner, &defect, base + interior.start) {
                scan.near_misses.push(NearMiss { span, why });
            }
        }
    }
}

/// Classify a failed interior, from the position the parse stopped at.
///
/// Spacing is tried before casing because casing is the narrower claim: a
/// [`NearMissKind::WrongCase`] is an interior whose *only* defect is casing,
/// so an interior carrying whitespace as well is the spacing warning — which
/// is why the spacing test folds case, an interior defective both ways having
/// to land somewhere and the wider warning being the spacing one.
///
/// A malformed bracket warns only where the interior is reaching for a
/// label, and the label's own alphabet is the test: every byte drawn from
/// it — whitespace admitted, since spacing is itself one of the defects
/// warned about — and at least one colon, its separator. The calculus asks
/// for warnings on "label-shaped interiors with wrong casing, brackets, or
/// spacing" (´[LBL-inv:labels:total-resolution]´), and a delimited span that
/// parses as no form is text and never a failure
/// (´[LBL-gram:labels:well-formed]´); a span holding a byte no label holds,
/// or holding no separator at all, is therefore text. Both cases are
/// everywhere in this corpus — a code span naming an adoption-data table is
/// written `[carrier]`, and a Rust attribute is written `#[sqlx::test]` —
/// and warning on those would make the checker unusable on the documents
/// that specify it.
fn near_miss(interior: &str, defect: &Defect, at: usize) -> Option<NearMissKind> {
    let syntax = match defect {
        Defect::Bracket => {
            let alphabet = interior
                .bytes()
                .all(|b| is_interior_byte(b) || b.is_ascii_whitespace());
            let shaped = alphabet && interior.bytes().any(|b| b == b':');
            return shaped.then_some(NearMissKind::MisplacedBracket);
        }
        Defect::NotLabel(syntax) => syntax,
    };
    if interior.bytes().any(|b| b.is_ascii_whitespace()) {
        let squeezed: String = interior.chars().filter(|c| !c.is_whitespace()).collect();
        if classify(&squeezed).is_ok() || classify(&squeezed.to_ascii_lowercase()).is_ok() {
            return Some(NearMissKind::InteriorSpacing { at: at + syntax.at });
        }
        return None;
    }
    classify(&interior.to_ascii_lowercase())
        .is_ok()
        .then_some(NearMissKind::WrongCase { at: at + syntax.at })
}

/// The whole occurrence span, and whether a parenthesis pair encloses the
/// delimited span immediately.
fn with_parentheses(text: &str, outer: ByteSpan) -> (ByteSpan, bool) {
    let before = text
        .get(..outer.start)
        .is_some_and(|head| head.ends_with('('));
    let after = text
        .get(outer.end..)
        .is_some_and(|tail| tail.starts_with(')'));
    if before && after {
        (
            ByteSpan {
                start: outer.start - 1,
                end: outer.end + 1,
            },
            true,
        )
    } else {
        (outer, false)
    }
}

fn shift(span: ByteSpan, base: usize) -> ByteSpan {
    ByteSpan {
        start: base + span.start,
        end: base + span.end,
    }
}

/// Warn where one parenthesis directly holds several label-shaped spans, which
/// is no citation form at all.
///
/// The walk is iterative and keeps one frame per open parenthesis, so a region
/// of arbitrary depth costs memory and never the stack. A span is attributed
/// to the innermost parenthesis open at its start, and a delimited span's own
/// bytes are skipped, so a parenthesis inside a code span disturbs nothing.
fn several_to_one(
    text: &str,
    base: usize,
    limit: usize,
    shaped: &[ByteSpan],
    delimited: &[ByteSpan],
    out: &mut Vec<NearMiss>,
) {
    let bytes = text.as_bytes();
    let end = limit.min(bytes.len());
    let mut stack: Vec<(usize, usize)> = Vec::new();
    let mut next_delimited = 0;
    let mut next_shaped = 0;
    let mut i = 0;
    while i < end {
        while next_delimited < delimited.len() && delimited[next_delimited].start < i {
            next_delimited += 1;
        }
        if next_delimited < delimited.len() && delimited[next_delimited].start == i {
            while next_shaped < shaped.len() && shaped[next_shaped].start < i {
                next_shaped += 1;
            }
            if next_shaped < shaped.len()
                && shaped[next_shaped].start == i
                && let Some(frame) = stack.last_mut()
            {
                frame.1 += 1;
            }
            i = delimited[next_delimited].end.max(i + 1);
            continue;
        }
        match bytes[i] {
            b'(' => stack.push((i, 0)),
            b')' => {
                if let Some((open, count)) = stack.pop()
                    && count >= 2
                {
                    out.push(NearMiss {
                        span: ByteSpan {
                            start: base + open,
                            end: base + i + 1,
                        },
                        why: NearMissKind::SeveralToOneParenthesis { count },
                    });
                }
            }
            _ => {}
        }
        i += 1;
    }
}

/// Whether a frontend's span is usable: inside the text, nested correctly, and
/// on character boundaries. A malformed one is ignored rather than trusted.
fn well_formed(text: &str, span: &DelimitedSpan) -> bool {
    span.outer.start <= span.interior.start
        && span.interior.start <= span.interior.end
        && span.interior.end <= span.outer.end
        && span.outer.end <= text.len()
        && text.is_char_boundary(span.outer.start)
        && text.is_char_boundary(span.outer.end)
        && text.is_char_boundary(span.interior.start)
        && text.is_char_boundary(span.interior.end)
}

/// Whether an acute at `after - ACUTE.len()` opens a span.
///
/// The calculus fixes the rule and not the test: the acute "opens exactly when
/// label-shaped text follows it" (´[LBL-judg:labels:participation]´). Label-
/// shaped is read here as the run of label-alphabet bytes after the acute
/// being either a complete interior — which is what makes an unclosed opening
/// acute detectable without first finding a closer — or immediately closed by
/// an acute, which is what lets a miscased or misbracketed span be warned
/// about at all. Whitespace is deliberately outside the run: admitting it
/// would let an apostrophe accident swallow the opening acute of the real
/// occurrence that follows it.
///
/// The interior a space squeezed apart is therefore not read here, and it is
/// not lost either: [`spacing_look`] warns about it without opening
/// anything, which is the whole difference.
fn opens(text: &str, after: usize) -> bool {
    let bytes = text.as_bytes();
    let mut i = after;
    while i < bytes.len() && is_interior_byte(bytes[i]) {
        i += 1;
    }
    if i == after {
        return false;
    }
    classify(&text[after..i]).is_ok() || is_acute(bytes, i)
}

fn is_interior_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b':' | b'-' | b'[' | b']')
}

fn is_acute(bytes: &[u8], i: usize) -> bool {
    bytes[i..].starts_with(ACUTE.as_bytes())
}

fn find_acute(bytes: &[u8], from: usize) -> Option<usize> {
    (from..bytes.len()).find(|&i| is_acute(bytes, i))
}

fn find_byte(bytes: &[u8], from: usize, byte: u8) -> Option<usize> {
    bytes
        .get(from..)
        .and_then(|tail| tail.iter().position(|&b| b == byte))
        .map(|at| from + at)
}
