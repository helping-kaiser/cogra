//! ´mod:module:labels´
//!
//! The label calculus's invariants, each as one query over the corpus graph.
//!
//! Every function here discharges one clause of the calculus and returns the
//! diagnostics that clause produces and nothing else (´sig:lint:judgment-api´).
//! The queries are the ones (´tab:lint:judgment-implementation´) fixes against
//! the two weight enums, which is what makes most of them a degree against a
//! constant.
//!
//! # What a judgment cannot fill in
//!
//! A judgment holds the graph and the registries, and the ruled signatures
//! give it neither the source bytes nor — for two of them — the adoption
//! data. It therefore produces a [`Location`] carrying the path and the span
//! and leaving line, column, and [`crate::Enforcement`] to the caller that
//! holds both, exactly as the pre-tokenizer leaves them to the caller that
//! holds the source (´[ARCH-req:linter:diagnostics-not-panics]´). The run
//! entry stamps them; [`crate::judge::stamp`] is the one place that does.
//!
//! # Empty domains
//!
//! Three of these clauses have no subject in this corpus: the anchor harvest
//! designates no index, synthetic citation designates no typed-data class,
//! and inventory has no effective profile. Each is implemented rather than
//! skipped, because a check whose domain is empty passes vacuously and a
//! check that does not exist passes by absence, and the difference shows up
//! on the day a designation is recorded (´tab:lint:judgment-implementation´).

use std::collections::BTreeMap;
use std::path::PathBuf;

use petgraph::Direction;
use petgraph::stable_graph::NodeIndex;
use petgraph::visit::{EdgeRef, IntoEdgeReferences, IntoNodeIdentifiers};

use crate::adopt::{Adoption, Kind, OwnerId, ProfileStatus};
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, Related, RuleId, Severity};
use crate::graph::{
    Corpus, EdgeW, NodeKind, NodeW, Registries, degree_along, edge_view, in_along, nodes_of,
    out_along, owner_of, owner_view,
};
use crate::judge::at;
use crate::scan::{Label, Prefix};

/// A label minted twice in one owner (´[LBL-inv:labels:unique-mint]´).
pub const DUPLICATE_MINT: RuleId = RuleId::new("label-duplicate-mint");

/// A participating citation that resolves to no mint
/// (´[LBL-inv:labels:total-resolution]´).
pub const UNRESOLVED: RuleId = RuleId::new("label-unresolved-citation");

/// A citation resolving to more than one mint, which the invariant's
/// "exactly one" forbids and the harvest cannot produce.
pub const AMBIGUOUS_RESOLUTION: RuleId = RuleId::new("label-ambiguous-resolution");

/// An imported citation whose prefix Σ does not register
/// (´[LBL-inf:labels:imported-citation]´).
pub const UNREGISTERED_PREFIX: RuleId = RuleId::new("label-unregistered-prefix");

/// An import naming the citing owner itself, which is underivable
/// (´[LBL-inf:labels:imported-citation]´).
pub const SELF_QUALIFIED_IMPORT: RuleId = RuleId::new("label-self-qualified-import");

/// A bare occurrence of a reserved kind no effective profile governs: the
/// hard failure with neither warrant available
/// (´[LBL-inv:labels:warrant-totality]´).
pub const KIND_UNGOVERNED: RuleId = RuleId::new("label-kind-ungoverned");

/// An inventory-kind token with no derivation behind it
/// (´[LBL-inv:labels:warrant-totality]´).
pub const WARRANT_MISSING: RuleId = RuleId::new("label-warrant-missing");

/// A derivation behind a token of a kind outside K, where only authorship is
/// admissible (´[LBL-inv:labels:warrant-totality]´).
pub const WARRANT_SPECIES: RuleId = RuleId::new("label-warrant-species");

/// A covered asset carrying no label of its profile's kind
/// (´[LBL-inv:labels:inventory]´).
pub const INVENTORY_UNCARRIED: RuleId = RuleId::new("label-inventory-uncarried");

/// A covered asset carrying more than one label of one profile's kind
/// (´[LBL-inv:labels:inventory]´).
pub const INVENTORY_REPEATED: RuleId = RuleId::new("label-inventory-repeated");

