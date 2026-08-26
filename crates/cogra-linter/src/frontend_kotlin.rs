//! ´mod:module:frontend-kotlin´
//!
//! `tree-sitter`: the comment regions of Kotlin.
//!
//! The grammar is this repository's own, written from scratch against the
//! Kotlin specification's ANTLR grammar and vendored at
//! `vendor/tree-sitter-kotlin/` (´[ARCH-dec:linter:kotlin-tree-sitter]´). Its
//! generated `parser.c` is committed and compiled by this crate's build
//! script, so a Kotlin parse costs a C library at build time and no grammar
//! toolchain ever.
//!
//! # The grammar decides the form
//!
//! Where the web frontend re-reads a comment's opening bytes to tell JSDoc
//! from a plain block comment, this one does not have to: the grammar emits
//! `line_comment`, `block_comment` and `kdoc` as three distinct named nodes,
//! which are exactly `[scanned-regions]`' three scanned forms for Kotlin. The
//! node kind is the form, decided by the scanner that read the bytes, so the
//! only bytes this module reads are the ones it copies into a region.
//!
//! The scanner's rule for the KDoc opener is its own and is followed rather
//! than second-guessed: `/**` opens KDoc unless the comment is the empty
//! `/**/`, whose closing star is not documentation.
//!
//! # One comment, one region
//!
//! `[scanned-regions]`' region unit for Kotlin is "one comment node from the
//! grammar, leaders resolved away". A run of consecutive `//` lines is that
//! many nodes and therefore that many regions — the same reading the web
//! frontend gives a `//` run, and the opposite of the Rust frontend's rule
//! for `///`, which the adoption rows give the reason for: a `///` run is one
//! documentation comment written across lines, and a `//` run is a run.
//!
//! # What is never read
//!
//! String literals, string templates and character literals carry no scanned
//! region. Nothing filters them out: they are their own node kinds, and this
//! module visits three. A `//` inside a string's content is part of that
//! string's node and never a comment node, so it cannot become an occurrence
//! — which is the property an AST frontend has and a text search does not
//! (´[ARCH-dec:linter:ast-frontends]´).
//!
//! One gap in that guarantee is known and parked, and it belongs to the
//! grammar rather than to this module: at a *token boundary* inside a line
//! string — directly after the opening quote, or directly after an
//! interpolation's closing brace — the grammar admits a comment token, so a
//! leader there is lexed as a comment rather than as content. Where the
//! comment is a block comment the string still closes and no error node is
//! produced, which would make a label written there an occurrence
//! `[scanned-regions]` promises cannot exist. No source of this corpus
//! reaches it: every string here that contains `//` contains it mid-content,
//! where the lexer never stops. `tests/kotlin_frontend.rs` carries the three
//! ignored repros and the corpus-wide guard that fails the day one appears.
//!
//! # Error nodes are findings, forever
//!
//! The grammar's precondition was that it parse the whole Android corpus to
//! zero error nodes, and it does. That is a measurement of one day's corpus,
//! not a property of Kotlin, so every `ERROR` and `MISSING` node this module
//! meets becomes a hard located diagnostic beside whatever regions did parse
//! (´[ARCH-req:linter:diagnostics-not-panics]´). A syntax the grammar does
//! not yet cover therefore surfaces loudly on the commit that writes it,
//! rather than as a file that quietly scanned to nothing.
//!
//! Only the outermost error of a nest is reported. A single unparsable
//! construct can strand a whole subtree in `ERROR` nodes, and one finding
//! that points at the construct serves a reader better than the dozen that
//! point into its wreckage.

use tree_sitter::{Node, Parser};
use tree_sitter_language::LanguageFn;

use crate::adopt::Adoption;
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::frontend::{Parsed, Region, RegionKind, append, degutter};
use crate::pretokenize::{CommentForm, located};
use crate::scan::Syntax as RegionSyntax;

unsafe extern "C" {
    fn tree_sitter_kotlin() -> *const ();
}

/// The first-party Kotlin grammar, in the form a [`Parser`] accepts.
///
/// `tree_sitter_kotlin` above is the vendored grammar's entry point, as its
/// generated `parser.c` exports it; the build script compiles that file into
/// this crate, so the symbol resolves at link time from the repository's own
/// source. The extern block carries no documentation of its own because
/// rustdoc generates none for one.
///
/// This constant is the binding tree-sitter's CLI writes into
/// `bindings/rust/lib.rs` for a published grammar. The vendored tree carries
/// no such directory — it is consumed by exactly one crate, which is this
/// one — so the binding lives at the point of use instead.
///
/// The safety obligation `LanguageFn::from_raw` states is that the function
/// be a language function generated from a grammar by the tree-sitter CLI.
/// It is: `vendor/tree-sitter-kotlin/src/parser.c` is generated output,
/// committed, and regenerated only by that CLI.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_kotlin) };

