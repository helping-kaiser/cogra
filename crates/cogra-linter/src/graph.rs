//! ´mod:module:graph´
//!
//! The corpus graph: one `StableDiGraph` holding the entire analysis.
//!
//! This module exports the two weight enums, the index maps, and free
//! functions over `&`[`Corpus`]. It exports no struct that owns a graph
//! and no trait implemented for one (´dec:lint:graph-free-functions´): a
//! restricted graph is a view handed to a generic algorithm, never a new
//! type, and a module that exports no type owning a graph cannot accrete
//! methods on one.
//!
//! Ownership is the `Owns` edge and nothing else (´dec:lint:ownership-by-edge´).
//! No node weight carries the owner it belongs to, because a graph that
//! carries the partition twice can disagree with itself after any mutation
//! with nothing in the type system to say which copy is right.

use std::collections::HashMap;

use petgraph::Direction;
use petgraph::stable_graph::{EdgeReference, NodeIndex, StableDiGraph};
use petgraph::visit::{EdgeFiltered, EdgeRef, NodeFiltered};

use crate::adopt::{Area, Kind, Language, OwnerId, Place, ProfileId, ProfileStatus};
use crate::diag::ByteSpan;
use crate::frontend::RegionKind;
use crate::scan::{Label, Prefix, Syntax};

/// One entity of the disciplines, held as a node weight of the corpus
/// graph (´sig:lint:node-weights´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NodeW {
    /// An owner of the partition Ω.
    Owner(OwnerNode),
    /// One carrier source: a file, its language, its generated status.
    Source(SourceNode),
    /// One logical region of a source.
    Region(RegionNode),
    /// A bare participating occurrence.
    Mint(MintNode),
    /// A participating citation occurrence, same-owner or imported.
    Citation(CitationNode),
    /// A label value, one node per owner that carries it.
    Label(LabelNode),
    /// A covered asset of some profile's census.
    Asset(AssetNode),
    /// A registered inventory profile, effective or staged.
    Profile(ProfileNode),
    /// A participating authored environment head.
    Head(HeadNode),
    /// A pair of the effective classification relation C_A.
    Pair(PairNode),
}

impl NodeW {
    /// Which variant this is, without cloning the weight.
    #[must_use]
    pub fn kind(&self) -> NodeKind {
        match self {
            NodeW::Owner(_) => NodeKind::Owner,
            NodeW::Source(_) => NodeKind::Source,
            NodeW::Region(_) => NodeKind::Region,
            NodeW::Mint(_) => NodeKind::Mint,
            NodeW::Citation(_) => NodeKind::Citation,
            NodeW::Label(_) => NodeKind::Label,
            NodeW::Asset(_) => NodeKind::Asset,
            NodeW::Profile(_) => NodeKind::Profile,
            NodeW::Head(_) => NodeKind::Head,
            NodeW::Pair(_) => NodeKind::Pair,
        }
    }
}

/// A discriminant enum with one variant per [`NodeW`] variant, so that a
/// filter can name a variant without cloning a weight.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum NodeKind {
    /// [`NodeW::Owner`]
    Owner,
    /// [`NodeW::Source`]
    Source,
    /// [`NodeW::Region`]
    Region,
    /// [`NodeW::Mint`]
    Mint,
    /// [`NodeW::Citation`]
    Citation,
    /// [`NodeW::Label`]
    Label,
    /// [`NodeW::Asset`]
    Asset,
    /// [`NodeW::Profile`]
    Profile,
    /// [`NodeW::Head`]
    Head,
    /// [`NodeW::Pair`]
    Pair,
}

/// An owner and the prefixes that name it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnerNode {
    /// The owner.
    pub id: OwnerId,
    /// Every prefix Σ registers for it, hand-registered or derived.
    pub prefixes: Vec<Prefix>,
}

/// One carrier source.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceNode {
    /// The path, relative to the corpus root.
    pub path: std::path::PathBuf,
    /// The language a frontend reads it as, where one does.
    pub language: Option<Language>,
    /// Whether it is a committed generated file.
    pub generated: bool,
}

/// One logical region of a source.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegionNode {
    /// Which kind of region it is.
    pub kind: RegionKind,
    /// Where it sits, in whole-file coordinates.
    pub span: ByteSpan,
    /// Whether its occurrences participate.
    pub participates: bool,
    /// Whether it is generated.
    pub generated: bool,
    /// For a generated region, the set it presents. A region participates
    /// in nothing it presents. Empty domain in version 1: no citation index
    /// is designated.
    pub presents: Option<PresentedSet>,
}

