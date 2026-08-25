//! The two property obligations slice 1 owes, one per claim, named after
//! the claim it would break.
//!
//! Both are properties of this design rather than of the calculus: that
//! ownership found by walking agrees with the partition it was built from
//! (´dec:lint:ownership-by-edge´), and that the registries stay coherent
//! however pass 1 fills them (´sig:lint:index-maps´). Each quantifies over
//! generated corpora, which is what a property framework is for and what a
//! vector table cannot express.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use cogra_linter::graph::{
    CitationNode, Corpus, EdgeW, LabelNode, MintNode, NodeW, OwnerNode, RegionKind, RegionNode,
    Registries, SourceNode, owner_of,
};
use cogra_linter::scan::{Label, Syntax};
use cogra_linter::{ByteSpan, OwnerId, Partition, PartitionRule, PathPrefix};
use petgraph::stable_graph::NodeIndex;
use proptest::prelude::*;

fn any_owner() -> impl Strategy<Value = OwnerId> {
    prop_oneof![
        Just("doc.one"),
        Just("doc.two"),
        Just("pkg.three"),
        Just("tree.four"),
    ]
    .prop_map(OwnerId::new)
}

fn any_prefix() -> impl Strategy<Value = PathPrefix> {
    prop_oneof![
        Just("a/"),
        Just("a/b/"),
        Just("b/"),
        Just("a/b/c.md"),
        Just("z.txt"),
        Just(""),
    ]
    .prop_map(PathPrefix::new)
}

/// A partition whose last rule carries the empty prefix, which is the shape
/// the adoption loader admits and therefore the only shape the walk meets.
fn any_partition() -> impl Strategy<Value = Partition> {
    proptest::collection::vec((any_prefix(), any_owner()), 0..6).prop_map(|rows| {
        let mut rules: Vec<PartitionRule> = rows
            .into_iter()
            .enumerate()
            .map(|(at, (path, owner))| PartitionRule {
                order: u32::try_from(at + 1).unwrap_or(u32::MAX),
                path,
                owner,
                optional: false,
            })
            .collect();
        rules.push(PartitionRule {
            order: u32::try_from(rules.len() + 1).unwrap_or(u32::MAX),
            path: PathPrefix::new(""),
            owner: OwnerId::new("tree.residual"),
            optional: false,
        });
        Partition { rules }
    })
}

fn any_path() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("a/b/c.md"),
        Just("a/b/d/e.md"),
        Just("a/x.md"),
        Just("b/y.rs"),
        Just("z.txt"),
        Just("elsewhere/w.md"),
    ]
    .prop_map(String::from)
}

fn any_label() -> impl Strategy<Value = Label> {
    prop_oneof![
        Just("sig:labels:owners"),
        Just("inv:labels:inventory"),
        Just("dec:lint:one-generator"),
        Just("a1:x:y"),
        Just("a:x:y"),
    ]
    .prop_map(|text| Label::parse(text).expect("a well-formed label"))
}

/// The pass-1 staging, as far as slice 1 has it: an owner node per owner of
/// the partition, a source under the owner Ω assigns it, one region per
/// source, and the occurrences of that region.
struct Built {
    graph: Corpus,
    owners: HashMap<OwnerId, NodeIndex>,
    sources: Vec<(NodeIndex, PathBuf)>,
    occurrences: Vec<(NodeIndex, PathBuf)>,
}

fn build(partition: &Partition, paths: &[String], labels: &[Label]) -> Built {
    let mut graph = Corpus::new();
    let mut owners = HashMap::new();
    for rule in &partition.rules {
        owners.entry(rule.owner.clone()).or_insert_with(|| {
            graph.add_node(NodeW::Owner(OwnerNode {
                id: rule.owner.clone(),
                prefixes: Vec::new(),
            }))
        });
    }

    let mut sources = Vec::new();
    let mut occurrences = Vec::new();
    for (at, path) in paths.iter().enumerate() {
        let owned = partition.owner_for(Path::new(path));
        let Some(owner) = owners.get(&owned).copied() else {
            continue;
        };
        let source = graph.add_node(NodeW::Source(SourceNode {
            path: PathBuf::from(path),
            language: None,
            generated: false,
        }));
        graph.add_edge(owner, source, EdgeW::Owns);
        sources.push((source, PathBuf::from(path)));

        let region = graph.add_node(NodeW::Region(RegionNode {
            kind: RegionKind::Prose,
            span: ByteSpan::new(0, 1),
            participates: true,
            generated: false,
            presents: None,
        }));
        graph.add_edge(source, region, EdgeW::Contains);
        occurrences.push((region, PathBuf::from(path)));

        if let Some(label) = labels.get(at % labels.len().max(1)) {
            let mint = graph.add_node(NodeW::Mint(MintNode {
                label: label.clone(),
                span: ByteSpan::new(0, 1),
                syntax: Syntax::Prose,
            }));
            graph.add_edge(region, mint, EdgeW::Contains);
            occurrences.push((mint, PathBuf::from(path)));
        }
    }

    Built {
        graph,
        owners,
        sources,
        occurrences,
    }
}

