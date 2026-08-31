//! ´mod:module:report´
//!
//! The reference report: what the corpus graph looks like, read off a
//! completed run.
//!
//! Every number here is already in the graph when the check finishes. Nothing
//! in this module walks the corpus, parses a source, or adds an edge — it
//! selects, counts and orders what pass 2 left behind, which is why it can
//! exist at all without a third pass over the tree (´dec:lint:report-subcommand´).
//!
//! # It judges nothing
//!
//! A mint nobody cites is ordinary. A label a hundred sources cite is
//! ordinary. Neither is a finding, neither has a rule, and the mode that
//! reports them exits `0` however long the listing runs
//! (´dec:lint:report-subcommand´). The judgments that *do* read this same
//! structure — unresolved citation, uncarried inventory, the warrant arms —
//! are [`crate::judge`]'s, run by the check, and this module reports none of
//! them a second time.
//!
//! # Order is the whole contract
//!
//! The registries are `HashMap`s, so no listing here may be produced by
//! iterating one: every list is sorted by keys that are total over the corpus
//! — the label, then the owner — before it is returned, and the counts that
//! rank the hubs are broken by that same order
//! (´[ARCH-req:linter:determinism]´).

use std::collections::BTreeMap;
use std::path::PathBuf;

use petgraph::stable_graph::NodeIndex;

use crate::Run;
use crate::adopt::OwnerId;
use crate::diag::Location;
use crate::graph::{
    Corpus, EdgeW, NodeKind, NodeW, in_along, nodes_of, out_along, owner_of, source_of,
};
use crate::scan::Label;

/// One label of one owner, located at its mint and counted by its citations.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cited {
    /// The label.
    pub label: Label,
    /// The owner that carries it.
    pub owner: OwnerId,
    /// Where it is minted.
    pub at: Location,
    /// How many citations resolve to it.
    pub citations: usize,
}

/// What one owner contributes to the reference graph.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tally {
    /// The owner.
    pub owner: OwnerId,
    /// The labels it mints.
    pub mints: usize,
    /// The citations its own sources write, wherever they reach.
    pub writes: usize,
    /// The citations that resolve into it, from anywhere.
    pub cited: usize,
}

/// The reference graph, as one completed run holds it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Survey {
    /// The carrier sources the run read.
    pub sources: usize,
    /// The owners of the partition.
    pub owners: usize,
    /// Every minting occurrence.
    pub mints: usize,
    /// Every citation occurrence.
    pub citations: usize,
    /// How many of them resolve to a label their owner mints.
    pub resolved: usize,
    /// The labels minted and cited by nothing, by label and then owner, cut
    /// to the length asked for.
    pub orphans: Vec<Cited>,
    /// How many there are, which is what [`Survey::orphans`] is the head of.
    pub orphaned: usize,
    /// The most-cited labels, by citations descending and then by the same
    /// order, cut to the length asked for.
    pub hubs: Vec<Cited>,
    /// How many labels are cited at all, which is what [`Survey::hubs`] is
    /// the head of.
    pub cited: usize,
    /// One row per owner, in owner order.
    pub tally: Vec<Tally>,
}

/// Where one label of one owner is minted, and every citation that reaches it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reverse {
    /// The owner that carries the label.
    pub owner: OwnerId,
    /// Every mint of it in that owner's sources, in the diagnostic order.
    pub minted: Vec<Location>,
    /// Every citation that resolves to it, in the same order.
    pub cited: Vec<Location>,
}

/// Survey one completed run.
///
/// `top` bounds *each* listing — the orphans as well as the hubs — and zero
/// names none of either, which is a shorter report and not a different one.
/// Both counts are carried whole beside the lists they head, so a cut listing
/// never understates what the corpus holds.
///
/// The hubs are ranked by a *stable* sort over a list already in label order,
/// so two labels with one count come out in that order and the cut falls in
/// the same place on every run (´[ARCH-req:linter:determinism]´).
///
/// ```no_run
/// use cogra_linter::report::survey;
/// use std::path::Path;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let root = Path::new(".");
/// let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
/// let checked = cogra_linter::check(&adoption, root)?;
///
/// let found = survey(&checked, 20);
/// println!("{} mints, {} of them cited by nothing", found.mints, found.orphans.len());
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn survey(run: &Run, top: usize) -> Survey {
    let g = &run.graph;
    let citations: Vec<NodeIndex> = nodes_of(g, NodeKind::Citation).collect();
    let resolved = citations
        .iter()
        .filter(|one| out_along(g, **one, EdgeW::ResolvesTo).next().is_some())
        .count();

    let mut carried: Vec<Cited> = Vec::new();
    for ((owner, label), mint) in &run.registries.mints {
        let Some(id) = owner_id(g, *owner) else {
            continue;
        };
        let reached = run
            .registries
            .labels
            .get(&(*owner, label.clone()))
            .map_or(0, |node| in_along(g, *node, EdgeW::ResolvesTo).count());
        let Some(at) = located(run, *mint) else {
            continue;
        };
        carried.push(Cited {
            label: label.clone(),
            owner: id,
            at,
            citations: reached,
        });
    }
    carried.sort_by(|one, other| {
        one.label
            .as_str()
            .cmp(other.label.as_str())
            .then_with(|| one.owner.as_str().cmp(other.owner.as_str()))
    });

    let mut orphans: Vec<Cited> = carried
        .iter()
        .filter(|one| one.citations == 0)
        .cloned()
        .collect();
    let orphaned = orphans.len();
    orphans.truncate(top);
    let mut hubs: Vec<Cited> = carried
        .iter()
        .filter(|one| one.citations > 0)
        .cloned()
        .collect();
    let cited = hubs.len();
    hubs.sort_by_key(|one| std::cmp::Reverse(one.citations));
    hubs.truncate(top);

    Survey {
        sources: run.sources.len(),
        owners: run.registries.owners.len(),
        mints: nodes_of(g, NodeKind::Mint).count(),
        citations: citations.len(),
        resolved,
        orphans,
        orphaned,
        hubs,
        cited,
        tally: tally(run, &citations),
    }
}