/// What a generated region displays, and therefore what it may not feed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PresentedSet {
    /// A committed index of citations into a designated upstream owner.
    CitationIndex {
        /// The owner whose labels the index presents.
        upstream: OwnerId,
    },
    /// A per-owner label register of one inventory profile.
    LabelRegister {
        /// The profile whose census the register presents.
        profile: ProfileId,
    },
}

/// A bare participating occurrence.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MintNode {
    /// The label it mints.
    pub label: Label,
    /// The whole occurrence, delimiters included.
    pub span: ByteSpan,
    /// Which syntax it was written in.
    pub syntax: Syntax,
}

/// A participating citation occurrence, same-owner or imported.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CitationNode {
    /// The label it cites.
    pub label: Label,
    /// The prefix it names, for an imported citation.
    pub prefix: Option<Prefix>,
    /// The whole occurrence, brackets and parentheses included.
    pub span: ByteSpan,
    /// Which syntax it was written in.
    pub syntax: Syntax,
}

/// A label value, one node per owner that carries it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LabelNode {
    /// The label.
    pub label: Label,
}

/// A covered asset of some profile's census.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AssetNode {
    /// The asset's bare identifier, as the language exposes it.
    pub identifier: Box<str>,
    /// The classification the profile's rule read off the asset.
    pub area: Area,
    /// Where the profile's standard place puts the label for this asset.
    pub place: Place,
    /// Where the asset sits, in whole-file coordinates.
    ///
    /// No derivation reads it, and (´[LBL-judg:labels:derivation]´) is why:
    /// position never enters a derived label. It is here so that a finding
    /// *about* an asset can point at it, which is a diagnostic's affair and
    /// not a warrant's.
    pub span: ByteSpan,
    /// The asset's own documentation, as logical lines.
    ///
    /// The claim discipline's whole subject (´dec:lint:claim-standing´). It
    /// travels on the node because the frontend resolved it and no later
    /// stage should re-read bytes to recover what a parser already settled.
    pub documentation: Vec<Box<str>>,
}

/// A registered inventory profile, effective or staged.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProfileNode {
    /// The profile.
    pub id: ProfileId,
    /// The kind it governs.
    pub kind: Kind,
    /// Whether it is in Π, or registered and waiting.
    pub status: ProfileStatus,
}

/// A participating authored environment head.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HeadNode {
    /// The head text, as the format supplies it.
    pub text: Box<str>,
    /// The kind its label declares.
    pub declared: Kind,
    /// Where it sits.
    pub span: ByteSpan,
}

/// A pair of the effective classification relation C_A.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PairNode {
    /// The catalogue name.
    pub name: Box<str>,
    /// The kind it carries.
    pub kind: Kind,
    /// Where the pair comes from.
    pub origin: PairOrigin,
}

/// Whether a classification pair comes from the registry document or from
/// the acceptee's recorded extensions.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum PairOrigin {
    /// A row of the registry document itself.
    Base,
    /// A row of the acceptee's recorded extensions.
    Extension,
}

/// One judgment-relevant relation, held as an edge weight
/// (´sig:lint:edge-weights´).
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum EdgeW {
    /// Ω: Owner → Source, Owner → Asset, Owner → Label.
    Owns,
    /// Structure: Source → Region | Asset, Region → Mint | Citation | Head.
    Contains,
    /// The minting judgment: Mint → Label.
    Mints,
    /// The owner a citation names — its own, or Σ(P): Citation → Owner.
    Cites,
    /// The resolution judgment: Citation → Label.
    ResolvesTo,
    /// The derivation warrant: Asset → Mint.
    Derives,
    /// Census membership: Profile → Asset.
    Covers,
    /// Head validation: Head → Pair.
    ValidatesAs,
    /// A harvested body citation into a designated upstream owner:
    /// Source → Label. Empty domain in version 1.
    Anchors,
}

/// The whole analysis, in one graph whose indices survive mutation.
pub type Corpus = StableDiGraph<NodeW, EdgeW>;

/// The owner of any node that has one, by its `Owns` and `Contains` edges.
///
/// Two `edges_directed` calls of degree one at each step up the structure,
/// which is the cost of holding the partition exactly once.
///
/// ```
/// use cogra_linter::graph::{Corpus, EdgeW, NodeW, OwnerNode, SourceNode, owner_of};
/// use cogra_linter::OwnerId;
/// use std::path::PathBuf;
///
/// let mut g = Corpus::new();
/// let owner = g.add_node(NodeW::Owner(OwnerNode {
///     id: OwnerId::new("doc.label-calculus"),
///     prefixes: Vec::new(),
/// }));
/// let source = g.add_node(NodeW::Source(SourceNode {
///     path: PathBuf::from("docs/labels.md"),
///     language: None,
///     generated: false,
/// }));
/// g.add_edge(owner, source, EdgeW::Owns);
///
/// assert_eq!(owner_of(&g, source), Some(owner));
/// assert_eq!(owner_of(&g, owner), None);
/// ```
#[must_use]
pub fn owner_of(g: &Corpus, n: NodeIndex) -> Option<NodeIndex> {
    let mut current = n;
    for _ in 0..g.node_count() {
        match in_along(g, current, EdgeW::Contains).next() {
            Some(up) => current = up,
            None => break,
        }
    }
    in_along(g, current, EdgeW::Owns).next()
}

