//! Vector tests for the Markdown frontend (´conv:lint:markdown-surface´).
//!
//! Trace convention: every test's doc comment names the clause it traces to
//! — a sentence of the markdown-surface convention, of the participation
//! judgment (´[LBL-judg:labels:participation]´), of the logical-span rule
//! (´[LBL-gram:labels:well-formed]´), or of head recognition
//! (´dec:lint:head-recognition´).
//!
//! Every test drives the real adoption data: what a head is, what the
//! separator is, and which formats carry heads are all
//! `corpus-adoption.toml`'s, never this file's.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::frontend::{Parsed, Region, RegionKind};
use cogra_linter::pretokenize::pretokenize;
use cogra_linter::scan::{NearMissKind, Occurrence, RegionScan, Syntax, scan_prose};
use cogra_linter::{Adoption, ByteSpan, Language, OwnerId, SourceFile, frontend, frontend_md};

/// The corpus's own adoption data, loaded once.
fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))
            .expect("the adoption data is readable");
        Adoption::from_str(&toml, Path::new("corpus-adoption.toml")).expect("the adoption loads")
    })
}

fn source(markdown: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from("crates/cogra-linter/docs/fixture.md"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("markdown")),
        generated: false,
        bytes: Vec::from(markdown),
    }
}

/// Parse one fixture, which must not fail as a whole.
fn doc(markdown: &str) -> Parsed {
    frontend_md::parse(&source(markdown), adoption()).expect("the fixture parses")
}

/// Scan one region's logical text through the spans the frontend paired.
///
/// The base is zero, so the scan reports region-local offsets and
/// [`Region::locate`] is what carries them into the file — the mapping the
/// frontend supplies for a region that is not contiguous.
fn scan(region: &Region) -> RegionScan {
    scan_prose(&region.text, 0, &region.spans)
}

fn kinds(parsed: &Parsed) -> Vec<RegionKind> {
    parsed.regions.iter().map(|region| region.kind).collect()
}

fn texts(parsed: &Parsed) -> Vec<&str> {
    parsed.regions.iter().map(|region| &*region.text).collect()
}

/// A block-level element becomes one region.
///
/// A block-level element becomes one region.
/// ´claim:markdown:a-block-is-one-region´
#[test]
fn a_paragraph_is_one_region() {
    let parsed = doc("one paragraph\n");
    assert_eq!(texts(&parsed), ["one paragraph"]);
    assert_eq!(kinds(&parsed), [RegionKind::Prose]);
}

/// One block-level element, one region: two paragraphs never merge.
///
/// (´claim:markdown:a-block-is-one-region´)
#[test]
fn two_paragraphs_are_two_regions() {
    let parsed = doc("first\n\nsecond\n");
    assert_eq!(texts(&parsed), ["first", "second"]);
}

/// A heading becomes a region of kind `Heading`.
///
/// A heading becomes a region of its own kind.
/// ´claim:markdown:a-heading-is-its-own-region-kind´
#[test]
fn a_heading_is_a_heading_region() {
    let parsed = doc("## Syntax\n");
    assert_eq!(kinds(&parsed), [RegionKind::Heading]);
}

/// The format's own markers are structure, resolved away before spans are
/// determined.
///
/// The format's own markers are structure, resolved away before spans are determined.
/// ´claim:markdown:format-markers-are-resolved-away´
#[test]
fn a_headings_markers_are_resolved_away() {
    let parsed = doc("### Registry and authorities\n");
    assert_eq!(texts(&parsed), ["Registry and authorities"]);
}

/// A fenced code block becomes a region with `participates: false`,
/// wholesale.
///
/// A fenced code block participates in nothing, wholesale.
/// ´claim:markdown:a-fenced-block-participates-in-nothing´
#[test]
fn a_fenced_block_participates_in_nothing() {
    let parsed = doc("```text\nlabel\n```\n");
    assert_eq!(parsed.regions.len(), 1);
    assert!(!parsed.regions[0].participates);
}

/// The fenced block is its own bytes, fences included: what it displays is
/// what the author fenced.
///
/// A fenced block is its own bytes, fences included: what it displays is what the author fenced.
/// ´claim:markdown:a-fenced-block-is-taken-whole´
#[test]
fn a_fenced_block_is_taken_whole() {
    let parsed = doc("```text\nlabel\n```\n");
    assert_eq!(texts(&parsed), ["```text\nlabel\n```"]);
    assert_eq!(parsed.regions[0].pieces.len(), 1);
}

/// An indented code block is a code block, and displays likewise.
///
/// (´claim:markdown:a-fenced-block-participates-in-nothing´)
#[test]
fn an_indented_block_participates_in_nothing() {
    let parsed = doc("paragraph\n\n    indented code\n");
    assert_eq!(parsed.regions.len(), 2);
    assert!(!parsed.regions[1].participates);
}

