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

use cogra_linter::ByteSpan;
use cogra_linter::scan::{
    DelimitedSpan, Delimiter, DelimiterFailure, NearMissKind, Occurrence, RegionScan, scan_code,
    scan_prose,
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
///
/// In prose a region carries only what the frontend paired, however label-shaped its text.
/// ´claim:delimiters:prose-reads-only-paired-spans´
#[test]
fn prose_reads_only_what_the_frontend_paired() {
    let scan = scan_prose("`a:b:c` and `d:e:f`", 0, &[]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: an unpaired backtick leaves its block's later spans undefined, and
/// the frontend expresses that by supplying none — the spans before it still
/// scan, which is the failure being bounded by its block.
///
/// An unpaired backtick leaves its block's later spans undefined and the earlier ones intact.
/// ´claim:delimiters:an-unpaired-backtick-is-bounded-by-its-block´
#[test]
fn prose_unpaired_backtick_bounds_its_block() {
    let text = "`a:b:c` then ` an unpaired backtick and `d:e:f`";
    let scan = scan_prose(text, 0, &[span((0, 7), (1, 6))]);
    assert_eq!(scan.occurrences.len(), 1);
    assert_eq!(scan.occurrences[0].label().as_str(), "a:b:c");
}

/// Prose: the scanner never reports a delimiter failure, because it never
/// pairs a backtick (´dec:lint:two-scan-entries´).
///
/// The scanner reports no delimiter failure in prose, never having paired a backtick.
/// ´claim:delimiters:prose-reports-no-delimiter-failure´
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
///
/// A span reaching past its region's text is ignored rather than trusted.
/// ´claim:delimiters:an-out-of-bounds-span-is-ignored´
#[test]
fn prose_span_out_of_bounds_is_ignored() {
    let scan = scan_prose("`a:b:c`", 0, &[span((0, 40), (1, 39))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: a span whose interior escapes its outer span is ignored.
///
/// A span whose interior escapes its outer span is ignored.
/// ´claim:delimiters:an-escaping-interior-is-ignored´
#[test]
fn prose_span_with_escaping_interior_is_ignored() {
    let scan = scan_prose("`a:b:c`", 0, &[span((2, 5), (1, 6))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: a span whose bounds fall inside a character is ignored.
///
/// A span whose bounds fall inside a character is ignored.
/// ´claim:delimiters:a-span-off-a-character-boundary-is-ignored´
#[test]
fn prose_span_off_a_character_boundary_is_ignored() {
    let scan = scan_prose("`é:b:c`", 0, &[span((0, 8), (2, 7))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: a span whose ends coincide is an empty interior, which is text.
///
/// A span whose ends coincide is an empty interior, which is text.
/// ´claim:delimiters:an-empty-interior-is-text´
#[test]
fn prose_empty_interior_is_text() {
    let scan = scan_prose("``", 0, &[span((0, 2), (1, 1))]);
    assert_eq!(scan, RegionScan::default());
}

/// Prose: the base offset reaches every reported span, occurrences and
/// near-misses alike.
///
/// The base offset reaches every reported span, occurrences and near-misses alike.
/// ´claim:delimiters:the-base-offset-reaches-every-span´
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
///
/// A displayed span is skipped whole, so its parentheses cite nothing.
/// ´claim:delimiters:a-displayed-span-cites-nothing´
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
///
/// In code the acute opens exactly when label-shaped text follows it.
/// ´claim:delimiters:the-acute-opens-on-label-shaped-text´
#[test]
fn code_acute_opens_on_label_shaped_text() {
    let scan = scan_code("´a:b:c´", 0);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
}

/// Code: an acute that opens nothing is text — a stray closing acute is
/// overwhelmingly an apostrophe accident.
///
/// An acute that opens nothing is text, a stray closer being an apostrophe accident.
/// ´claim:delimiters:an-acute-opening-nothing-is-text´
#[test]
fn code_acute_opening_nothing_is_text() {
    assert_eq!(
        scan_code("it isn´t an occurrence", 0),
        RegionScan::default()
    );
}

/// Code: an acute opening a non-label run is text, both acutes included.
///
/// (´claim:delimiters:an-acute-opening-nothing-is-text´)
#[test]
fn code_acute_around_a_short_word_is_text() {
    assert_eq!(scan_code("the ´x´ marker", 0), RegionScan::default());
}

/// Code: an empty acute pair opens nothing and fails nothing.
///
/// (´claim:delimiters:an-acute-opening-nothing-is-text´)
#[test]
fn code_empty_acute_pair_is_text() {
    assert_eq!(scan_code("nothing ´´ here", 0), RegionScan::default());
}

/// Code: an acute at the very end of a region opens nothing.
///
/// (´claim:delimiters:an-acute-opening-nothing-is-text´)
#[test]
fn code_trailing_acute_is_text() {
    assert_eq!(scan_code("ends with an acute ´", 0), RegionScan::default());
}

/// Code: an opening acute unclosed when its region ends is a hard failure,
/// located at the opening acute in whole-file coordinates.
///
/// An opening acute unclosed when its region ends is a hard failure, located at the opener.
/// ´claim:delimiters:an-unclosed-opening-acute-fails´
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
///
/// (´claim:delimiters:an-unclosed-opening-acute-fails´)
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
///
/// The occurrences before an unclosed opening acute stand.
/// ´claim:delimiters:occurrences-before-a-failure-stand´
#[test]
fn code_occurrences_before_the_failure_stand() {
    let scan = scan_code("´a:b:c´ then ´d:e:f", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert_eq!(scan.occurrences[0].label().as_str(), "a:b:c");
    assert!(scan.delimiter_failure.is_some());
}

/// Code: a delimiter failure ends the region's spans, so nothing after it is
/// read — not an occurrence and not a near-miss.
///
/// A delimiter failure ends its region's spans, so nothing after it is read at all.
/// ´claim:delimiters:a-failure-ends-the-regions-spans´
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
///
/// Delimiter pairing is settled within a region before any span in it is parsed.
/// ´claim:delimiters:pairing-precedes-parsing´
#[test]
fn code_pairing_precedes_parsing() {
    let scan = scan_code("´a:b:c and the ´d:e:f´ citation", 0);
    assert!(scan.occurrences.is_empty());
    assert!(scan.delimiter_failure.is_none());
    assert_eq!(scan.near_misses[0].span, ByteSpan { start: 0, end: 18 });
}

/// Code: the acute classifies locally, so an apostrophe accident before a real
/// occurrence does not swallow it.
///
/// The acute classifies locally, so an apostrophe accident does not swallow the next occurrence.
/// ´claim:delimiters:the-acute-classifies-locally´
#[test]
fn code_apostrophe_does_not_swallow_the_next_occurrence() {
    let scan = scan_code("it isn´t the mint ´a:b:c´ names", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(scan.delimiter_failure.is_none());
}

/// Code: a run of occurrences pairs one acute to the next, never across a span.
///
/// A run of occurrences pairs one acute to the next, never across a span.
/// ´claim:delimiters:consecutive-spans-pair-in-order´
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
///
/// An acute span whose interior runs past the label alphabet parses as no form and is text.
/// ´claim:delimiters:a-foreign-interior-is-text´
#[test]
fn code_span_with_foreign_interior_is_text() {
    let scan = scan_code("´a:b:c(´", 0);
    assert!(scan.occurrences.is_empty());
    assert!(scan.delimiter_failure.is_none());
}

/// Code: the backtick pairs only for the near-miss warning and never opens an
/// occurrence.
///
/// In code the backtick pairs only for the near-miss warning and never opens an occurrence.
/// ´claim:delimiters:the-backtick-never-mints-in-code´
#[test]
fn code_backtick_never_mints() {
    let scan = scan_code("`a:b:c`", 0);
    assert!(scan.occurrences.is_empty());
    assert_eq!(scan.near_misses[0].why, NearMissKind::BacktickInCode);
}

/// Code: an unpaired backtick in code text is inert — the backtick owns no
/// pairing here, so it fails nothing.
///
/// (´claim:delimiters:the-backtick-never-mints-in-code´)
#[test]
fn code_unpaired_backtick_is_inert() {
    let scan = scan_code("a ` and the mint ´a:b:c´", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(scan.delimiter_failure.is_none());
}

/// Code: a backtick inside an acute span is part of no pair, the acute span
/// being read atomically.
///
/// (´claim:delimiters:the-backtick-never-mints-in-code´)
#[test]
fn code_backtick_inside_an_acute_span() {
    let scan = scan_code("´a:b:c´ ` ´d:e:f´", 0);
    assert_eq!(scan.occurrences.len(), 2);
    assert!(scan.near_misses.is_empty());
}

/// Code: a backtick pair does not swallow the acute occurrence inside it.
///
/// The backtick carries no pairing authority in scanned code text — the
/// acute belongs to the label syntax and classifies locally — so a stretch
/// between two backticks is not a span the scanner may consume, and the mint
/// inside it reads exactly as it reads without them.
///
/// A backtick pair in code consumes nothing, so an occurrence inside one reads as it would without.
/// ´claim:delimiters:a-backtick-pair-consumes-nothing´
#[test]
fn f1_backtick_pair_does_not_swallow_a_mint() {
    let scan = scan_code("the `Foo type and ´def:x:mint´ then `Bar`", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
    assert_eq!(scan.occurrences[0].label().as_str(), "def:x:mint");

    let control = scan_code("the Foo type and ´def:x:mint´ then Bar", 0);
    assert_eq!(control.occurrences.len(), scan.occurrences.len());
}

/// Code: nor the citation inside it.
///
/// (´claim:delimiters:a-backtick-pair-consumes-nothing´)
#[test]
fn f1_backtick_pair_does_not_swallow_a_citation() {
    let scan = scan_code("the `Foo type and (´def:x:cite´) then `Bar`", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(matches!(scan.occurrences[0], Occurrence::SameOwner { .. }));
}

/// Code: nor the hard failure an unclosed opening acute inside it is.
///
/// Suppressing this was the worst of the three, a hard failure being the one
/// thing the participation judgment does not let pass quietly.
///
/// (´claim:delimiters:a-backtick-pair-consumes-nothing´)
#[test]
fn f1_backtick_pair_does_not_suppress_a_delimiter_failure() {
    let scan = scan_code("a `x and ´def:x:open and `y`", 0);
    assert_eq!(
        scan.delimiter_failure,
        Some(DelimiterFailure {
            at: 9,
            delimiter: Delimiter::Acute
        })
    );
}

/// Code: the backtick's own warning survives the loss of its pairing
/// authority, being read out of the residue the acute pass did not consume.
///
/// The backtick's own warning is read out of the residue the acute pass did not consume.
/// ´claim:delimiters:the-backtick-warning-comes-from-the-residue´
#[test]
fn f1_backtick_near_miss_is_read_out_of_the_residue() {
    let scan = scan_code("´a:b:c´ and `d:e:f` here", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert_eq!(scan.near_misses.len(), 1);
    assert_eq!(scan.near_misses[0].why, NearMissKind::BacktickInCode);
}

/// Code: a backtick never pairs across an acute span, so the two backticks
/// on either side of one are each unpaired and each inert.
///
/// A backtick never pairs across an acute span, so each side is unpaired and inert.
/// ´claim:delimiters:backticks-do-not-pair-across-an-acute-span´
#[test]
fn f1_backticks_do_not_pair_across_an_acute_span() {
    let scan = scan_code("`a ´d:e:f´ b`", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert!(scan.near_misses.is_empty());
    assert!(scan.delimiter_failure.is_none());
}

/// Code: an interior a space squeezed apart is warned about, though no
/// acute opened it.
///
/// The run the opening test reads stops at the space, so the span never
/// opens; the bounded look after that failure is what makes the spacing
/// warning of (´[LBL-inv:labels:total-resolution]´) reachable in code.
///
/// An interior a space squeezed apart is warned about, though no acute opened it.
/// ´claim:delimiters:the-spacing-warning-is-reachable-in-code´
#[test]
fn f5_interior_spacing_is_reachable_in_code() {
    for text in ["´def: fx:spaced´", "´def :fx:spaced´", "´a:b: c´"] {
        let scan = scan_code(text, 0);
        assert_eq!(
            scan.near_misses.len(),
            1,
            "{text:?} warns once: {:?}",
            scan.near_misses
        );
        assert!(matches!(
            scan.near_misses[0].why,
            NearMissKind::InteriorSpacing { .. }
        ));
    }
}

/// Code: the look creates no span and consumes nothing — it warns, and the
/// occurrence after it is read exactly as if the look had not happened.
///
/// The spacing look creates no span and consumes nothing.
/// ´claim:delimiters:the-spacing-look-consumes-nothing´
#[test]
fn f5_the_spacing_look_swallows_nothing() {
    let scan = scan_code("´def: fx:spaced´ then ´a:b:c´", 0);
    assert_eq!(scan.occurrences.len(), 1);
    assert_eq!(scan.occurrences[0].label().as_str(), "a:b:c");
    assert!(scan.delimiter_failure.is_none());
}

/// Code: the look is bounded, so a lone acute far from the next one warns
/// about nothing — and an apostrophe accident stays text.
///
/// The spacing look is bounded, so a lone acute warns about nothing and stays text.
/// ´claim:delimiters:the-spacing-look-is-bounded´
#[test]
fn f5_the_spacing_look_is_bounded_and_keeps_apostrophes_text() {
    let far = "´def: fx and then a stretch of prose long enough to carry no acute at all, \
               nowhere near this one, and long enough again that no bounded look could \
               reach across it, ´a:b:c´";
    let scan = scan_code(far, 0);
    assert!(scan.near_misses.is_empty(), "{:?}", scan.near_misses);
    assert_eq!(scan.occurrences.len(), 1);

    assert_eq!(
        scan_code("it isn´t an occurrence", 0),
        RegionScan::default()
    );
    assert!(
        scan_code("the author´s ´a:b:c´ label", 0)
            .near_misses
            .is_empty()
    );
}

/// Code: an empty region carries nothing.
///
/// An empty region carries nothing, in either syntax.
/// ´claim:delimiters:an-empty-region-carries-nothing´
#[test]
fn code_empty_region() {
    assert_eq!(scan_code("", 0), RegionScan::default());
}

/// Prose: an empty region carries nothing.
///
/// (´claim:delimiters:an-empty-region-carries-nothing´)
#[test]
fn prose_empty_region() {
    assert_eq!(scan_prose("", 0, &[]), RegionScan::default());
}
