//! ´mod:module:frontend-web´
//!
//! `swc`: the comment regions of TypeScript and TSX.
//!
//! `swc_ecma_parser` retains what `syn` drops. Its parser takes a comments
//! store beside the source and fills it as it lexes, so the comments arrive
//! out of band, keyed by the byte position of the token they attach to
//! (´[ARCH-conv:linter:web-frontend]´). Those comments are the whole of what this
//! frontend produces: `[scanned-regions]` scans the three comment forms of
//! TypeScript and nothing else, and `[head-recognition]` gives the language
//! no head form, so a region here carries occurrences and heads nothing.
//!
//! # Coordinates
//!
//! A `swc_common::SourceMap` numbers every file it holds from a start
//! position of its own, so a comment's span is a position in the map and not
//! in the file. Subtracting the source file's own start is the whole of the
//! conversion, and it is done once, at the boundary. Every offset past that
//! point is a file offset, which is what a [`crate::frontend::Region`]'s
//! pieces are.
//!
//! # One comment, one region
//!
//! `[scanned-regions]`' region unit for TypeScript is "one comment from
//! swc's out-of-band comments store, keyed by byte position". The store
//! hands over discrete comments, so a run of consecutive `//` lines is that
//! many regions and not one — the opposite of the Rust frontend's rule for
//! `///`, and for the reason the two adoption rows give: a `///` run is one
//! documentation comment written across lines, and a `//` run is a run.
//!
//! # No census, no assets
//!
//! `[profiles]` registers no TypeScript profile in version 1, so the syntax
//! tree is built and never read. Building it is still the point: comments
//! reach the store only because the parser walked the file, and a file that
//! does not parse is a finding rather than a file with no comments
//! (´[ARCH-req:linter:diagnostics-not-panics]´).

use swc_common::comments::{Comment, CommentKind, SingleThreadedComments};
use swc_common::sync::Lrc;
use swc_common::{BytePos, FileName, SourceMap, Spanned};
use swc_ecma_ast::EsVersion;
use swc_ecma_parser::{Syntax, TsSyntax, parse_file_as_program};

use crate::adopt::Adoption;
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::frontend::{Parsed, Region, RegionKind, append, degutter};
use crate::pretokenize::{CommentForm, located};
use crate::scan::Syntax as RegionSyntax;

/// The `[scanned-regions]` language this frontend reads.
pub const TYPESCRIPT: &str = "typescript";

/// A TypeScript source that is not UTF-8 at all, so no parser can read it.
///
/// TypeScript has no entry in `[banned-tokens]`, so unlike its Rust
/// counterpart this finding leaves nothing else to enforce on the file: the
/// bytes are unreadable and the file carries no region.
pub const NOT_TEXT: RuleId = RuleId::new("web-not-utf8");

/// A TypeScript source `swc` cannot parse.
///
/// Reported whether the parser gave up or recovered, because both are the
/// same fact about the corpus: a source the frontend did not fully read
/// (´[ARCH-req:linter:diagnostics-not-panics]´). What differs is only how
/// much survived, and the regions that did survive travel beside the
/// finding rather than in place of it.
pub const UNPARSABLE: RuleId = RuleId::new("web-unparsable");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 2] = [NOT_TEXT, UNPARSABLE];

/// The TSX extension, which is the one syntax setting the file name decides.
const TSX: &str = ".tsx";

/// The declaration-file extension, whose sources are types and no values.
const DTS: &str = ".d.ts";