/// An HTML block carries no inline structure the format defines, so no span
/// of it is paired and none of it participates.
///
/// An HTML block carries no inline structure the format defines, so none of it participates.
/// ´claim:markdown:an-html-block-participates-in-nothing´
#[test]
fn an_html_block_participates_in_nothing() {
    let parsed = doc("<div>\nraw `a:b:c`\n</div>\n");
    assert!(parsed.regions.iter().all(|region| !region.participates));
}

/// A thematic break carries no text, so it is no region.
///
/// A thematic break carries no text and is no region.
/// ´claim:markdown:a-thematic-break-is-no-region´
#[test]
fn a_thematic_break_is_no_region() {
    let parsed = doc("one\n\n---\n\ntwo\n");
    assert_eq!(texts(&parsed), ["one", "two"]);
}

/// A quotation block's markers are the source's own structure, resolved
/// away: the region is the paragraph inside it.
///
/// A quotation block's markers are resolved away, and the region is the paragraph inside it.
/// ´claim:markdown:quote-markers-are-resolved-away´
#[test]
fn quote_markers_are_resolved_away() {
    let parsed = doc("> quoted one\n> quoted two\n");
    assert_eq!(texts(&parsed), ["quoted one\nquoted two"]);
}

/// Nesting resolves both markers, and still leaves one region.
///
/// (´claim:markdown:quote-markers-are-resolved-away´)
#[test]
fn nested_quote_markers_are_resolved_away() {
    let parsed = doc("> > deep one\n> > deep two\n");
    assert_eq!(texts(&parsed), ["deep one\ndeep two"]);
}

/// A tight list item holds its inline content directly, so the item is the
/// block-level element and the region.
///
/// A tight list item holds its inline content directly, so the item is the region.
/// ´claim:markdown:a-tight-item-is-a-region´
#[test]
fn a_tight_list_item_is_a_region() {
    let parsed = doc("- first item\n- second item\n");
    assert_eq!(texts(&parsed), ["first item", "second item"]);
}

/// A loose item's paragraphs are the block-level elements; the item itself
/// holds no text of its own and is no region.
///
/// A loose item's paragraphs are the regions, the item holding no text of its own.
/// ´claim:markdown:a-loose-items-paragraphs-are-the-regions´
#[test]
fn a_loose_list_items_paragraphs_are_the_regions() {
    let parsed = doc("- para one\n\n  para two\n");
    assert_eq!(texts(&parsed), ["para one", "para two"]);
}

/// List continuation indentation is structure, resolved away.
///
/// List continuation indentation is structure, resolved away.
/// ´claim:markdown:continuation-indentation-is-resolved-away´
#[test]
fn list_continuation_indentation_is_resolved_away() {
    let parsed = doc("- one\n  two\n");
    assert_eq!(texts(&parsed), ["one\ntwo"]);
}

/// A nested list's items are regions in their own right.
///
/// A nested list's items are regions in their own right.
/// ´claim:markdown:nested-items-are-regions´
#[test]
fn nested_list_items_are_regions() {
    let parsed = doc("- outer\n  - inner\n");
    assert_eq!(texts(&parsed), ["outer", "inner"]);
}

/// A region with no structure inside it is one contiguous piece.
///
/// A region with no structure inside it is one contiguous piece.
/// ´claim:markdown:an-unstructured-region-is-one-piece´
#[test]
fn an_unstructured_paragraph_is_one_piece() {
    let parsed = doc("plain text only\n");
    assert_eq!(parsed.regions[0].pieces, [ByteSpan::new(0, 15)]);
}

/// A region assembled across structure has one piece per stretch, and the
/// structure between them is in none of them.
///
/// A region assembled across structure has one piece per stretch, and the structure is in none of them.
/// ´claim:markdown:pieces-skip-the-structure-between-them´
#[test]
fn pieces_skip_the_structure_between_them() {
    let parsed = doc("> one\n> two\n");
    assert_eq!(
        parsed.regions[0].pieces,
        [ByteSpan::new(2, 6), ByteSpan::new(8, 11)]
    );
}

/// The logical text is the source's own bytes over the pieces, assembled
/// verbatim: a piece is copied, never transformed.
///
/// The logical text is the source's own bytes over the pieces, assembled verbatim.
/// ´claim:markdown:the-text-is-the-pieces-concatenated´
#[test]
fn the_text_is_the_concatenation_of_the_pieces() {
    let markdown = "> one\n> two\n";
    let parsed = doc(markdown);
    let assembled: String = parsed.regions[0]
        .pieces
        .iter()
        .map(|piece| &markdown[piece.start..piece.end])
        .collect();
    assert_eq!(assembled, parsed.regions[0].text);
}

