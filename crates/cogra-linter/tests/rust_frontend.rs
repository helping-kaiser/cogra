//! Vector tests for the Rust frontend (´conv:lint:rust-surface´).
//!
//! Trace convention: every test's doc comment names the clause it traces to
//! — one of the five documentation forms of `[scanned-regions]`, its region
//! unit, a `[profiles]` census rule, the staging decision
//! (´dec:lint:staged-profiles´), or the error boundary
//! (´crit:lint:error-or-finding´).
//!
//! Every test drives the real adoption data: which forms are scanned, what
//! the harnesses are, and which profiles are in force are all
//! `corpus-adoption.toml`'s, never this file's. The one clause it no longer
//! supplies a subject for — a staged profile — is held by an inverted
//! fixture built from the same file.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::frontend::{Region, RegionKind};
use cogra_linter::pretokenize::{CommentForm, PreTokenized, pretokenize};
use cogra_linter::scan::{Occurrence, Syntax, scan_code};
use cogra_linter::{
    Adoption, ByteSpan, CargoTarget, Enforcement, Language, OwnerId, Parsed, ProfileStatus,
    SourceFile, frontend, frontend_rust,
};

/// The corpus's own adoption data, loaded once.
fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let at = root.join("corpus-adoption.toml");
        let text = std::fs::read_to_string(&at).expect("the corpus carries its adoption data");
        Adoption::from_str(&text, Path::new("corpus-adoption.toml")).expect("it loads")
    })
}

fn source(text: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from("x.rs"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from(text),
    }
}

fn pre_of(src: &SourceFile) -> PreTokenized {
    pretokenize(src.language.as_ref(), &src.bytes)
}

/// The ruled adoption with the module profile put back where it entered from
/// (´dec:lint:staged-profiles´).
///
/// Both profiles are in force today, so the staged half of the decision has
/// no subject in the ruled data and a fixture supplies one. The module
/// profile is the last one `[profiles]` registers, so the last effective
/// status in the file is its own.
fn module_staged() -> Adoption {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let text = std::fs::read_to_string(root.join("corpus-adoption.toml"))
        .expect("the corpus carries its adoption data")
        .replace("effective = 2", "effective = 1");
    let mark = "status = \"effective\"";
    let at = text.rfind(mark).expect("the module profile is effective");
    let text = format!(
        "{}status = \"staged\"{}",
        &text[..at],
        &text[at + mark.len()..]
    );
    Adoption::from_str(&text, Path::new("corpus-adoption.toml")).expect("it loads")
}

/// Parse a fixture, asserting it parses.
fn parse(text: &str) -> Parsed {
    parse_under(adoption(), text)
}

/// The same, under an adoption a fixture built rather than the ruled one.
fn parse_under(a: &Adoption, text: &str) -> Parsed {
    let src = source(text);
    let pre = pre_of(&src);
    frontend_rust::parse(&src, &pre, a).expect("the fixture parses")
}

/// The regions of a fixture.
fn regions(text: &str) -> Vec<Region> {
    parse(text).regions
}

/// The region kinds of a fixture.
fn kinds(text: &str) -> Vec<RegionKind> {
    regions(text).into_iter().map(|one| one.kind).collect()
}

/// The region texts of a fixture.
fn texts(text: &str) -> Vec<String> {
    regions(text).into_iter().map(|one| one.text).collect()
}

/// The censuses of a fixture under one target.
fn censuses(text: &str, target: CargoTarget) -> frontend_rust::Censuses {
    let src = source(text);
    frontend_rust::censuses(&src, adoption(), target).expect("the fixture parses")
}

/// The identifiers a census covered, in order.
fn covered(assets: &[cogra_linter::Asset]) -> Vec<&str> {
    assets.iter().map(|one| one.identifier.as_str()).collect()
}