proptest! {
    /// (´dec:lint:ownership-by-edge´): the walk and the partition never
    /// disagree, because the graph holds the partition exactly once.
    #[test]
    fn owner_of_agrees_with_the_partition(
        partition in any_partition(),
        paths in proptest::collection::vec(any_path(), 0..8),
        labels in proptest::collection::vec(any_label(), 1..4),
    ) {
        let built = build(&partition, &paths, &labels);
        for (node, path) in built.sources.iter().chain(&built.occurrences) {
            let expected = built
                .owners
                .get(&partition.owner_for(path))
                .copied();
            prop_assert_eq!(
                owner_of(&built.graph, *node),
                expected,
                "the walk and Ω's first match disagree about {:?}",
                path
            );
        }
    }

    /// An owner node is its own owner's subject and has no owner above it.
    #[test]
    fn an_owner_node_has_no_owner(
        partition in any_partition(),
        paths in proptest::collection::vec(any_path(), 0..4),
        labels in proptest::collection::vec(any_label(), 1..3),
    ) {
        let built = build(&partition, &paths, &labels);
        for owner in built.owners.values() {
            prop_assert_eq!(owner_of(&built.graph, *owner), None);
        }
    }

    /// (´sig:lint:index-maps´): every key of `mints` is a key of `labels`,
    /// and every `ResolvesTo` target is a node `labels` holds.
    #[test]
    fn the_registries_stay_coherent(
        partition in any_partition(),
        paths in proptest::collection::vec(any_path(), 0..8),
        labels in proptest::collection::vec(any_label(), 1..4),
        cited in proptest::collection::vec((0usize..4, 0usize..4), 0..8),
    ) {
        let built = build(&partition, &paths, &labels);
        let mut graph = built.graph;
        let mut registries = Registries::new();
        let owner_nodes: Vec<NodeIndex> = built.owners.values().copied().collect();

        for (owner, id) in &built.owners {
            registries.owners.insert(owner.clone(), *id);
        }

        for (source, _) in &built.sources {
            let owner = owner_of(&graph, *source).unwrap_or(*source);
            for label in &labels {
                let label_node = graph.add_node(NodeW::Label(LabelNode {
                    label: label.clone(),
                }));
                let mint = graph.add_node(NodeW::Mint(MintNode {
                    label: label.clone(),
                    span: ByteSpan::new(0, 1),
                    syntax: Syntax::Code,
                }));
                registries.record_mint(owner, label.clone(), mint, label_node);
            }
        }

        for (owner_at, label_at) in cited {
            let (Some(owner), Some(label)) = (
                owner_nodes.get(owner_at % owner_nodes.len().max(1)),
                labels.get(label_at % labels.len()),
            ) else {
                continue;
            };
            let citation = graph.add_node(NodeW::Citation(CitationNode {
                label: label.clone(),
                prefix: None,
                span: ByteSpan::new(0, 1),
                syntax: Syntax::Prose,
            }));
            let target = match registries.labels.get(&(*owner, label.clone())).copied() {
                Some(existing) => existing,
                None => {
                    let fresh = graph.add_node(NodeW::Label(LabelNode {
                        label: label.clone(),
                    }));
                    registries.record_label(*owner, label.clone(), fresh);
                    fresh
                }
            };
            graph.add_edge(citation, target, EdgeW::ResolvesTo);
        }

        for key in registries.mints.keys() {
            prop_assert!(
                registries.labels.contains_key(key),
                "a mint of {:?} with no label node beside it",
                key.1
            );
        }

        let held: Vec<NodeIndex> = registries.labels.values().copied().collect();
        for edge in graph.edge_indices() {
            if graph.edge_weight(edge) != Some(&EdgeW::ResolvesTo) {
                continue;
            }
            let Some((_, target)) = graph.edge_endpoints(edge) else {
                continue;
            };
            prop_assert!(
                held.contains(&target),
                "a resolution into a label node the registries do not hold"
            );
        }
    }
}
