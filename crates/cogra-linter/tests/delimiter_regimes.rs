//! Vector tests for the two delimiter regimes of
//! (´[LBL-judg:labels:participation]´).
//!
//! Trace convention: every test's doc comment names the clause of the
//! participation judgment it traces to — "in prose the backtick belongs to the
//! document format", "in scanned code text the acute belongs to the label
//! syntax and classifies locally", "an opening acute unclosed when its region
//! ends is a hard failure", "an acute that opens nothing is text" — or the
//! decision that splits the two doors (´dec:lint:two-scan-entries´).
//!
//! The prose half is expressed through the [`DelimitedSpan`] contract, which
//! is the whole content of "the scanner never counts a backtick": what the
//! frontend does not pair, the scanner cannot read.

use cogra_linter::scan::{
    ByteSpan, DelimitedSpan, Delimiter, DelimiterFailure, NearMissKind, Occurrence, RegionScan,
    scan_code, scan_prose,
};

/// A paired, participating span.
fn span(outer: (usize, usize), interior: (usize, usize)) -> DelimitedSpan {
    DelimitedSpan {
        outer: ByteSpan {
            start: outer.0,
            end: outer.1,
        },
        interior: ByteSpan {
            start: interior.0,
            end: interior.1,
        },
        displayed: false,
    }
}

