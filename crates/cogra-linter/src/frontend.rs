//! ´mod:module:frontend´
//!
//! The shared frontend contract: what every frontend produces, and the
//! dispatcher that picks one.
//!
//! A frontend turns one carrier source into logical regions, environment
//! heads, and covered assets (´sig:lint:frontend-api´). The *data* contract
//! is real and lives here; the *behavior* contract is one `match`, because a
//! trait exists to admit implementations its author does not know and the
//! frontends are four, all in this crate (´dec:lint:frontend-dispatch´).
//!
//! # Coordinates
//!
//! A region's [`Region::text`] is logical text with the source's own
//! structure resolved away, so it is not a run of file bytes
//! (´[LBL-gram:labels:well-formed]´). [`Region::pieces`] records the file
//! ranges it was assembled from, in order, and [`Region::locate`] maps a
//! region-local span back into the file — which is how a scan of the logical
//! text produces a diagnostic that points into the source.
//!
//! # The one step no frontend takes
//!
//! A definition-recognized census is not computable from one source: the
//! file backing a `mod name;` holds the definition and the declaring file
//! holds the name. The unresolved half travels as a [`Declaration`], and
//! [`backing_definitions`] completes it once every source is in hand
//! (´dec:lint:cross-source-pairing´). It lives here because its input and
//! its output are both this contract's own types, and because the two runs
//! that need it must share one implementation rather than grow one each.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::adopt::{Adoption, Area, Kind, Place, Profile, ProfileId};
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic};
use crate::frontend_rust::CargoTarget;
use crate::pretokenize::{CommentForm, PreTokenized};
use crate::scan::{DelimitedSpan, Syntax};

/// What kind of logical region a frontend produced.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum RegionKind {
    /// A block-level element of prose.
    Prose,
    /// A heading, whose rung the format supplies.
    Heading,
    /// A comment, in the form the language gives it.
    Comment(CommentForm),
    /// Documentation written as an attribute rather than as a comment: the
    /// fifth documentation form `[scanned-regions]` names for Rust, a
    /// `#[doc = "…"]` whose region is the literal's interior. It is not a
    /// [`RegionKind::Comment`] because it is not one — no comment form
    /// describes it, and saying it was written `///` would be false about
    /// the bytes a diagnostic points at.
    Attribute,
    /// Table material: one cell of one row.
    TableRow,
}

/// One logical region: the unit the span scanner receives
/// (´sig:lint:frontend-api´).
///
/// ```
/// use cogra_linter::ByteSpan;
/// use cogra_linter::frontend::{Region, RegionKind};
/// use cogra_linter::scan::Syntax;
///
/// let region = Region {
///     kind: RegionKind::Prose,
///     text: String::from("one\ntwo"),
///     pieces: vec![ByteSpan::new(2, 6), ByteSpan::new(8, 11)],
///     syntax: Syntax::Prose,
///     participates: true,
///     generated: false,
///     spans: Vec::new(),
/// };
/// assert_eq!(region.locate(ByteSpan::new(4, 7)), ByteSpan::new(8, 11));
/// assert_eq!(region.span(), ByteSpan::new(2, 11));
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Region {
    /// Which kind of region it is.
    pub kind: RegionKind,
    /// The region's own logical text, structure resolved away.
    pub text: String,
    /// The file ranges the logical text was assembled from, in order. Their
    /// lengths sum to the length of [`Region::text`]: a piece is copied
    /// verbatim, never transformed, which is what makes
    /// [`Region::locate`] exact.
    pub pieces: Vec<ByteSpan>,
    /// Which concrete syntax the region carries.
    pub syntax: Syntax,
    /// Whether its occurrences participate (´[LBL-judg:labels:participation]´).
    pub participates: bool,
    /// Whether it is generated.
    pub generated: bool,
    /// For prose regions: the format's own delimited spans, already paired.
    /// Both offsets of each span index [`Region::text`].
    pub spans: Vec<DelimitedSpan>,
}