/// The source a region, occurrence, or head lies in.
#[must_use]
pub fn source_of(g: &Corpus, n: NodeIndex) -> Option<NodeIndex> {
    let mut current = n;
    for _ in 0..=g.node_count() {
        if g.node_weight(current).map(NodeW::kind) == Some(NodeKind::Source) {
            return Some(current);
        }
        current = in_along(g, current, EdgeW::Contains).next()?;
    }
    None
}

/// Nodes of one variant, in index order.
pub fn nodes_of(g: &Corpus, k: NodeKind) -> impl Iterator<Item = NodeIndex> + '_ {
    g.node_indices()
        .filter(move |n| g.node_weight(*n).map(NodeW::kind) == Some(k))
}

/// Successors along exactly one edge weight.
pub fn out_along(g: &Corpus, n: NodeIndex, w: EdgeW) -> impl Iterator<Item = NodeIndex> + '_ {
    g.edges_directed(n, Direction::Outgoing)
        .filter(move |edge| *edge.weight() == w)
        .map(|edge| edge.target())
}

/// Predecessors along exactly one edge weight.
pub fn in_along(g: &Corpus, n: NodeIndex, w: EdgeW) -> impl Iterator<Item = NodeIndex> + '_ {
    g.edges_directed(n, Direction::Incoming)
        .filter(move |edge| *edge.weight() == w)
        .map(|edge| edge.source())
}

/// How many edges of one weight run into or out of a node.
///
/// Most of the judgments are this function against a constant: exactly
/// one, zero, or two (´tab:lint:judgment-implementation´).
#[must_use]
pub fn degree_along(g: &Corpus, n: NodeIndex, w: EdgeW, d: Direction) -> usize {
    g.edges_directed(n, d)
        .filter(|edge| *edge.weight() == w)
        .count()
}

/// The subgraph of one owner: its sources, regions, occurrences, and
/// assets.
#[must_use]
pub fn owner_view<'g>(
    g: &'g Corpus,
    owner: NodeIndex,
) -> NodeFiltered<&'g Corpus, impl Fn(NodeIndex) -> bool + 'g> {
    NodeFiltered(g, move |n: NodeIndex| {
        n == owner || owner_of(g, n) == Some(owner)
    })
}

