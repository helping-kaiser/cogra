//! Vector tests for the Kotlin frontend (´[ARCH-dec:linter:kotlin-tree-sitter]´).
//!
//! Trace convention: every test's doc comment names the clause it traces to
//! — one of the three scanned forms `[scanned-regions]` gives Kotlin, one of
//! the forms it puts outside them, its region unit, the head absence
//! `[head-recognition]` records for the language, or the error boundary
//! (´crit:lint:error-or-finding´).
//!
//! Every test drives the real adoption data: which forms are scanned and
//! which extensions name the language are `corpus-adoption.toml`'s, never
//! this file's.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::frontend::{Region, RegionKind};
use cogra_linter::pretokenize::{CommentForm, pretokenize};
use cogra_linter::scan::{Occurrence, Syntax, scan_code};
use cogra_linter::{
    Adoption, ByteSpan, Language, OwnerId, Parsed, SourceFile, frontend, frontend_kotlin,
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
        path: PathBuf::from("X.kt"),
        owner: OwnerId::new("android"),
        language: Some(Language::new("kotlin")),
        generated: false,
        bytes: Vec::from(text),
    }
}

/// Parse a fixture, asserting it parses.
fn parse(text: &str) -> Parsed {
    frontend_kotlin::parse(&source(text), adoption()).expect("the fixture parses")
}

/// The regions of a fixture, asserting the grammar found no error node —
/// which every fixture but the error tests' own is written to satisfy.
fn regions(text: &str) -> Vec<Region> {
    let parsed = parse(text);
    assert!(
        parsed.diagnostics.is_empty(),
        "the fixture does not parse cleanly: {:?}",
        parsed.diagnostics
    );
    parsed.regions
}

/// The region kinds of a fixture.
fn kinds(text: &str) -> Vec<RegionKind> {
    regions(text).into_iter().map(|one| one.kind).collect()
}

/// The region texts of a fixture.
fn texts(text: &str) -> Vec<String> {
    regions(text).into_iter().map(|one| one.text).collect()
}

/// The grammar and the runtime agree about the ABI.
///
/// The vendored `parser.c` declares ABI 14 and the runtime admits a range;
/// asserting the load here is what keeps
/// [`frontend_kotlin::NO_PARSER`] a rule that never fires.
#[test]
fn the_vendored_grammar_loads_into_the_runtime() {
    let language: tree_sitter::Language = frontend_kotlin::LANGUAGE.into();
    assert!(
        language.abi_version() >= tree_sitter::MIN_COMPATIBLE_LANGUAGE_VERSION,
        "the grammar's ABI {} is below the runtime's floor {}",
        language.abi_version(),
        tree_sitter::MIN_COMPATIBLE_LANGUAGE_VERSION
    );
    assert!(language.abi_version() <= tree_sitter::LANGUAGE_VERSION);
    let mut parser = tree_sitter::Parser::new();
    assert!(parser.set_language(&language).is_ok());
}

/// `[scanned-regions]`, first scanned form: line comments.
#[test]
fn a_line_comment_is_a_region() {
    assert_eq!(
        kinds("// one\nval x = 1\n"),
        vec![RegionKind::Comment(CommentForm::LinePlain)]
    );
    assert_eq!(texts("// one\nval x = 1\n"), vec![String::from(" one")]);
}

/// Second scanned form: block comments.
#[test]
fn a_block_comment_is_a_region() {
    assert_eq!(
        kinds("/* one */\nval x = 1\n"),
        vec![RegionKind::Comment(CommentForm::BlockPlain)]
    );
    assert_eq!(texts("/* one */\nval x = 1\n"), vec![String::from(" one ")]);
}

/// Third scanned form: KDoc, which the grammar emits as its own node kind
/// rather than as a block comment this frontend would have to re-read.
#[test]
fn a_kdoc_comment_is_a_region() {
    assert_eq!(
        kinds("/** one */\nval x = 1\n"),
        vec![RegionKind::Comment(CommentForm::BlockOuterDoc)]
    );
}

/// An empty block comment is no documentation that happens to be empty: the
/// scanner's own rule is that `/**/` closes where a KDoc leader would still
/// be opening.
#[test]
fn an_empty_block_comment_is_plain() {
    assert_eq!(
        kinds("/**/\nval x = 1\n"),
        vec![RegionKind::Comment(CommentForm::BlockPlain)]
    );
    assert_eq!(texts("/**/\nval x = 1\n"), vec![String::new()]);
}