/// Prose: with no spans, a region carries nothing, however label-shaped its
/// text — the format owns the backtick and the frontend owns the pairing.
#[test]
fn prose_reads_only_what_the_frontend_paired() {
    let scan = scan_prose("`a:b:c` and `d:e:f`", 0, &[]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: an unpaired backtick leaves its block's later spans undefined, and
/// the frontend expresses that by supplying none — the spans before it still
/// scan, which is the failure being bounded by its block.
#[test]
fn prose_unpaired_backtick_bounds_its_block() {
    let text = "`a:b:c` then ` an unpaired backtick and `d:e:f`";
    let scan = scan_prose(text, 0, &[span((0, 7), (1, 6))]);
    assert_eq!(scan.occurrences.len(), 1);
    assert_eq!(scan.occurrences[0].label().as_str(), "a:b:c");
}

/// Prose: the scanner never reports a delimiter failure, because it never
/// pairs a backtick (´dec:lint:two-scan-entries´).
#[test]
fn prose_reports_no_delimiter_failure() {
    let text = "` an unpaired backtick";
    assert!(scan_prose(text, 0, &[]).delimiter_failure.is_none());
    assert!(
        scan_prose("(`a:b:c`)", 0, &frontend_pair())
            .delimiter_failure
            .is_none()
    );
}

/// One well-formed span over the text of the test above.
fn frontend_pair() -> Vec<DelimitedSpan> {
    vec![span((1, 8), (2, 7))]
}

/// Prose: a span reaching past the region's text is ignored rather than
/// trusted, so a defective frontend cannot panic a scan.
#[test]
fn prose_span_out_of_bounds_is_ignored() {
    let scan = scan_prose("`a:b:c`", 0, &[span((0, 40), (1, 39))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: a span whose interior escapes its outer span is ignored.
#[test]
fn prose_span_with_escaping_interior_is_ignored() {
    let scan = scan_prose("`a:b:c`", 0, &[span((2, 5), (1, 6))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: a span whose bounds fall inside a character is ignored.
#[test]
fn prose_span_off_a_character_boundary_is_ignored() {
    let scan = scan_prose("`é:b:c`", 0, &[span((0, 8), (2, 7))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: a span whose ends coincide is an empty interior, which is text.
#[test]
fn prose_empty_interior_is_text() {
    let scan = scan_prose("``", 0, &[span((0, 2), (1, 1))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: the base offset reaches every reported span, occurrences and
/// near-misses alike.
#[test]
fn prose_base_reaches_every_span() {
    let text = "`a:b:c` `D:e:f`";
    let scan = scan_prose(text, 1_000, &[span((0, 7), (1, 6)), span((8, 15), (9, 14))]);
    assert_eq!(
        scan.occurrences[0].span(),
        ByteSpan {
            start: 1_000,
            end: 1_007
        }
    );
    assert_eq!(
        scan.near_misses[0].span,
        ByteSpan {
            start: 1_008,
            end: 1_015
        }
    );
    assert_eq!(
        scan.near_misses[0].why,
        NearMissKind::WrongCase { at: 1_009 }
    );
}

/// Prose: a displayed span is skipped whole, so its parentheses cite nothing.
#[test]
fn prose_displayed_span_cites_nothing() {
    let text = "(``a:b:c``)";
    let scan = scan_prose(
        text,
        0,
        &[DelimitedSpan {
            outer: ByteSpan { start: 1, end: 10 },
            interior: ByteSpan { start: 3, end: 8 },
            displayed: true,
        }],
    );
    assert_eq!(scan, RegionScan::default());
}

/// Code: the acute opens exactly when label-shaped text follows it.
#[test]
fn code_acute_opens_on_label_shaped_text() {
    let scan = scan_code("´a:b:c´", 0);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
}

/// Code: an acute that opens nothing is text — a stray closing acute is
/// overwhelmingly an apostrophe accident.
#[test]
fn code_acute_opening_nothing_is_text() {
    assert_eq!(
        scan_code("it isn´t an occurrence", 0),
        RegionScan::default()
    );
}

/// Code: an acute opening a non-label run is text, both acutes included.
#[test]
fn code_acute_around_a_short_word_is_text() {
    assert_eq!(scan_code("the ´x´ marker", 0), RegionScan::default());
}

/// Code: an empty acute pair opens nothing and fails nothing.
#[test]
fn code_empty_acute_pair_is_text() {
    assert_eq!(scan_code("nothing ´´ here", 0), RegionScan::default());
}

/// Code: an acute at the very end of a region opens nothing.
#[test]
fn code_trailing_acute_is_text() {
    assert_eq!(scan_code("ends with an acute ´", 0), RegionScan::default());
}

/// Code: an opening acute unclosed when its region ends is a hard failure,
/// located at the opening acute in whole-file coordinates.
#[test]
fn code_unclosed_opening_acute_fails() {
    let scan = scan_code("the mint ´def:parser:tokenizer", 100);
    assert_eq!(
        scan.delimiter_failure,
        Some(DelimiterFailure {
            at: 109,
            delimiter: Delimiter::Acute
        })
    );
}

/// Code: an unclosed opening acute of the bracketed form fails the same way.
#[test]
fn code_unclosed_bracketed_acute_fails() {
    let scan = scan_code("(´[SPEC-a:b:c]", 0);
    assert_eq!(
        scan.delimiter_failure,
        Some(DelimiterFailure {
            at: 1,
            delimiter: Delimiter::Acute
        })
    );
}

/// Code: the occurrences before an unclosed opening acute stand.
#[test]
fn code_occurrences_before_the_failure_stand() {
    let scan = scan_code("´a:b:c´ then ´d:e:f", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert_eq!(scan.occurrences[0].label().as_str(), "a:b:c");
    assert!(scan.delimiter_failure.is_some());
}

/// Code: a delimiter failure ends the region's spans, so nothing after it is
/// read — not an occurrence and not a near-miss.
#[test]
fn code_failure_ends_the_regions_spans() {
    let scan = scan_code("´a:b:c then `d:e:f` and no closer", 0);
    assert!(scan.occurrences.is_empty());
    assert!(scan.near_misses.is_empty());
    assert_eq!(
        scan.delimiter_failure,
        Some(DelimiterFailure {
            at: 0,
            delimiter: Delimiter::Acute
        })
    );
}

/// Code: delimiter pairing is settled within a region before any span in it is
/// parsed, so an opening acute pairs with the next acute in the region whatever
/// lies between, and the resulting span parses as no form and is text.
///
/// The consequence is recorded rather than worked around: an occurrence whose
/// own opening acute is consumed as that closer is lost silently, and no
/// failure is reported. Bounding the closer search would decide a question the
/// participation judgment leaves open, and it would decide it against the
/// judgment's own ordering of pairing before parsing.
#[test]
fn code_pairing_precedes_parsing() {
    let scan = scan_code("´a:b:c and the ´d:e:f´ citation", 0);
    assert!(scan.occurrences.is_empty());
    assert!(scan.delimiter_failure.is_none());
    assert_eq!(scan.near_misses[0].span, ByteSpan { start: 0, end: 18 });
}

/// Code: the acute classifies locally, so an apostrophe accident before a real
/// occurrence does not swallow it.
#[test]
fn code_apostrophe_does_not_swallow_the_next_occurrence() {
    let scan = scan_code("it isn´t the mint ´a:b:c´ names", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(scan.delimiter_failure.is_none());
}

/// Code: a run of occurrences pairs one acute to the next, never across a span.
#[test]
fn code_consecutive_spans_pair_in_order() {
    let text = "´a:b:c´ ´d:e:f´ ´g:h:i´";
    let scan = scan_code(text, 0);
    let labels: Vec<&str> = scan
        .occurrences
        .iter()
        .map(|o| o.label().as_str())
        .collect();
    assert_eq!(labels, ["a:b:c", "d:e:f", "g:h:i"]);
}

/// Code: an acute span whose interior runs past the label alphabet parses as no
/// form and is text.
#[test]
fn code_span_with_foreign_interior_is_text() {
    let scan = scan_code("´a:b:c(´", 0);
    assert!(scan.occurrences.is_empty());
    assert!(scan.delimiter_failure.is_none());
}

/// Code: the backtick pairs only for the near-miss warning and never opens an
/// occurrence.
#[test]
fn code_backtick_never_mints() {
    let scan = scan_code("`a:b:c`", 0);
    assert!(scan.occurrences.is_empty());
    assert_eq!(scan.near_misses[0].why, NearMissKind::BacktickInCode);
}

/// Code: an unpaired backtick in code text is inert — the backtick owns no
/// pairing here, so it fails nothing.
#[test]
fn code_unpaired_backtick_is_inert() {
    let scan = scan_code("a ` and the mint ´a:b:c´", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(scan.delimiter_failure.is_none());
}

/// Code: a backtick inside an acute span is part of no pair, the acute span
/// being read atomically.
#[test]
fn code_backtick_inside_an_acute_span() {
    let scan = scan_code("´a:b:c´ ` ´d:e:f´", 0);
    assert_eq!(scan.occurrences.len(), 2);
    assert!(scan.near_misses.is_empty());
}

/// Code: an empty region carries nothing.
#[test]
fn code_empty_region() {
    assert_eq!(scan_code("", 0), RegionScan::default());
}

/// Prose: an empty region carries nothing.
#[test]
fn prose_empty_region() {
    assert_eq!(scan_prose("", 0, &[]), RegionScan::default());
}