/// The `[scanned-regions]` language this frontend reads.
pub const KOTLIN: &str = "kotlin";

/// A Kotlin source that is not UTF-8 at all, so no parser can read it.
///
/// Kotlin has no entry in `[banned-tokens]`, so this finding leaves nothing
/// else to enforce on the file: the bytes are unreadable and the file carries
/// no region.
pub const NOT_TEXT: RuleId = RuleId::new("kotlin-not-utf8");

/// A Kotlin source the grammar could not parse, at the node where it failed.
///
/// One per outermost `ERROR` or `MISSING` node, located at that node. The
/// regions that did parse travel beside it and are never traded for it.
pub const UNPARSABLE: RuleId = RuleId::new("kotlin-unparsable");

/// The grammar itself did not load, so no Kotlin source can be read at all.
///
/// A fact about the build rather than about the corpus: the compiled parser
/// and the runtime disagree about the ABI, or the parser produced no tree.
/// It is a diagnostic and not a panic because a frontend reports
/// (´crit:lint:error-or-finding´), and it is its own rule because its remedy
/// is its own — rebuild the crate, rather than edit the file it points at.
/// The suite asserts it never fires, which is what keeps it theoretical.
pub const NO_PARSER: RuleId = RuleId::new("kotlin-no-grammar");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 3] = [NOT_TEXT, UNPARSABLE, NO_PARSER];

/// The grammar's line comment node, opened `//` and ended by the newline it
/// does not include.
const LINE_COMMENT: &str = "line_comment";

/// The grammar's block comment node, opened `/*` and closed `*/`, nesting.
const BLOCK_COMMENT: &str = "block_comment";

/// The grammar's KDoc node, opened `/**` and closed `*/`, nesting.
const KDOC: &str = "kdoc";

/// Parse one Kotlin source.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::pretokenize::CommentForm;
/// use cogra_linter::frontend::RegionKind;
/// use cogra_linter::{Language, OwnerId, SourceFile, frontend_kotlin};
///
/// let source = SourceFile {
///     path: std::path::PathBuf::from("X.kt"),
///     owner: OwnerId::new("android"),
///     language: Some(Language::new("kotlin")),
///     generated: false,
///     bytes: Vec::from("// one\n// two\nval x = \"https://three\"\n"),
/// };
/// let parsed = frontend_kotlin::parse(&source, &adoption)
///     .map_err(|d| format!("{d:?}"))?;
///
/// assert_eq!(parsed.regions.len(), 2, "a // run is two comments, not one");
/// assert_eq!(parsed.regions[0].kind, RegionKind::Comment(CommentForm::LinePlain));
/// assert_eq!(parsed.regions[0].text, " one");
/// assert_eq!(parsed.regions[1].text, " two");
/// assert!(parsed.heads.is_empty(), "no Kotlin profile, so no head");
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// Diagnostics whenever no region of the source can be read: it is not UTF-8,
/// or the grammar did not load. A source that parses with error nodes is not
/// such a failure — its regions and its findings travel together
/// (´crit:lint:error-or-finding´).
pub fn parse(src: &SourceFile, a: &Adoption) -> Result<Parsed, Vec<Diagnostic>> {
    let enforcement = a.enforcement.enforcement_for(&src.path);
    let Ok(text) = std::str::from_utf8(&src.bytes) else {
        return Err(vec![whole_file(
            src,
            enforcement,
            NOT_TEXT,
            String::from("the source is not UTF-8, so no comment of it can be read"),
        )]);
    };

    let mut parser = Parser::new();
    if parser.set_language(&LANGUAGE.into()).is_err() {
        return Err(vec![whole_file(
            src,
            enforcement,
            NO_PARSER,
            String::from("the vendored Kotlin grammar and the tree-sitter runtime disagree"),
        )]);
    }
    let Some(tree) = parser.parse(text, None) else {
        return Err(vec![whole_file(
            src,
            enforcement,
            NO_PARSER,
            String::from("the vendored Kotlin grammar produced no tree for this source"),
        )]);
    };

    let mut out = Parsed {
        path: src.path.clone(),
        ..Parsed::default()
    };
    walk(src, text, enforcement, &tree, &mut out);
    out.diagnostics.sort();
    Ok(out)
}