/// `/***/` is where this grammar and the web frontend's JSDoc rule part: the
/// scanner asks only whether the byte after `/**` closes the comment, and a
/// third star does not, so `/***/` is KDoc with an empty interior. The
/// frontend follows the grammar rather than second-guessing it.
#[test]
fn a_three_star_block_comment_is_kdoc_with_no_interior() {
    assert_eq!(
        kinds("/***/\nval x = 1\n"),
        vec![RegionKind::Comment(CommentForm::BlockOuterDoc)]
    );
    assert_eq!(texts("/***/\nval x = 1\n"), vec![String::new()]);
}

/// Kotlin block comments nest, which is why they are scanner tokens: the
/// whole of `/* a /* b */ c */` is one comment and one region.
#[test]
fn a_nested_block_comment_is_one_region() {
    assert_eq!(
        texts("/* a /* b */ c */\nval x = 1\n"),
        vec![String::from(" a /* b */ c ")]
    );
}

/// `[scanned-regions]`' region unit for Kotlin is "one comment node from the
/// grammar": a run of `//` lines is that many nodes and therefore that many
/// regions, where a `///` run in Rust is one.
#[test]
fn a_run_of_line_comments_is_one_region_each() {
    assert_eq!(
        texts("// one\n// two\n// three\nval x = 1\n"),
        vec![
            String::from(" one"),
            String::from(" two"),
            String::from(" three")
        ]
    );
}

/// A KDoc comment's gutter is a leader and is resolved away; the line breaks
/// inside it are not, and stay.
#[test]
fn a_kdoc_gutter_is_resolved_away() {
    assert_eq!(
        texts("/**\n * one\n * two\n */\nval x = 1\n"),
        vec![String::from("\n one\n two\n ")]
    );
}

/// A plain block comment has no gutter convention, so a `*` inside one is
/// content and survives.
#[test]
fn a_plain_block_comment_keeps_its_stars() {
    assert_eq!(
        texts("/*\n * one\n */\nval x = 1\n"),
        vec![String::from("\n * one\n ")]
    );
}

/// A KDoc line that is only its gutter contributes only its line break,
/// which is what keeps a blank documentation line blank.
#[test]
fn a_bare_kdoc_gutter_line_contributes_its_break() {
    assert_eq!(
        texts("/**\n * one\n *\n * two\n */\nval x = 1\n"),
        vec![String::from("\n one\n\n two\n ")]
    );
}

/// A line comment ends at the newline and does not include it: the region's
/// last byte is the comment's, so a diagnostic never points one line on.
#[test]
fn a_line_comment_stops_before_its_newline() {
    let regions = regions("// one\nval x = 1\n");
    assert_eq!(regions[0].span(), ByteSpan::new(2, 6));
}

/// `[scanned-regions]` puts string literals outside what is scanned, and a
/// `//` inside one is not a comment: the grammar lexed it as a string, so no
/// comment node exists to become a region.
///
/// PARKED — the grammar admits a comment token at a token boundary inside a
/// `line_string_literal`. Here the line comment swallows the closing quote,
/// so the string never closes and the declaration becomes an `ERROR` node.
/// The frontend reports that honestly, but the finding is spurious: the
/// source is valid Kotlin. Un-ignore when the grammar is fixed; the
/// assertion is what the adoption data promises.
#[test]
#[ignore = "grammar: a comment leader at a token boundary inside a line string is lexed as a comment"]
fn a_line_leader_inside_a_string_is_not_a_comment() {
    assert!(regions("val x = \"// not a comment\"\n").is_empty());
}

/// The same for a block leader.
///
/// PARKED, and this is the graver half of the same defect: the block comment
/// closes, so the string parses and NO error node is produced. The grammar
/// hands back `(line_string_literal (block_comment))` — a comment node whose
/// bytes are string content — and a label written there would become a real
/// occurrence, which is exactly what `[scanned-regions]` promises cannot
/// happen. Silent, where the line-comment case at least announces itself.
#[test]
#[ignore = "grammar: a block comment inside a line string parses as a comment node, with no error"]
fn a_block_leader_inside_a_string_is_not_a_comment() {
    assert!(regions("val x = \"/* not a comment */\"\n").is_empty());
}

/// Character literals are outside what is scanned too.
#[test]
fn a_character_literal_is_not_scanned() {
    assert!(regions("val x = '/'\nval y = '*'\n").is_empty());
}

