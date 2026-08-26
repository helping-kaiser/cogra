//! ´mod:module:diag´
//!
//! Diagnostics: the one value every finding about the corpus travels as.
//!
//! A judgment's answer is a list of these and never an `Err`
//! (´conv:lint:finding-or-error´); [`crate::error`] carries what remains — the
//! linter's own inability to proceed. The order here is implemented and
//! not derived, because its three keys are not the declaration order
//! (´conv:lint:diagnostic-order´).

use std::cmp::Ordering;
use std::collections::HashSet;
use std::fmt;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock, PoisonError};

/// A half-open byte range of a source, in whole-file coordinates.
///
/// Whole-file, because a logical region is not contiguous in the file and
/// a diagnostic must still point into it (´dec:lint:two-scan-entries´).
///
/// ```
/// use cogra_linter::ByteSpan;
///
/// assert_eq!(ByteSpan::new(4, 9).len(), 5);
/// assert_eq!(ByteSpan { start: 4, end: 9 }.len(), 5);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ByteSpan {
    /// First byte of the span.
    pub start: usize,
    /// One past the last byte of the span.
    pub end: usize,
}

impl ByteSpan {
    /// A span from `start` to `end`, half-open.
    #[must_use]
    pub const fn new(start: usize, end: usize) -> ByteSpan {
        ByteSpan { start, end }
    }

    /// The span's length in bytes, saturating: a span whose end precedes its
    /// start has no length rather than a negative one, so a malformed span
    /// from a frontend cannot panic a scan.
    #[must_use]
    pub const fn len(&self) -> usize {
        self.end.saturating_sub(self.start)
    }

    /// Whether the span covers no byte.
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// A stable rule identifier.
///
/// Deliberately a plain token and never a label: `lint` is a reserved kind
/// no profile governs, so a label-shaped rule identifier would be a hard
/// failure of the linter's own sources (´sig:lint:diagnostic-api´).
///
/// ```
/// use cogra_linter::RuleId;
///
/// let rule = RuleId::new("carrier-unreadable-tree");
/// assert_eq!(rule.as_str(), "carrier-unreadable-tree");
/// assert!(!rule.as_str().contains(':'));
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct RuleId(&'static str);

impl RuleId {
    /// The rule identified by `token`.
    ///
    /// `token` is a plain token: hyphenated words, no colon, so that no
    /// rule identifier can be read as a label.
    #[must_use]
    pub const fn new(token: &'static str) -> RuleId {
        RuleId(token)
    }

    /// The rule identified by `token`, which the adoption data supplied.
    ///
    /// A [`RuleId`] is a `&'static str` because every rule the crate names
    /// is a `const` in the module that reports it. `[banned-tokens]` breaks
    /// that shape on purpose — a future ban is a new row and not new code
    /// (´sig:lint:bans-api´) — so its identifiers arrive as owned strings
    /// with no static home.
    ///
    /// Interning is the smallest resolution: the token is leaked once, the
    /// first time it is seen, and every later call answers with the same
    /// pointer. The set it can grow to is the set of distinct identifiers
    /// in one adoption file, which is loaded once and is finite, so the
    /// leak is bounded by the input rather than by the number of calls.
    /// Making [`RuleId`] owned instead would cost it `Copy`, which every
    /// `const RULE: RuleId` in the crate rests on.
    ///
    /// ```
    /// use cogra_linter::RuleId;
    ///
    /// let once = RuleId::interned("rust-plain-line-comment");
    /// let twice = RuleId::interned("rust-plain-line-comment");
    /// assert_eq!(once, twice);
    /// assert!(std::ptr::eq(once.as_str(), twice.as_str()));
    /// ```
    #[must_use]
    pub fn interned(token: &str) -> RuleId {
        static TOKENS: OnceLock<Mutex<HashSet<&'static str>>> = OnceLock::new();
        let held = TOKENS.get_or_init(|| Mutex::new(HashSet::new()));
        let mut tokens = held.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(found) = tokens.get(token) {
            return RuleId(found);
        }
        let leaked: &'static str = Box::leak(Box::from(token));
        tokens.insert(leaked);
        RuleId(leaked)
    }

    /// The token itself.
    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        self.0
    }
}

impl fmt::Display for RuleId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.0)
    }
}

/// How grave a finding is, wherever it is found.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// The corpus violates a clause of the disciplines.
    Error,
    /// The corpus is suspect where no clause is violated outright.
    Warning,
}

/// Whether a finding fails the build or is reported only.
///
/// Computed from the finding's path against `[enforcement]` of the adoption
/// data (´dec:lint:enforcement-partition´), never from its severity: an
/// error is an error wherever it is found, and only the exit code differs.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Enforcement {
    /// Inside the failing set: the lane fails on this finding.
    Failing,
    /// Outside it: reported, counted, and not fatal.
    Advisory,
}

/// Where a finding sits.
///
/// ```
/// use cogra_linter::{ByteSpan, Location};
/// use std::path::PathBuf;
///
/// let source = "alpha\nbeta\ngamma\n";
/// let at = Location::in_source(PathBuf::from("x.md"), ByteSpan::new(6, 10), source);
/// assert_eq!((at.line, at.column), (2, 1));
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Location {
    /// The source, relative to the corpus root.
    pub path: PathBuf,
    /// The bytes the finding is about.
    pub span: ByteSpan,
    /// One-based line of `span.start`.
    pub line: u32,
    /// One-based column of `span.start`, counted in bytes of its line.
    pub column: u32,
}