/// A span reported against the logical text maps back into the file through
/// the frontend's own mapping (´dec:lint:two-scan-entries´).
///
/// A span reported against the logical text maps back into the file.
/// ´claim:markdown:a-scanned-span-locates-into-the-file´
#[test]
fn a_scanned_span_locates_into_the_file() {
    let markdown = "> as (`inv:labels:unique-mint`) has it\n";
    let parsed = doc(markdown);
    let region = &parsed.regions[0];
    let scan = scan(region);
    let at = region.locate(scan.occurrences[0].span());
    assert_eq!(&markdown[at.start..at.end], "(`inv:labels:unique-mint`)");
}

/// Emphasis is formatting structure, resolved away by the parser.
///
/// Emphasis is formatting structure, resolved away by the parser.
/// ´claim:markdown:emphasis-is-resolved-away´
#[test]
fn emphasis_markers_are_resolved_away() {
    let parsed = doc("an *emphatic* word\n");
    assert_eq!(texts(&parsed), ["an emphatic word"]);
}

/// So is strong emphasis, which is what makes the head form's text
/// readable.
///
/// (´claim:markdown:emphasis-is-resolved-away´)
#[test]
fn strong_markers_are_resolved_away() {
    let parsed = doc("a **bold** word\n");
    assert_eq!(texts(&parsed), ["a bold word"]);
}

/// A link's text is the region's, and its destination is not: the
/// destination is structure the format owns.
///
/// A link's text is the region's and its destination is structure the format owns.
/// ´claim:markdown:a-link-destination-is-not-text´
#[test]
fn a_links_destination_is_not_region_text() {
    let parsed = doc("see [the design](docs/design.md) for it\n");
    assert_eq!(texts(&parsed), ["see the design for it"]);
}

/// A single-backtick span is meant, not displayed.
///
/// A single-backtick span is meant, not displayed.
/// ´claim:markdown:a-single-backtick-span-is-meant´
#[test]
fn a_single_backtick_span_is_not_displayed() {
    let parsed = doc("a `inv:x:y` b\n");
    assert!(!parsed.regions[0].spans[0].displayed);
}

/// A double-backtick span is displayed without participating: the run
/// length is decided by counting the backticks at the span's own offset.
///
/// A multi-backtick span is displayed without participating, the run length deciding.
/// ´claim:markdown:a-multi-backtick-span-is-displayed´
#[test]
fn a_double_backtick_span_is_displayed() {
    let parsed = doc("a ``kind:area:name`` b\n");
    assert!(parsed.regions[0].spans[0].displayed);
}

/// The count is of the run, not of one delimiter: three backticks display
/// as surely as two.
///
/// (´claim:markdown:a-multi-backtick-span-is-displayed´)
#[test]
fn a_triple_backtick_span_is_displayed() {
    let parsed = doc("a ```inv:x:y``` b\n");
    assert!(parsed.regions[0].spans[0].displayed);
}

/// The outer span carries its delimiters and the interior does not, which
/// is the contract the scanner reads.
///
/// A span's outer carries its delimiters and its interior does not.
/// ´claim:markdown:the-outer-carries-the-delimiters´
#[test]
fn a_spans_outer_carries_its_delimiters() {
    let parsed = doc("a ``inv:x:y`` b\n");
    let span = parsed.regions[0].spans[0];
    let text = &parsed.regions[0].text;
    assert_eq!(&text[span.outer.start..span.outer.end], "``inv:x:y``");
    assert_eq!(&text[span.interior.start..span.interior.end], "inv:x:y");
}

/// A displayed span participates in nothing: the scanner reads neither an
/// occurrence nor a near-miss out of one.
///
/// A displayed span yields neither an occurrence nor a near-miss.
/// ´claim:markdown:a-displayed-span-yields-nothing´
#[test]
fn a_displayed_span_yields_no_occurrence() {
    let parsed = doc("a ``inv:x:y`` b\n");
    assert_eq!(scan(&parsed.regions[0]), RegionScan::default());
}

/// A single-backtick span that is label-shaped and bare is a mint.
///
/// A single-backtick span that is label-shaped and bare is a mint.
/// ´claim:markdown:a-bare-prose-span-mints´
#[test]
fn a_bare_span_mints() {
    let parsed = doc("`sec:kinds:syntax`\n");
    let scan = scan(&parsed.regions[0]);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
}

/// The interior is the source's own bytes, so spacing inside the
/// delimiters is spacing and no occurrence
/// (´[LBL-gram:labels:well-formed]´).
///
/// The interior is the source's own bytes, so spacing inside the delimiters is no occurrence.
/// ´claim:markdown:interior-spacing-is-no-occurrence´
#[test]
fn interior_spacing_is_no_occurrence() {
    let parsed = doc("a ` inv:x:y ` b\n");
    let scan = scan(&parsed.regions[0]);
    assert!(scan.occurrences.is_empty());
    assert!(matches!(
        scan.near_misses[0].why,
        NearMissKind::InteriorSpacing { .. }
    ));
}

