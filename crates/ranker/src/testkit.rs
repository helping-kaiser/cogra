//! Fixtures for the crate's own tests: a slice builder that writes records
//! the way Layer 1 publishes them, and a generator of random slices.
//!
//! The builder keeps every identifier honest — minted content is named by
//! its genesis act, so the syntactic creator rule reads the right author —
//! and gives every record its own causal key, epoch by epoch.

use std::collections::BTreeMap;

use proptest::prelude::*;
use proptest::test_runner::{Config, RngSeed, TestCaseError, TestRunner};

use crate::bundle::CausalKey;
use crate::census::{Family, LegRole};
use crate::input::{
    NetworkParams, NodeKind, Slice, SliceLeg, SliceNode, SliceRecord, TieBreakerKey,
};
use crate::recency::RecencyShape;

/// Runs a property from an ordinary test, seeded, persisting nothing.
pub(crate) fn check<S>(
    cases: u32,
    strategy: S,
    test: impl Fn(S::Value) -> Result<(), TestCaseError>,
) where
    S: Strategy,
    S::Value: std::fmt::Debug,
{
    let mut runner = TestRunner::new(Config {
        cases,
        rng_seed: RngSeed::Fixed(0x0C06_4A5E_2026_1013),
        failure_persistence: None,
        ..Config::default()
    });
    if let Err(failure) = runner.run(&strategy, test) {
        panic!("{failure}");
    }
}

/// The genesis network parameters, with the composition the genesis seed
/// names.
pub(crate) fn network() -> NetworkParams {
    NetworkParams {
        k: 8,
        gamma: 1.0,
        dust_floor: 0.0,
        half_life_epochs: 30,
        shape: RecencyShape::Exponential,
        tie_breakers: vec![TieBreakerKey::Recency],
    }
}

/// A CoGra id for a graph identifier.
pub(crate) fn id_of(graph_id: &str) -> String {
    format!("id/{graph_id}")
}

/// Builds a slice record by record.
pub(crate) struct Builder {
    pub as_of: i64,
    pub epoch: i64,
    pub tau: f64,
    viewer: String,
    clock: i64,
    seq: BTreeMap<String, u64>,
    nodes: BTreeMap<String, SliceNode>,
    records: Vec<SliceRecord>,
}

impl Builder {
    pub(crate) fn new(viewer: &str) -> Builder {
        let mut b = Builder {
            as_of: 10,
            epoch: 1,
            tau: 0.5,
            viewer: id_of(&format!("prof:{viewer}")),
            clock: 0,
            seq: BTreeMap::new(),
            nodes: BTreeMap::new(),
            records: Vec::new(),
        };
        b.person(viewer);
        b
    }

    fn next_key(&mut self) -> CausalKey {
        self.clock += 1;
        CausalKey {
            landing_epoch: self.epoch,
            act_time: self.clock,
            position: self.clock,
        }
    }

    fn act(&mut self, author: &str, family: Family) -> String {
        let seq = self.seq.entry(author.to_string()).or_insert(0);
        *seq += 1;
        let token = family.seam().as_str();
        format!("act:{author}:{seq}:{token}")
    }

    fn node(&mut self, graph_id: &str, kind: Option<NodeKind>, genesis: Option<CausalKey>) {
        self.nodes.insert(
            graph_id.to_string(),
            SliceNode {
                graph_id: graph_id.to_string(),
                id: kind.map(|_| id_of(graph_id)),
                kind,
                genesis,
                statistics: None,
            },
        );
    }

    /// A person, with a Registration as its genesis.
    pub(crate) fn person(&mut self, atom: &str) -> String {
        let graph_id = format!("prof:{atom}");
        let key = self.next_key();
        self.node(&graph_id, Some(NodeKind::User), Some(key));
        graph_id
    }

    /// A node CoGra carries no row for: it transits and is never a
    /// candidate.
    pub(crate) fn rowless(&mut self, graph_id: &str) -> String {
        self.node(graph_id, None, None);
        graph_id.to_string()
    }

    /// A Type.
    pub(crate) fn topic(&mut self, name: &str) -> String {
        let graph_id = format!("name:{name}");
        self.node(&graph_id, Some(NodeKind::Hashtag), None);
        graph_id
    }

    fn leg(&self, role: LegRole, source: &str, target: &str, p_d: f64, p_i: f64) -> SliceLeg {
        SliceLeg {
            role,
            source: source.to_string(),
            target: target.to_string(),
            p_d,
            p_i,
            tau: self.tau,
            census_unknown: false,
        }
    }

