//! Vector tests for the three occurrence forms in both concrete syntaxes
//! (´[LBL-gram:labels:well-formed]´).
//!
//! Trace convention: every test's doc comment names the form of
//! (´[LBL-lang:labels:label-language]´) it traces to — mint, same-owner
//! citation, imported citation — or the clause of
//! (´[LBL-gram:labels:well-formed]´) it exercises: atomicity, non-nesting, or
//! "a span that parses as no form is ordinary text". The near-miss tests name
//! their class of (´sig:lint:near-miss-api´).

use cogra_linter::ByteSpan;
use cogra_linter::scan::{
    DelimitedSpan, NearMiss, NearMissKind, Occurrence, RegionScan, scan_code, scan_prose,
};

/// Stand in for the Markdown frontend: pair the backtick runs of a region and
/// hand the scanner the spans, a run of two or more marking displayed material
/// (´[LBL-judg:labels:participation]´).
fn frontend_spans(text: &str) -> Vec<DelimitedSpan> {
    let bytes = text.as_bytes();
    let mut spans = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'`' {
            i += 1;
            continue;
        }
        let open = i;
        while i < bytes.len() && bytes[i] == b'`' {
            i += 1;
        }
        let run = i - open;
        let mut j = i;
        let close = loop {
            if j >= bytes.len() {
                break None;
            }
            if bytes[j] != b'`' {
                j += 1;
                continue;
            }
            let start = j;
            while j < bytes.len() && bytes[j] == b'`' {
                j += 1;
            }
            if j - start == run {
                break Some(start);
            }
        };
        let Some(close) = close else { break };
        spans.push(DelimitedSpan {
            outer: ByteSpan {
                start: open,
                end: close + run,
            },
            interior: ByteSpan {
                start: open + run,
                end: close,
            },
            displayed: run > 1,
        });
        i = close + run;
    }
    spans
}

/// Scan one prose region, the frontend's pairing supplied.
fn prose(text: &str) -> RegionScan {
    scan_prose(text, 0, &frontend_spans(text))
}

/// The one occurrence a region is expected to carry.
fn only(scan: &RegionScan) -> &Occurrence {
    assert_eq!(
        scan.occurrences.len(),
        1,
        "expected exactly one occurrence: {scan:?}"
    );
    &scan.occurrences[0]
}

/// The one near-miss a region is expected to carry.
fn only_miss(scan: &RegionScan) -> &NearMiss {
    assert_eq!(
        scan.near_misses.len(),
        1,
        "expected exactly one near-miss: {scan:?}"
    );
    &scan.near_misses[0]
}

/// The text a span covers, for asserting that a whole-occurrence span really
/// covers the whole occurrence.
fn covered(text: &str, span: ByteSpan) -> &str {
    &text[span.start..span.end]
}

/// Mint, prose: a bare delimited span mints, delimiters inside the span.
#[test]
fn prose_mint() {
    let text = "the head carries `sec:labels:syntax` and nothing else";
    let scan = prose(text);
    let Occurrence::Mint { label, span } = only(&scan) else {
        panic!("mint expected: {scan:?}")
    };
    assert_eq!(label.as_str(), "sec:labels:syntax");
    assert_eq!(covered(text, *span), "`sec:labels:syntax`");
}

/// Same-owner citation, prose: the parenthesis is part of the occurrence.
#[test]
fn prose_same_owner_citation() {
    let text = "as (`inv:labels:unique-mint`) has it";
    let scan = prose(text);
    let Occurrence::SameOwner { label, span } = only(&scan) else {
        panic!("same-owner citation expected: {scan:?}")
    };
    assert_eq!(label.as_str(), "inv:labels:unique-mint");
    assert_eq!(covered(text, *span), "(`inv:labels:unique-mint`)");
}

/// Imported citation, prose: parentheses and brackets are both part of the
/// occurrence, and the prefix names the owner (´[LBL-inf:labels:imported-citation]´).
#[test]
fn prose_imported_citation() {
    let text = "see (`[SPEC-def:parser:tokenizer]`) upstream";
    let scan = prose(text);
    let Occurrence::Imported {
        prefix,
        label,
        span,
    } = only(&scan)
    else {
        panic!("imported citation expected: {scan:?}")
    };
    assert_eq!(prefix.as_str(), "SPEC");
    assert_eq!(label.as_str(), "def:parser:tokenizer");
    assert_eq!(covered(text, *span), "(`[SPEC-def:parser:tokenizer]`)");
}