/// A span wrapped across a line is one span, and its interior carries the
/// line ending the author wrote — so it is not label-shaped, and the
/// warning says so rather than the occurrence standing.
///
/// A span wrapped across a line carries the line ending the author wrote and is no occurrence.
/// ´claim:markdown:a-wrapped-span-is-no-occurrence´
#[test]
fn a_wrapped_span_is_one_span_and_no_occurrence() {
    let parsed = doc("a `inv:x:\ny` b\n");
    assert_eq!(parsed.regions[0].spans.len(), 1);
    let scan = scan(&parsed.regions[0]);
    assert!(scan.occurrences.is_empty());
    assert!(!scan.near_misses.is_empty());
}

/// A code span inside a fenced block is no span at all: the block displays
/// wholesale and pairs nothing.
///
/// A code span inside a fenced block is no span at all, the block pairing nothing.
/// ´claim:markdown:a-fenced-block-pairs-nothing´
#[test]
fn a_fenced_block_pairs_no_span() {
    let parsed = doc("```text\n`inv:x:y`\n```\n");
    assert!(parsed.regions[0].spans.is_empty());
    assert_eq!(scan(&parsed.regions[0]), RegionScan::default());
}

/// The design's fenced illustration: imported-citation-shaped spans inside
/// a fence participate in nothing at all.
///
/// (´claim:markdown:a-fenced-block-pairs-nothing´)
#[test]
fn a_fenced_illustration_participates_in_nothing() {
    let parsed =
        doc("```text\ncitation, from another owner:   (`[SPEC-def:parser:tokenizer]`)\n```\n");
    assert_eq!(parsed.regions.len(), 1);
    assert!(!parsed.regions[0].participates);
    assert!(parsed.regions[0].spans.is_empty());
    assert_eq!(scan(&parsed.regions[0]), RegionScan::default());
}

/// In prose the backtick belongs to the document format, so an unpaired one
/// leaves its block's spans undefined and is a hard failure bounded by that
/// block.
///
/// An unpaired backtick leaves its block's spans undefined and is a hard failure.
/// ´claim:markdown:an-unpaired-backtick-fails´
#[test]
fn an_unpaired_backtick_fails_its_block() {
    let parsed = doc("a ` stray backtick\n");
    assert_eq!(parsed.diagnostics.len(), 1);
    assert_eq!(parsed.diagnostics[0].rule, frontend_md::UNPAIRED_BACKTICK);
}

/// Bounded by that block: the rest of the file resolves normally.
///
/// The failure is bounded by its block, and the rest of the file resolves normally.
/// ´claim:markdown:the-backtick-failure-is-bounded´
#[test]
fn an_unpaired_backtick_fails_only_its_block() {
    let parsed = doc("a ` stray backtick\n\nthen `inv:x:y` resolves\n");
    assert_eq!(parsed.diagnostics.len(), 1);
    assert_eq!(scan(&parsed.regions[1]).occurrences.len(), 1);
}

/// The spans of the failing block are undefined, so the frontend supplies
/// none and the scanner is structurally unable to read an occurrence out of
/// it.
///
/// The failing block supplies no spans, so no occurrence can be read out of it.
/// ´claim:markdown:a-failing-block-supplies-no-spans´
#[test]
fn an_unpaired_backtick_clears_its_blocks_spans() {
    let parsed = doc("`inv:x:y` then ` a stray backtick\n");
    assert!(parsed.regions[0].spans.is_empty());
    assert_eq!(scan(&parsed.regions[0]), RegionScan::default());
}

/// The finding is located at the backtick itself, in the file's own
/// coordinates.
///
/// The unpaired finding is located at the backtick itself, in the file's own coordinates.
/// ´claim:markdown:the-unpaired-finding-is-located-at-the-backtick´
#[test]
fn the_unpaired_finding_is_located_at_the_backtick() {
    let markdown = "first line\n\nsecond ` line\n";
    let parsed = doc(markdown);
    let at = parsed.diagnostics[0].primary.span;
    assert_eq!(&markdown[at.start..at.end], "`");
    assert_eq!(parsed.diagnostics[0].primary.line, 3);
}

/// A backslash-escaped backtick is the author's literal and pairs with
/// nothing by design, so it is no failure. It is recognized by the file
/// byte before it, the backslash having already been resolved away from the
/// logical text.
///
/// An escaped backtick is the author's literal and is no failure.
/// ´claim:markdown:an-escaped-backtick-is-no-failure´
#[test]
fn an_escaped_backtick_is_not_unpaired() {
    let parsed = doc("a \\` literal backtick\n");
    assert!(parsed.diagnostics.is_empty());
}