/// Parse one TypeScript or TSX source.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::pretokenize::CommentForm;
/// use cogra_linter::frontend::RegionKind;
/// use cogra_linter::{Language, OwnerId, SourceFile, frontend_web};
///
/// let source = SourceFile {
///     path: std::path::PathBuf::from("x.ts"),
///     owner: OwnerId::new("web"),
///     language: Some(Language::new("typescript")),
///     generated: false,
///     bytes: Vec::from("// one\n// two\nconst x = \"// three\";\n"),
/// };
/// let parsed = frontend_web::parse(&source, &adoption)
///     .map_err(|d| format!("{d:?}"))?;
///
/// assert_eq!(parsed.regions.len(), 2, "a // run is two comments, not one");
/// assert_eq!(parsed.regions[0].kind, RegionKind::Comment(CommentForm::LinePlain));
/// assert_eq!(parsed.regions[0].text, " one");
/// assert_eq!(parsed.regions[1].text, " two");
/// assert!(parsed.heads.is_empty());
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// Diagnostics whenever the source cannot be parsed at all: it is not UTF-8,
/// or `swc` rejects it outright. A file that will not parse is a fact about
/// the corpus and travels as a finding, never as an `Err` of the crate's own
/// taxonomy (´crit:lint:error-or-finding´).
pub fn parse(src: &SourceFile, a: &Adoption) -> Result<Parsed, Vec<Diagnostic>> {
    let enforcement = a.enforcement.enforcement_for(&src.path);
    let Ok(text) = std::str::from_utf8(&src.bytes) else {
        return Err(vec![Diagnostic {
            rule: NOT_TEXT,
            severity: Severity::Error,
            enforcement,
            primary: Location::new(src.path.clone(), ByteSpan::new(0, 0), 1, 1),
            related: Vec::new(),
            message: String::from("the source is not UTF-8, so no comment of it can be read"),
        }]);
    };

    let map = SourceMap::default();
    let file = map.new_source_file(
        Lrc::new(FileName::Real(src.path.clone())),
        String::from(text),
    );
    let store = SingleThreadedComments::default();
    let mut recovered = Vec::new();
    let outcome = parse_file_as_program(
        &file,
        syntax_of(src),
        EsVersion::latest(),
        Some(&store),
        &mut recovered,
    );

    let start = file.start_pos;
    if let Err(fatal) = outcome {
        return Err(vec![finding(src, enforcement, start, fatal)]);
    }

    let mut out = Parsed {
        path: src.path.clone(),
        regions: regions(src, text, start, &store),
        diagnostics: recovered
            .into_iter()
            .map(|one| finding(src, enforcement, start, one))
            .collect(),
        ..Parsed::default()
    };
    out.diagnostics.sort();
    Ok(out)
}

/// The syntax settings one source's name decides.
///
/// Two of `TsSyntax`' fields are per-file facts rather than corpus-wide
/// ones, and both are read off the extension the file was given: `tsx`
/// switches on the JSX grammar, which a `.ts` file may not use and a `.tsx`
/// file may, and `dts` marks an ambient declaration file, whose bodies are
/// types where a `.ts` file's are values. Everything else `TsSyntax` offers
/// stays at its default, which is what `swc` documents as the plain
/// TypeScript reading.
fn syntax_of(src: &SourceFile) -> Syntax {
    let name = src.path.to_string_lossy().into_owned();
    Syntax::Typescript(TsSyntax {
        tsx: name.ends_with(TSX),
        dts: name.ends_with(DTS),
        ..TsSyntax::default()
    })
}

/// One parse failure as a located finding.
///
/// `swc` reports a failure at a span of the source map, so the span converts
/// the way a comment's does, and the line and column are then counted off the
/// file's own bytes the way every other frontend's are. A failure the parser
/// cannot place at all lands at the file's head rather than nowhere, which is
/// where a reader looks for "this file did not parse".
fn finding(
    src: &SourceFile,
    enforcement: Enforcement,
    start: BytePos,
    error: swc_ecma_parser::error::Error,
) -> Diagnostic {
    let at = span_of(error.span(), start).unwrap_or(ByteSpan::new(0, 0));
    Diagnostic {
        rule: UNPARSABLE,
        severity: Severity::Error,
        enforcement,
        primary: located(&src.path, at, &src.bytes),
        related: Vec::new(),
        message: format!("swc cannot parse this source: {}", error.into_kind().msg()),
    }
}

