//! Vector tests for the web frontend (´[ARCH-conv:linter:web-frontend]´).
//!
//! Trace convention: every test's doc comment names the clause it traces to
//! — one of the three scanned forms `[scanned-regions]` gives TypeScript,
//! one of the forms it puts outside them, its region unit, the head
//! absence `[head-recognition]` records for the language, or the error
//! boundary (´crit:lint:error-or-finding´).
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
    Adoption, ByteSpan, Language, OwnerId, Parsed, SourceFile, frontend, frontend_web,
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

/// A source under a name of the caller's choosing, which is what decides
/// the two per-file syntax settings.
fn named(name: &str, text: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from(name),
        owner: OwnerId::new("web"),
        language: Some(Language::new("typescript")),
        generated: false,
        bytes: Vec::from(text),
    }
}

fn source(text: &str) -> SourceFile {
    named("x.ts", text)
}

/// Parse a fixture, asserting it parses.
fn parse(text: &str) -> Parsed {
    frontend_web::parse(&source(text), adoption()).expect("the fixture parses")
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

/// `[scanned-regions]`, first scanned form: line comments.
#[test]
fn a_line_comment_is_a_region() {
    assert_eq!(
        kinds("// one\nconst x = 1;\n"),
        vec![RegionKind::Comment(CommentForm::LinePlain)]
    );
    assert_eq!(texts("// one\nconst x = 1;\n"), vec![String::from(" one")]);
}

/// Second scanned form: block comments.
#[test]
fn a_block_comment_is_a_region() {
    assert_eq!(
        kinds("/* one */\nconst x = 1;\n"),
        vec![RegionKind::Comment(CommentForm::BlockPlain)]
    );
    assert_eq!(
        texts("/* one */\nconst x = 1;\n"),
        vec![String::from(" one ")]
    );
}

/// Third scanned form: JSDoc block comments, which carry the `/** */`
/// spelling and so the comment form of that spelling.
#[test]
fn a_jsdoc_comment_is_a_region() {
    assert_eq!(
        kinds("/** one */\nconst x = 1;\n"),
        vec![RegionKind::Comment(CommentForm::BlockOuterDoc)]
    );
}

/// An empty block comment is no documentation that happens to be empty:
/// `/**/` closes where a JSDoc leader would still be opening.
#[test]
fn an_empty_block_comment_is_plain() {
    assert_eq!(
        kinds("/**/\nconst x = 1;\n"),
        vec![RegionKind::Comment(CommentForm::BlockPlain)]
    );
    assert_eq!(texts("/**/\nconst x = 1;\n"), vec![String::new()]);
}

/// And neither is `/***/`, by the same rule.
#[test]
fn a_three_star_block_comment_is_plain() {
    assert_eq!(
        kinds("/***/\nconst x = 1;\n"),
        vec![RegionKind::Comment(CommentForm::BlockPlain)]
    );
}

/// `[scanned-regions]`' region unit for TypeScript is "one comment from
/// swc's out-of-band comments store": a run of `//` lines is that many
/// comments and therefore that many regions, where a `///` run in Rust is
/// one.
#[test]
fn a_run_of_line_comments_is_one_region_each() {
    assert_eq!(
        texts("// one\n// two\n// three\nconst x = 1;\n"),
        vec![
            String::from(" one"),
            String::from(" two"),
            String::from(" three")
        ]
    );
}

/// A JSDoc comment's gutter is a leader and is resolved away; the line
/// breaks inside it are not, and stay.
#[test]
fn a_jsdoc_gutter_is_resolved_away() {
    assert_eq!(
        texts("/**\n * one\n * two\n */\nconst x = 1;\n"),
        vec![String::from("\n one\n two\n ")]
    );
}

/// A plain block comment has no gutter convention, so a `*` inside one is
/// content and survives.
#[test]
fn a_plain_block_comment_keeps_its_stars() {
    assert_eq!(
        texts("/*\n * one\n */\nconst x = 1;\n"),
        vec![String::from("\n * one\n ")]
    );
}

/// A JSDoc line that is only its gutter contributes only its line break,
/// which is what keeps a blank documentation line blank.
#[test]
fn a_bare_jsdoc_gutter_line_contributes_its_break() {
    assert_eq!(
        texts("/**\n * one\n *\n * two\n */\nconst x = 1;\n"),
        vec![String::from("\n one\n\n two\n ")]
    );
}

/// `[scanned-regions]` puts string literals outside what is scanned, and a
/// `//` inside one is not a comment: `swc` lexed it as a string, so it
/// never reaches the comments store.
#[test]
fn a_line_leader_inside_a_string_is_not_a_comment() {
    assert!(regions("const x = \"// not a comment\";\n").is_empty());
}

/// The same for a block leader.
#[test]
fn a_block_leader_inside_a_string_is_not_a_comment() {
    assert!(regions("const x = '/* not a comment */';\n").is_empty());
}

/// Template literals are literals too, interpolation and all: neither the
/// literal parts nor the `${}` holes yield a region.
#[test]
fn a_template_literal_is_not_scanned() {
    assert!(regions("const x = `a // b ${ y } /* c */ d`;\n").is_empty());
}

/// A comment inside a template literal's interpolation is a comment: the
/// hole is code, and this is the boundary an AST frontend gets right and a
/// pattern search does not (´[ARCH-ansatz:linter:regex-scanning]´).
#[test]
fn a_comment_inside_an_interpolation_is_a_comment() {
    assert_eq!(
        texts("const x = `a ${ y /* real */ } b`;\n"),
        vec![String::from(" real ")]
    );
}

/// `[scanned-regions]` puts JSX text outside what is scanned; a `//` in it
/// is text the parser reads as text.
#[test]
fn jsx_text_is_not_scanned() {
    let src = named("x.tsx", "const a = <p>// not a comment</p>;\n");
    let parsed = frontend_web::parse(&src, adoption()).expect("the fixture parses");
    assert!(parsed.regions.is_empty());
}

/// A comment inside a JSX expression container is still a comment, for the
/// reason the interpolation case is: the container holds code.
#[test]
fn a_comment_inside_a_jsx_container_is_a_comment() {
    let src = named("x.tsx", "const a = <p>{/* real */}</p>;\n");
    let parsed = frontend_web::parse(&src, adoption()).expect("the fixture parses");
    assert_eq!(
        parsed
            .regions
            .into_iter()
            .map(|one| one.text)
            .collect::<Vec<_>>(),
        vec![String::from(" real ")]
    );
}

/// A `.tsx` source parses its JSX, which a `.ts` source of the same bytes
/// does not: `TsSyntax::tsx` is read off the extension `[scanned-regions]`
/// lists beside `.ts`.
#[test]
fn tsx_parses_where_ts_does_not() {
    let text = "const a = <p>hi</p>;\n";
    assert!(frontend_web::parse(&named("x.tsx", text), adoption()).is_ok());
    let parsed = frontend_web::parse(&named("x.ts", text), adoption());
    let findings = parsed
        .map(|one| one.diagnostics)
        .unwrap_or_else(|findings| findings);
    assert!(
        findings
            .iter()
            .any(|one| one.rule == frontend_web::UNPARSABLE),
        "the same bytes under .ts reported {findings:?}"
    );
}

/// An ambient declaration file parses as one: its bodies are types where a
/// `.ts` file's are values.
#[test]
fn a_declaration_file_parses_as_ambient() {
    let src = named("x.d.ts", "// one\ndeclare const x: number;\n");
    let parsed = frontend_web::parse(&src, adoption()).expect("the fixture parses");
    assert_eq!(parsed.regions.len(), 1);
    assert!(parsed.diagnostics.is_empty());
}

/// An acute-delimited label in a comment scans as an occurrence: the
/// comment is scanned code text, where the acute is the label delimiter
/// (´dec:lint:two-scan-entries´).
#[test]
fn an_acute_label_in_a_comment_scans_as_an_occurrence() {
    let regions = regions("// mints \u{b4}def:web:widget\u{b4} here\nconst x = 1;\n");
    let scan = scan_code(&regions[0].text, 0);
    assert!(matches!(scan.occurrences[0], Occurrence::Mint { .. }));
    assert_eq!(scan.occurrences[0].label().name(), "widget");
}

/// The same label inside a string literal scans as nothing, because the
/// literal is no region at all.
#[test]
fn an_acute_label_in_a_string_scans_as_nothing() {
    assert!(regions("const x = \"\u{b4}def:web:widget\u{b4}\";\n").is_empty());
}

/// A region carries the code syntax, which is what routes it to
/// [`scan_code`] rather than to the prose entry (´dec:lint:two-scan-entries´).
#[test]
fn a_web_region_carries_the_code_syntax() {
    for region in regions("// one\n/** two */\nconst x = 1;\n") {
        assert_eq!(region.syntax, Syntax::Code);
        assert!(region.participates);
    }
}

/// A region's pieces are file ranges copied verbatim, so their lengths sum
/// to the logical text's length and each is a slice of the file.
#[test]
fn a_region_s_pieces_reconstruct_its_text() {
    let text = "/**\n * one\n * two\n */\nconst x = 1;\n";
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

/// Byte offsets are the file's own, not the source map's: a label after a
/// multibyte character locates at the bytes it was written at.
#[test]
fn an_occurrence_after_a_multibyte_character_locates_exactly() {
    let text = "// \u{e4}\u{f6}\u{fc} \u{b4}def:web:widget\u{b4}\nconst x = 1;\n";
    let regions = regions(text);
    let scan = scan_code(&regions[0].text, 0);
    let at = regions[0].locate(scan.occurrences[0].span());
    assert_eq!(&text[at.start..at.end], "\u{b4}def:web:widget\u{b4}");
}

/// And the first comment of a file starts where the file does, which is
/// what the source map's own numbering would otherwise shift by one.
#[test]
fn the_first_comment_of_a_file_starts_at_its_first_byte() {
    let regions = regions("// one\nconst x = 1;\n");
    assert_eq!(regions[0].span(), ByteSpan::new(2, 6));
}

/// A syntax error is a hard, located diagnostic and never a silently
/// skipped region (´[ARCH-req:linter:diagnostics-not-panics]´).
#[test]
fn a_syntax_error_is_a_located_diagnostic() {
    let src = source("// one\nconst = = ;\n");
    let parsed = frontend_web::parse(&src, adoption());
    let findings = parsed
        .map(|one| one.diagnostics)
        .unwrap_or_else(|findings| findings);
    assert!(!findings.is_empty(), "a broken source reported nothing");
    assert!(
        findings
            .iter()
            .all(|one| one.rule == frontend_web::UNPARSABLE)
    );
    assert!(
        findings.iter().any(|one| one.primary.line > 1),
        "no finding names the broken line: {findings:?}"
    );
}

/// A source that is not UTF-8 cannot be read at all, and unlike its Rust
/// counterpart it leaves nothing behind to enforce: TypeScript has no
/// entry in `[banned-tokens]`.
#[test]
fn a_web_source_that_is_not_utf8_is_an_error() {
    let mut src = source("");
    src.bytes = vec![0xff, 0xfe, 0x00];
    let findings = frontend_web::parse(&src, adoption()).expect_err("not text");
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].rule, frontend_web::NOT_TEXT);
}