    fn push(
        &mut self,
        record_id: String,
        family: Family,
        author: &str,
        key: CausalKey,
        legs: Vec<SliceLeg>,
    ) -> String {
        self.records.push(SliceRecord {
            record_id: record_id.clone(),
            family,
            author: author.to_string(),
            key,
            legs,
        });
        record_id
    }

    /// A post by `author`, minted by its Publish record.
    pub(crate) fn post(&mut self, author: &str, attachment: f64) -> String {
        let record = self.act(author, Family::Publish);
        let graph_id = format!("mint:{record}");
        let key = self.next_key();
        self.node(&graph_id, Some(NodeKind::Post), Some(key));
        let leg = self.leg(
            LegRole::Binary,
            &format!("addr:{author}"),
            &graph_id,
            attachment,
            1.0,
        );
        self.push(record, Family::Publish, author, key, vec![leg]);
        graph_id
    }

    /// A binary record.
    pub(crate) fn binary(
        &mut self,
        family: Family,
        author: &str,
        target: &str,
        p_d: f64,
        p_i: f64,
    ) -> String {
        let record = self.act(author, family);
        let key = self.next_key();
        let leg = self.leg(LegRole::Binary, &format!("addr:{author}"), target, p_d, p_i);
        self.push(record, family, author, key, vec![leg])
    }

    pub(crate) fn opinion(&mut self, author: &str, target: &str, p_d: f64, p_i: f64) -> String {
        self.binary(Family::Opinion, author, target, p_d, p_i)
    }

    /// A hyper-edge record: A-leg into `middle`, T-leg on to `target`, the
    /// T-leg rendering the tuple transposed.
    pub(crate) fn hyper(
        &mut self,
        family: Family,
        author: &str,
        middle: &str,
        target: &str,
        p_d: f64,
        p_i: f64,
    ) -> String {
        let record = self.act(author, family);
        let key = self.next_key();
        let a = self.leg(LegRole::A, &format!("addr:{author}"), middle, p_d, p_i);
        let t = self.leg(LegRole::T, middle, target, p_i, p_d);
        self.push(record, family, author, key, vec![a, t])
    }

    /// A comment by `author` under `parent`, minted by its genesis Review.
    pub(crate) fn comment(&mut self, author: &str, parent: &str, p_d: f64, p_i: f64) -> String {
        let record = self.act(author, Family::Review);
        let graph_id = format!("mint:{record}");
        let key = self.next_key();
        self.node(&graph_id, Some(NodeKind::Comment), Some(key));
        let a = self.leg(LegRole::A, &format!("addr:{author}"), parent, p_d, p_i);
        let t = self.leg(LegRole::T, parent, &graph_id, p_i, p_d);
        self.push(record, Family::Review, author, key, vec![a, t]);
        graph_id
    }

    /// Marks the newest record's legs census-unknown.
    pub(crate) fn census_unknown_last(&mut self) {
        if let Some(record) = self.records.last_mut() {
            for leg in &mut record.legs {
                leg.census_unknown = true;
            }
        }
    }

    pub(crate) fn build(&self) -> Slice {
        Slice {
            as_of_epoch: self.as_of,
            viewer: self.viewer.clone(),
            nodes: self.nodes.values().cloned().collect(),
            records: self.records.clone(),
        }
    }
}

/// One random authoring act, by indices into the generated population.
#[derive(Debug, Clone)]
enum Act {
    Opinion {
        author: usize,
        target: usize,
        p_d: f64,
        p_i: f64,
    },
    Tag {
        author: usize,
        content: usize,
        topic: usize,
        relevance: f64,
        confidence: f64,
    },
    Reference {
        author: usize,
        carrier: usize,
        target: usize,
        p_d: f64,
        p_i: f64,
    },
    Comment {
        author: usize,
        parent: usize,
        p_d: f64,
        p_i: f64,
    },
    Edit {
        author: usize,
        comment: usize,
        p_d: f64,
        p_i: f64,
    },
    Affinity {
        author: usize,
        topic: usize,
        p_d: f64,
        p_i: f64,
    },
}

fn parameter() -> impl Strategy<Value = f64> {
    prop::sample::select(vec![-1.0, -0.5, 0.0, 0.3, 0.5, 0.75, 1.0])
}