/// Two covered assets of one owner deriving one label: a naming defect of the
/// assets (´[LBL-inv:labels:inventory]´).
pub const INVENTORY_COLLISION: RuleId = RuleId::new("label-inventory-collision");

/// A label of a governed kind with no covered asset behind it: an inventory
/// label outliving what it names (´[LBL-inv:labels:inventory]´).
pub const INVENTORY_ORPHAN: RuleId = RuleId::new("label-inventory-orphan");

/// A generated occurrence that is neither a warranted mint nor a resolving
/// citation (´[LBL-inv:labels:generated-compliance]´).
pub const GENERATED_UNWARRANTED: RuleId = RuleId::new("label-generated-unwarranted");

/// A generated citation that resolves nowhere: a generator defect
/// (´[LBL-inv:labels:generated-compliance]´).
pub const GENERATED_DANGLING: RuleId = RuleId::new("label-generated-dangling");

/// An `Anchors` edge harvested into an owner no designation names
/// (´[LBL-inf:labels:anchor-harvest]´).
pub const ANCHOR_UNDESIGNATED: RuleId = RuleId::new("anchor-undesignated");

/// A designated typed-data class the harvest produced no citation for
/// (´[LBL-inf:labels:synthetic-citation]´).
pub const TYPED_DATA_UNHARVESTED: RuleId = RuleId::new("typed-data-unharvested");

/// An imported citation into an owner outside the citing owner's declared
/// reach (´dec:lint:reach-declared´).
pub const CITATION_OUTSIDE_REACH: RuleId = RuleId::new("label-citation-outside-reach");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 17] = [
    DUPLICATE_MINT,
    UNRESOLVED,
    AMBIGUOUS_RESOLUTION,
    UNREGISTERED_PREFIX,
    SELF_QUALIFIED_IMPORT,
    KIND_UNGOVERNED,
    WARRANT_MISSING,
    WARRANT_SPECIES,
    INVENTORY_UNCARRIED,
    INVENTORY_REPEATED,
    INVENTORY_COLLISION,
    INVENTORY_ORPHAN,
    GENERATED_UNWARRANTED,
    GENERATED_DANGLING,
    ANCHOR_UNDESIGNATED,
    TYPED_DATA_UNHARVESTED,
    CITATION_OUTSIDE_REACH,
];

/// At most one mint per owner and label, with both locations when there are
/// two (´[LBL-inv:labels:unique-mint]´).
///
/// The registry decides which mint is the first, because insertion into
/// [`Registries::mints`] is where the two met and the loser was handed back
/// (´sig:lint:index-maps´); the graph holds every mint, the loser included,
/// because neither is dropped. Reading the pair back out of the two is the
/// same fact the insertion saw and with the same information — unlike the
/// degree check over `Mints` alone, which cannot say which came first.
///
/// ```
/// use cogra_linter::graph::{Corpus, Registries};
/// use cogra_linter::judge::labels::unique_mint;
///
/// let g = Corpus::new();
/// assert!(unique_mint(&g, &Registries::new()).is_empty(), "an empty corpus mints nothing twice");
/// ```
#[must_use]
pub fn unique_mint(g: &Corpus, r: &Registries) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    for label_node in nodes_of(g, NodeKind::Label) {
        let Some(NodeW::Label(weight)) = g.node_weight(label_node) else {
            continue;
        };
        let Some(owner) = owner_of(g, label_node) else {
            continue;
        };
        let mut mints: Vec<NodeIndex> = in_along(g, label_node, EdgeW::Mints).collect();
        if mints.len() < 2 {
            continue;
        }
        mints.sort_unstable();
        let first = r
            .mints
            .get(&(owner, weight.label.clone()))
            .copied()
            .unwrap_or(mints[0]);
        for duplicate in mints.into_iter().filter(|one| *one != first) {
            let (Some(at), Some(earlier)) = (at(g, duplicate), at(g, first)) else {
                continue;
            };
            found.push(Diagnostic {
                rule: DUPLICATE_MINT,
                severity: Severity::Error,
                enforcement: Enforcement::Advisory,
                primary: at,
                related: vec![Related {
                    at: earlier,
                    note: String::from("the label is first minted here"),
                }],
                message: format!(
                    "{} is minted more than once in {}",
                    weight.label,
                    owner_id(g, owner)
                ),
            });
        }
    }
    found
}