/// A backtick the format put inside a span is the format's own and is
/// skipped.
///
/// A backtick the format put inside a span is the format's own and is skipped.
/// ´claim:markdown:a-backtick-inside-a-span-is-skipped´
#[test]
fn a_backtick_inside_a_span_is_not_unpaired() {
    let parsed = doc("the backtick `` ` `` itself\n");
    assert!(parsed.diagnostics.is_empty());
}

/// A fenced block's backticks are the fence's, and a non-participating
/// region is not asked about them.
///
/// A fenced block's backticks are the fence's, and a non-participating region is not asked.
/// ´claim:markdown:a-fences-backticks-are-not-asked-about´
#[test]
fn a_fenced_blocks_backticks_are_not_unpaired() {
    let parsed = doc("```text\none ` backtick\n```\n");
    assert!(parsed.diagnostics.is_empty());
}

/// For a heading the head is the rung the format supplies and not the
/// heading's own text.
///
/// For a heading the head is the rung the format supplies and not the heading's own text.
/// ´claim:markdown:a-headings-head-is-its-rung´
#[test]
fn a_headings_head_is_the_rung() {
    let parsed = doc("## Syntax \u{b7} `sec:kinds:syntax`\n");
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Section");
}

/// The label at the head declares the intended kind; the registry validates
/// the pair (´[KND-judg:kinds:classification]´).
///
/// The label at a head declares the intended kind and the registry validates the pair.
/// ´claim:markdown:a-head-declares-its-kind´
#[test]
fn a_headings_mint_declares_the_kind() {
    let parsed = doc("# Title \u{b7} `sec:labels:syntax`\n");
    assert_eq!(parsed.heads[0].declared.as_str(), "sec");
}

/// Every rung is Section: the heading's level is presentation, and the
/// format supplies one rung. The title is the one exception, and it is not
/// a rung — it is the document, which is why it is asked for separately.
///
/// Every heading level supplies one rung, the level being presentation.
/// ´claim:markdown:every-level-supplies-one-rung´
#[test]
fn every_heading_level_supplies_one_rung() {
    let parsed = doc("## a \u{b7} `sec:x:one`\n\n##### b \u{b7} `sec:x:two`\n");
    assert_eq!(parsed.heads.len(), 2);
    assert!(parsed.heads.iter().all(|head| head.text == "Section"));
}

/// A heading is a head when it is followed by the separator and the mint.
///
/// A heading is a head when the separator and the mint follow it.
/// ´claim:markdown:a-heading-without-a-mint-heads-nothing´
#[test]
fn a_heading_without_a_mint_heads_nothing() {
    let parsed = doc("## A Section With No Mint\n");
    assert!(parsed.heads.is_empty());
}

/// The first level-one heading is the document's Title head, and its
/// environment name is Document whatever the title says
/// (´dec:lint:title-head´).
///
/// The first level-one heading is the document's Title head whatever the title says.
/// ´claim:markdown:the-first-level-one-heading-is-the-title´
#[test]
fn the_first_level_one_heading_is_the_title_head() {
    let parsed = doc("# A Calculus of Documentation \u{b7} `spec:x:calculus`\n");
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Document");
    assert_eq!(parsed.heads[0].declared.as_str(), "spec");
    assert!(parsed.diagnostics.is_empty());
}

/// Only the first: a later level-one heading is an ordinary division and
/// takes the rung the format supplies.
///
/// A later level-one heading is an ordinary division and takes the format's rung.
/// ´claim:markdown:a-later-level-one-heading-is-a-division´
#[test]
fn a_later_level_one_heading_is_an_ordinary_division() {
    let parsed = doc("# One \u{b7} `spec:x:one`\n\n# Two \u{b7} `sec:x:two`\n");
    assert_eq!(parsed.heads.len(), 2);
    assert_eq!(parsed.heads[0].text, "Document");
    assert_eq!(parsed.heads[1].text, "Section");
}

/// A setext level-one heading is a level-one heading: the format supplies
/// the rung, and how the author underlined it is presentation.
///
/// A setext level-one heading is a level-one heading, the underlining being presentation.
/// ´claim:markdown:a-setext-heading-is-a-heading´
#[test]
fn a_setext_level_one_heading_is_the_title_head() {
    let parsed = doc("A Calculus \u{b7} `spec:x:calculus`\n===\n");
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Document");
}

/// The claim is made when the heading opens, so a first level-one heading
/// that carries no mint takes the title with it: the coverage finding names
/// that heading, and the next one stays an ordinary division.
///
/// The title claim is made when the heading opens, so an unminted first heading still takes it.
/// ´claim:markdown:the-title-is-claimed-when-it-opens´
#[test]
fn an_unminted_title_is_a_finding_and_still_the_title() {
    let parsed = doc("# Untitled\n\n# Later \u{b7} `sec:x:later`\n");
    assert_eq!(parsed.diagnostics.len(), 1);
    assert_eq!(
        parsed.diagnostics[0].rule.as_str(),
        "markdown-title-unminted"
    );
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Section");
}