/// `[scanned-regions]`, first scanned form: outer line doc comments.
#[test]
fn an_outer_line_doc_comment_is_a_region() {
    assert_eq!(
        kinds("/// doc\nstruct X;\n"),
        vec![RegionKind::Comment(CommentForm::LineOuterDoc)]
    );
}

/// Second form: inner line doc comments.
#[test]
fn an_inner_line_doc_comment_is_a_region() {
    assert_eq!(
        kinds("//! module doc\nstruct X;\n"),
        vec![RegionKind::Comment(CommentForm::LineInnerDoc)]
    );
}

/// Third form: outer block doc comments.
#[test]
fn an_outer_block_doc_comment_is_a_region() {
    assert_eq!(
        kinds("/** doc */\nstruct X;\n"),
        vec![RegionKind::Comment(CommentForm::BlockOuterDoc)]
    );
}

/// Fourth form: inner block doc comments.
#[test]
fn an_inner_block_doc_comment_is_a_region() {
    assert_eq!(
        kinds("/*! module doc */\nstruct X;\n"),
        vec![RegionKind::Comment(CommentForm::BlockInnerDoc)]
    );
}

/// Fifth form: a written `#[doc = "…"]` attribute, which is no comment and
/// therefore no comment kind.
#[test]
fn a_written_doc_attribute_is_a_region() {
    assert_eq!(
        kinds("#[doc = \"written\"]\nstruct X;\n"),
        vec![RegionKind::Attribute]
    );
}

/// The region unit of `[scanned-regions]`: a run of consecutive `///`
/// lines is ONE logical region.
#[test]
fn a_run_of_outer_doc_lines_is_one_region() {
    let regions = regions("/// one\n/// two\n/// three\nstruct X;\n");
    assert_eq!(regions.len(), 1);
    assert_eq!(regions[0].text, " one two three");
}

/// The run's pieces are one per line, so a diagnostic points at the line
/// the defect is on and not at the whole run.
#[test]
fn a_run_carries_one_piece_per_line() {
    let regions = regions("/// one\n/// two\nstruct X;\n");
    assert_eq!(regions[0].pieces.len(), 2);
    assert_eq!(regions[0].pieces[0], ByteSpan::new(3, 7));
    assert_eq!(regions[0].pieces[1], ByteSpan::new(11, 15));
}

/// A blank line ends the run: the region unit says *consecutive* lines.
#[test]
fn a_blank_line_ends_a_run() {
    assert_eq!(regions("/// one\n\n/// two\nstruct X;\n").len(), 2);
}

/// An empty `///` line does not end a run — it is a line of it.
#[test]
fn an_empty_doc_line_continues_a_run() {
    let regions = regions("/// one\n///\n/// two\nstruct X;\n");
    assert_eq!(regions.len(), 1);
    assert_eq!(regions[0].pieces.len(), 3);
}

/// Two items' doc comments are two regions: the item between them is not
/// whitespace, so the run is broken.
#[test]
fn two_items_carry_two_regions() {
    assert_eq!(regions("/// a\nstruct A;\n/// b\nstruct B;\n").len(), 2);
}

/// An inner run and an outer run are different forms and never merge.
#[test]
fn an_inner_run_never_joins_an_outer_one() {
    assert_eq!(regions("//! inner\n/// outer\nstruct X;\n").len(), 2);
}

/// Block doc comments are one region each, never a run: only line forms
/// assemble.
#[test]
fn block_doc_comments_do_not_assemble() {
    assert_eq!(regions("/** a */\n/** b */\nstruct X;\n").len(), 2);
}