/// One finding about the whole file, located at its head.
///
/// Where a reader looks for "nothing could be read here", and the only
/// honest span when the reason is that the bytes or the grammar, rather than
/// any position in them, is what failed.
fn whole_file(
    src: &SourceFile,
    enforcement: Enforcement,
    rule: RuleId,
    message: String,
) -> Diagnostic {
    Diagnostic {
        rule,
        severity: Severity::Error,
        enforcement,
        primary: Location::new(src.path.clone(), ByteSpan::new(0, 0), 1, 1),
        related: Vec::new(),
        message,
    }
}

/// Walk the whole tree once, collecting comment regions and error findings.
///
/// One traversal rather than two, and iterative rather than recursive: a
/// frontend that must not panic must not depend on the stack outlasting an
/// arbitrarily deep expression either
/// (´[ARCH-req:linter:diagnostics-not-panics]´).
///
/// `error` holds the depth of the outermost unreported-through error node,
/// which is how a nest of them yields one finding. Comments are collected
/// inside such a nest all the same: a comment node is a scanner token, and
/// the scanner read it correctly whatever the parser then failed to do with
/// its neighbours.
fn walk(
    src: &SourceFile,
    text: &str,
    enforcement: Enforcement,
    tree: &tree_sitter::Tree,
    out: &mut Parsed,
) {
    let mut cursor = tree.walk();
    let mut depth = 0usize;
    let mut error: Option<usize> = None;
    loop {
        let node = cursor.node();
        if error.is_some_and(|at| depth <= at) {
            error = None;
        }
        if error.is_none() && (node.is_error() || node.is_missing()) {
            out.diagnostics.push(failure(src, enforcement, node));
            error = Some(depth);
        }
        if let Some(region) = region(src, text, node) {
            out.regions.push(region);
        }

        if cursor.goto_first_child() {
            depth += 1;
            continue;
        }
        loop {
            if cursor.goto_next_sibling() {
                break;
            }
            if !cursor.goto_parent() {
                return;
            }
            depth -= 1;
        }
    }
}

/// One error node as a located finding.
///
/// A `MISSING` node has no width — the parser is naming a token that should
/// have been there and was not — so its span is empty and points at the
/// position the token was expected. An `ERROR` node spans the bytes the
/// parser could make nothing of.
fn failure(src: &SourceFile, enforcement: Enforcement, node: Node<'_>) -> Diagnostic {
    let range = node.byte_range();
    let at = ByteSpan::new(range.start, range.end);
    let what = if node.is_missing() {
        format!("a {} is missing here", node.kind())
    } else {
        String::from("the grammar cannot parse this")
    };
    Diagnostic {
        rule: UNPARSABLE,
        severity: Severity::Error,
        enforcement,
        primary: located(&src.path, at, &src.bytes),
        related: Vec::new(),
        message: format!("{what} (´[ARCH-dec:linter:kotlin-tree-sitter]´ keeps this a finding)"),
    }
}

/// One comment node as a region, its leaders resolved away.
///
/// `None` for every node that is not one of the grammar's three comment
/// kinds, which is what leaves string templates and character literals
/// unread.
fn region(src: &SourceFile, text: &str, node: Node<'_>) -> Option<Region> {
    let (form, open) = match node.kind() {
        LINE_COMMENT => (CommentForm::LinePlain, "//".len()),
        BLOCK_COMMENT => (CommentForm::BlockPlain, "/*".len()),
        KDOC => (CommentForm::BlockOuterDoc, "/**".len()),
        _ => return None,
    };
    let range = node.byte_range();
    let raw = text.get(range.start..range.end)?;
    let close = trailer(raw, form, open);
    let interior = ByteSpan::new(
        range.start.checked_add(open)?,
        range.end.checked_sub(close)?,
    );
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

/// How many bytes of a comment's tail are its closing delimiter.
///
/// A line comment has none: the scanner stops before the newline, so the
/// node's last byte is already the comment's. A block comment normally ends
/// `*/` — but one the scanner ran to end-of-file looking for does not, and
/// cutting two bytes off its content would misplace every offset after it.
/// The check is a read of raw bytes at a span the tree handed back, which is
/// the one thing an AST frontend consults them for
/// (´[ARCH-dec:linter:ast-frontends]´).
fn trailer(raw: &str, form: CommentForm, open: usize) -> usize {
    let closer = "*/";
    if form == CommentForm::LinePlain {
        return 0;
    }
    if raw.len() >= open + closer.len() && raw.ends_with(closer) {
        closer.len()
    } else {
        0
    }
}