impl Region {
    /// The file span enclosing a region-local span.
    ///
    /// A logical span may cross a piece boundary — an occurrence inside a run
    /// of line documentation comments, whose leaders were resolved away and
    /// took the line breaks with them, or a quotation whose markers were
    /// removed — and the file range between its ends then covers structure
    /// the logical text does not hold. That range is what a diagnostic points
    /// at: the whole of what the author wrote, markers included.
    ///
    /// A prose span wrapped across lines is not one of those cases. Only
    /// structure is resolved away, so the line break stays inside the span,
    /// which then parses as no form and is text
    /// (´[LBL-gram:labels:well-formed]´); what crosses a boundary here is a
    /// near-miss's span, not an occurrence's.
    #[must_use]
    pub fn locate(&self, local: ByteSpan) -> ByteSpan {
        ByteSpan::new(self.at(local.start, false), self.at(local.end, true))
    }

    /// The file span enclosing the whole region.
    #[must_use]
    pub fn span(&self) -> ByteSpan {
        match (self.pieces.first(), self.pieces.last()) {
            (Some(first), Some(last)) => ByteSpan::new(first.start, last.end),
            _ => ByteSpan::new(0, 0),
        }
    }

    /// One region-local offset in file coordinates.
    ///
    /// `closing` decides what an offset sitting exactly on a piece boundary
    /// means: the end of the earlier piece for a span's end, the start of
    /// the later one for a span's start. An offset past the logical text
    /// lands at the last piece's end.
    fn at(&self, offset: usize, closing: bool) -> usize {
        let mut consumed = 0;
        for piece in &self.pieces {
            let next = consumed + piece.len();
            let inside = if closing {
                offset <= next
            } else {
                offset < next
            };
            if inside {
                return piece.start + (offset - consumed);
            }
            consumed = next;
        }
        self.pieces.last().map_or(0, |last| last.end)
    }
}

/// Copy one file range onto a region's logical text.
///
/// Adjacent pieces merge, which keeps a comment with no structure to resolve
/// one piece and makes [`Region::locate`] a single addition over it.
pub(crate) fn append(region: &mut Region, text: &str, piece: ByteSpan) {
    let Some(slice) = text.get(piece.start..piece.end) else {
        return;
    };
    region.text.push_str(slice);
    match region.pieces.last_mut() {
        Some(last) if last.end == piece.start => last.end = piece.end,
        _ => region.pieces.push(piece),
    }
}

/// Copy a block documentation comment's interior onto a region, line by
/// line, with each line's gutter resolved away.
///
/// The gutter — the whitespace and `*` that open every line of such a
/// comment after the first — is a leader in exactly the sense
/// (´[ARCH-def:linter:logical-region]´) means, and both conventions that use
/// this shape agree a reader never sees it. What is not a leader is the line
/// break: it sits inside one comment, where a line comment run's breaks sit
/// between two, so it stays in the logical text and the region keeps the
/// shape its author gave it.
///
/// Shared because the convention is: JSDoc and KDoc are the same three
/// characters opening the same gutter, and the two frontends that read them
/// would otherwise resolve it twice.
pub(crate) fn degutter(region: &mut Region, text: &str, interior: ByteSpan) {
    let Some(whole) = text.get(interior.start..interior.end) else {
        return;
    };
    let mut at = interior.start;
    for line in whole.split_inclusive('\n') {
        let cut = gutter(line);
        append(region, text, ByteSpan::new(at + cut, at + line.len()));
        at += line.len();
    }
}

/// How many bytes of one gutter-carrying line the gutter occupies.
///
/// A gutter is leading whitespace followed by one `*`, and a line without
/// that shape has none — the first line of a comment written `/** text`,
/// most often, whose text starts where the leader ended.
fn gutter(line: &str) -> usize {
    let blanks = line.len() - line.trim_start().len();
    match line.as_bytes().get(blanks) {
        Some(b'*') => blanks + 1,
        _ => 0,
    }
}