impl Location {
    /// A location with its line and column already known.
    #[must_use]
    pub const fn new(path: PathBuf, span: ByteSpan, line: u32, column: u32) -> Location {
        Location {
            path,
            span,
            line,
            column,
        }
    }

    /// A location whose line and column are read off `source`.
    ///
    /// Both are one-based, and the column counts bytes rather than
    /// characters, so that it agrees with the span it is derived from. An
    /// offset past the end of `source` reports the last line.
    #[must_use]
    pub fn in_source(path: PathBuf, span: ByteSpan, source: &str) -> Location {
        let start = span.start.min(source.len());
        let upto = &source.as_bytes()[..start];
        let line = 1 + upto.iter().filter(|byte| **byte == b'\n').count();
        let column = 1 + start
            - upto
                .iter()
                .rposition(|byte| *byte == b'\n')
                .map_or(0, |at| at + 1);
        Location {
            path,
            span,
            line: u32::try_from(line).unwrap_or(u32::MAX),
            column: u32::try_from(column).unwrap_or(u32::MAX),
        }
    }
}

/// A further location one finding needs, with the note that says why.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Related {
    /// Where the related material sits.
    pub at: Location,
    /// One line saying what the reader is being pointed at.
    pub note: String,
}

/// One finding about the corpus.
///
/// The message is a single line; a finding that wants a paragraph wants a
/// related location instead (´dec:lint:diagnostic-format´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Diagnostic {
    /// The rule that produced the finding.
    pub rule: RuleId,
    /// How grave it is.
    pub severity: Severity,
    /// Whether it fails the lane.
    pub enforcement: Enforcement,
    /// The location the finding is primarily about.
    pub primary: Location,
    /// Further locations the finding needs — the other mint of a duplicate,
    /// the second asset of a collision — each with its own note.
    pub related: Vec<Related>,
    /// One line, no trailing punctuation.
    pub message: String,
}

impl Ord for Diagnostic {
    /// Path, then the primary span's start offset, then the rule.
    ///
    /// Implemented rather than derived: a derived order would compare the
    /// fields in declaration order, putting the rule first, and would then
    /// have to be kept honest by field order forever
    /// (´conv:lint:diagnostic-order´).
    fn cmp(&self, other: &Diagnostic) -> Ordering {
        self.primary
            .path
            .cmp(&other.primary.path)
            .then_with(|| self.primary.span.start.cmp(&other.primary.span.start))
            .then_with(|| self.rule.cmp(&other.rule))
    }
}

impl PartialOrd for Diagnostic {
    fn partial_cmp(&self, other: &Diagnostic) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(path: &str, start: usize) -> Location {
        Location::new(PathBuf::from(path), ByteSpan::new(start, start + 1), 1, 1)
    }

    fn diagnostic(path: &str, start: usize, rule: &'static str) -> Diagnostic {
        Diagnostic {
            rule: RuleId::new(rule),
            severity: Severity::Error,
            enforcement: Enforcement::Failing,
            primary: at(path, start),
            related: Vec::new(),
            message: String::from("a finding"),
        }
    }

    #[test]
    fn the_first_key_is_the_path() {
        let earlier = diagnostic("a.md", 900, "z-rule");
        let later = diagnostic("b.md", 1, "a-rule");
        assert!(earlier < later);
    }

    #[test]
    fn the_second_key_is_the_start_offset() {
        let earlier = diagnostic("a.md", 4, "z-rule");
        let later = diagnostic("a.md", 40, "a-rule");
        assert!(earlier < later);
    }

    #[test]
    fn the_third_key_is_the_rule() {
        let earlier = diagnostic("a.md", 4, "a-rule");
        let later = diagnostic("a.md", 4, "z-rule");
        assert!(earlier < later);
    }

    #[test]
    fn the_message_decides_nothing() {
        let mut one = diagnostic("a.md", 4, "a-rule");
        one.message = String::from("zzz");
        let other = diagnostic("a.md", 4, "a-rule");
        assert_eq!(one.cmp(&other), Ordering::Equal);
    }

    #[test]
    fn sorting_is_stable_under_shuffling() {
        let mut one = vec![
            diagnostic("b.md", 1, "a-rule"),
            diagnostic("a.md", 9, "a-rule"),
            diagnostic("a.md", 2, "b-rule"),
            diagnostic("a.md", 2, "a-rule"),
        ];
        let mut other = vec![
            diagnostic("a.md", 2, "a-rule"),
            diagnostic("b.md", 1, "a-rule"),
            diagnostic("a.md", 2, "b-rule"),
            diagnostic("a.md", 9, "a-rule"),
        ];
        one.sort();
        other.sort();
        assert_eq!(one, other);
    }

    #[test]
    fn a_location_counts_lines_and_columns_from_one() {
        let source = "alpha\nbeta\ngamma";
        let first = Location::in_source(PathBuf::from("x"), ByteSpan::new(0, 1), source);
        assert_eq!((first.line, first.column), (1, 1));
        let third = Location::in_source(PathBuf::from("x"), ByteSpan::new(13, 14), source);
        assert_eq!((third.line, third.column), (3, 3));
    }

    #[test]
    fn a_location_past_the_end_reports_the_last_line() {
        let source = "alpha\nbeta";
        let past = Location::in_source(PathBuf::from("x"), ByteSpan::new(400, 401), source);
        assert_eq!(past.line, 2);
    }

    #[test]
    fn a_rule_identifier_is_never_label_shaped() {
        for rule in crate::carrier::RULES {
            assert!(
                !rule.as_str().contains(':'),
                "the rule identifier {rule} is label-shaped"
            );
        }
    }
}