/// `[head-recognition]` gives TypeScript no head form: a code comment
/// carries occurrences and heads no environment.
#[test]
fn the_web_frontend_produces_no_heads() {
    let parsed =
        parse("/** Definition (Widget) \u{b7} \u{b4}def:web:widget\u{b4} */\nconst x = 1;\n");
    assert!(parsed.heads.is_empty());
}

/// `[profiles]` registers no TypeScript profile in version 1, so the
/// frontend settles no census and pairs nothing across sources.
#[test]
fn the_web_frontend_produces_no_assets() {
    let parsed = parse("export class Widget {}\nexport function make() {}\n");
    assert!(parsed.assets.is_empty());
    assert!(parsed.declarations.is_empty());
    assert!(parsed.tables.is_empty());
}

/// The dispatcher routes a TypeScript source here, which is the whole of
/// what wiring a frontend means: `[scanned-regions]` already named the
/// extensions, and the carrier already carried the files.
#[test]
fn the_dispatcher_reaches_the_web_frontend() {
    let src = source("// one\nconst x = 1;\n");
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    let parsed = frontend::parse(&src, &pre, adoption()).expect("parses");
    assert_eq!(
        parsed.regions[0].kind,
        RegionKind::Comment(CommentForm::LinePlain)
    );
    assert_eq!(parsed.path, src.path);
}