/// Every participating citation resolves to exactly one mint, and every
/// import's side conditions hold (´[LBL-inv:labels:total-resolution]´),
/// (´[LBL-inf:labels:imported-citation]´).
///
/// The two clauses are one traversal because they are one degree check each
/// over the same node: the side conditions are structural exactly because
/// `Cites` points at an owner rather than at a label
/// (´sig:lint:edge-weights´) — an unregistered prefix names no owner and
/// leaves out-degree zero, and a self-qualified import is an edge back to
/// the citing owner.
///
/// An unresolved same-owner citation whose label mints elsewhere carries the
/// import form as its suggestion, which is what
/// (´[LBL-gate:labels:implementation]´) asks for by name.
#[must_use]
pub fn total_resolution(g: &Corpus, r: &Registries) -> Vec<Diagnostic> {
    let elsewhere = minting_owners(r);
    let mut found = Vec::new();
    for citation in nodes_of(g, NodeKind::Citation) {
        let Some(NodeW::Citation(weight)) = g.node_weight(citation) else {
            continue;
        };
        let Some(at) = at(g, citation) else { continue };
        let owner = owner_of(g, citation);
        if let Some(prefix) = weight.prefix.as_ref() {
            let cites: Vec<NodeIndex> = out_along(g, citation, EdgeW::Cites).collect();
            match cites.first() {
                None => {
                    found.push(Diagnostic {
                        rule: UNREGISTERED_PREFIX,
                        severity: Severity::Error,
                        enforcement: Enforcement::Advisory,
                        primary: at,
                        related: Vec::new(),
                        message: format!("no owner is registered under the prefix {prefix}"),
                    });
                    continue;
                }
                Some(cited) if Some(*cited) == owner => {
                    found.push(Diagnostic {
                        rule: SELF_QUALIFIED_IMPORT,
                        severity: Severity::Error,
                        enforcement: Enforcement::Advisory,
                        primary: at,
                        related: Vec::new(),
                        message: format!(
                            "{prefix} names the citing owner itself, and a self-qualified import is underivable"
                        ),
                    });
                    continue;
                }
                Some(_) => {}
            }
        }
        match degree_along(g, citation, EdgeW::ResolvesTo, Direction::Outgoing) {
            1 => {}
            0 => found.push(Diagnostic {
                rule: UNRESOLVED,
                severity: Severity::Error,
                enforcement: Enforcement::Advisory,
                primary: at,
                related: Vec::new(),
                message: unresolved_message(
                    g,
                    &weight.label,
                    weight.prefix.as_ref(),
                    owner,
                    &elsewhere,
                ),
            }),
            several => found.push(Diagnostic {
                rule: AMBIGUOUS_RESOLUTION,
                severity: Severity::Error,
                enforcement: Enforcement::Advisory,
                primary: at,
                related: Vec::new(),
                message: format!(
                    "{} resolves to {several} mints where the invariant admits exactly one",
                    weight.label
                ),
            }),
        }
    }
    found
}