/// Mint, code: the acute delimits, and its two bytes are inside the span.
#[test]
fn code_mint() {
    let text = "mints ´def:parser:tokenizer´ here";
    let scan = scan_code(text, 0);
    let Occurrence::Mint { label, span } = only(&scan) else {
        panic!("mint expected: {scan:?}")
    };
    assert_eq!(label.as_str(), "def:parser:tokenizer");
    assert_eq!(covered(text, *span), "´def:parser:tokenizer´");
}

/// Same-owner citation, code.
#[test]
fn code_same_owner_citation() {
    let text = "cited from its own package: (´test:integration:decode-roundtrip´)";
    let scan = scan_code(text, 0);
    let Occurrence::SameOwner { label, span } = only(&scan) else {
        panic!("same-owner citation expected: {scan:?}")
    };
    assert_eq!(label.name(), "decode-roundtrip");
    assert_eq!(
        covered(text, *span),
        "(´test:integration:decode-roundtrip´)"
    );
}

/// Imported citation, code.
#[test]
fn code_imported_citation() {
    let text = "(´[CODEC-test:integration:decode-roundtrip]´)";
    let scan = scan_code(text, 0);
    let Occurrence::Imported {
        prefix,
        label,
        span,
    } = only(&scan)
    else {
        panic!("imported citation expected: {scan:?}")
    };
    assert_eq!(prefix.as_str(), "CODEC");
    assert_eq!(label.kind(), "test");
    assert_eq!(covered(text, *span), text);
}

/// Every span is reported in whole-file coordinates: region-local plus base.
#[test]
fn spans_are_whole_file() {
    let text = "(`a:b:c`)";
    let scan = scan_prose(text, 4_096, &frontend_spans(text));
    assert_eq!(
        only(&scan).span(),
        ByteSpan {
            start: 4_096,
            end: 4_105
        }
    );
}

/// Every span is reported in whole-file coordinates in code too.
#[test]
fn code_spans_are_whole_file() {
    let scan = scan_code("´a:b:c´", 10);
    assert_eq!(only(&scan).span(), ByteSpan { start: 10, end: 19 });
}

/// Atomicity: one region carries as many occurrences as it has spans, each
/// read on its own.
#[test]
fn several_occurrences_in_one_region() {
    let text = "`a:b:c` then (`d:e:f`) then (`[P-g:h:i]`)";
    let scan = prose(text);
    assert_eq!(scan.occurrences.len(), 3);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
    assert!(matches!(scan.occurrences[1], Occurrence::SameOwner { .. }));
    assert!(matches!(scan.occurrences[2], Occurrence::Imported { .. }));
}

/// Atomicity: the same three forms, in the code syntax.
#[test]
fn several_occurrences_in_one_code_region() {
    let scan = scan_code("´a:b:c´ then (´d:e:f´) then (´[P-g:h:i]´)", 0);
    assert_eq!(scan.occurrences.len(), 3);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
    assert!(matches!(scan.occurrences[1], Occurrence::SameOwner { .. }));
    assert!(matches!(scan.occurrences[2], Occurrence::Imported { .. }));
}

/// The citation form needs both parentheses: an opening one alone leaves a
/// mint, since no other bracketing is an occurrence.
#[test]
fn opening_parenthesis_alone_is_a_mint() {
    let text = "(`a:b:c` and more";
    let scan = prose(text);
    assert!(matches!(only(&scan), Occurrence::Mint { .. }));
}

/// The citation form needs both parentheses: a closing one alone leaves a mint.
#[test]
fn closing_parenthesis_alone_is_a_mint() {
    let text = "text `a:b:c`) more";
    let scan = prose(text);
    assert!(matches!(only(&scan), Occurrence::Mint { .. }));
}