/// Every mint of one label and every citation that reaches it, by owner.
///
/// One label may be carried by several owners — the calculus scopes a label to
/// its owner and nothing forbids two of them minting the same one — so the
/// answer is a row per owner rather than one list, which is what keeps a
/// reader from reading two owners' citations as one label's.
///
/// Empty where no owner carries the label at all. A well-formed label nobody
/// wrote is a fact about the corpus and not a mistake in the question, which
/// is what separates it from a label that is not well-formed: the caller
/// refuses that one before asking (´dec:lint:report-subcommand´).
#[must_use]
pub fn reverse(run: &Run, label: &Label) -> Vec<Reverse> {
    let g = &run.graph;
    let mut out: Vec<Reverse> = Vec::new();
    for (id, owner) in ordered(&run.registries.owners) {
        let Some(node) = run.registries.labels.get(&(owner, label.clone())) else {
            continue;
        };
        let mut minted: Vec<Location> = in_along(g, *node, EdgeW::Mints)
            .filter_map(|mint| located(run, mint))
            .collect();
        let mut cited: Vec<Location> = in_along(g, *node, EdgeW::ResolvesTo)
            .filter_map(|citation| located(run, citation))
            .collect();
        minted.sort();
        cited.sort();
        out.push(Reverse {
            owner: id,
            minted,
            cited,
        });
    }
    out
}

/// One row per owner: what it mints, what it writes, and what reaches it.
fn tally(run: &Run, citations: &[NodeIndex]) -> Vec<Tally> {
    let g = &run.graph;
    let mut mints: BTreeMap<OwnerId, usize> = BTreeMap::new();
    let mut cited: BTreeMap<OwnerId, usize> = BTreeMap::new();
    let mut writes: BTreeMap<OwnerId, usize> = BTreeMap::new();
    for (id, _) in ordered(&run.registries.owners) {
        mints.insert(id.clone(), 0);
        cited.insert(id.clone(), 0);
        writes.insert(id, 0);
    }
    for (owner, _) in run.registries.mints.keys() {
        if let Some(id) = owner_id(g, *owner) {
            *mints.entry(id).or_default() += 1;
        }
    }
    for citation in citations {
        if let Some(id) = owner_of(g, *citation).and_then(|owner| owner_id(g, owner)) {
            *writes.entry(id).or_default() += 1;
        }
        if let Some(id) = out_along(g, *citation, EdgeW::ResolvesTo)
            .next()
            .and_then(|label| owner_of(g, label))
            .and_then(|owner| owner_id(g, owner))
        {
            *cited.entry(id).or_default() += 1;
        }
    }
    mints
        .into_iter()
        .map(|(owner, held)| Tally {
            mints: held,
            writes: writes.get(&owner).copied().unwrap_or_default(),
            cited: cited.get(&owner).copied().unwrap_or_default(),
            owner,
        })
        .collect()
}

/// The owner index map in owner order, never in the map's own.
fn ordered(owners: &std::collections::HashMap<OwnerId, NodeIndex>) -> Vec<(OwnerId, NodeIndex)> {
    let held: BTreeMap<&OwnerId, NodeIndex> = owners.iter().map(|(id, at)| (id, *at)).collect();
    held.into_iter().map(|(id, at)| (id.clone(), at)).collect()
}

/// The owner one owner node names.
fn owner_id(g: &Corpus, owner: NodeIndex) -> Option<OwnerId> {
    match g.node_weight(owner) {
        Some(NodeW::Owner(weight)) => Some(weight.id.clone()),
        _ => None,
    }
}

/// Where one occurrence sits, in the located form every other output uses.
///
/// The bytes are the run's own read of the source, so a location this report
/// prints and a location a diagnostic prints are computed from one string.
fn located(run: &Run, occurrence: NodeIndex) -> Option<Location> {
    let g = &run.graph;
    let span = match g.node_weight(occurrence) {
        Some(NodeW::Mint(weight)) => weight.span,
        Some(NodeW::Citation(weight)) => weight.span,
        _ => return None,
    };
    let path: PathBuf = match source_of(g, occurrence).and_then(|src| g.node_weight(src)) {
        Some(NodeW::Source(weight)) => weight.path.clone(),
        _ => return None,
    };
    let bytes = run.sources.get(&path)?;
    let text = std::str::from_utf8(bytes).ok()?;
    Some(Location::in_source(path, span, text))
}

/// Every rule this module can report.
///
/// None: it describes and decides nothing (´conv:lint:finding-or-error´).
pub const RULES: [crate::diag::RuleId; 0] = [];
