//! ´mod:module:frontend-rust´
//!
//! `syn`: doc-comment regions, the two profiles' censuses.
//!
//! One [`syn::parse_file`] and one [`syn::visit::Visit`] walk feed both
//! duties (´conv:lint:rust-surface´). The scanned regions are exactly the
//! documentation comments, which survive parsing as `#[doc]` attributes
//! with spans; the censuses read the item's own identifier and attributes
//! and never its file path (´[LBL-judg:labels:derivation]´).
//!
//! # Coordinates
//!
//! Every byte offset here is [`proc_macro2::Span::byte_range`] under the
//! `span-locations` feature, which is accurate outside a procedural macro —
//! and a linter is outside one (´dec:lint:syn-spans´). A region's pieces
//! are file ranges copied verbatim, so a leader is resolved away by moving
//! a piece's start rather than by rewriting text, and
//! [`crate::frontend::Region::locate`] stays exact.
//!
//! # Five forms, one region kind per run
//!
//! `[scanned-regions]` names five documentation forms — `///`, `//!`,
//! `/** */`, `/*! */`, and a written `#[doc = "…"]` attribute. `syn` hands
//! all five over as the same `#[doc]` attribute and says nothing about
//! which was written, so the form is read off the pre-tokenizer's partition
//! at the attribute's own offset: a comment lexeme starting there *is* the
//! comment it was written as. That is what the `pre` parameter of the ruled
//! signature buys, and it is why nothing here re-lexes bytes `syn` dropped.
//!
//! A run of consecutive `///` lines is ONE logical region, per
//! `[scanned-regions]`' own region unit: consecutive line-doc comments of
//! one form, separated by whitespace holding exactly one newline, assemble
//! into a single region with one piece per line. A blank line ends the run,
//! and so does anything that is not whitespace.
//!
//! # Fenced examples
//!
//! `[scanned-regions]` puts fenced documentation examples outside what is
//! scanned, and an assembled run is therefore cut at its fence lines into
//! participating and non-participating regions
//! (´[LBL-judg:labels:participation]´). The cut is made on the lines, before
//! the join resolves the leaders away, and it moves no bytes: every fence
//! line stays in the pieces of the stretch it bounds.
//!
//! # Heads
//!
//! None. A code comment is a scanned region that carries occurrences and
//! heads nothing, which is why this frontend produces no
//! [`crate::frontend::Head`] values
//! (´dec:lint:head-recognition´).

use syn::spanned::Spanned;
use syn::visit::Visit;

use crate::adopt::{Adoption, Area, Profile};
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::frontend::{Asset, Declaration, Parsed, Region, RegionKind};
use crate::pretokenize::rust::RUST;
use crate::pretokenize::{CommentForm, PreTokenized, located};
use crate::scan::Syntax;

/// A Rust source that is not UTF-8 at all, so `syn` cannot read it.
///
/// The pre-tokenizer still runs on the bytes, so the bans of
/// `[banned-tokens]` are enforced on a file no parser can accept: a lexical
/// fact does not wait on an AST (´crit:lint:error-or-finding´).
pub const NOT_TEXT: RuleId = RuleId::new("rust-not-utf8");

/// A Rust source `syn` cannot parse.
pub const UNPARSABLE: RuleId = RuleId::new("rust-unparsable");

/// A census that classifies by Cargo target and registers no area for the
/// target its recognized assets lie in.
///
/// The target itself is never missing — it is the source's own place in the
/// Cargo layout — so what this reports is a hole in the profile's
/// `[profiles]` classification, which is a value no run can guess. Loud
/// rather than a guessed area, and reached only once a profile of that shape
/// is in force.
pub const TARGET_UNKNOWN: RuleId = RuleId::new("rust-target-unknown");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 3] = [NOT_TEXT, UNPARSABLE, TARGET_UNKNOWN];

/// The `[profiles]` case names the test profile's classification keys its
/// areas by.
const LIB_OR_BIN: &str = "lib_or_bin_target";

/// The other one.
const INTEGRATION: &str = "integration_test_target";