/// The parenthesis must be immediate: a space between it and the span leaves a
/// mint, since no other spacing is an occurrence.
#[test]
fn spaced_parenthesis_is_not_a_citation() {
    let text = "( `a:b:c` )";
    let scan = prose(text);
    assert!(matches!(only(&scan), Occurrence::Mint { .. }));
}

/// Atomicity: the occurrence is the delimited span with its immediate
/// parenthesis, so a citation closing a parenthetical remark still cites.
#[test]
fn citation_inside_a_parenthetical_remark() {
    let text = "(see also (`a:b:c`))";
    let scan = prose(text);
    let Occurrence::SameOwner { span, .. } = only(&scan) else {
        panic!("same-owner citation expected: {scan:?}")
    };
    assert_eq!(covered(text, *span), "(`a:b:c`)");
}

/// No nesting: an imported form inside an imported form parses as no form, and
/// its bracket is warned about instead.
#[test]
fn nested_imported_forms_refused() {
    let text = "(`[A-[B-a:b:c]]`)";
    let scan = prose(text);
    assert!(scan.occurrences.is_empty());
    assert_eq!(only_miss(&scan).why, NearMissKind::MisplacedBracket);
}

/// No nesting: a bracketed interior whose label field is itself bracketed is
/// no occurrence.
#[test]
fn bracket_inside_the_label_refused() {
    let scan = prose("(`[A-a:b:[c]]`)");
    assert!(scan.occurrences.is_empty());
}

/// A span that parses as no form is ordinary text — an ordinary code span in
/// prose is never an occurrence and never a warning.
#[test]
fn ordinary_code_span_is_text() {
    let scan = prose("run `cargo fmt` before pushing");
    assert_eq!(scan, RegionScan::default());
}

/// A span that parses as no form is ordinary text: a filename is not a label.
#[test]
fn filename_span_is_text() {
    let scan = prose("the file `Cargo.toml` says so");
    assert!(scan.occurrences.is_empty() && scan.near_misses.is_empty());
}

/// A span that parses as no form is ordinary text: a Rust identifier that
/// happens to carry colons is not a label.
#[test]
fn path_span_is_text() {
    let scan = prose("the type `common::l1::Record` is shared");
    assert!(scan.occurrences.is_empty() && scan.near_misses.is_empty());
}

/// A span that parses as no form is ordinary text: an empty span mints nothing.
#[test]
fn empty_span_is_text() {
    let scan = prose("an empty `` span");
    assert!(scan.occurrences.is_empty() && scan.near_misses.is_empty());
}

/// Participation: displayed material is shown and not meant, so a
/// double-backtick span mints nothing (´[LBL-judg:labels:participation]´).
#[test]
fn displayed_span_mints_nothing() {
    let scan = prose("displayed: ``sec:labels:syntax``");
    assert_eq!(scan, RegionScan::default());
}

/// Participation: a displayed span carries no near-miss either — material
/// deliberately shown is not a defect to warn about.
#[test]
fn displayed_span_warns_nothing() {
    let scan = prose("displayed: ``Sec:labels:syntax``");
    assert!(scan.near_misses.is_empty());
}

/// Near-miss, MisplacedBracket: a bracketed interior outside any parenthesis
/// is no occurrence.
#[test]
fn bracket_outside_parenthesis() {
    let text = "wrongly `[SPEC-a:b:c]` bare";
    let scan = prose(text);
    assert!(scan.occurrences.is_empty());
    let miss = only_miss(&scan);
    assert_eq!(miss.why, NearMissKind::MisplacedBracket);
    assert_eq!(covered(text, miss.span), "`[SPEC-a:b:c]`");
}

/// Near-miss, MisplacedBracket: a parenthesized bracketed interior whose
/// prefix is not prefix-shaped.
#[test]
fn lowercase_prefix_is_a_misplaced_bracket() {
    let scan = prose("(`[spec-a:b:c]`)");
    assert!(scan.occurrences.is_empty());
    assert_eq!(only_miss(&scan).why, NearMissKind::MisplacedBracket);
}

/// Near-miss, MisplacedBracket: a bracketed interior with no separating hyphen.
#[test]
fn missing_separator_is_a_misplaced_bracket() {
    let scan = prose("(`[SPECa:b:c]`)");
    assert_eq!(only_miss(&scan).why, NearMissKind::MisplacedBracket);
}