/// The subgraph reached along one edge weight, for the algorithms that
/// want a graph rather than an iterator.
#[must_use]
pub fn edge_view<'g>(
    g: &'g Corpus,
    w: EdgeW,
) -> EdgeFiltered<&'g Corpus, impl Fn(EdgeReference<'g, EdgeW>) -> bool> {
    EdgeFiltered(g, move |edge: EdgeReference<'g, EdgeW>| *edge.weight() == w)
}

/// The registries the harvest completes and the resolution consults
/// (´sig:lint:index-maps´).
///
/// Plain maps, not graph structures: they are the lookup tables the
/// two-pass staging fills in pass 1 and reads in pass 2, and the
/// architecture places them outside the petgraph rule by its own terms.
#[derive(Clone, Debug, Default)]
pub struct Registries {
    /// The minting registry: one mint per owner and label.
    pub mints: HashMap<(NodeIndex, Label), NodeIndex>,
    /// Every owner's label node, whether minted or only cited into.
    pub labels: HashMap<(NodeIndex, Label), NodeIndex>,
    /// Σ, as node indices: registered prefix to owner.
    pub prefixes: HashMap<Prefix, NodeIndex>,
    /// Owner id to owner node, for the partition's own diagnostics.
    pub owners: HashMap<OwnerId, NodeIndex>,
    /// Every derived label of every effective profile, for the inventory
    /// query: the asset the profile's transformation derived it from.
    ///
    /// The census side of the bijection, keyed as `mints` and `labels` are.
    /// A label two of one owner's assets derive keeps the first, exactly as a
    /// twice-minted label does — the collision is the graph's to report, and
    /// reporting it needs both assets, which the `Covers` edges hold.
    pub derived: HashMap<(NodeIndex, Label), NodeIndex>,
}

impl Registries {
    /// Empty registries, before pass 1.
    #[must_use]
    pub fn new() -> Registries {
        Registries::default()
    }

    /// Record that `owner` carries `label` at the node `label_node`.
    ///
    /// Idempotent: an owner's label node exists once whether it is minted,
    /// cited into, or both.
    pub fn record_label(&mut self, owner: NodeIndex, label: Label, label_node: NodeIndex) {
        self.labels.entry((owner, label)).or_insert(label_node);
    }

    /// Record a mint, and with it the label it carries.
    ///
    /// Returns the mint already recorded for that owner and label, which is
    /// where duplicate minting fails, with both locations to hand
    /// (´sig:lint:index-maps´). Recording a mint records its label too:
    /// that is what keeps every key of `mints` a key of `labels`.
    ///
    /// ```
    /// use cogra_linter::graph::{Corpus, LabelNode, NodeW, Registries};
    /// use cogra_linter::scan::Label;
    /// use petgraph::stable_graph::NodeIndex;
    ///
    /// let mut g = Corpus::new();
    /// let label = Label::parse("sig:labels:owners").expect("a well-formed label");
    /// let owner = NodeIndex::new(0);
    /// let node = g.add_node(NodeW::Label(LabelNode { label: label.clone() }));
    /// let (first, second) = (NodeIndex::new(7), NodeIndex::new(9));
    ///
    /// let mut registries = Registries::new();
    /// assert_eq!(registries.record_mint(owner, label.clone(), first, node), None);
    /// assert_eq!(
    ///     registries.record_mint(owner, label.clone(), second, node),
    ///     Some(first),
    ///     "the collision hands back the first mint, so both locations are to hand",
    /// );
    /// assert!(registries.labels.contains_key(&(owner, label)));
    /// ```
    pub fn record_mint(
        &mut self,
        owner: NodeIndex,
        label: Label,
        mint: NodeIndex,
        label_node: NodeIndex,
    ) -> Option<NodeIndex> {
        self.record_label(owner, label.clone(), label_node);
        let earlier = self.mints.get(&(owner, label.clone())).copied();
        if earlier.is_none() {
            self.mints.insert((owner, label), mint);
        }
        earlier
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn label(text: &str) -> Label {
        Label::parse(text).unwrap_or_else(|problem| panic!("{text} is well-formed: {problem:?}"))
    }

    fn owner(id: &str) -> NodeW {
        NodeW::Owner(OwnerNode {
            id: OwnerId::new(id),
            prefixes: Vec::new(),
        })
    }

    fn source(path: &str) -> NodeW {
        NodeW::Source(SourceNode {
            path: PathBuf::from(path),
            language: Some(Language::new("markdown")),
            generated: false,
        })
    }

    fn region() -> NodeW {
        NodeW::Region(RegionNode {
            kind: RegionKind::Prose,
            span: ByteSpan::new(0, 10),
            participates: true,
            generated: false,
            presents: None,
        })
    }

    fn mint(text: &str) -> NodeW {
        NodeW::Mint(MintNode {
            label: label(text),
            span: ByteSpan::new(1, 9),
            syntax: Syntax::Prose,
        })
    }

    /// One owner, one source, one region, one mint, wired the way pass 1
    /// wires them.
    fn one_chain() -> (Corpus, NodeIndex, NodeIndex, NodeIndex, NodeIndex) {
        let mut g = Corpus::new();
        let o = g.add_node(owner("doc.label-calculus"));
        let s = g.add_node(source("docs/labels.md"));
        let r = g.add_node(region());
        let m = g.add_node(mint("sig:labels:owners"));
        g.add_edge(o, s, EdgeW::Owns);
        g.add_edge(s, r, EdgeW::Contains);
        g.add_edge(r, m, EdgeW::Contains);
        (g, o, s, r, m)
    }

    #[test]
    fn ownership_is_found_by_walking_and_never_by_a_field() {
        let (g, o, s, r, m) = one_chain();
        assert_eq!(owner_of(&g, m), Some(o));
        assert_eq!(owner_of(&g, r), Some(o));
        assert_eq!(owner_of(&g, s), Some(o));
    }

    #[test]
    fn an_unowned_node_has_no_owner() {
        let mut g = Corpus::new();
        let stray = g.add_node(region());
        assert_eq!(owner_of(&g, stray), None);
    }

    #[test]
    fn the_source_of_an_occurrence_is_the_file_it_lies_in() {
        let (g, _, s, r, m) = one_chain();
        assert_eq!(source_of(&g, m), Some(s));
        assert_eq!(source_of(&g, r), Some(s));
        assert_eq!(source_of(&g, s), Some(s));
    }

    #[test]
    fn nodes_of_one_variant_come_in_index_order() {
        let (mut g, _, _, _, _) = one_chain();
        let second = g.add_node(mint("sig:labels:profiles"));
        let found: Vec<NodeIndex> = nodes_of(&g, NodeKind::Mint).collect();
        assert_eq!(found.len(), 2);
        assert!(found[0].index() < second.index());
    }

    #[test]
    fn a_walk_along_one_weight_ignores_the_others() {
        let (mut g, o, s, _, m) = one_chain();
        let l = g.add_node(NodeW::Label(LabelNode {
            label: label("sig:labels:owners"),
        }));
        g.add_edge(m, l, EdgeW::Mints);
        g.add_edge(o, l, EdgeW::Owns);
        assert_eq!(out_along(&g, m, EdgeW::Mints).count(), 1);
        assert_eq!(out_along(&g, m, EdgeW::Contains).count(), 0);
        assert_eq!(in_along(&g, l, EdgeW::Owns).next(), Some(o));
        assert_eq!(out_along(&g, o, EdgeW::Owns).count(), 2);
        assert_eq!(out_along(&g, s, EdgeW::Contains).count(), 1);
    }

    #[test]
    fn a_judgment_is_a_degree_against_a_constant() {
        let (mut g, _, _, _, m) = one_chain();
        let l = g.add_node(NodeW::Label(LabelNode {
            label: label("sig:labels:owners"),
        }));
        g.add_edge(m, l, EdgeW::Mints);
        assert_eq!(degree_along(&g, m, EdgeW::Mints, Direction::Outgoing), 1);
        assert_eq!(degree_along(&g, l, EdgeW::Mints, Direction::Incoming), 1);
        assert_eq!(
            degree_along(&g, l, EdgeW::ResolvesTo, Direction::Incoming),
            0
        );
    }

    #[test]
    fn an_owner_view_holds_that_owner_alone() {
        let (mut g, o, _, _, _) = one_chain();
        let other = g.add_node(owner("doc.kind-registry"));
        let elsewhere = g.add_node(source("docs/kinds.md"));
        g.add_edge(other, elsewhere, EdgeW::Owns);

        let view = owner_view(&g, o);
        let held: Vec<NodeIndex> =
            petgraph::visit::IntoNodeIdentifiers::node_identifiers(&view).collect();
        assert!(held.contains(&o));
        assert!(!held.contains(&other));
        assert!(!held.contains(&elsewhere));
        assert_eq!(held.len(), 4);
    }

    #[test]
    fn an_edge_view_holds_one_weight_alone() {
        let (g, _, _, _, _) = one_chain();
        let view = edge_view(&g, EdgeW::Contains);
        let held = petgraph::visit::IntoEdgeReferences::edge_references(&view).count();
        assert_eq!(held, 2);
        assert_eq!(
            petgraph::visit::IntoEdgeReferences::edge_references(&edge_view(&g, EdgeW::Owns))
                .count(),
            1
        );
    }

    #[test]
    fn every_node_variant_has_its_discriminant() {
        assert_eq!(owner("x").kind(), NodeKind::Owner);
        assert_eq!(source("x").kind(), NodeKind::Source);
        assert_eq!(region().kind(), NodeKind::Region);
        assert_eq!(mint("a:b:c").kind(), NodeKind::Mint);
    }

    #[test]
    fn a_second_mint_of_one_label_is_caught_at_insertion() {
        let (mut g, o, _, _, m) = one_chain();
        let l = g.add_node(NodeW::Label(LabelNode {
            label: label("sig:labels:owners"),
        }));
        let second = g.add_node(mint("sig:labels:owners"));
        let mut registries = Registries::new();
        assert_eq!(
            registries.record_mint(o, label("sig:labels:owners"), m, l),
            None
        );
        assert_eq!(
            registries.record_mint(o, label("sig:labels:owners"), second, l),
            Some(m),
            "the first mint is kept and handed back, so both locations are to hand"
        );
        assert_eq!(registries.mints.len(), 1);
    }

    #[test]
    fn recording_a_mint_records_its_label() {
        let (mut g, o, _, _, m) = one_chain();
        let l = g.add_node(NodeW::Label(LabelNode {
            label: label("sig:labels:owners"),
        }));
        let mut registries = Registries::new();
        registries.record_mint(o, label("sig:labels:owners"), m, l);
        assert!(
            registries
                .labels
                .contains_key(&(o, label("sig:labels:owners")))
        );
    }
}