/// Which Cargo target a source belongs to.
///
/// The test profile's classification rule is "the Cargo TARGET containing
/// the function", which `syn` cannot see: the item tree of one file says
/// nothing about targets. The datum therefore comes from the walk that
/// produced the source, and the reading is the recorded one — target
/// membership is a build-system class of the asset, the same species of
/// fact as "the harness recognizes it as a test", and the derivation reads
/// the target and never the path (´[LBL-ansatz:labels:path-derivation]´).
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum CargoTarget {
    /// A `lib` or `bin` target's tree, whose tests are `unit`.
    LibOrBin,
    /// A `tests/` target's tree, whose tests are `integration`.
    IntegrationTest,
}

impl CargoTarget {
    /// The target a source's place in the Cargo layout puts it in.
    ///
    /// Cargo's own layout is the datum: a package's integration targets are
    /// the trees under its `tests/` directory, and everything else a package
    /// compiles belongs to a `lib` or `bin` target. Reading it off the
    /// layout derives no *name* from the path
    /// (´[LBL-ansatz:labels:path-derivation]´); it is how the build system
    /// says which target a file belongs to, and the classification reads the
    /// target.
    ///
    /// ```
    /// use cogra_linter::CargoTarget;
    /// use std::path::Path;
    ///
    /// assert_eq!(
    ///     CargoTarget::of(Path::new("crates/api/tests/rig/mod.rs")),
    ///     CargoTarget::IntegrationTest,
    /// );
    /// assert_eq!(
    ///     CargoTarget::of(Path::new("crates/api/src/tests/helper.rs")),
    ///     CargoTarget::LibOrBin,
    ///     "a tests module inside a lib target is not an integration target",
    /// );
    /// ```
    #[must_use]
    pub fn of(path: &std::path::Path) -> CargoTarget {
        for part in path.components() {
            match part.as_os_str().to_string_lossy().as_ref() {
                "src" => return CargoTarget::LibOrBin,
                "tests" => return CargoTarget::IntegrationTest,
                _ => {}
            }
        }
        CargoTarget::LibOrBin
    }

    /// The `[profiles]` case name this target selects an area by.
    #[must_use]
    pub const fn case(&self) -> &'static str {
        match self {
            CargoTarget::LibOrBin => LIB_OR_BIN,
            CargoTarget::IntegrationTest => INTEGRATION,
        }
    }
}

/// The censuses of one source, computed whether or not their profiles are
/// in force.
///
/// Computing them is not judging them: a staged profile carries no `Covers`
/// edges and no inventory judgment runs over it
/// (´dec:lint:staged-profiles´), which is why [`parse`] reports the assets
/// of the effective profiles alone and a staged profile's census is read
/// through here — by the measurement and by the named regeneration, both of
/// which judge nothing.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Censuses {
    /// The covered assets of every attribute-recognized profile.
    pub tests: Vec<Asset>,
    /// The covered assets of every definition-recognized profile: inline
    /// module definitions, `#[cfg(test)]` excluded.
    pub modules: Vec<Asset>,
    /// The `mod name;` declarations, which are neither: the unresolved half
    /// of the pairing (´dec:lint:cross-source-pairing´).
    pub declarations: Vec<Declaration>,
}