/// Near-miss, MisplacedBracket: a bracket the author opened and never closed.
#[test]
fn unclosed_bracket_is_a_misplaced_bracket() {
    let scan = prose("(`[SPEC-a:b:c`)");
    assert_eq!(only_miss(&scan).why, NearMissKind::MisplacedBracket);
}

/// Near-miss, MisplacedBracket: a bracket closed and never opened.
#[test]
fn unopened_bracket_is_a_misplaced_bracket() {
    let scan = prose("(`SPEC-a:b:c]`)");
    assert_eq!(only_miss(&scan).why, NearMissKind::MisplacedBracket);
}

/// Near-miss, MisplacedBracket: a bracketed interior whose label is defective.
#[test]
fn bracketed_defective_label() {
    let scan = prose("(`[SPEC-a:b]`)");
    assert_eq!(only_miss(&scan).why, NearMissKind::MisplacedBracket);
}

/// Near-miss, WrongCase: an interior whose only defect is casing, located at
/// the byte the parse stopped on.
#[test]
fn wrong_case_in_the_kind() {
    let text = "`Sec:labels:syntax`";
    let scan = prose(text);
    assert!(scan.occurrences.is_empty());
    assert_eq!(only_miss(&scan).why, NearMissKind::WrongCase { at: 1 });
}

/// Near-miss, WrongCase: casing inside the name, located at its byte.
#[test]
fn wrong_case_in_the_name() {
    let text = "(`inv:labels:uniqueMint`)";
    let scan = prose(text);
    assert_eq!(only_miss(&scan).why, NearMissKind::WrongCase { at: 19 });
}

/// Near-miss, WrongCase: an all-uppercase interior is still only a casing
/// defect.
#[test]
fn wrong_case_throughout() {
    let scan = prose("`SEC:LABELS:SYNTAX`");
    assert_eq!(only_miss(&scan).why, NearMissKind::WrongCase { at: 1 });
}

/// Near-miss, InteriorSpacing: whitespace inside the delimiters, located at the
/// offending space.
#[test]
fn interior_spacing_around_the_label() {
    let scan = prose("` a:b:c `");
    assert!(scan.occurrences.is_empty());
    assert_eq!(
        only_miss(&scan).why,
        NearMissKind::InteriorSpacing { at: 1 }
    );
}

/// Near-miss, InteriorSpacing: whitespace before a colon.
#[test]
fn interior_spacing_before_a_colon() {
    let scan = prose("(`a:b :c`)");
    assert_eq!(
        only_miss(&scan).why,
        NearMissKind::InteriorSpacing { at: 5 }
    );
}

/// Near-miss, InteriorSpacing: whitespace inside a bracketed interior.
#[test]
fn interior_spacing_inside_a_bracket() {
    let scan = prose("(`[SPEC- a:b:c]`)");
    assert!(matches!(
        only_miss(&scan).why,
        NearMissKind::MisplacedBracket | NearMissKind::InteriorSpacing { .. }
    ));
}

/// An interior with both spacing and casing defects is the spacing warning:
/// WrongCase claims casing is the *only* defect.
#[test]
fn spacing_beats_casing() {
    let scan = prose("` A:b:c `");
    assert_eq!(
        only_miss(&scan).why,
        NearMissKind::InteriorSpacing { at: 1 }
    );
}

/// An interior that is neither label-shaped nor near it is text, not a warning.
#[test]
fn far_from_a_label_is_text() {
    let scan = prose("`this is prose in a code span`");
    assert!(scan.near_misses.is_empty());
}

/// Near-miss, SeveralToOneParenthesis: two label-shaped spans in one
/// parenthesis are no citation form at all, and the parenthesis is warned about
/// as a whole.
#[test]
fn several_to_one_parenthesis() {
    let text = "(`a:b:c` and `d:e:f`)";
    let scan = prose(text);
    let miss = only_miss(&scan);
    assert_eq!(miss.why, NearMissKind::SeveralToOneParenthesis { count: 2 });
    assert_eq!(covered(text, miss.span), text);
}