fn act() -> impl Strategy<Value = Act> {
    let i = || 0usize..64;
    prop_oneof![
        4 => (i(), i(), parameter(), parameter()).prop_map(|(author, target, p_d, p_i)| Act::Opinion { author, target, p_d, p_i }),
        2 => (i(), i(), i(), parameter(), prop::sample::select(vec![0.0, 0.5, 1.0])).prop_map(|(author, content, topic, relevance, confidence)| Act::Tag { author, content, topic, relevance, confidence }),
        2 => (i(), i(), i(), parameter(), parameter()).prop_map(|(author, carrier, target, p_d, p_i)| Act::Reference { author, carrier, target, p_d, p_i }),
        2 => (i(), i(), parameter(), parameter()).prop_map(|(author, parent, p_d, p_i)| Act::Comment { author, parent, p_d, p_i }),
        1 => (i(), i(), parameter(), parameter()).prop_map(|(author, comment, p_d, p_i)| Act::Edit { author, comment, p_d, p_i }),
        1 => (i(), i(), parameter(), parameter()).prop_map(|(author, topic, p_d, p_i)| Act::Affinity { author, topic, p_d, p_i }),
    ]
}

/// A random slice: a handful of people, their posts, two Types, and a
/// stream of opinions, tags, references, comments and edits among them,
/// landing over several epochs at several maturities.
pub(crate) fn any_slice() -> impl Strategy<Value = Slice> {
    (
        2usize..7,
        prop::collection::vec(0usize..3, 7),
        prop::collection::vec(
            (
                act(),
                0i64..5,
                prop::sample::select(vec![0.0, 0.3, 0.7, 0.95]),
            ),
            0..40,
        ),
    )
        .prop_map(|(people, posts_per, acts)| {
            let atoms: Vec<String> = (0..people).map(|i| format!("p{i}")).collect();
            let mut b = Builder::new(&atoms[0]);
            for atom in &atoms[1..] {
                b.person(atom);
            }
            let topics = [b.topic("alpha"), b.topic("beta")];
            let mut contents: Vec<String> = Vec::new();
            for (i, atom) in atoms.iter().enumerate() {
                for _ in 0..posts_per[i] {
                    contents.push(b.post(atom, 1.0));
                }
            }
            let mut comments: Vec<(String, String)> = Vec::new();
            for (act, epoch, tau) in acts {
                b.epoch = epoch;
                b.tau = tau;
                let person = |i: usize| format!("prof:{}", atoms[i % atoms.len()]);
                let atom = |i: usize| atoms[i % atoms.len()].clone();
                let any_node = |i: usize, contents: &[String]| {
                    let all = atoms.len() + contents.len();
                    let j = i % all;
                    if j < atoms.len() {
                        person(j)
                    } else {
                        contents[j - atoms.len()].clone()
                    }
                };
                match act {
                    Act::Opinion {
                        author,
                        target,
                        p_d,
                        p_i,
                    } => {
                        let t = any_node(target, &contents);
                        b.opinion(&atom(author), &t, p_d, p_i);
                    }
                    Act::Tag {
                        author,
                        content,
                        topic,
                        relevance,
                        confidence,
                    } if !contents.is_empty() => {
                        let c = contents[content % contents.len()].clone();
                        b.hyper(
                            Family::Tag,
                            &atom(author),
                            &c,
                            &topics[topic % 2],
                            relevance,
                            confidence,
                        );
                    }
                    Act::Reference {
                        author,
                        carrier,
                        target,
                        p_d,
                        p_i,
                    } if !contents.is_empty() => {
                        let c = contents[carrier % contents.len()].clone();
                        let t = any_node(target, &contents);
                        if t != c {
                            b.hyper(Family::Reference, &atom(author), &c, &t, p_d, p_i);
                        }
                    }
                    Act::Comment {
                        author,
                        parent,
                        p_d,
                        p_i,
                    } if !contents.is_empty() => {
                        let p = contents[parent % contents.len()].clone();
                        let c = b.comment(&atom(author), &p, p_d, p_i);
                        comments.push((p, c.clone()));
                        contents.push(c);
                    }
                    Act::Edit {
                        author,
                        comment,
                        p_d,
                        p_i,
                    } if !comments.is_empty() => {
                        let (p, c) = comments[comment % comments.len()].clone();
                        b.hyper(Family::Review, &atom(author), &p, &c, p_d, p_i);
                    }
                    Act::Affinity {
                        author,
                        topic,
                        p_d,
                        p_i,
                    } => {
                        b.binary(
                            Family::Affinity,
                            &atom(author),
                            &topics[topic % 2],
                            p_d,
                            p_i,
                        );
                    }
                    _ => {}
                }
            }
            b.build()
        })
}