/// String templates are literals, interpolation and all: neither the literal
/// parts nor the `${}` holes yield a region.
///
/// PARKED — the same defect, and the case that shows what makes it reachable
/// in ordinary code: an interpolation ends a content token, so whatever
/// follows `}` is lexed fresh, and a comment leader there is taken as a
/// comment. The `a // b` before the hole is fine, because it sits inside one
/// content token and the lexer never stops there.
#[test]
#[ignore = "grammar: a comment leader after an interpolation is lexed as a comment"]
fn a_string_template_is_not_scanned() {
    assert!(regions("val x = \"a // b ${y} /* c */ d\"\n").is_empty());
}

/// What does hold today, and why the corpus is clean: a comment leader in
/// the middle of a string's content token is content, which is every URL the
/// Android tree writes.
#[test]
fn a_url_inside_a_string_is_not_a_comment() {
    assert!(regions("val x = \"https://cogra.example/join/$id\"\n").is_empty());
    assert!(regions("val x = \"a // b\"\n").is_empty());
}

/// A raw string carries no region either, however many lines and leaders it
/// spans.
#[test]
fn a_raw_string_is_not_scanned() {
    assert!(regions("val x = \"\"\"\n// not a comment\n/** nor this */\n\"\"\"\n").is_empty());
}

/// A comment inside a template's interpolation is a comment: the hole is
/// code, and this is the boundary an AST frontend gets right and a pattern
/// search does not (´[ARCH-ansatz:linter:regex-scanning]´).
#[test]
fn a_comment_inside_an_interpolation_is_a_comment() {
    assert_eq!(
        texts("val x = \"a ${y /* real */} b\"\n"),
        vec![String::from(" real ")]
    );
}

/// An acute-delimited label in a comment scans as an occurrence: the comment
/// is scanned code text, where the acute is the label delimiter
/// (´dec:lint:two-scan-entries´).
#[test]
fn an_acute_label_in_a_comment_scans_as_an_occurrence() {
    let regions = regions("// mints \u{b4}def:android:widget\u{b4} here\nval x = 1\n");
    let scan = scan_code(&regions[0].text, 0);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
    assert_eq!(scan.occurrences[0].label().name(), "widget");
}

/// The same in KDoc, whose gutter is resolved away first.
#[test]
fn an_acute_label_in_kdoc_scans_as_an_occurrence() {
    let regions = regions("/**\n * \u{b4}def:android:widget\u{b4}\n */\nval x = 1\n");
    let scan = scan_code(&regions[0].text, 0);
    assert_eq!(scan.occurrences[0].label().name(), "widget");
}

/// The same label inside a string literal scans as nothing, because the
/// literal is no region at all.
#[test]
fn an_acute_label_in_a_string_scans_as_nothing() {
    assert!(regions("val x = \"\u{b4}def:android:widget\u{b4}\"\n").is_empty());
}

/// A region carries the code syntax, which is what routes it to
/// [`scan_code`] rather than to the prose entry (´dec:lint:two-scan-entries´).
#[test]
fn a_kotlin_region_carries_the_code_syntax() {
    for region in regions("// one\n/** two */\nval x = 1\n") {
        assert_eq!(region.syntax, Syntax::Code);
        assert!(region.participates);
    }
}

/// A region's pieces are file ranges copied verbatim, so their lengths sum
/// to the logical text's length and each is a slice of the file.
#[test]
fn a_region_s_pieces_reconstruct_its_text() {
    let text = "/**\n * one\n * two\n */\nval x = 1\n";
    for region in regions(text) {
        let sum: usize = region.pieces.iter().map(ByteSpan::len).sum();
        assert_eq!(sum, region.text.len());
        let joined: String = region
            .pieces
            .iter()
            .map(|piece| &text[piece.start..piece.end])
            .collect();
        assert_eq!(joined, region.text);
    }
}

/// Byte offsets are the file's own: a label after a multibyte character
/// locates at the bytes it was written at, not at the characters.
#[test]
fn an_occurrence_after_a_multibyte_character_locates_exactly() {
    let text = "// \u{e4}\u{f6}\u{fc} \u{b4}def:android:widget\u{b4}\nval x = 1\n";
    let regions = regions(text);
    let scan = scan_code(&regions[0].text, 0);
    let at = regions[0].locate(scan.occurrences[0].span());
    assert_eq!(&text[at.start..at.end], "\u{b4}def:android:widget\u{b4}");
}