/// Parse one Rust source.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::pretokenize::{CommentForm, pretokenize};
/// use cogra_linter::frontend::RegionKind;
/// use cogra_linter::{Language, OwnerId, SourceFile, frontend_rust};
///
/// let source = SourceFile {
///     path: std::path::PathBuf::from("x.rs"),
///     owner: OwnerId::new("linter"),
///     language: Some(Language::new("rust")),
///     generated: false,
///     bytes: Vec::from("/// one\n/// two\nstruct X;\n"),
/// };
/// let pre = pretokenize(source.language.as_ref(), &source.bytes);
/// let parsed = frontend_rust::parse(&source, &pre, &adoption)
///     .map_err(|d| format!("{d:?}"))?;
///
/// assert_eq!(parsed.regions.len(), 1);
/// assert_eq!(parsed.regions[0].kind, RegionKind::Comment(CommentForm::LineOuterDoc));
/// assert_eq!(parsed.regions[0].text, " one two");
/// assert!(parsed.heads.is_empty());
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// Diagnostics whenever the source cannot be parsed at all: it is not
/// UTF-8, or `syn` rejects it. A file that will not parse is a fact about
/// the corpus and travels as a finding, never as an `Err` of the crate's
/// own taxonomy (´crit:lint:error-or-finding´).
pub fn parse(
    src: &SourceFile,
    pre: &PreTokenized,
    a: &Adoption,
) -> Result<Parsed, Vec<Diagnostic>> {
    let enforcement = a.enforcement.enforcement_for(&src.path);
    let (text, file) = read(src, enforcement)?;
    let mut walk = Walk::default();
    walk.visit_file(&file);

    let mut out = Parsed {
        path: src.path.clone(),
        regions: regions(src, pre, text, &walk),
        declarations: walk.declarations.clone(),
        ..Parsed::default()
    };
    out.diagnostics = effective_assets(src, a, &walk, enforcement, &mut out.assets);
    out.diagnostics
        .extend(pre.stamped(&src.path, &src.bytes, enforcement));
    out.diagnostics.sort();
    Ok(out)
}

/// The two censuses of one source, computed for every registered Rust
/// profile whatever its standing.
///
/// # Errors
///
/// The same two failures [`parse`] reports: a source that is not UTF-8, or
/// one `syn` rejects.
pub fn censuses(
    src: &SourceFile,
    a: &Adoption,
    target: CargoTarget,
) -> Result<Censuses, Vec<Diagnostic>> {
    let enforcement = a.enforcement.enforcement_for(&src.path);
    let (_, file) = read(src, enforcement)?;
    let mut walk = Walk::default();
    walk.visit_file(&file);
    let mut out = Censuses {
        declarations: walk.declarations.clone(),
        ..Censuses::default()
    };
    for profile in &a.profiles.profiles {
        if profile.census.language.as_str() != RUST {
            continue;
        }
        match recognizer(profile) {
            Some(Recognizer::Attributed(harness)) => {
                out.tests
                    .extend(attributed(&walk, profile, &harness, Some(target)));
            }
            Some(Recognizer::Definitions) => {
                out.modules.extend(definitions(&walk, profile));
            }
            None => {}
        }
    }
    Ok(out)
}

/// The source as text and as an item tree, or the findings that stop both.
fn read(src: &SourceFile, enforcement: Enforcement) -> Result<(&str, syn::File), Vec<Diagnostic>> {
    let Ok(text) = std::str::from_utf8(&src.bytes) else {
        return Err(vec![Diagnostic {
            rule: NOT_TEXT,
            severity: Severity::Error,
            enforcement,
            primary: Location::new(src.path.clone(), ByteSpan::new(0, 0), 1, 1),
            related: Vec::new(),
            message: String::from("the source is not UTF-8, so no item of it can be read"),
        }]);
    };
    match syn::parse_file(text) {
        Ok(file) => Ok((text, file)),
        Err(problem) => Err(problem
            .into_iter()
            .map(|one| {
                let span = one.span().byte_range();
                Diagnostic {
                    rule: UNPARSABLE,
                    severity: Severity::Error,
                    enforcement,
                    primary: located(&src.path, ByteSpan::new(span.start, span.end), &src.bytes),
                    related: Vec::new(),
                    message: format!("syn cannot parse this source: {one}"),
                }
            })
            .collect()),
    }
}