/// The spans of a several-to-one parenthesis still mint, since neither carries
/// the immediate parenthesis the citation form needs and a bare participating
/// occurrence is the mint form wherever it sits.
///
/// The warning explains the shape; suppressing the mints would hide the very
/// bare occurrences the unique-mint invariant exists to catch
/// (´[LBL-inv:labels:unique-mint]´).
#[test]
fn several_to_one_parenthesis_still_mints() {
    let scan = prose("(`a:b:c` and `d:e:f`)");
    assert_eq!(scan.occurrences.len(), 2);
    assert!(
        scan.occurrences
            .iter()
            .all(|o| matches!(o, Occurrence::Mint { .. }))
    );
}

/// Near-miss, SeveralToOneParenthesis: the count is the parenthesis's own.
#[test]
fn several_to_one_parenthesis_counts_three() {
    let scan = prose("(`a:b:c`, `d:e:f`, `g:h:i`)");
    assert_eq!(
        only_miss(&scan).why,
        NearMissKind::SeveralToOneParenthesis { count: 3 }
    );
}

/// One label-shaped span in one parenthesis is the citation form and no
/// warning.
#[test]
fn one_to_one_parenthesis_is_no_warning() {
    let scan = prose("(`a:b:c`)");
    assert!(scan.near_misses.is_empty());
}

/// The several-to-one count is the innermost parenthesis's, so a nested
/// parenthesis is not warned about twice.
#[test]
fn several_to_one_counts_the_innermost_parenthesis() {
    let scan = prose("((`a:b:c` `d:e:f`))");
    assert_eq!(scan.near_misses.len(), 1);
}

/// A parenthesis inside a delimited span disturbs no count: the span's own
/// bytes are skipped.
#[test]
fn parenthesis_inside_a_span_is_not_a_group() {
    let scan = prose("`fn f(x)` and (`a:b:c`)");
    assert!(scan.near_misses.is_empty());
    assert!(matches!(only(&scan), Occurrence::SameOwner { .. }));
}

/// Near-miss, BacktickInCode: in scanned code text a label-shaped backtick span
/// is where the acute was meant.
#[test]
fn backtick_in_code() {
    let text = "see `inv:labels:unique-mint` above";
    let scan = scan_code(text, 0);
    assert!(scan.occurrences.is_empty());
    let miss = only_miss(&scan);
    assert_eq!(miss.why, NearMissKind::BacktickInCode);
    assert_eq!(covered(text, miss.span), "`inv:labels:unique-mint`");
}

/// Near-miss, BacktickInCode: the warning covers the parentheses too, since
/// that is the occurrence the author meant.
#[test]
fn backtick_in_code_with_parentheses() {
    let text = "see (`inv:labels:unique-mint`) above";
    let scan = scan_code(text, 0);
    assert_eq!(
        covered(text, only_miss(&scan).span),
        "(`inv:labels:unique-mint`)"
    );
}

/// Near-miss, BacktickInCode: the bracketed form too.
#[test]
fn backtick_in_code_imported() {
    let scan = scan_code("(`[SPEC-a:b:c]`)", 0);
    assert_eq!(only_miss(&scan).why, NearMissKind::BacktickInCode);
}

/// An ordinary backtick span in code text is text, not a warning.
#[test]
fn ordinary_backtick_in_code_is_text() {
    let scan = scan_code("returns `Ok(())` on success", 0);
    assert_eq!(scan, RegionScan::default());
}

/// Near-misses of one region are reported in span order.
#[test]
fn near_misses_are_ordered() {
    let scan = prose("`Sec:labels:syntax` then ` a:b:c ` then `[P-d:e:f]`");
    let starts: Vec<usize> = scan
        .near_misses
        .iter()
        .map(|miss| miss.span.start)
        .collect();
    let mut sorted = starts.clone();
    sorted.sort_unstable();
    assert_eq!(starts, sorted);
    assert_eq!(starts.len(), 3);
}

/// Occurrence accessors read the label and the span of every form.
#[test]
fn occurrence_accessors() {
    let scan = prose("(`[P-a:b:c]`)");
    let occurrence = only(&scan);
    assert_eq!(occurrence.label().as_str(), "a:b:c");
    assert_eq!(occurrence.span(), ByteSpan { start: 0, end: 13 });
}