/// A source with no level-one heading is exempt, and nothing is
/// synthesized for it.
///
/// A source with no level-one heading is exempt, and nothing is synthesized for it.
/// ´claim:markdown:no-level-one-heading-is-exempt´
#[test]
fn a_source_without_a_level_one_heading_is_exempt() {
    let parsed = doc("## Only a section \u{b7} `sec:x:only`\n\nprose\n");
    assert!(parsed.diagnostics.is_empty());
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Section");
}

/// The separator is what says where the head text ends and the label
/// begins, so a mint without it heads nothing.
///
/// The separator says where the head text ends, so a mint without it heads nothing.
/// ´claim:markdown:the-separator-ends-the-head-text´
#[test]
fn a_heading_without_the_separator_heads_nothing() {
    let parsed = doc("## Syntax `sec:kinds:syntax`\n");
    assert!(parsed.heads.is_empty());
}

/// The bold form: a bold run opening a block, of the shape `Kind (Title)`,
/// followed by the separator and the mint.
///
/// A bold run opening a block, of the ruled shape and followed by separator and mint, is a head.
/// ´claim:markdown:a-bold-run-of-the-shape-is-a-head´
#[test]
fn a_bold_run_of_the_shape_is_a_head() {
    let parsed = doc("**Convention (Results and assertions)** \u{b7} `conv:kinds:results`\n");
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Convention");
    assert_eq!(parsed.heads[0].declared.as_str(), "conv");
}

/// The parenthesized Title names this instance and is not part of the head:
/// handing it to the registry would ask it to classify a proper noun.
///
/// The parenthesized title names the instance and is not part of the head.
/// ´claim:markdown:the-title-is-not-the-head´
#[test]
fn the_title_is_not_part_of_the_head() {
    let parsed = doc("**Inference rule (Hybrid kinds)** \u{b7} `inf:kinds:hybrid`\n");
    assert_eq!(parsed.heads[0].text, "Inference rule");
}

/// A bold run carrying no parenthesis is not a head.
///
/// A bold run carrying no parenthesis is no head.
/// ´claim:markdown:a-parenthesisless-bold-run-is-no-head´
#[test]
fn a_bold_run_without_a_parenthesis_is_no_head() {
    let parsed = doc("**Note** \u{b7} `rem:kinds:aside`\n");
    assert!(parsed.heads.is_empty());
}

/// The bold run must open the block: emphasis in the middle of a paragraph
/// heads nothing.
///
/// The bold run must open its block, so emphasis mid-paragraph heads nothing.
/// ´claim:markdown:a-bold-run-must-open-its-block´
#[test]
fn a_bold_run_inside_a_block_is_no_head() {
    let parsed = doc("prose then **Convention (Title)** \u{b7} `conv:kinds:results`\n");
    assert!(parsed.heads.is_empty());
}

/// A bold run inside the head's own bold run closes the inner one, not the
/// head: the head text runs to where the run that opened the block ends.
///
/// A bold run inside the head's own run closes the inner one and not the head.
/// ´claim:markdown:a-nested-bold-run-does-not-close-the-head´
#[test]
fn a_nested_bold_run_does_not_close_the_head() {
    let parsed = doc("**Convention (__A__ title)** \u{b7} `conv:kinds:results`\n");
    assert_eq!(parsed.heads.len(), 1);
    assert_eq!(parsed.heads[0].text, "Convention");
}

/// The mint is bare; a parenthesized span after the separator is a citation
/// and declares nothing.
///
/// The mint is bare, so a parenthesized span after the separator declares nothing.
/// ´claim:markdown:a-citation-after-the-separator-declares-nothing´
#[test]
fn a_citation_after_the_separator_is_no_mint() {
    let parsed = doc("**Convention (Title)** \u{b7} (`conv:kinds:results`)\n");
    assert!(parsed.heads.is_empty());
}

/// A head's span points at the head text itself, which is what a
/// head-validation diagnostic complains about.
///
/// A head's span points at the head text itself.
/// ´claim:markdown:a-heads-span-is-its-text´
#[test]
fn a_bold_heads_span_covers_its_head_text() {
    let markdown = "**Convention (Title)** \u{b7} `conv:kinds:results`\n";
    let parsed = doc(markdown);
    let at = parsed.heads[0].span;
    assert_eq!(&markdown[at.start..at.end], "Convention");
}

/// A head inside a fenced illustration heads nothing: the block displays
/// and participates in nothing, and only participating authored heads are
/// judged (´[KND-inv:kinds:totality]´).
///
/// A head inside a fenced illustration heads nothing, only participating heads being judged.
/// ´claim:markdown:a-fenced-head-heads-nothing´
#[test]
fn a_head_shaped_fence_heads_nothing() {
    let parsed = doc("```text\n**Convention (Title)** \u{b7} `conv:kinds:results`\n```\n");
    assert!(parsed.heads.is_empty());
}