/// And a multibyte character inside a resolved-away KDoc gutter shifts
/// nothing either, which is the case a piece boundary makes interesting.
#[test]
fn an_occurrence_in_kdoc_after_a_multibyte_character_locates_exactly() {
    let text = "/**\n * \u{e4}\u{f6}\u{fc}\n * \u{b4}def:android:widget\u{b4}\n */\nval x = 1\n";
    let regions = regions(text);
    let scan = scan_code(&regions[0].text, 0);
    let at = regions[0].locate(scan.occurrences[0].span());
    assert_eq!(&text[at.start..at.end], "\u{b4}def:android:widget\u{b4}");
}

/// A syntax error is a hard, located diagnostic and never a silently skipped
/// region (´[ARCH-req:linter:diagnostics-not-panics]´).
///
/// The fixture is a top-level statement, which is exactly what `.kts` admits
/// and `kotlinFile` does not — so this test doubles as the record of why
/// `.kts` has no frontend: the grammar implements the declaration-only file
/// production, and a script's statement is an error node to it.
#[test]
fn a_top_level_statement_is_a_located_diagnostic() {
    let parsed = frontend_kotlin::parse(&source("val x = 1\nprintln(x)\n"), adoption())
        .expect("the grammar loads, whatever it makes of the bytes");
    assert!(
        !parsed.diagnostics.is_empty(),
        "a script-shaped source reported nothing"
    );
    assert!(
        parsed
            .diagnostics
            .iter()
            .all(|one| one.rule == frontend_kotlin::UNPARSABLE)
    );
    assert!(
        parsed.diagnostics.iter().any(|one| one.primary.line > 1),
        "no finding names the broken line: {:?}",
        parsed.diagnostics
    );
}

/// The regions travel beside the findings and are never traded for them: a
/// file with an error node still yields every comment that parsed.
#[test]
fn regions_survive_an_error_node() {
    let parsed = frontend_kotlin::parse(&source("// kept\nval x = 1\nprintln(x)\n"), adoption())
        .expect("the grammar loads");
    assert!(!parsed.diagnostics.is_empty());
    assert_eq!(
        parsed
            .regions
            .into_iter()
            .map(|one| one.text)
            .collect::<Vec<_>>(),
        vec![String::from(" kept")]
    );
}

/// A source that is not UTF-8 cannot be read at all, and unlike its Rust
/// counterpart it leaves nothing behind to enforce: Kotlin has no entry in
/// `[banned-tokens]`.
#[test]
fn a_kotlin_source_that_is_not_utf8_is_an_error() {
    let mut src = source("");
    src.bytes = vec![0xff, 0xfe, 0x00];
    let findings = frontend_kotlin::parse(&src, adoption()).expect_err("not text");
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].rule, frontend_kotlin::NOT_TEXT);
}

/// `[head-recognition]` gives Kotlin no head form: a code comment carries
/// occurrences and heads no environment.
#[test]
fn the_kotlin_frontend_produces_no_heads() {
    let parsed =
        parse("/** Definition (Widget) \u{b7} \u{b4}def:android:widget\u{b4} */\nval x = 1\n");
    assert!(parsed.heads.is_empty());
}

/// `[profiles]` registers no Kotlin profile in version 1, so the frontend
/// settles no census and pairs nothing across sources.
#[test]
fn the_kotlin_frontend_produces_no_assets() {
    let parsed = parse("class Widget\nfun make() {}\n");
    assert!(parsed.assets.is_empty());
    assert!(parsed.declarations.is_empty());
    assert!(parsed.tables.is_empty());
}

/// The dispatcher routes a Kotlin source here, which is the whole of what
/// wiring a frontend means: `[scanned-regions]` already named the extension,
/// and the carrier already carried the files.
#[test]
fn the_dispatcher_reaches_the_kotlin_frontend() {
    let src = source("// one\nval x = 1\n");
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    let parsed = frontend::parse(&src, &pre, adoption()).expect("parses");
    assert_eq!(
        parsed.regions[0].kind,
        RegionKind::Comment(CommentForm::LinePlain)
    );
    assert_eq!(parsed.path, src.path);
}

/// Regions come out in file order, which is what makes the frontend's output
/// byte-deterministic (´[ARCH-req:linter:determinism]´).
#[test]
fn regions_are_ordered_by_position() {
    let mut text = String::new();
    for one in 0..40 {
        text.push_str(&format!("// c{one}\nval x{one} = {one}\n"));
    }
    let starts: Vec<usize> = regions(&text).iter().map(|one| one.span().start).collect();
    let mut sorted = starts.clone();
    sorted.sort_unstable();
    assert_eq!(starts, sorted);
    assert_eq!(starts.len(), 40);
}