/// A participating authored environment head, with the kind its label
/// declares (´[KND-judg:kinds:head-validation]´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Head {
    /// The head text the registry classifies — the genre's name, never the
    /// instance's title (´dec:lint:head-recognition´).
    pub text: String,
    /// The kind the head's own mint declares.
    pub declared: Kind,
    /// Where the head sits, in whole-file coordinates.
    pub span: ByteSpan,
}

/// A covered asset of one profile's census, as the language exposes it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Asset {
    /// The profile whose census covers it.
    pub profile: ProfileId,
    /// Its bare identifier, as the language exposes it.
    pub identifier: String,
    /// The classification the profile's rule read off it.
    pub area: Area,
    /// Where the profile's standard place puts its label.
    pub place: Place,
    /// Where the asset sits, in whole-file coordinates.
    pub span: ByteSpan,
    /// Where the asset's own documentation opens, in whole-file
    /// coordinates: byte 0 for a definition a whole file backs, and the byte
    /// after the opening brace for one written inline.
    ///
    /// The frontend answers it because the frontend holds the tree. Where a
    /// profile's standard place is the asset itself, this is the byte a label
    /// line goes before, and a run that had to re-derive it from the source
    /// would be reading structure out of bytes that a parser had already
    /// resolved. It carries no meaning for a register-placed profile, whose
    /// standard place is a file of the owner's rather than a position in this
    /// one.
    pub opens: usize,
    /// The asset's own documentation comment, as logical lines: leaders
    /// resolved away, each line trimmed, a block comment's interior split at
    /// its breaks. Empty where the asset carries no documentation.
    ///
    /// The frontend answers it for the reason it answers [`Asset::opens`] —
    /// it holds the tree, and an item's documentation is a fact the parser
    /// has already resolved. It is what the claim discipline reads: the
    /// statement a covered test evidences is written here, and a run that
    /// re-derived these lines from bytes would be reading back structure the
    /// parser had settled (´dec:lint:claim-standing´).
    pub documentation: Vec<String>,
}

/// A `mod name;` declaration, which is not a definition and not an asset.
///
/// A definition census counts definitions once and never declarations, and
/// the definition backing a declaration is another file — which is why this
/// travels out of a frontend unresolved and
/// [`backing_definitions`] resolves it (´dec:lint:cross-source-pairing´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Declaration {
    /// The declared module's bare identifier.
    pub identifier: String,
    /// Where the declaration sits, in whole-file coordinates.
    pub span: ByteSpan,
}

/// One table of a document, as its cells' regions spell it.
///
/// The cell texts are the regions' own logical text, so a cell holding a
/// code span holds it with its delimiters: the table is the document's
/// bytes, not an interpretation of them. Reading a kind token out of one is
/// the registry parser's affair (´sig:lint:kind-registry-api´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Table {
    /// The header row's cells.
    pub headers: Vec<String>,
    /// The body rows, each a row of cells.
    pub rows: Vec<Vec<String>>,
    /// The whole table, in whole-file coordinates.
    pub span: ByteSpan,
}

/// What one frontend produced from one source.
///
/// The findings travel beside the regions and are never traded for them: an
/// unpaired backtick fails its block and the rest of the file resolves
/// normally (´[LBL-judg:labels:participation]´), which is the same shape
/// [`crate::carrier::WalkOutcome`] gives a traversal failure.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Parsed {
    /// The source this came from, relative to the corpus root.
    pub path: PathBuf,
    /// Its logical regions, in document order.
    pub regions: Vec<Region>,
    /// Its participating authored heads, in document order.
    pub heads: Vec<Head>,
    /// The covered assets of every effective profile's census, as far as
    /// this one source settles them.
    pub assets: Vec<Asset>,
    /// The declarations whose definitions lie in other sources, in document
    /// order (´dec:lint:cross-source-pairing´).
    pub declarations: Vec<Declaration>,
    /// Its tables, in document order. Empty for a format with no tables.
    pub tables: Vec<Table>,
    /// What the frontend found wrong, each bounded as its discipline bounds
    /// it.
    pub diagnostics: Vec<Diagnostic>,
}