/// A table cell is a region in its own right, classified by the same rules
/// as any other — there is no special case for tables.
///
/// A table cell is a region in its own right, with no special case for tables.
/// ´claim:markdown:a-table-cell-is-a-region´
#[test]
fn table_cells_are_regions() {
    let parsed = doc("| Environment | Kind |\n| --- | --- |\n| Axiom | `ax` |\n");
    assert_eq!(texts(&parsed), ["Environment", "Kind", "Axiom", "`ax`"]);
    assert!(
        parsed
            .regions
            .iter()
            .all(|region| region.kind == RegionKind::TableRow)
    );
}

/// The header row's cells are the table's headers.
///
/// A table's headers are its header row's cells.
/// ´claim:markdown:a-tables-headers-are-its-header-row´
#[test]
fn a_tables_headers_are_its_header_row() {
    let parsed = doc("| Environment | Kind |\n| --- | --- |\n| Axiom | `ax` |\n");
    assert_eq!(parsed.tables[0].headers, ["Environment", "Kind"]);
}

/// Its body rows are the rows below the delimiter row, in order.
///
/// A table's body rows are the rows below its delimiter row, in order.
/// ´claim:markdown:a-tables-body-is-below-the-delimiter´
#[test]
fn a_tables_rows_are_its_body() {
    let parsed = doc("| A | B |\n| --- | --- |\n| one | two |\n| three | four |\n");
    assert_eq!(parsed.tables[0].rows, [["one", "two"], ["three", "four"]]);
}

/// The table's span covers the whole table, which is where a finding about
/// one of its rows points.
///
/// A table's span covers the whole table, which is where a finding about a row points.
/// ´claim:markdown:a-tables-span-covers-it-whole´
#[test]
fn a_tables_span_covers_the_whole_table() {
    let markdown = "before\n\n| A | B |\n| --- | --- |\n| one | two |\n";
    let parsed = doc(markdown);
    let at = parsed.tables[0].span;
    assert!(markdown[at.start..at.end].starts_with("| A | B |"));
    assert!(markdown[at.start..at.end].ends_with("| one | two |\n"));
}

/// The registry's rows carry kind tokens in plain code spans that are
/// deliberately not label-shaped, and every one is classified by the same
/// rules as any other span: a span parsing as no form is ordinary text.
///
/// A cell's span parsing as no form is ordinary text, tables getting no special rule.
/// ´claim:markdown:a-cell-span-is-classified-like-any-other´
#[test]
fn a_kind_token_in_a_cell_is_ordinary_text() {
    let parsed = doc("| Environment | Kind |\n| --- | --- |\n| Axiom | `ax` |\n");
    let cell = &parsed.regions[3];
    assert_eq!(cell.spans.len(), 1);
    assert!(!cell.spans[0].displayed);
    assert_eq!(scan(cell), RegionScan::default());
}

/// The frontend's own accessor answers with what it recorded.
///
/// The frontend's table accessor answers with what it recorded.
/// ´claim:markdown:the-table-accessor-answers-with-what-it-recorded´
#[test]
fn the_tables_accessor_answers_with_the_documents_tables() {
    let parsed = doc("| A | B |\n| --- | --- |\n| one | two |\n");
    assert_eq!(frontend_md::tables(&parsed), parsed.tables);
}

/// A label-shaped interior whose only defect is casing, through real
/// markdown.
///
/// The casing near-miss surfaces through real markdown.
/// ´claim:markdown:near-misses-surface-through-markdown´
#[test]
fn wrong_case_surfaces_through_markdown() {
    let parsed = doc("as (`Inv:labels:unique-mint`) has it\n");
    assert!(matches!(
        scan(&parsed.regions[0]).near_misses[0].why,
        NearMissKind::WrongCase { .. }
    ));
}

/// A bracketed interior outside any parenthesis, through real markdown.
///
/// (´claim:markdown:near-misses-surface-through-markdown´)
#[test]
fn a_misplaced_bracket_surfaces_through_markdown() {
    let parsed = doc("the label `[LBL-inv:labels:unique-mint]` stands bare\n");
    assert!(matches!(
        scan(&parsed.regions[0]).near_misses[0].why,
        NearMissKind::MisplacedBracket
    ));
}

/// Several label-shaped spans inside one parenthesis, which is no citation
/// form at all, through real markdown.
///
/// (´claim:markdown:near-misses-surface-through-markdown´)
#[test]
fn several_to_one_parenthesis_surfaces_through_markdown() {
    let parsed = doc("see (`inv:labels:unique-mint` and `inv:labels:inventory`)\n");
    let scan = scan(&parsed.regions[0]);
    assert!(
        scan.near_misses
            .iter()
            .any(|miss| matches!(miss.why, NearMissKind::SeveralToOneParenthesis { count: 2 }))
    );
}