/// Every mint stands on exactly one warrant, and its kind admits that
/// species (´[LBL-inv:labels:warrant-totality]´).
///
/// The three failures the invariant names in as many words are three
/// branches here: an inventory-kind token away from any standard place, a
/// reserved-kind token no profile governs, and — the mirror case the
/// invariant's "at most one warrant species" forbids — a derivation behind a
/// token of a kind outside K.
#[must_use]
pub fn warrant_totality(g: &Corpus, _r: &Registries, a: &Adoption) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    for mint in nodes_of(g, NodeKind::Mint) {
        let Some(NodeW::Mint(weight)) = g.node_weight(mint) else {
            continue;
        };
        let Some(at) = at(g, mint) else { continue };
        let kind = Kind::new(weight.label.kind());
        let reserved = a.reserved_kinds.contains(&kind);
        let governed = a.profiles.effective().any(|profile| profile.kind == kind);
        let derived = degree_along(g, mint, EdgeW::Derives, Direction::Incoming) > 0;
        let (rule, message) = match (reserved, governed, derived) {
            (true, false, _) => (
                KIND_UNGOVERNED,
                format!(
                    "the kind {kind} is reserved and no effective profile governs it, so {} stands on no warrant",
                    weight.label
                ),
            ),
            (true, true, false) => (
                WARRANT_MISSING,
                format!(
                    "{} is an inventory label away from its profile's standard place, so no derivation warrants it",
                    weight.label
                ),
            ),
            (false, _, true) => (
                WARRANT_SPECIES,
                format!(
                    "the kind {kind} lies outside K and admits authorship only, yet a derivation stands behind {}",
                    weight.label
                ),
            ),
            _ => continue,
        };
        found.push(Diagnostic {
            rule,
            severity: Severity::Error,
            enforcement: Enforcement::Advisory,
            primary: at,
            related: Vec::new(),
            message,
        });
    }
    found
}

/// Per effective profile and per owner, the census and the carried labels
/// stand in a bijection (´[LBL-inv:labels:inventory]´).
///
/// Effective is read off the `Profile` node's own status, because a staged
/// profile carries no `Covers` edges and no inventory judgment runs over it
/// (´dec:lint:staged-profiles´): a staged profile's assets are outside the
/// domain, and the judgment quantifies over what the profiles in force cover.
///
/// The per-owner scope is `owner_view`, which is the architecture's views-not-
/// wrappers rule taken literally: the orphan scan is a filtered graph handed
/// to an ordinary traversal, never a new type owning a graph.
#[must_use]
pub fn inventory(g: &Corpus, _r: &Registries) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    for profile in nodes_of(g, NodeKind::Profile) {
        let Some(NodeW::Profile(weight)) = g.node_weight(profile) else {
            continue;
        };
        if !matches!(weight.status, ProfileStatus::Effective) {
            continue;
        }
        let mut by_owner: BTreeMap<Option<NodeIndex>, Vec<NodeIndex>> = BTreeMap::new();
        for asset in out_along(g, profile, EdgeW::Covers) {
            by_owner.entry(owner_of(g, asset)).or_default().push(asset);
        }
        for (owner, mut assets) in by_owner {
            assets.sort_unstable();
            found.extend(inventory_of_owner(g, &weight.kind, owner, &assets));
        }
    }
    found
}

/// Every occurrence of a generated region is a warranted mint or a resolving
/// citation (´[LBL-inv:labels:generated-compliance]´).
///
/// What a generated region *presents* never reaches this judgment: the
/// harvest excludes it before any registry sees it, which is the exclusion
/// that keeps (´[LBL-metathm:labels:no-self-support]´) a theorem. The domain
/// is empty in this corpus — no generated carrier file has a frontend — and
/// the query is implemented all the same.
///
/// # Which mints the derivation clause reaches
///
/// Only those of a kind in K. Generation is a fact about the pen and
/// warrants attach to no pen: a kind outside K is authored, and "an
/// authorship a generator transcribes from the record of the authors' choice
/// is that choice still" — so a generated mint of an authored kind stands on
/// its authorship exactly as a hand-written one does, and asking it for a
/// derivation would demand the one warrant its kind does not admit. The
/// kind partition is (´[LBL-inv:labels:warrant-totality]´)'s business and is
/// checked there, over authored and generated text alike.
#[must_use]
pub fn generated_compliance(g: &Corpus, _r: &Registries, a: &Adoption) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    for region in nodes_of(g, NodeKind::Region) {
        let Some(NodeW::Region(weight)) = g.node_weight(region) else {
            continue;
        };
        if !weight.generated {
            continue;
        }
        for held in out_along(g, region, EdgeW::Contains) {
            let Some(at) = at(g, held) else { continue };
            let (rule, message) = match g.node_weight(held) {
                Some(NodeW::Mint(mint))
                    if a.reserved_kinds.contains(&Kind::new(mint.label.kind()))
                        && degree_along(g, held, EdgeW::Derives, Direction::Incoming) == 0 =>
                {
                    (
                        GENERATED_UNWARRANTED,
                        format!(
                            "{} carries the reserved kind {}, which only a derivation warrants, and the generated mint stands on none",
                            mint.label,
                            mint.label.kind()
                        ),
                    )
                }
                Some(NodeW::Citation(citation))
                    if degree_along(g, held, EdgeW::ResolvesTo, Direction::Outgoing) == 0 =>
                {
                    (
                        GENERATED_DANGLING,
                        format!(
                            "the generated citation of {} resolves nowhere, which is a generator defect",
                            citation.label
                        ),
                    )
                }
                _ => continue,
            };
            found.push(Diagnostic {
                rule,
                severity: Severity::Error,
                enforcement: Enforcement::Advisory,
                primary: at,
                related: Vec::new(),
                message,
            });
        }
    }
    found
}