/// Parse one source with the frontend its language names.
///
/// A language with no frontend yields an empty [`Parsed`]: its files stay in
/// the carrier and stay owned, carrying no occurrences
/// (´[LBL-judg:labels:minting]´).
///
/// `pre` is the source's own pre-tokenizing, and one frontend of the three
/// uses it: the Rust frontend reads a doc attribute's comment form out of it
/// rather than re-deciding one `syn` already dropped
/// (´conv:lint:rust-surface´). Markdown has no lexical pre-pass at all, and
/// `swc` keeps the comments it lexes, so neither of the other two needs a
/// second reading of the bytes.
///
/// # Errors
///
/// One or more diagnostics whenever the source cannot be parsed at all — a
/// Markdown file that is not UTF-8, say. A defect the format bounds to one
/// block is not such a failure: it travels in [`Parsed::diagnostics`] beside
/// the regions that did parse.
pub fn parse(
    src: &SourceFile,
    pre: &PreTokenized,
    a: &Adoption,
) -> Result<Parsed, Vec<Diagnostic>> {
    match src.language.as_ref().map(crate::adopt::Language::as_str) {
        Some(crate::frontend_md::MARKDOWN) => crate::frontend_md::parse(src, a),
        Some(crate::pretokenize::rust::RUST) => crate::frontend_rust::parse(src, pre, a),
        Some(crate::frontend_web::TYPESCRIPT) => crate::frontend_web::parse(src, a),
        Some(crate::frontend_kotlin::KOTLIN) => crate::frontend_kotlin::parse(src, a),
        _ => Ok(Parsed {
            path: src.path.clone(),
            ..Parsed::default()
        }),
    }
}

/// The sources that back a profile's `mod name;` declarations, each once,
/// as the covered assets they are.
///
/// This is the pairing no frontend can make: a declaration and its
/// definition sit in different files, and a frontend is handed one source at
/// a time (´sig:lint:frontend-api´). A run that holds every source makes it
/// here — once per definition, never per declaration, which is what keeps
/// the nine `mod rig;` declarations of one tree one asset rather than nine
/// (´dec:lint:cross-source-pairing´).
///
/// `declared` is every declaration of the corpus as the pair of the
/// declaring source's path and the declared identifier; `defined` is every
/// definition of this profile a source settled on its own, so that a file
/// already carrying an inline definition of the name it is backed under
/// yields one asset and not two. Neither wants the declaration's span: the
/// asset is located at the backing file, which is where its standard place
/// lies.
///
/// Cargo's own module layout is the rule: a declaration in a crate root or a
/// `mod.rs` is backed from that file's own directory, and one in any other
/// module file from the directory named after it. A declaration whose
/// backing file is not in the carrier pairs with nothing and contributes no
/// asset, rather than an asset pointing at a file no run saw. The result is
/// ordered by the backing source's path (´[ARCH-req:linter:determinism]´).
///
/// A file directly under a package's `tests` directory is a crate root as
/// well, because Cargo compiles each as its own crate, which is why the
/// `mod rig;` of eleven integration suites pairs to the one tree beside them.
#[must_use]
pub fn backing_definitions<'s>(
    profile: &Profile,
    sources: &'s [SourceFile],
    declared: &[(&Path, &str)],
    defined: &[(&Path, &str)],
) -> Vec<(&'s SourceFile, Asset)> {
    if profile.census.definition_rule.is_none() {
        return Vec::new();
    }
    let mut areas = profile.classification.areas.values();
    let (Some(area), None) = (areas.next(), areas.next()) else {
        return Vec::new();
    };
    let by_path: BTreeMap<&Path, &SourceFile> = sources
        .iter()
        .map(|one| (one.path.as_path(), one))
        .collect();
    let mut paired: BTreeMap<&Path, (&SourceFile, &str)> = BTreeMap::new();
    for (declaring, identifier) in declared {
        for candidate in candidates(declaring, identifier) {
            if let Some(src) = by_path.get(candidate.as_path()) {
                paired
                    .entry(src.path.as_path())
                    .or_insert((*src, identifier));
                break;
            }
        }
    }
    paired
        .into_values()
        .filter(|(src, identifier)| {
            !defined
                .iter()
                .any(|(path, held)| *path == src.path.as_path() && held == identifier)
        })
        .map(|(src, identifier)| {
            let asset = Asset {
                profile: profile.id.clone(),
                identifier: String::from(identifier),
                area: area.clone(),
                place: profile.standard_place.clone(),
                span: ByteSpan::new(0, 0),
                opens: 0,
                documentation: Vec::new(),
            };
            (src, asset)
        })
        .collect()
}