/// The scanned regions: every comment of the store, once, in file order.
///
/// A comment reaches the store as the leading comment of the token after it
/// or the trailing comment of the token before it, and which of the two a
/// given comment lands in is the parser's affair. Reading both maps and
/// keying on the comment's own span settles it from this side: the region
/// set is the set of comments, whatever the attachment, and it is ordered by
/// position rather than by however the store enumerates
/// (´[ARCH-req:linter:determinism]´).
fn regions(
    src: &SourceFile,
    text: &str,
    start: BytePos,
    store: &SingleThreadedComments,
) -> Vec<Region> {
    let (leading, trailing) = store.borrow_all();
    let mut comments: Vec<&Comment> = leading
        .values()
        .chain(trailing.values())
        .flatten()
        .collect();
    comments.sort_unstable_by_key(|one| (one.span.lo, one.span.hi));
    comments.dedup_by_key(|one| (one.span.lo, one.span.hi));
    comments
        .into_iter()
        .filter_map(|one| region(src, text, span_of(one.span, start)?, one.kind))
        .collect()
}

/// One span of the source map in file coordinates.
///
/// `None` for a span the file does not contain, which a span of another file
/// in the same map would be. One file is put in each map here, so the case is
/// unreachable rather than expected — and it is an absence and not a panic
/// because a frontend reports (´crit:lint:error-or-finding´).
fn span_of(span: swc_common::Span, start: BytePos) -> Option<ByteSpan> {
    let lo = span.lo.0.checked_sub(start.0)? as usize;
    let hi = span.hi.0.checked_sub(start.0)? as usize;
    (hi >= lo).then(|| ByteSpan::new(lo, hi))
}

/// One comment as a region, its leaders resolved away.
///
/// The form is read off the bytes the span covers rather than off
/// `CommentKind`, which distinguishes only line from block: `/**` opens a
/// JSDoc comment and `/*` a plain one, and the two differ in what counts as
/// a leader. Reading a delimiter form at a span the parser handed back is
/// the one place raw bytes are consulted at all
/// (´[ARCH-dec:linter:ast-frontends]´).
fn region(src: &SourceFile, text: &str, span: ByteSpan, kind: CommentKind) -> Option<Region> {
    let raw = text.get(span.start..span.end)?;
    let (form, open, close) = shape(raw, kind);
    let interior = ByteSpan::new(span.start.checked_add(open)?, span.end.checked_sub(close)?);
    if interior.end < interior.start {
        return None;
    }
    let mut region = Region {
        kind: RegionKind::Comment(form),
        text: String::new(),
        pieces: Vec::new(),
        syntax: RegionSyntax::Code,
        participates: true,
        generated: src.generated,
        spans: Vec::new(),
    };
    match form {
        CommentForm::BlockOuterDoc => degutter(&mut region, text, interior),
        _ => append(&mut region, text, interior),
    }
    Some(region)
}

/// The form a comment was written in, and the widths of its leader and its
/// trailer.
///
/// `/**` opens a JSDoc comment "unless the next byte is `*` or `/`", which is
/// the rule the corpus's Rust pre-tokenizer already reads `/**/` and `/***/`
/// by: an empty block comment is not documentation that happens to be
/// empty. The three forms are `[scanned-regions]`' three for TypeScript, and
/// they carry the [`CommentForm`] variants of the same spelling — the enum
/// names comment forms by how they are written, and `//`, `/* */` and
/// `/** */` are written the same in both languages.
fn shape(raw: &str, kind: CommentKind) -> (CommentForm, usize, usize) {
    if kind == CommentKind::Line {
        return (CommentForm::LinePlain, "//".len(), 0);
    }
    let jsdoc = raw.len() > "/***/".len()
        && raw.starts_with("/**")
        && !matches!(raw.as_bytes().get("/**".len()), Some(b'*' | b'/'));
    if jsdoc {
        (CommentForm::BlockOuterDoc, "/**".len(), "*/".len())
    } else {
        (CommentForm::BlockPlain, "/*".len(), "*/".len())
    }
}