/// Every harvested anchor runs into an owner some designation names
/// (´[LBL-inf:labels:anchor-harvest]´).
///
/// `[citation-indexes]` designates nothing in this corpus, so the harvest
/// produces no `Anchors` edge and the view is empty. The query is the
/// architecture's own — an `EdgeFiltered` view over `Anchors` — and it fires
/// the day an edge appears that no designation authorizes.
#[must_use]
pub fn anchor_harvest(g: &Corpus, a: &Adoption) -> Vec<Diagnostic> {
    if !a.citation_indexes.designations.is_empty() {
        return Vec::new();
    }
    let anchors = edge_view(g, EdgeW::Anchors);
    anchors
        .edge_references()
        .filter_map(|edge| {
            at(g, edge.source())
                .or_else(|| at(g, edge.target()))
                .map(|at| Diagnostic {
                    rule: ANCHOR_UNDESIGNATED,
                    severity: Severity::Error,
                    enforcement: Enforcement::Advisory,
                    primary: at,
                    related: Vec::new(),
                    message: String::from(
                        "an anchor was harvested where no citation index is designated",
                    ),
                })
        })
        .collect()
}

/// Every designated typed-data class is harvested as a citation like any
/// other (´[LBL-inf:labels:synthetic-citation]´).
///
/// `[typed-data]` designates no class in this corpus, so the domain is
/// empty. A designation recorded without a harvest behind it is what this
/// query reports, because the alternative — a designated class silently
/// contributing nothing — is a resolution check that passes by absence.
///
/// The finding carries no path: it is about the adoption data, and
/// [`Adoption`] does not retain the file it was read from
/// (´sig:lint:adoption-api´).
#[must_use]
pub fn synthetic_citation(g: &Corpus, a: &Adoption) -> Vec<Diagnostic> {
    if a.typed_data.classes.is_empty() {
        return Vec::new();
    }
    let harvested = nodes_of(g, NodeKind::Citation).count();
    if harvested > 0 {
        return Vec::new();
    }
    a.typed_data
        .classes
        .iter()
        .map(|class| Diagnostic {
            rule: TYPED_DATA_UNHARVESTED,
            severity: Severity::Error,
            enforcement: Enforcement::Advisory,
            primary: Location::new(PathBuf::new(), ByteSpan::new(0, 0), 0, 0),
            related: Vec::new(),
            message: format!(
                "the typed-data class {class} is designated and no synthetic citation was harvested from it"
            ),
        })
        .collect()
}