/// Whether a source is a crate root, in Cargo's own sense.
///
/// Three roots are named by their file stem — a package's `lib.rs` and
/// `main.rs`, and the `mod.rs` that roots a directory. The fourth is named by
/// its place in a target: "Files located under the `tests` directory are
/// integration tests", and "Cargo will compile each of these files as a
/// separate crate" (The Cargo Book, *Cargo Targets*, verified 2026-08-26), so
/// a file directly under one is an entry point and not a module file. Which
/// directory that is comes from [`CargoTarget::of`], the one reading of the
/// layout this crate has: a `tests` directory inside a `src` tree belongs to
/// a lib target and roots nothing.
fn is_crate_root(path: &Path) -> bool {
    if matches!(
        path.file_stem().and_then(std::ffi::OsStr::to_str),
        Some("lib" | "main" | "mod")
    ) {
        return true;
    }
    CargoTarget::of(path) == CargoTarget::IntegrationTest
        && path
            .parent()
            .and_then(Path::file_name)
            .is_some_and(|dir| dir == std::ffi::OsStr::new("tests"))
}

/// The two files a declaration in `declaring` could be backed by.
fn candidates(declaring: &Path, name: &str) -> [PathBuf; 2] {
    let parent = declaring.parent().unwrap_or(Path::new(""));
    let dir = if is_crate_root(declaring) {
        parent.to_path_buf()
    } else {
        match declaring.file_stem().and_then(std::ffi::OsStr::to_str) {
            Some(stem) => parent.join(stem),
            None => parent.to_path_buf(),
        }
    };
    [
        dir.join(format!("{name}.rs")),
        dir.join(name).join("mod.rs"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn region(pieces: Vec<ByteSpan>, text: &str) -> Region {
        Region {
            kind: RegionKind::Prose,
            text: String::from(text),
            pieces,
            syntax: Syntax::Prose,
            participates: true,
            generated: false,
            spans: Vec::new(),
        }
    }

    /// A contiguous region locates by addition alone.
    /// ´claim:pieces:a-contiguous-region-locates-by-addition´
    #[test]
    fn a_contiguous_region_locates_by_addition() {
        let one = region(vec![ByteSpan::new(10, 20)], "0123456789");
        assert_eq!(one.locate(ByteSpan::new(2, 5)), ByteSpan::new(12, 15));
    }

    /// A span crossing a piece boundary covers the structure between the pieces.
    /// ´claim:pieces:a-crossing-span-covers-the-structure´
    #[test]
    fn a_span_crossing_a_piece_boundary_covers_the_structure_between() {
        let one = region(vec![ByteSpan::new(0, 3), ByteSpan::new(9, 12)], "abcdef");
        assert_eq!(one.locate(ByteSpan::new(1, 5)), ByteSpan::new(1, 11));
    }

    /// An offset on a boundary belongs to the piece it faces.
    /// ´claim:pieces:a-boundary-offset-faces-one-piece´
    #[test]
    fn an_offset_on_a_boundary_belongs_to_the_piece_it_faces() {
        let one = region(vec![ByteSpan::new(0, 3), ByteSpan::new(9, 12)], "abcdef");
        assert_eq!(one.locate(ByteSpan::new(3, 3)), ByteSpan::new(9, 3));
        assert_eq!(one.locate(ByteSpan::new(0, 3)), ByteSpan::new(0, 3));
        assert_eq!(one.locate(ByteSpan::new(3, 6)), ByteSpan::new(9, 12));
    }

    /// An offset past the text lands at the last piece.
    /// ´claim:pieces:an-offset-past-the-text-clamps´
    #[test]
    fn an_offset_past_the_text_lands_at_the_last_piece() {
        let one = region(vec![ByteSpan::new(4, 7)], "abc");
        assert_eq!(one.locate(ByteSpan::new(90, 90)), ByteSpan::new(7, 7));
    }

    /// A region with no pieces spans nothing.
    /// ´claim:pieces:a-pieceless-region-spans-nothing´
    #[test]
    fn a_region_with_no_pieces_spans_nothing() {
        let one = region(Vec::new(), "");
        assert_eq!(one.span(), ByteSpan::new(0, 0));
        assert_eq!(one.locate(ByteSpan::new(0, 1)), ByteSpan::new(0, 0));
    }

    fn spelled(declaring: &str, name: &str) -> Vec<String> {
        candidates(Path::new(declaring), name)
            .iter()
            .map(|one| one.to_string_lossy().replace('\\', "/"))
            .collect()
    }

    /// A crate root backs its declarations from its own directory.
    /// ´claim:layout:a-crate-root-backs-from-its-directory´
    #[test]
    fn a_crate_root_backs_from_its_own_directory() {
        assert_eq!(
            spelled("crates/api/src/lib.rs", "auth"),
            ["crates/api/src/auth.rs", "crates/api/src/auth/mod.rs"]
        );
    }

    /// A module file backs from the directory named after it.
    /// ´claim:layout:a-module-file-backs-from-its-namesake´
    #[test]
    fn a_module_file_backs_from_the_directory_named_after_it() {
        assert_eq!(
            spelled("crates/api/src/auth.rs", "tokens"),
            [
                "crates/api/src/auth/tokens.rs",
                "crates/api/src/auth/tokens/mod.rs"
            ]
        );
    }

    /// A module-root file backs from its own directory like a crate root.
    /// ´claim:layout:a-mod-file-backs-like-a-root´
    #[test]
    fn a_mod_file_backs_from_its_own_directory_like_a_root() {
        assert_eq!(
            spelled("crates/api/tests/rig/mod.rs", "seed"),
            [
                "crates/api/tests/rig/seed.rs",
                "crates/api/tests/rig/seed/mod.rs"
            ]
        );
    }

    /// A test-target entry point backs from its own directory.
    /// ´claim:layout:a-test-entry-backs-from-its-directory´
    #[test]
    fn a_test_target_entry_point_backs_from_its_own_directory() {
        assert_eq!(
            spelled("crates/api/tests/server.rs", "rig"),
            ["crates/api/tests/rig.rs", "crates/api/tests/rig/mod.rs"]
        );
    }

    /// A tests directory inside a library target roots nothing.
    /// ´claim:layout:an-inner-tests-directory-roots-nothing´
    #[test]
    fn a_tests_directory_inside_a_lib_target_roots_nothing() {
        assert_eq!(
            spelled("crates/api/src/tests/helper.rs", "inner"),
            [
                "crates/api/src/tests/helper/inner.rs",
                "crates/api/src/tests/helper/inner/mod.rs"
            ]
        );
    }
}