/// The assets of the *effective* profiles only, and the findings the
/// computation owes.
///
/// The Cargo target is taken from the source's own place in the layout, which
/// is the same datum [`censuses`] is handed by the run that walked the corpus
/// (´dec:lint:migrations-subcommand´). Taking it here rather than through a
/// parameter is what keeps entering Π a commit that flips two fields: the
/// frontend contract carries no target, and a check that could not classify
/// would report every covered asset unclassifiable on the day a profile
/// enters (´dec:lint:staged-profiles´).
fn effective_assets(
    src: &SourceFile,
    a: &Adoption,
    walk: &Walk,
    enforcement: Enforcement,
    into: &mut Vec<Asset>,
) -> Vec<Diagnostic> {
    let mut findings = Vec::new();
    for profile in a.profiles.effective() {
        if profile.census.language.as_str() != RUST {
            continue;
        }
        match recognizer(profile) {
            Some(Recognizer::Attributed(harness)) => {
                let covered = attributed(walk, profile, &harness, Some(CargoTarget::of(&src.path)));
                if covered.is_empty() && recognized(walk, &harness) {
                    findings.push(Diagnostic {
                        rule: TARGET_UNKNOWN,
                        severity: Severity::Error,
                        enforcement,
                        primary: Location::new(src.path.clone(), ByteSpan::new(0, 0), 1, 1),
                        related: Vec::new(),
                        message: format!(
                            "profile {} classifies by Cargo target and registers no area for the one this source lies in",
                            profile.id.as_str()
                        ),
                    });
                }
                into.extend(covered);
            }
            Some(Recognizer::Definitions) => into.extend(definitions(walk, profile)),
            None => {}
        }
    }
    findings
}

/// Whether any function of this source carries one of the harness tokens.
///
/// The census recognized something and produced nothing exactly when the
/// area lookup failed, which is the one case [`TARGET_UNKNOWN`] reports; a
/// source with no test in it produces nothing for the ordinary reason.
fn recognized(walk: &Walk, harness: &[String]) -> bool {
    walk.functions.iter().any(|hit| {
        hit.attributes
            .iter()
            .any(|segment| harness.iter().any(|token| token == segment))
    })
}

/// Which census a profile's `[profiles]` row asks for.
///
/// Read off the row's own shape rather than off its identifier: a census
/// stating harness attributes is recognized by attribute, one stating a
/// definition rule is recognized by definition. `[profiles]` carries no
/// explicit census-kind key, and this is the reading that keeps a third
/// Rust profile from needing a match on its name.
enum Recognizer {
    /// The final segments of the harness attribute paths.
    Attributed(Vec<String>),
    /// Definitions, not declarations.
    Definitions,
}

fn recognizer(profile: &Profile) -> Option<Recognizer> {
    if !profile.census.attributes.is_empty() {
        let harness = profile
            .census
            .attributes
            .iter()
            .filter_map(|path| path.rsplit("::").next().map(String::from))
            .collect();
        return Some(Recognizer::Attributed(harness));
    }
    profile
        .census
        .definition_rule
        .as_ref()
        .map(|_| Recognizer::Definitions)
}

/// The attribute census: any function carrying an attribute whose path's
/// final segment is one of the harness tokens.
///
/// The open rule of `[profiles]` in one line — "any attribute path whose
/// final segment is 'test'" — which is what keeps a fourth harness from
/// needing a code change: `sqlx::test`, `tokio::test`, and a bare `test`
/// all reduce to the same final segment, and so would a fifth.
fn attributed(
    walk: &Walk,
    profile: &Profile,
    harness: &[String],
    target: Option<CargoTarget>,
) -> Vec<Asset> {
    let Some(area) = target.and_then(|one| profile.classification.areas.get(one.case())) else {
        return Vec::new();
    };
    walk.functions
        .iter()
        .filter(|hit| {
            hit.attributes
                .iter()
                .any(|segment| harness.iter().any(|token| token == segment))
        })
        .map(|hit| asset(profile, &hit.identifier, area.clone(), hit.span))
        .collect()
}

/// The definition census: inline module definitions, `#[cfg(test)]` out.
///
/// A file-backed module is a definition too, and it is deliberately absent:
/// its identifier lives at the `mod name;` declaration in another file, so
/// pairing the two is a cross-source step, and reading the name off this
/// file's own path is what (´[LBL-ansatz:labels:path-derivation]´) forbids.
/// The declarations travel out unresolved — in [`Parsed::declarations`] and
/// in [`Censuses::declarations`] — and
/// [`crate::frontend::backing_definitions`] pairs them once a run holds
/// every source (´dec:lint:cross-source-pairing´).
fn definitions(walk: &Walk, profile: &Profile) -> Vec<Asset> {
    let mut areas = profile.classification.areas.values();
    let (Some(area), None) = (areas.next(), areas.next()) else {
        return Vec::new();
    };
    walk.modules
        .iter()
        .map(|hit| asset(profile, &hit.identifier, area.clone(), hit.span))
        .collect()
}