/// Every imported citation names an owner the citing owner reaches
/// (´dec:lint:reach-declared´).
///
/// Σ says which prefixes name an owner and Ω says which owner holds a source.
/// Between them a citation either resolves or does not, and neither has an
/// opinion about whether a source of one owner had any business importing
/// from another: a primitive document importing from a web package resolves
/// exactly as cleanly as one importing from the label calculus. This is the
/// clause that has the opinion, and the corpus supplies it as data.
///
/// # Why the domain is the imported citations alone
///
/// A same-owner citation is an owner reaching itself, which no declaration can
/// forbid. An import whose prefix Σ does not register has no `Cites` edge and
/// names no owner to test — [`total_resolution`] reports it as
/// [`UNREGISTERED_PREFIX`], and a second finding on the same occurrence would
/// say nothing further. An import that names the citing owner is
/// [`SELF_QUALIFIED_IMPORT`] there for the same reason. What is left is
/// exactly the edges a reach graph is about, and each is one lookup against
/// one row.
///
/// The query runs over the citations in node order and consults no `HashMap`,
/// so the findings arrive in one order whatever the traversal did
/// (´[ARCH-req:linter:determinism]´).
///
/// # The empty domain
///
/// This corpus declares no `[reach]` section, so the graph is `None` and the
/// clause passes vacuously over every import it holds. That is the same
/// vacuity the anchor harvest and the synthetic citation run under, and it is
/// implemented for the same reason: a check whose domain is empty passes
/// vacuously and a check that does not exist passes by absence
/// (´tab:lint:judgment-implementation´).
#[must_use]
pub fn citation_reach(g: &Corpus, a: &Adoption) -> Vec<Diagnostic> {
    let Some(reach) = a.reach.as_ref() else {
        return Vec::new();
    };
    let mut found = Vec::new();
    for citation in nodes_of(g, NodeKind::Citation) {
        let Some(NodeW::Citation(weight)) = g.node_weight(citation) else {
            continue;
        };
        let Some(prefix) = weight.prefix.as_ref() else {
            continue;
        };
        let (Some(from), Some(into)) = (
            owner_of(g, citation),
            out_along(g, citation, EdgeW::Cites).next(),
        ) else {
            continue;
        };
        let (from, into) = (owner_id(g, from), owner_id(g, into));
        if reach.permits(&from, &into) {
            continue;
        }
        let Some(at) = at(g, citation) else { continue };
        found.push(Diagnostic {
            rule: CITATION_OUTSIDE_REACH,
            severity: Severity::Error,
            enforcement: Enforcement::Advisory,
            primary: at,
            related: Vec::new(),
            message: format!(
                "{from} imports {prefix} of {into}, which its declared reach does not name"
            ),
        });
    }
    found
}

/// One profile's inventory within one owner.
fn inventory_of_owner(
    g: &Corpus,
    kind: &Kind,
    owner: Option<NodeIndex>,
    assets: &[NodeIndex],
) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    let mut carried: BTreeMap<Label, Vec<NodeIndex>> = BTreeMap::new();
    for asset in assets {
        let mints: Vec<NodeIndex> = out_along(g, *asset, EdgeW::Derives).collect();
        let Some(at) = at(g, *asset) else { continue };
        match mints.len() {
            0 => found.push(Diagnostic {
                rule: INVENTORY_UNCARRIED,
                severity: Severity::Error,
                enforcement: Enforcement::Advisory,
                primary: at,
                related: Vec::new(),
                message: format!(
                    "{} carries no label of kind {kind} at its profile's standard place",
                    identifier(g, *asset)
                ),
            }),
            1 => {}
            several => found.push(Diagnostic {
                rule: INVENTORY_REPEATED,
                severity: Severity::Error,
                enforcement: Enforcement::Advisory,
                primary: at,
                related: Vec::new(),
                message: format!(
                    "{} carries {several} labels of kind {kind} where the inventory admits exactly one",
                    identifier(g, *asset)
                ),
            }),
        }
        for mint in mints {
            if let Some(NodeW::Mint(weight)) = g.node_weight(mint) {
                carried
                    .entry(weight.label.clone())
                    .or_default()
                    .push(*asset);
            }
        }
    }
    for (label, sharing) in &carried {
        if sharing.len() < 2 {
            continue;
        }
        let Some(primary) = at(g, sharing[0]) else {
            continue;
        };
        found.push(Diagnostic {
            rule: INVENTORY_COLLISION,
            severity: Severity::Error,
            enforcement: Enforcement::Advisory,
            primary,
            related: sharing[1..]
                .iter()
                .filter_map(|other| {
                    at(g, *other).map(|at| Related {
                        at,
                        note: format!("{} derives the same label", identifier(g, *other)),
                    })
                })
                .collect(),
            message: format!("two covered assets of one owner derive {label}"),
        });
    }
    found.extend(orphans(g, kind, owner, &carried));
    found
}