/// `[scanned-regions]` does not scan fenced documentation examples, so a run
/// carrying a fence is cut into a participating stretch and a fenced one.
///
/// The fence lines themselves belong to the fenced stretch: they are the
/// example's own delimiters, and letting them participate is what used to
/// give the backtick something to pair across.
#[test]
fn f2_a_fenced_example_does_not_participate() {
    let regions = regions(
        "/// before\n///\n/// ```\n/// let l = ´def:fx:fenceleak´;\n/// ```\n/// after\nstruct X;\n",
    );
    let participating: Vec<&str> = regions
        .iter()
        .filter(|one| one.participates)
        .map(|one| one.text.as_str())
        .collect();
    assert_eq!(participating, [" before", " after"]);
    assert!(
        regions
            .iter()
            .any(|one| !one.participates && one.text.contains("fenceleak")),
        "the fenced stretch is present and not scanned"
    );
}

/// The fence bytes stay in the pieces: a region records the file ranges it
/// was assembled from, and the cut moves none of them.
#[test]
fn f2_the_fence_bytes_stay_in_the_pieces() {
    let text = "/// a\n/// ```\n/// b\n/// ```\n/// c\nstruct X;\n";
    let regions = regions(text);
    let covered: usize = regions
        .iter()
        .flat_map(|one| one.pieces.iter())
        .map(ByteSpan::len)
        .sum();
    let assembled: usize = regions.iter().map(|one| one.text.len()).sum();
    assert_eq!(covered, assembled);
    let pieces: Vec<ByteSpan> = regions
        .iter()
        .flat_map(|one| one.pieces.iter().copied())
        .collect();
    assert_eq!(pieces.len(), 5, "one piece per line of the run: {pieces:?}");
    for piece in &pieces {
        assert!(text.get(piece.start..piece.end).is_some());
    }
}

/// A mint written inside a fenced example is not a mint, so a citation of it
/// resolves nowhere — the fixture the audit reproduced the leak with.
#[test]
fn f2_a_fenced_mint_resolves_no_citation() {
    let rust = SourceFile {
        path: PathBuf::from("docs/fence.rs"),
        owner: OwnerId::new("doc.fenced"),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from(
            "/// Example:\n///\n/// ```\n/// let s = \"`\";\n/// let l = ´def:fx:fenceleak´;\n/// ```\npub fn one() {}\n",
        ),
    };
    let prose = SourceFile {
        path: PathBuf::from("docs/cites.md"),
        owner: OwnerId::new("doc.fenced"),
        language: Some(Language::new("markdown")),
        generated: false,
        bytes: Vec::from("**Thing (A)** · `def:fx:a`\n\nfenceleak: (`def:fx:fenceleak`)\n"),
    };
    let run = cogra_linter::check_sources(adoption(), vec![rust, prose]);
    assert!(
        run.findings
            .iter()
            .any(|one| one.rule.as_str() == "label-unresolved-citation"
                && one.message.contains("def:fx:fenceleak")),
        "the citation of a fenced mint resolves: {:?}",
        run.findings
            .iter()
            .map(|one| one.message.as_str())
            .collect::<Vec<_>>()
    );
}