/// Regions come out in file order however the comments store enumerated
/// them, which is what makes the frontend's output byte-deterministic
/// (´[ARCH-req:linter:determinism]´).
#[test]
fn regions_are_ordered_by_position() {
    let mut text = String::new();
    for one in 0..40 {
        text.push_str(&format!("// c{one}\nconst x{one} = {one};\n"));
    }
    let starts: Vec<usize> = regions(&text).iter().map(|one| one.span().start).collect();
    let mut sorted = starts.clone();
    sorted.sort_unstable();
    assert_eq!(starts, sorted);
    assert_eq!(starts.len(), 40);
}

/// A comment attached to two tokens at once is still one comment: reading
/// both halves of the store and keying on the comment's own span is what
/// keeps a trailing comment from arriving twice.
#[test]
fn a_trailing_comment_is_one_region() {
    assert_eq!(
        texts("const x = 1; // trailing\nconst y = 2;\n"),
        vec![String::from(" trailing")]
    );
}

/// The end-to-end fixture: the frontend over one real web source. Its
/// comments are found, and every region's pieces map back into the file.
#[test]
fn the_frontend_reads_a_real_web_source() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let at = root.join("web/src/lib/crypto/identifiers.ts");
    let bytes = std::fs::read(&at).expect("the corpus carries its identifier algebra");
    let text = String::from_utf8(bytes.clone()).expect("it is UTF-8");
    let src = SourceFile {
        path: PathBuf::from("web/src/lib/crypto/identifiers.ts"),
        owner: OwnerId::new("web"),
        language: Some(Language::new("typescript")),
        generated: false,
        bytes,
    };

    let parsed = frontend_web::parse(&src, adoption()).expect("it parses");
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

/// No rule identifier of this module is label-shaped: `lint` is a reserved
/// kind no profile governs (´sig:lint:diagnostic-api´).
#[test]
fn no_web_frontend_rule_identifier_is_label_shaped() {
    for rule in frontend_web::RULES {
        assert!(!rule.as_str().contains(':'), "{rule} is label-shaped");
    }
}