/// The backtick-in-code near-miss is unreachable from prose, and
/// structurally so: it warns where the acute was meant, and the acute
/// belongs to the code syntax alone (´dec:lint:two-scan-entries´).
///
/// The backtick-in-code near-miss is structurally unreachable from prose.
/// ´claim:markdown:the-code-warning-is-unreachable-from-prose´
#[test]
fn the_backtick_in_code_class_is_unreachable_from_prose() {
    let parsed = doc("a `inv:x:y` and `[LBL-inv:x:y]` and `Inv:X:y` and ` inv:x:y `\n");
    let scan = scan(&parsed.regions[0]);
    assert!(
        !scan
            .near_misses
            .iter()
            .any(|miss| matches!(miss.why, NearMissKind::BacktickInCode))
    );
}

/// Every region a Markdown source yields carries the prose syntax.
///
/// Every region a Markdown source yields carries the prose syntax.
/// ´claim:markdown:every-markdown-region-is-prose´
#[test]
fn every_markdown_region_carries_the_prose_syntax() {
    let parsed = doc("para\n\n## head\n\n```\nfence\n```\n\n| A |\n| --- |\n| one |\n");
    assert!(
        parsed
            .regions
            .iter()
            .all(|region| region.syntax == Syntax::Prose)
    );
}

/// A region of a generated source is generated, which is what excludes it
/// from the harvest it feeds (´[LBL-inv:labels:generated-compliance]´).
///
/// A region of a generated source is generated.
/// ´claim:markdown:a-generated-sources-regions-are-generated´
#[test]
fn a_generated_sources_regions_are_generated() {
    let mut src = source("a paragraph\n");
    src.generated = true;
    let parsed = frontend_md::parse(&src, adoption()).expect("parses");
    assert!(parsed.regions.iter().all(|region| region.generated));
}

/// A language with no frontend yields an empty `Parsed`: its files stay in
/// the carrier and stay owned, carrying no occurrences.
///
/// A language with no frontend yields nothing, its files staying carried and owned.
/// ´claim:markdown:no-frontend-yields-nothing´
#[test]
fn a_language_with_no_frontend_yields_nothing() {
    let mut src = source("`inv:x:y`\n");
    src.language = Some(Language::new("sql"));
    let parsed = frontend::parse(
        &src,
        &pretokenize(src.language.as_ref(), &src.bytes),
        adoption(),
    )
    .expect("no frontend, no failure");
    assert!(parsed.regions.is_empty() && parsed.heads.is_empty());
    assert_eq!(parsed.path, src.path);
}

/// A file with no language at all is likewise vacuously in good standing.
///
/// (´claim:markdown:no-frontend-yields-nothing´)
#[test]
fn a_source_with_no_language_yields_nothing() {
    let mut src = source("`inv:x:y`\n");
    src.language = None;
    let parsed = frontend::parse(
        &src,
        &pretokenize(src.language.as_ref(), &src.bytes),
        adoption(),
    )
    .expect("no frontend, no failure");
    assert!(parsed.regions.is_empty());
}

/// The dispatcher hands Markdown to the Markdown frontend.
///
/// The dispatcher hands a Markdown source to the Markdown frontend.
/// ´claim:markdown:the-dispatcher-reaches-the-markdown-frontend´
#[test]
fn the_dispatcher_reaches_the_markdown_frontend() {
    let src = source("## Syntax \u{b7} `sec:kinds:syntax`\n");
    let parsed = frontend::parse(
        &src,
        &pretokenize(src.language.as_ref(), &src.bytes),
        adoption(),
    )
    .expect("parses");
    assert_eq!(parsed.heads.len(), 1);
}

/// A source that is not UTF-8 cannot be read at all, and that is the one
/// Markdown defect that costs the whole file.
///
/// A Markdown source that is not UTF-8 costs the whole file.
/// ´claim:markdown:a-non-utf8-markdown-source-is-lost´
#[test]
fn a_source_that_is_not_utf8_is_an_error() {
    let mut src = source("");
    src.bytes = vec![0xff, 0xfe, 0x00];
    let findings = frontend_md::parse(&src, adoption()).expect_err("not text");
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].rule, frontend_md::NOT_TEXT);
}

/// No rule identifier of this module is label-shaped: `lint` is a reserved
/// kind no profile governs (´sig:lint:diagnostic-api´).
///
/// (´claim:diagnostics:no-rule-identifier-is-label-shaped´)
#[test]
fn no_markdown_rule_identifier_is_label_shaped() {
    for rule in frontend_md::RULES {
        assert!(!rule.as_str().contains(':'), "{rule} is label-shaped");
    }
}