/// (´[LBL-cav:labels:coexistence]´): enforcement is orthogonal to
/// severity — an error is an error wherever it is found, and only the
/// exit code differs.
///
/// The witness is a fixture rather than the corpus: every Rust crate has
/// completed the ban sweep and entered the failing set, so no advisory
/// tree in the corpus carries a finding to read this off any more.
#[test]
fn an_advisory_finding_keeps_its_severity() {
    let banned = SourceFile {
        path: PathBuf::from("outside/every/failing/prefix.rs"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from("// narration the ban refuses\npub fn one() {}\n"),
    };
    let run = cogra_linter::check_sources(adoption(), vec![banned]);
    let found = run
        .findings
        .iter()
        .find(|one| one.rule.as_str() == "rust-plain-line-comment")
        .expect("the plain comment is reported");
    assert_eq!(
        found.enforcement,
        Enforcement::Advisory,
        "a path under no failing prefix is advisory"
    );
    assert_eq!(
        found.severity,
        cogra_linter::Severity::Error,
        "an error outside the failing set is still an error"
    );
}

/// The leader is resolved away: no region's text carries a `///`.
#[test]
fn the_line_leader_is_resolved_away() {
    assert_eq!(texts("/// doc\nstruct X;\n"), vec![String::from(" doc")]);
}

/// The inner leader likewise.
#[test]
fn the_inner_leader_is_resolved_away() {
    assert_eq!(texts("//! doc\nstruct X;\n"), vec![String::from(" doc")]);
}

/// A block form's delimiters are resolved away at both ends.
#[test]
fn the_block_delimiters_are_resolved_away() {
    assert_eq!(
        texts("/** doc */\nstruct X;\n"),
        vec![String::from(" doc ")]
    );
}

/// A written attribute's region is the literal's interior.
#[test]
fn a_written_attribute_yields_the_literal_interior() {
    assert_eq!(
        texts("#[doc = \"written\"]\nstruct X;\n"),
        vec![String::from("written")]
    );
}

/// And a raw literal's interior, hashes and all resolved away.
#[test]
fn a_raw_written_attribute_yields_its_interior() {
    assert_eq!(
        texts("#[doc = r#\"a \"quoted\" b\"#]\nstruct X;\n"),
        vec![String::from("a \"quoted\" b")]
    );
}

/// A plain comment is no scanned region: `[scanned-regions]` lists it under
/// `not_scanned`, and `[banned-tokens]` forbids it outright.
#[test]
fn a_plain_comment_is_no_region() {
    assert!(regions("// note\nstruct X;\n").is_empty());
    assert!(regions("/* note */\nstruct X;\n").is_empty());
}

/// A pieces-sum invariant: the pieces are copied verbatim, so their lengths
/// sum to the text's length. That is what makes `Region::locate` exact.
#[test]
fn the_pieces_sum_to_the_text() {
    for fixture in [
        "/// one\n/// two\nstruct X;\n",
        "/** a */\nstruct X;\n",
        "//! a\n//! b\n",
        "#[doc = \"written\"]\nstruct X;\n",
    ] {
        for region in regions(fixture) {
            let sum: usize = region.pieces.iter().map(ByteSpan::len).sum();
            assert_eq!(sum, region.text.len(), "in {fixture:?}");
        }
    }
}

/// Rust's regions carry the code syntax: the acute belongs to the label
/// syntax and classifies locally (´dec:lint:two-scan-entries´).
#[test]
fn a_rust_region_carries_the_code_syntax() {
    let regions = regions("/// doc\nstruct X;\n");
    assert_eq!(regions[0].syntax, Syntax::Code);
    assert!(regions[0].spans.is_empty());
}

/// Doc comments are the scanned regions, so they participate.
#[test]
fn a_doc_region_participates() {
    assert!(regions("/// doc\nstruct X;\n")[0].participates);
}

/// A generated source's regions are generated.
#[test]
fn a_generated_source_yields_generated_regions() {
    let mut src = source("/// doc\nstruct X;\n");
    src.generated = true;
    let pre = pre_of(&src);
    let parsed = frontend_rust::parse(&src, &pre, adoption()).expect("parses");
    assert!(parsed.regions[0].generated);
}

/// This frontend produces no heads: a code comment carries occurrences and
/// heads nothing (´dec:lint:head-recognition´).
#[test]
fn the_rust_frontend_produces_no_heads() {
    assert!(
        parse("/// Definition (Thing) \u{b7} `def:x:thing`\nstruct X;\n")
            .heads
            .is_empty()
    );
}

/// And no tables.
#[test]
fn the_rust_frontend_produces_no_tables() {
    assert!(parse("/// | a | b |\nstruct X;\n").tables.is_empty());
}

/// An occurrence in a doc region scans out of the region's logical text and
/// locates back into the file: the whole point of the pieces mapping.
#[test]
fn an_occurrence_locates_back_into_the_file() {
    let text = "/// see \u{b4}sig:lint:pretokenizer-api\u{b4} for the rest\nstruct X;\n";
    let regions = regions(text);
    let scanned = scan_code(&regions[0].text, 0);
    assert_eq!(scanned.occurrences.len(), 1);
    let Occurrence::Mint { span, label } = &scanned.occurrences[0] else {
        panic!("a bare occurrence is a mint");
    };
    assert_eq!(label.as_str(), "sig:lint:pretokenizer-api");
    let at = regions[0].locate(*span);
    assert_eq!(
        &text[at.start..at.end],
        "\u{b4}sig:lint:pretokenizer-api\u{b4}"
    );
}

/// A region-local span crossing a piece boundary maps to a file span that
/// covers the leader the logical text resolved away: the whole of what the
/// author wrote, markers included.
#[test]
fn a_span_across_a_run_covers_the_leader_between() {
    let text = "/// one\n/// two\nstruct X;\n";
    let regions = regions(text);
    assert_eq!(regions[0].text, " one two");
    let across = regions[0].locate(ByteSpan::new(1, 6));
    assert_eq!(&text[across.start..across.end], "one\n/// t");
}

/// A source that is not UTF-8 is a located finding and never a panic
/// (´crit:lint:error-or-finding´).
#[test]
fn a_source_that_is_not_utf8_is_a_finding() {
    let mut src = source("");
    src.bytes = vec![0xff, 0xfe, 0x00];
    let pre = pre_of(&src);
    let findings = frontend_rust::parse(&src, &pre, adoption()).expect_err("not text");
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].rule, frontend_rust::NOT_TEXT);
    assert_eq!(findings[0].primary.path, src.path);
}

