//! ´mod:module:judge´
//!
//! The judgment surface: every invariant as one free function over the
//! graph.
//!
//! A judgment never mutates the graph and never consults a later stage's
//! output (´sig:lint:judgment-api´); its answer is a list of diagnostics and
//! an empty list is the positive answer (´conv:lint:finding-or-error´).
//!
//! [`judge_all`] runs them in a fixed order, which affects nothing but the
//! collection sequence: [`crate::diag`] re-sorts the whole list before it is
//! rendered (´conv:lint:diagnostic-order´).
//!
//! # What a judgment leaves for its caller
//!
//! The ruled signatures hand a judgment the graph, the registries, and — for
//! some of them — the adoption data. None of them holds the source bytes,
//! and two of them hold no adoption data, so a judgment's [`Diagnostic`]
//! carries its path and its span and leaves line, column, and
//! [`Enforcement`] unset. [`stamp`] fills all three, in one place, from the
//! sources the run entry is holding anyway — the same division the
//! pre-tokenizer already makes for the same reason
//! (´[ARCH-req:linter:diagnostics-not-panics]´).

pub mod claims;
pub mod freshness;
pub mod kinds;
pub mod labels;

use std::collections::BTreeMap;
use std::path::PathBuf;

use petgraph::stable_graph::NodeIndex;

use crate::adopt::Adoption;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::graph::{Corpus, EdgeW, NodeKind, NodeW, Registries, nodes_of, out_along, source_of};
use crate::judge::kinds::KindRegistry;

/// Kind validation was suppressed by a defect in the registry document
/// (´dec:lint:registry-bootstrap´).
pub const VALIDATION_SUPPRESSED: RuleId = RuleId::new("kind-validation-suppressed");

/// Every rule this module itself can report.
pub const RULES: [RuleId; 1] = [VALIDATION_SUPPRESSED];

/// Run every judgment the adoption data puts in force, in a fixed order.
///
/// Every judgment but one: register freshness needs the committed bytes and
/// the one generator's own inputs, which this ruled signature does not
/// carry, so [`freshness::registers`] is called from the run beside this
/// function and its module says why.
///
/// `kinds` is `None` when the registry document would not parse, and equally
/// when the carrier does not hold it — a fixture corpus of two files, say.
/// The label judgments then run normally — the registry document is linted
/// first by the rules that need no kinds, which is the architecture's own
/// mitigation — and one further diagnostic names kind validation as
/// suppressed and counts the heads it did not validate. Treating an
/// unvalidatable head as valid would make a broken registry look like a
/// clean corpus, which is the failure mode the bootstrap must not have
/// (´dec:lint:registry-bootstrap´). The finding sits on the registry
/// document either way, because that is the file whose absence or defect the
/// reader has to act on.
///
/// ```
/// use cogra_linter::graph::{Corpus, Registries};
/// use cogra_linter::judge::judge_all;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
///
/// let found = judge_all(&Corpus::new(), &Registries::new(), &adoption, None);
/// assert_eq!(found.len(), 1, "an empty corpus still reports the suppression");
/// assert_eq!(found[0].rule.as_str(), "kind-validation-suppressed");
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn judge_all(
    g: &Corpus,
    r: &Registries,
    a: &Adoption,
    kinds: Option<&KindRegistry>,
) -> Vec<Diagnostic> {
    let mut found = labels::unique_mint(g, r);
    found.extend(labels::total_resolution(g, r));
    found.extend(labels::warrant_totality(g, r, a));
    found.extend(labels::inventory(g, r));
    found.extend(labels::generated_compliance(g, r, a));
    found.extend(labels::anchor_harvest(g, a));
    found.extend(labels::synthetic_citation(g, a));
    found.extend(labels::citation_reach(g, a));
    found.extend(claims::claims(g, a));
    match kinds {
        Some(registry) => found.extend(kinds::head_validation(g, registry)),
        None => found.push(suppressed(g, a)),
    }
    found
}

/// Fill in what a judgment cannot know: enforcement, line, and column.
///
/// `sources` maps each carrier path to its bytes. A finding whose path is
/// absent from it keeps its zeros, which is what a finding about the
/// adoption data rather than about a source looks like.
pub fn stamp(findings: &mut [Diagnostic], sources: &BTreeMap<PathBuf, Vec<u8>>, a: &Adoption) {
    for finding in findings {
        finding.enforcement = a.enforcement.enforcement_for(&finding.primary.path);
        stamp_location(&mut finding.primary, sources);
        for related in &mut finding.related {
            stamp_location(&mut related.at, sources);
        }
    }
}

/// One location, given the bytes of the file it points into.
fn stamp_location(at: &mut Location, sources: &BTreeMap<PathBuf, Vec<u8>>) {
    let Some(bytes) = sources.get(&at.path) else {
        return;
    };
    let Ok(text) = std::str::from_utf8(bytes) else {
        return;
    };
    *at = Location::in_source(at.path.clone(), at.span, text);
}

/// The one diagnostic a suppressed kind validation leaves behind.
fn suppressed(g: &Corpus, a: &Adoption) -> Diagnostic {
    let unvalidated = nodes_of(g, NodeKind::Head).count();
    Diagnostic {
        rule: VALIDATION_SUPPRESSED,
        severity: Severity::Error,
        enforcement: Enforcement::Advisory,
        primary: Location::new(a.registry_document(), ByteSpan::new(0, 0), 0, 0),
        related: Vec::new(),
        message: format!(
            "the kind registry is unavailable, so {unvalidated} heads went unvalidated"
        ),
    }
}

/// Where a node sits, as far as the graph can say.
///
/// Line and column stay zero and the enforcement stays the adoption's own
/// default; [`stamp`] fills both in one place.
///
/// An `Asset` is located through the mint it derives, because it has no
/// other route into a file: (´sig:lint:node-weights´) gives `AssetNode` an
/// identifier, an area, and a place and no span, and (´sig:lint:edge-weights´)
/// runs `Owns` from the owner to the asset and no `Contains` from its
/// source. An asset carrying no label therefore has nothing to point at, and
/// is reported unlocated rather than not reported — a silently dropped
/// finding would be worse than an unlocated one, and the inventory clause's
/// most important case is exactly the asset with no mint. The gap is in the
/// ruled weights and not a choice of this module.
pub(crate) fn at(g: &Corpus, n: NodeIndex) -> Option<Location> {
    let anchor = match g.node_weight(n) {
        Some(NodeW::Asset(_)) => match out_along(g, n, EdgeW::Derives).next() {
            Some(mint) => mint,
            None => return Some(Location::new(PathBuf::new(), ByteSpan::new(0, 0), 0, 0)),
        },
        _ => n,
    };
    let span = span_of(g, anchor)?;
    let source = source_of(g, anchor)?;
    let Some(NodeW::Source(weight)) = g.node_weight(source) else {
        return None;
    };
    Some(Location::new(weight.path.clone(), span, 0, 0))
}

/// The span a node weight carries, where it carries one.
fn span_of(g: &Corpus, n: NodeIndex) -> Option<ByteSpan> {
    match g.node_weight(n)? {
        NodeW::Region(weight) => Some(weight.span),
        NodeW::Mint(weight) => Some(weight.span),
        NodeW::Citation(weight) => Some(weight.span),
        NodeW::Head(weight) => Some(weight.span),
        NodeW::Source(_) => Some(ByteSpan::new(0, 0)),
        _ => None,
    }
}