/// One covered asset, carrying the bare identifier the language exposes.
///
/// The name transformation is not applied here: an [`Asset`] holds the
/// identifier as the language spells it, and turning it into a label's name
/// segment is the derivation's affair.
fn asset(profile: &Profile, identifier: &str, area: Area, span: ByteSpan) -> Asset {
    Asset {
        profile: profile.id.clone(),
        identifier: String::from(identifier),
        area,
        place: profile.standard_place.clone(),
        span,
    }
}

/// The three-backtick fence that opens and closes a documentation example.
const FENCE: &str = "```";

/// The scanned regions: the documentation comments, runs assembled, each
/// split at the fence boundaries its lines carry.
fn regions(src: &SourceFile, pre: &PreTokenized, text: &str, walk: &Walk) -> Vec<Region> {
    let mut docs = walk.docs.clone();
    docs.sort_by_key(|one| one.outer.start);
    let mut out: Vec<Region> = Vec::new();
    let mut open: Option<(CommentForm, ByteSpan, Region)> = None;
    for doc in &docs {
        let (kind, piece) = shape(pre, text, doc);
        let Some(piece) = piece else {
            continue;
        };
        if let Some((form, last, region)) = open.take() {
            if kind == RegionKind::Comment(form)
                && form.is_line()
                && one_newline(text, last.end, doc.outer.start)
            {
                let mut region = region;
                extend(&mut region, text, piece);
                open = Some((form, doc.outer, region));
                continue;
            }
            out.push(region);
        }
        let mut region = Region {
            kind,
            text: String::new(),
            pieces: Vec::new(),
            syntax: Syntax::Code,
            participates: true,
            generated: src.generated,
            spans: Vec::new(),
        };
        extend(&mut region, text, piece);
        open = match kind {
            RegionKind::Comment(form) => Some((form, doc.outer, region)),
            _ => {
                out.push(region);
                None
            }
        };
    }
    if let Some((_, _, region)) = open {
        out.push(region);
    }
    out.iter().flat_map(split_fences).collect()
}

/// Copy one file range onto a region's logical text.
fn extend(region: &mut Region, text: &str, piece: ByteSpan) {
    let Some(slice) = text.get(piece.start..piece.end) else {
        return;
    };
    append(region, slice, piece);
}

/// Copy one already-cut slice onto a region's logical text.
///
/// Adjacent pieces merge, which is what keeps a contiguous block comment one
/// piece and a run of line comments one piece per line.
fn append(region: &mut Region, slice: &str, piece: ByteSpan) {
    region.text.push_str(slice);
    match region.pieces.last_mut() {
        Some(last) if last.end == piece.start => last.end = piece.end,
        _ => region.pieces.push(piece),
    }
}