/// But the pre-tokenizer still runs on those bytes, so a ban still fires:
/// a lexical fact does not wait on an AST.
#[test]
fn a_source_that_is_not_utf8_still_pre_tokenizes() {
    let bytes = [0xffu8, b'\n', b'/', b'/', b' ', b'x', b'\n'];
    let pre = pretokenize(Some(&Language::new("rust")), &bytes);
    assert!(pre.partitions(bytes.len()));
    assert_eq!(pre.comments().count(), 1);
}

/// A source `syn` rejects is a located finding too.
#[test]
fn an_unparsable_source_is_a_located_finding() {
    let src = source("fn ( { ]\n");
    let pre = pre_of(&src);
    let findings = frontend_rust::parse(&src, &pre, adoption()).expect_err("syn rejects it");
    assert!(!findings.is_empty());
    assert_eq!(findings[0].rule, frontend_rust::UNPARSABLE);
    assert_eq!(findings[0].primary.path, src.path);
}

/// The lexer takes bytes and no file, so its diagnostics arrive unstamped
/// and the caller holding the source completes them: which file the bytes
/// came from and whether findings there fail the lane are the two fields no
/// byte-level lexer can know.
#[test]
fn the_lexer_s_failures_are_stamped_with_their_source() {
    let src = source("/* never closed\n");
    let mut pre = pre_of(&src);
    assert_eq!(pre.unclassified.len(), 1);
    assert_eq!(pre.unclassified[0].primary.path, PathBuf::new());

    pre.stamp(&src.path, &src.bytes, Enforcement::Advisory);
    assert_eq!(pre.unclassified[0].primary.path, src.path);
    assert_eq!(pre.unclassified[0].enforcement, Enforcement::Advisory);
    assert_eq!(pre.unclassified[0].primary.line, 1);
}

/// The dispatcher reaches this frontend for a Rust source
/// (´dec:lint:frontend-dispatch´).
#[test]
fn the_dispatcher_reaches_the_rust_frontend() {
    let src = source("/// doc\nstruct X;\n");
    let pre = pre_of(&src);
    let parsed = frontend::parse(&src, &pre, adoption()).expect("parses");
    assert_eq!(
        parsed.regions[0].kind,
        RegionKind::Comment(CommentForm::LineOuterDoc)
    );
    assert_eq!(parsed.path, src.path);
}