/// Labels of a governed kind that no covered asset derives.
fn orphans(
    g: &Corpus,
    kind: &Kind,
    owner: Option<NodeIndex>,
    carried: &BTreeMap<Label, Vec<NodeIndex>>,
) -> Vec<Diagnostic> {
    let Some(owner) = owner else {
        return Vec::new();
    };
    let held = owner_view(g, owner);
    let mut found = Vec::new();
    for node in held.node_identifiers() {
        let Some(NodeW::Mint(weight)) = g.node_weight(node) else {
            continue;
        };
        if weight.label.kind() != kind.as_str() || carried.contains_key(&weight.label) {
            continue;
        }
        let Some(at) = at(g, node) else { continue };
        found.push(Diagnostic {
            rule: INVENTORY_ORPHAN,
            severity: Severity::Error,
            enforcement: Enforcement::Advisory,
            primary: at,
            related: Vec::new(),
            message: format!(
                "{} is a label of the governed kind {kind} with no covered asset behind it",
                weight.label
            ),
        });
    }
    found
}

/// What an unresolved citation says, with the import form where one applies.
fn unresolved_message(
    g: &Corpus,
    label: &Label,
    prefix: Option<&Prefix>,
    owner: Option<NodeIndex>,
    elsewhere: &BTreeMap<Label, Vec<NodeIndex>>,
) -> String {
    if let Some(prefix) = prefix {
        return format!("{label} is not minted in the owner {prefix} names");
    }
    let others: Vec<NodeIndex> = elsewhere
        .get(label)
        .map(|owners| {
            owners
                .iter()
                .copied()
                .filter(|one| Some(*one) != owner)
                .collect()
        })
        .unwrap_or_default();
    let mut forms: Vec<String> = others
        .iter()
        .filter_map(|other| import_form(g, *other, label))
        .collect();
    forms.sort();
    forms.dedup();
    match forms.first() {
        Some(form) => format!("{label} is not minted in this owner; it mints in {form}"),
        None => format!("{label} is minted nowhere in the corpus"),
    }
}

/// The import form that would reach a label in another owner.
fn import_form(g: &Corpus, owner: NodeIndex, label: &Label) -> Option<String> {
    let Some(NodeW::Owner(weight)) = g.node_weight(owner) else {
        return None;
    };
    let mut prefixes: Vec<&Prefix> = weight.prefixes.iter().collect();
    prefixes.sort();
    match prefixes.first() {
        Some(prefix) => Some(format!(
            "{}, which the form {prefix}-{label} reaches",
            weight.id
        )),
        None => Some(format!("{}, which registers no prefix", weight.id)),
    }
}

/// Which owners mint each label, in a deterministic order.
///
/// Built once per run of the resolution judgment, because the alternative is
/// a scan of the whole minting registry per unresolved citation and because
/// a `HashMap`'s own iteration order must never reach a message
/// (´[ARCH-req:linter:determinism]´).
fn minting_owners(r: &Registries) -> BTreeMap<Label, Vec<NodeIndex>> {
    let mut out: BTreeMap<Label, Vec<NodeIndex>> = BTreeMap::new();
    for (owner, label) in r.mints.keys() {
        out.entry(label.clone()).or_default().push(*owner);
    }
    for owners in out.values_mut() {
        owners.sort_unstable();
        owners.dedup();
    }
    out
}

/// An asset's bare identifier, for a message that names it.
fn identifier(g: &Corpus, asset: NodeIndex) -> String {
    match g.node_weight(asset) {
        Some(NodeW::Asset(weight)) => weight.identifier.to_string(),
        _ => String::from("the asset"),
    }
}

/// An owner's identifier, for a message that names it.
fn owner_id(g: &Corpus, owner: NodeIndex) -> OwnerId {
    match g.node_weight(owner) {
        Some(NodeW::Owner(weight)) => weight.id.clone(),
        _ => OwnerId::new("an unnamed owner"),
    }
}