/// One assembled region, cut into participating and non-participating
/// stretches at its fence lines.
///
/// `[scanned-regions]` puts fenced documentation examples outside what is
/// scanned, alongside string and character literals
/// (´[LBL-judg:labels:participation]´). A fence is a property of a *line*,
/// and a run's logical text joins its lines directly — the leaders resolved
/// away take the newlines with them — so the decision is made on the pieces,
/// which are the lines, and never on the text the join produced.
///
/// The fence bytes stay in the pieces of the stretch they open and close: a
/// region records the file ranges it was assembled from, and dropping them
/// would make [`Region::locate`] inexact for everything after. What the
/// fenced stretch loses is participation, which is the region contract's own
/// way of saying present but not scanned — the same thing the Markdown
/// frontend says about a fenced block.
///
/// An empty piece is an empty `///` line and stays one line: splitting an
/// empty slice yields nothing, so the empty line is supplied rather than
/// lost, and a run keeps its one piece per line.
fn split_fences(region: &Region) -> Vec<Region> {
    if region.pieces.is_empty() {
        return vec![region.clone()];
    }
    let mut out: Vec<Region> = Vec::new();
    let mut open: Option<Region> = None;
    let mut fenced = false;
    let mut consumed = 0;
    for piece in &region.pieces {
        let Some(slice) = region.text.get(consumed..consumed + piece.len()) else {
            continue;
        };
        consumed += piece.len();
        let mut at = piece.start;
        let empty = slice.is_empty();
        for line in slice.split_inclusive('\n').chain(empty.then_some("")) {
            let fence = line.trim_start().starts_with(FENCE);
            let participates = !(fenced || fence);
            fenced ^= fence;
            let cut = ByteSpan::new(at, at + line.len());
            at += line.len();
            match open.as_mut() {
                Some(current) if current.participates == participates => {
                    append(current, line, cut);
                }
                _ => {
                    out.extend(open.take());
                    let mut fresh = Region {
                        kind: region.kind,
                        text: String::new(),
                        pieces: Vec::new(),
                        syntax: region.syntax,
                        participates,
                        generated: region.generated,
                        spans: region.spans.clone(),
                    };
                    append(&mut fresh, line, cut);
                    open = Some(fresh);
                }
            }
        }
    }
    out.extend(open);
    out
}

/// The region kind one doc attribute makes, and the file range its content
/// occupies with the leaders resolved away.
///
/// The form comes from the pre-tokenizer's partition: a comment lexeme
/// starting exactly where the attribute does is the comment the attribute
/// was written as. An attribute that starts at no comment was written as
/// one — `#[doc = "…"]` — and its content is the string literal's interior.
fn shape(pre: &PreTokenized, text: &str, doc: &Doc) -> (RegionKind, Option<ByteSpan>) {
    match pre.class_at(doc.outer.start).and_then(|one| one.comment()) {
        Some(form) => {
            let (open, close) = match form {
                CommentForm::LineOuterDoc | CommentForm::LineInnerDoc => (3, 0),
                CommentForm::BlockOuterDoc | CommentForm::BlockInnerDoc => (3, 2),
                CommentForm::LinePlain | CommentForm::BlockPlain => {
                    return (RegionKind::Prose, None);
                }
            };
            (RegionKind::Comment(form), interior(doc.outer, open, close))
        }
        None => (
            RegionKind::Attribute,
            doc.literal.and_then(|lit| quoted(text, lit)),
        ),
    }
}

/// The interior of a span with a leader and a trailer of known width.
fn interior(span: ByteSpan, open: usize, close: usize) -> Option<ByteSpan> {
    let start = span.start.checked_add(open)?;
    let end = span.end.checked_sub(close)?;
    (end >= start).then(|| ByteSpan::new(start, end))
}

/// The interior of a string literal, raw forms included.
///
/// The opening delimiters are whatever precedes the first quote, and the
/// closing ones mirror them, so `"x"`, `r"x"`, and `r##"x"##` all yield the
/// bytes between the quotes with no dialect and no counting rule of their
/// own.
fn quoted(text: &str, span: ByteSpan) -> Option<ByteSpan> {
    let raw = text.get(span.start..span.end)?.as_bytes();
    let open = raw.iter().position(|byte| *byte == b'"')?;
    let hashes = raw.iter().rev().take_while(|byte| **byte == b'#').count();
    interior(span, open + 1, hashes + 1)
}

/// Whether the bytes between two line-doc comments are one line break.
///
/// Whitespace holding exactly one newline is what separates two lines of
/// one run; a blank line holds two and ends it, and anything that is not
/// whitespace is another item's business.
fn one_newline(text: &str, from: usize, to: usize) -> bool {
    text.get(from..to).is_some_and(|gap| {
        gap.bytes().all(|byte| byte.is_ascii_whitespace())
            && gap.bytes().filter(|byte| *byte == b'\n').count() == 1
    })
}

/// One documentation attribute, as the walk found it.
#[derive(Clone, Debug)]
struct Doc {
    /// The whole attribute, which for a comment is the comment itself.
    outer: ByteSpan,
    /// Its string literal, where it was written as an attribute.
    literal: Option<ByteSpan>,
}