/// The test census recognizes a bare `#[test]`.
#[test]
fn the_test_census_recognizes_a_bare_test_attribute() {
    let out = censuses("#[test]\nfn decode_roundtrip() {}\n", CargoTarget::LibOrBin);
    assert_eq!(covered(&out.tests), vec!["decode_roundtrip"]);
}

/// And the two qualified harness paths `[profiles]` lists.
#[test]
fn the_test_census_recognizes_the_qualified_harnesses() {
    let out = censuses(
        "#[tokio::test]\nfn a() {}\n#[sqlx::test]\nfn b() {}\n",
        CargoTarget::LibOrBin,
    );
    assert_eq!(covered(&out.tests), vec!["a", "b"]);
}

/// The open rule: any attribute path whose final segment is a harness
/// token, so a fourth harness needs no code change.
#[test]
fn the_open_rule_admits_an_unlisted_harness() {
    let out = censuses("#[some::other::test]\nfn c() {}\n", CargoTarget::LibOrBin);
    assert_eq!(covered(&out.tests), vec!["c"]);
}

/// A function carrying no harness attribute is not covered.
#[test]
fn an_unattributed_function_is_not_covered() {
    let out = censuses("fn plain() {}\n", CargoTarget::LibOrBin);
    assert!(out.tests.is_empty());
}

/// An attribute whose final segment is not a harness token does not cover.
#[test]
fn an_unrelated_attribute_does_not_cover() {
    let out = censuses("#[inline]\nfn plain() {}\n", CargoTarget::LibOrBin);
    assert!(out.tests.is_empty());
}

/// A test method inside an `impl` is covered like any other function.
#[test]
fn a_test_method_is_covered() {
    let out = censuses(
        "struct S;\nimpl S {\n#[test]\nfn method() {}\n}\n",
        CargoTarget::LibOrBin,
    );
    assert_eq!(covered(&out.tests), vec!["method"]);
}

/// The classification rule is the Cargo target: a lib or bin target's tests
/// are `unit`, and a `tests/` target's are `integration`.
#[test]
fn the_target_decides_the_area() {
    let fixture = "#[test]\nfn one() {}\n";
    let unit = censuses(fixture, CargoTarget::LibOrBin);
    let integration = censuses(fixture, CargoTarget::IntegrationTest);
    assert_eq!(unit.tests[0].area.as_str(), "unit");
    assert_eq!(integration.tests[0].area.as_str(), "integration");
    assert_ne!(unit.tests[0].area, integration.tests[0].area);
}

/// The asset carries the bare identifier the language exposes, untransformed:
/// turning it into a label's name segment is the derivation's affair.
#[test]
fn a_covered_asset_carries_the_bare_identifier() {
    let out = censuses("#[test]\nfn decode_roundtrip() {}\n", CargoTarget::LibOrBin);
    assert_eq!(out.tests[0].identifier, "decode_roundtrip");
}

/// And the profile's own standard place.
#[test]
fn a_covered_asset_carries_the_profile_s_place() {
    let out = censuses("#[test]\nfn one() {}\n", CargoTarget::LibOrBin);
    let profile = adoption()
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == out.tests[0].profile)
        .expect("the asset names a registered profile");
    assert_eq!(out.tests[0].place, profile.standard_place);
}

/// The module census counts an inline `mod name { … }` as one definition.
#[test]
fn an_inline_module_is_a_definition() {
    let out = censuses("mod record_mirror { }\n", CargoTarget::LibOrBin);
    assert_eq!(covered(&out.modules), vec!["record_mirror"]);
}