/// A trailing comment is one region, wherever the grammar hangs its node.
#[test]
fn a_trailing_comment_is_one_region() {
    assert_eq!(
        texts("val x = 1 // trailing\nval y = 2\n"),
        vec![String::from(" trailing")]
    );
}

/// The end-to-end fixture: the frontend over one real Kotlin source. Its
/// comments are found, and every region's pieces map back into the file.
#[test]
fn the_frontend_reads_a_real_kotlin_source() {
    let at = "android/core/domain/src/main/kotlin/com/cogra/domain/Models.kt";
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let bytes = std::fs::read(root.join(at)).expect("the corpus carries its domain models");
    let text = String::from_utf8(bytes.clone()).expect("it is UTF-8");
    let src = SourceFile {
        path: PathBuf::from(at),
        owner: OwnerId::new("android"),
        language: Some(Language::new("kotlin")),
        generated: false,
        bytes,
    };

    let parsed = frontend_kotlin::parse(&src, adoption()).expect("it parses");
    assert!(
        parsed.regions.len() > 5,
        "only {} comment regions",
        parsed.regions.len()
    );
    assert!(parsed.diagnostics.is_empty());
    assert!(parsed.heads.is_empty());

    for region in &parsed.regions {
        let sum: usize = region.pieces.iter().map(ByteSpan::len).sum();
        assert_eq!(sum, region.text.len());
        for piece in &region.pieces {
            assert!(text.get(piece.start..piece.end).is_some());
        }
        assert!(!region.text.starts_with("//"), "a leader survived");
        assert!(!region.text.ends_with("*/"), "a trailer survived");
    }
}

/// No Kotlin source of the corpus triggers the parked string defect.
///
/// The three ignored tests above record a grammar defect the corpus does not
/// currently reach: a comment leader at a token boundary inside a line
/// string is lexed as a comment. Its silent half would put a comment node
/// inside a string literal, and a label written there would become an
/// occurrence `[scanned-regions]` promises cannot exist.
///
/// This is the guard that keeps "does not currently reach" true. It walks
/// every `.kt` source of the carrier and fails if any comment node has a
/// string literal above it — so the defect cannot activate silently, it
/// activates as a red test on the commit that writes the string.
#[test]
fn no_corpus_comment_node_sits_inside_a_string() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut files = Vec::new();
    collect_kt(&root.join("android"), &mut files);
    files.sort();
    assert!(files.len() > 100, "only {} sources found", files.len());

    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&frontend_kotlin::LANGUAGE.into())
        .expect("the grammar loads");

    let mut offenders = Vec::new();
    for file in &files {
        let bytes = std::fs::read(file).expect("a carrier source reads");
        let Ok(text) = std::str::from_utf8(&bytes) else {
            continue;
        };
        let tree = parser.parse(text, None).expect("a tree");
        let mut cursor = tree.walk();
        let mut depth = 0usize;
        let mut string_at: Option<usize> = None;
        'walk: loop {
            let node = cursor.node();
            if string_at.is_some_and(|at| depth <= at) {
                string_at = None;
            }
            let kind = node.kind();
            if string_at.is_none() && kind.ends_with("string_literal") {
                string_at = Some(depth);
            } else if string_at.is_some()
                && matches!(kind, "line_comment" | "block_comment" | "kdoc")
            {
                offenders.push(format!("{} at {:?}", file.display(), node.byte_range()));
            }
            if cursor.goto_first_child() {
                depth += 1;
                continue;
            }
            loop {
                if cursor.goto_next_sibling() {
                    continue 'walk;
                }
                if !cursor.goto_parent() {
                    break 'walk;
                }
                depth -= 1;
            }
        }
    }
    assert!(
        offenders.is_empty(),
        "the parked grammar defect has activated: {offenders:?}"
    );
}

/// Every `.kt` source under a tree, skipping the build outputs `[carrier]`
/// excludes.
fn collect_kt(at: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(at) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().map(|one| one.to_string_lossy().into_owned());
            if matches!(name.as_deref(), Some("build" | ".gradle")) {
                continue;
            }
            collect_kt(&path, out);
        } else if path.extension().is_some_and(|one| one == "kt") {
            out.push(path);
        }
    }
}

/// No rule identifier of this module is label-shaped: `lint` is a reserved
/// kind no profile governs (´sig:lint:diagnostic-api´).
#[test]
fn no_kotlin_frontend_rule_identifier_is_label_shaped() {
    for rule in frontend_kotlin::RULES {
        assert!(!rule.as_str().contains(':'), "{rule} is label-shaped");
    }
}