/// One census candidate.
#[derive(Clone, Debug)]
struct Hit {
    identifier: String,
    span: ByteSpan,
    /// The final segments of the item's own attribute paths.
    attributes: Vec<String>,
}

/// The one walk both duties are fed from.
#[derive(Debug, Default)]
struct Walk {
    docs: Vec<Doc>,
    functions: Vec<Hit>,
    modules: Vec<Hit>,
    declarations: Vec<Declaration>,
}

impl Walk {
    fn function(&mut self, ident: &syn::Ident, attrs: &[syn::Attribute], span: ByteSpan) {
        self.functions.push(Hit {
            identifier: ident.to_string(),
            span,
            attributes: attrs.iter().filter_map(final_segment).collect(),
        });
    }
}

impl<'ast> Visit<'ast> for Walk {
    fn visit_attribute(&mut self, attr: &'ast syn::Attribute) {
        if let syn::Meta::NameValue(pair) = &attr.meta
            && pair.path.is_ident("doc")
        {
            let outer = range(attr.span());
            let literal = match &pair.value {
                syn::Expr::Lit(lit) => Some(range(lit.lit.span())),
                _ => None,
            };
            self.docs.push(Doc { outer, literal });
        }
        syn::visit::visit_attribute(self, attr);
    }

    fn visit_item_fn(&mut self, item: &'ast syn::ItemFn) {
        self.function(&item.sig.ident, &item.attrs, range(item.span()));
        syn::visit::visit_item_fn(self, item);
    }

    fn visit_impl_item_fn(&mut self, item: &'ast syn::ImplItemFn) {
        self.function(&item.sig.ident, &item.attrs, range(item.span()));
        syn::visit::visit_impl_item_fn(self, item);
    }

    fn visit_item_mod(&mut self, item: &'ast syn::ItemMod) {
        if item.attrs.iter().any(is_cfg_test) {
            syn::visit::visit_item_mod(self, item);
            return;
        }
        if item.content.is_some() {
            self.modules.push(Hit {
                identifier: item.ident.to_string(),
                span: range(item.span()),
                attributes: item.attrs.iter().filter_map(final_segment).collect(),
            });
        } else {
            self.declarations.push(Declaration {
                identifier: item.ident.to_string(),
                span: range(item.span()),
            });
        }
        syn::visit::visit_item_mod(self, item);
    }
}

/// The final segment of an attribute's path, which is what the open rule of
/// `[profiles]` reads.
fn final_segment(attr: &syn::Attribute) -> Option<String> {
    attr.path()
        .segments
        .last()
        .map(|segment| segment.ident.to_string())
}

/// Whether an attribute is exactly `#[cfg(test)]`.
///
/// The exclusion reads on the item and not on its shape: a declaration
/// attributed `#[cfg(test)]` names a module the census excludes, so it is not
/// reported for pairing either (´dec:lint:cross-source-pairing´). Either way
/// the attribute is read on the item itself, which is what the inline half
/// has always done.
///
/// Exactly: `[profiles]` excludes "modules attributed `#[cfg(test)]`", and
/// a broader reading would swallow `#[cfg(feature = "test")]`, which names
/// a feature and not the test configuration.
fn is_cfg_test(attr: &syn::Attribute) -> bool {
    let syn::Meta::List(list) = &attr.meta else {
        return false;
    };
    list.path.is_ident("cfg")
        && syn::parse2::<syn::Ident>(list.tokens.clone()).is_ok_and(|one| one == "test")
}

fn range(span: proc_macro2::Span) -> ByteSpan {
    let range = span.byte_range();
    ByteSpan::new(range.start, range.end)
}

/// Whether this frontend computes a census for `profile`, whatever its
/// standing.
///
/// The recognizer is read off the row's shape, so a test can assert that
/// both ruled Rust profiles are recognized without naming either.
#[must_use]
pub fn governs(profile: &Profile) -> bool {
    profile.census.language.as_str() == RUST && recognizer(profile).is_some()
}