/// A `mod name;` declaration is not a definition and not an asset: the
/// definition backing it is another file (´conv:lint:rust-surface´).
#[test]
fn a_module_declaration_is_not_a_definition() {
    let out = censuses("mod rig;\n", CargoTarget::LibOrBin);
    assert!(out.modules.is_empty());
    assert_eq!(
        out.declarations
            .iter()
            .map(|one| one.identifier.as_str())
            .collect::<Vec<_>>(),
        vec!["rig"]
    );
}

/// Nine declarations of one module are nine declarations and no assets,
/// which is the measured shape `[profiles]` records for `mod rig;`.
#[test]
fn repeated_declarations_produce_no_assets() {
    let out = censuses("mod rig;\nmod rig;\nmod rig;\n", CargoTarget::LibOrBin);
    assert!(out.modules.is_empty());
    assert_eq!(out.declarations.len(), 3);
}

/// `#[cfg(test)]` modules are excluded: they are test scaffolding, and what
/// lives inside them is the test profile's business.
#[test]
fn a_cfg_test_module_is_excluded() {
    let out = censuses("#[cfg(test)]\nmod tests { }\n", CargoTarget::LibOrBin);
    assert!(out.modules.is_empty());
}

/// The exclusion is exact: `#[cfg(feature = "test")]` names a feature and
/// not the test configuration, so it excludes nothing.
#[test]
fn a_feature_named_test_is_not_the_test_configuration() {
    let out = censuses(
        "#[cfg(feature = \"test\")]\nmod kept { }\n",
        CargoTarget::LibOrBin,
    );
    assert_eq!(covered(&out.modules), vec!["kept"]);
}

/// A nested inline module is a definition too, and both are counted.
#[test]
fn nested_inline_modules_are_both_definitions() {
    let out = censuses("mod outer { mod inner { } }\n", CargoTarget::LibOrBin);
    let mut names = covered(&out.modules);
    names.sort_unstable();
    assert_eq!(names, vec!["inner", "outer"]);
}

/// A `#[cfg(test)]` module's contents are not walked for definitions
/// either: the exclusion is of the module, and the test census still sees
/// what is inside it.
#[test]
fn a_cfg_test_module_still_holds_its_tests() {
    let out = censuses(
        "#[cfg(test)]\nmod tests {\n#[test]\nfn inside() {}\n}\n",
        CargoTarget::LibOrBin,
    );
    assert!(out.modules.is_empty());
    assert_eq!(covered(&out.tests), vec!["inside"]);
}

/// Both ruled Rust profiles are recognized by their rows' own shape, so a
/// third would need no match on its name.
#[test]
fn both_ruled_rust_profiles_are_recognized() {
    let recognized: Vec<&str> = adoption()
        .profiles
        .profiles
        .iter()
        .filter(|one| frontend_rust::governs(one))
        .map(|one| one.id.as_str())
        .collect();
    assert_eq!(recognized, vec!["rust-test", "rust-module"]);
}

/// A staged profile puts nothing in the run (´dec:lint:staged-profiles´):
/// under a fixture that stages the module profile, `Parsed::assets` carries
/// the test profile's covered function alone, though the source defines a
/// module beside it.
#[test]
fn a_staged_profile_puts_nothing_in_the_run() {
    let staging = module_staged();
    let staged: Vec<&str> = staging
        .profiles
        .profiles
        .iter()
        .filter(|one| matches!(one.status, ProfileStatus::Staged { .. }))
        .map(|one| one.id.as_str())
        .collect();
    assert_eq!(staged, vec!["rust-module"]);

    let parsed = parse_under(&staging, "#[test]\nfn one() {}\nmod two { }\n");
    assert_eq!(covered(&parsed.assets), vec!["one"]);
    assert_eq!(staging.profiles.effective_count, 1);
}

/// (´dec:lint:staged-profiles´): entering Π flipped fields and nothing else,
/// so the same source read under the ruled data carries both censuses.
#[test]
fn a_profile_in_force_puts_its_census_in_the_run() {
    let parsed = parse("#[test]\nfn one() {}\nmod two { }\n");
    assert_eq!(covered(&parsed.assets), vec!["one", "two"]);
    assert_eq!(adoption().profiles.effective_count, 2);
}

