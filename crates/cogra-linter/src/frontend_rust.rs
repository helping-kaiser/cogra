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
//! # Heads
//!
//! None. A code comment is a scanned region that carries occurrences and
//! heads nothing, which is why this frontend produces no [`Head`] values
//! (´dec:lint:head-recognition´).

use syn::spanned::Spanned;
use syn::visit::Visit;

use crate::adopt::{Adoption, Area, Profile};
use crate::carrier::SourceFile;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::frontend::{Asset, Parsed, Region, RegionKind};
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

/// A census that needs the Cargo target and was not given one.
///
/// Unreachable while every Rust profile is staged, and deliberately kept:
/// a check that does not exist passes by absence, and the day a profile
/// enters Π is the day this must be loud rather than a guessed area.
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
    /// The `[profiles]` case name this target selects an area by.
    #[must_use]
    pub const fn case(&self) -> &'static str {
        match self {
            CargoTarget::LibOrBin => LIB_OR_BIN,
            CargoTarget::IntegrationTest => INTEGRATION,
        }
    }
}

/// A `mod name;` declaration, which is not a definition and not an asset.
///
/// The module census counts definitions once, never declarations, and the
/// definition backing a declaration is another file — a pairing no
/// frontend can make, since it is handed one source. The declarations are
/// reported so the cross-source step that will pair them has its input.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Declaration {
    /// The declared module's bare identifier.
    pub identifier: String,
    /// Where the declaration sits, in whole-file coordinates.
    pub span: ByteSpan,
}

/// The censuses of one source, computed whether or not their profiles are
/// in force.
///
/// Computing them is not judging them: a staged profile carries no `Covers`
/// edges and no inventory judgment runs over it (´dec:lint:staged-profiles´),
/// which is why [`parse`] puts none of this in [`Parsed::assets`] today.
/// The functions exist and are tested so that entering Π flips fields
/// rather than writing code.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Censuses {
    /// The covered assets of every attribute-recognized profile.
    pub tests: Vec<Asset>,
    /// The covered assets of every definition-recognized profile: inline
    /// module definitions, `#[cfg(test)]` excluded.
    pub modules: Vec<Asset>,
    /// The `mod name;` declarations, which are neither.
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
        ..Parsed::default()
    };
    out.diagnostics = effective_assets(src, a, &walk, enforcement, &mut out.assets);
    let mut lexical = pre.clone();
    lexical.stamp(&src.path, &src.bytes, enforcement);
    out.diagnostics.extend(lexical.unclassified);
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
                let covered = attributed(walk, profile, &harness, None);
                if covered.is_empty() && !walk.functions.is_empty() {
                    findings.push(Diagnostic {
                        rule: TARGET_UNKNOWN,
                        severity: Severity::Error,
                        enforcement,
                        primary: Location::new(src.path.clone(), ByteSpan::new(0, 0), 1, 1),
                        related: Vec::new(),
                        message: format!(
                            "profile {} classifies by Cargo target, which the walk did not supply",
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
/// The declarations travel in [`Censuses::declarations`] for the pass that
/// will do the pairing.
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

/// The scanned regions: the documentation comments, runs assembled.
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
    out
}

/// Copy one file range onto a region's logical text.
fn extend(region: &mut Region, text: &str, piece: ByteSpan) {
    let Some(slice) = text.get(piece.start..piece.end) else {
        return;
    };
    region.text.push_str(slice);
    match region.pieces.last_mut() {
        Some(last) if last.end == piece.start => last.end = piece.end,
        _ => region.pieces.push(piece),
    }
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
        if item.content.is_some() {
            if !item.attrs.iter().any(is_cfg_test) {
                self.modules.push(Hit {
                    identifier: item.ident.to_string(),
                    span: range(item.span()),
                    attributes: item.attrs.iter().filter_map(final_segment).collect(),
                });
            }
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