/// The censuses are computed whatever a profile's status is: computing is not
/// judging, which is why entering Π flips fields rather than writing code.
#[test]
fn the_census_is_computed_even_though_it_is_inert() {
    let out = censuses("#[test]\nfn one() {}\nmod two { }\n", CargoTarget::LibOrBin);
    assert_eq!(covered(&out.tests), vec!["one"]);
    assert_eq!(covered(&out.modules), vec!["two"]);
}

/// The end-to-end fixture: the frontend over one real crate source. Its doc
/// regions are found, nothing is unclassified, and every region's pieces
/// map back into the file.
#[test]
fn the_frontend_reads_a_real_crate_source() {
    let at = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/scan.rs");
    let bytes = std::fs::read(&at).expect("the crate carries its scanner");
    let src = SourceFile {
        path: PathBuf::from("crates/cogra-linter/src/scan.rs"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("rust")),
        generated: false,
        bytes,
    };
    let pre = pre_of(&src);

    assert!(pre.partitions(src.bytes.len()), "scan.rs partitions");
    assert!(
        pre.unclassified.is_empty(),
        "scan.rs has {} unclassified stretches",
        pre.unclassified.len()
    );

    let parsed = frontend_rust::parse(&src, &pre, adoption()).expect("scan.rs parses");
    assert!(
        parsed.regions.len() > 20,
        "only {} doc regions in scan.rs",
        parsed.regions.len()
    );
    assert!(parsed.heads.is_empty());
    assert!(parsed.assets.is_empty());
    assert!(parsed.diagnostics.is_empty());

    let text = std::str::from_utf8(&src.bytes).expect("scan.rs is UTF-8");
    for region in &parsed.regions {
        assert_eq!(
            region.participates,
            !region.text.contains("```"),
            "a participating region carries a fence, or a fenced one participates: {:?}",
            region.text
        );
        assert_eq!(region.syntax, Syntax::Code);
        let sum: usize = region.pieces.iter().map(ByteSpan::len).sum();
        assert_eq!(sum, region.text.len());
        for piece in &region.pieces {
            assert!(piece.end <= text.len());
            assert!(text.get(piece.start..piece.end).is_some());
        }
        assert!(
            !region.text.contains("///"),
            "a leader survived: {:?}",
            region.text
        );
    }
}

/// The same source's own label occurrences scan out of its regions and
/// locate back into real file bytes, which is what the frontend exists to
/// make possible.
#[test]
fn a_real_source_s_occurrences_locate_into_the_file() {
    let at = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/scan.rs");
    let bytes = std::fs::read(&at).expect("the crate carries its scanner");
    let text = String::from_utf8(bytes.clone()).expect("scan.rs is UTF-8");
    let src = SourceFile {
        path: PathBuf::from("crates/cogra-linter/src/scan.rs"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("rust")),
        generated: false,
        bytes,
    };
    let pre = pre_of(&src);
    let parsed = frontend_rust::parse(&src, &pre, adoption()).expect("scan.rs parses");

    let mut occurrences = 0;
    for region in &parsed.regions {
        for occurrence in scan_code(&region.text, 0).occurrences {
            let at = region.locate(occurrence.span());
            assert!(
                text.get(at.start..at.end).is_some(),
                "{at:?} is not a slice"
            );
            occurrences += 1;
        }
    }
    assert!(occurrences > 0, "scan.rs carries label occurrences");
}

/// No rule identifier of this module is label-shaped: `lint` is a reserved
/// kind no profile governs (´sig:lint:diagnostic-api´).
#[test]
fn no_rust_frontend_rule_identifier_is_label_shaped() {
    for rule in frontend_rust::RULES {
        assert!(!rule.as_str().contains(':'), "{rule} is label-shaped");
    }
}
