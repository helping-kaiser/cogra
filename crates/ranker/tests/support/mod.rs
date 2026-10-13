//! ´mod:module:support´
//!
//! The hand-built ranking cases of vector sets (c) and (d), and the JSON
//! forms they travel in.
//!
//! Each case is a small slice built the way Layer 1 publishes records —
//! minted content named by its genesis act, every record its own causal
//! key — with the viewer `v` at its root. The cases are the ones ranker-core
//! §7.1 requires: both reference channels, a Tag's topic leg, the person
//! fold, a Type sink, a negative score, a cancellation, a strict-score tie
//! the cascade resolves, and the cost ties the canonical hop key breaks.

use std::collections::BTreeMap;

use ranker::{
    CausalKey, Family, FeedEntry, LegRole, NetworkParams, NodeKind, RankParams, RecencyShape,
    Slice, SliceLeg, SliceNode, SliceRecord, TieBreakerKey,
};
use serde_json::{Value, json};

/// A float as the 16 hex digits of its IEEE-754 bit pattern, big-endian.
pub fn bits(x: f64) -> String {
    format!("{:016x}", x.to_bits())
}

pub fn network(k: u32) -> NetworkParams {
    NetworkParams {
        k,
        gamma: 1.0,
        dust_floor: 0.0,
        half_life_epochs: 30,
        shape: RecencyShape::Exponential,
        tie_breakers: vec![TieBreakerKey::Recency],
    }
}

pub fn every_kind() -> RankParams {
    RankParams {
        kinds: Some(NodeKind::ALL.to_vec()),
        ..RankParams::default()
    }
}

pub struct Builder {
    pub epoch: i64,
    pub tau: f64,
    clock: i64,
    seq: BTreeMap<String, u64>,
    nodes: BTreeMap<String, SliceNode>,
    records: Vec<SliceRecord>,
}

fn family_token(family: Family) -> &'static str {
    match family {
        Family::Publish => "publish",
        Family::Review => "review",
        Family::Opinion => "opinion",
        Family::Tag => "tag",
        Family::Reference => "reference",
        Family::Affinity => "affinity",
        _ => "other",
    }
}

impl Builder {
    pub fn new() -> Builder {
        let mut b = Builder {
            epoch: 1,
            tau: 0.5,
            clock: 0,
            seq: BTreeMap::new(),
            nodes: BTreeMap::new(),
            records: Vec::new(),
        };
        b.person("v");
        b
    }

    fn key(&mut self) -> CausalKey {
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
        format!("act:{author}:{seq}:{}", family_token(family))
    }

    fn node(&mut self, graph_id: &str, kind: NodeKind, genesis: Option<CausalKey>) {
        self.nodes.insert(
            graph_id.to_string(),
            SliceNode {
                graph_id: graph_id.to_string(),
                id: Some(format!("id/{graph_id}")),
                kind: Some(kind),
                genesis,
                statistics: None,
            },
        );
    }

    pub fn person(&mut self, atom: &str) -> String {
        let key = self.key();
        let graph_id = format!("prof:{atom}");
        self.node(&graph_id, NodeKind::User, Some(key));
        graph_id
    }

    pub fn topic(&mut self, name: &str) -> String {
        let graph_id = format!("name:{name}");
        self.node(&graph_id, NodeKind::Hashtag, None);
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

    pub fn post(&mut self, author: &str) -> String {
        let record = self.act(author, Family::Publish);
        let graph_id = format!("mint:{record}");
        let key = self.key();
        self.node(&graph_id, NodeKind::Post, Some(key));
        let leg = self.leg(
            LegRole::Binary,
            &format!("addr:{author}"),
            &graph_id,
            1.0,
            1.0,
        );
        self.records.push(SliceRecord {
            record_id: record,
            family: Family::Publish,
            author: author.to_string(),
            key,
            legs: vec![leg],
        });
        graph_id
    }

    pub fn binary(&mut self, family: Family, author: &str, target: &str, p_d: f64, p_i: f64) {
        let record = self.act(author, family);
        let key = self.key();
        let leg = self.leg(LegRole::Binary, &format!("addr:{author}"), target, p_d, p_i);
        self.records.push(SliceRecord {
            record_id: record,
            family,
            author: author.to_string(),
            key,
            legs: vec![leg],
        });
    }

    pub fn opinion(&mut self, author: &str, target: &str, p_d: f64, p_i: f64) {
        self.binary(Family::Opinion, author, target, p_d, p_i);
    }

    pub fn hyper(
        &mut self,
        family: Family,
        author: &str,
        middle: &str,
        target: &str,
        p_d: f64,
        p_i: f64,
    ) {
        let record = self.act(author, family);
        let key = self.key();
        let a = self.leg(LegRole::A, &format!("addr:{author}"), middle, p_d, p_i);
        let t = self.leg(LegRole::T, middle, target, p_i, p_d);
        self.records.push(SliceRecord {
            record_id: record,
            family,
            author: author.to_string(),
            key,
            legs: vec![a, t],
        });
    }

    pub fn build(&self) -> Slice {
        Slice {
            as_of_epoch: 10,
            viewer: "id/prof:v".to_string(),
            nodes: self.nodes.values().cloned().collect(),
            records: self.records.clone(),
        }
    }
}

/// One case: a slice, the parameters it ranks under, and what it pins.
pub struct Case {
    pub name: &'static str,
    pub slice: Slice,
    pub params: RankParams,
    pub network: NetworkParams,
}

/// Vector set (c): the required behaviours.
pub fn ranking_cases() -> Vec<Case> {
    let mut cases = Vec::new();

    let mut b = Builder::new();
    b.person("owner");
    b.person("cited");
    let carrier = b.post("owner");
    let target = b.post("cited");
    b.opinion("v", &carrier, 1.0, 1.0);
    b.hyper(Family::Reference, "owner", &carrier, &target, 1.0, 0.5);
    cases.push(Case {
        name: "a reference crosses content-intrinsically from any arrival at its carrier",
        slice: b.build(),
        params: RankParams::default(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("owner");
    b.person("referrer");
    b.person("cited");
    let carrier = b.post("owner");
    let target = b.post("cited");
    b.opinion("v", &carrier, 1.0, 1.0);
    b.opinion("v", "prof:referrer", 0.5, 1.0);
    b.hyper(Family::Reference, "referrer", &carrier, &target, 1.0, 1.0);
    cases.push(Case {
        name: "a stranger's reference crosses only as its author's own continuation",
        slice: b.build(),
        params: RankParams::default(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("writer");
    let topic = b.topic("rust");
    let post = b.post("writer");
    b.opinion("v", &post, 1.0, 1.0);
    b.hyper(Family::Tag, "writer", &post, &topic, 1.0, 1.0);
    cases.push(Case {
        name: "a tag's topic leg lands on its Type",
        slice: b.build(),
        params: every_kind(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("friend");
    b.person("far");
    b.opinion("v", "prof:friend", 1.0, 1.0);
    b.opinion("friend", "prof:far", 0.5, 0.5);
    let post = b.post("far");
    let _ = post;
    cases.push(Case {
        name: "a stance landing on a profile continues from the person's own records",
        slice: b.build(),
        params: every_kind(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("stranger");
    let topic = b.topic("sink");
    let beyond = b.post("stranger");
    b.binary(Family::Affinity, "v", &topic, 1.0, 1.0);
    b.hyper(Family::Reference, "v", &topic, &beyond, 1.0, 1.0);
    cases.push(Case {
        name: "a Type ranks and never transits",
        slice: b.build(),
        params: every_kind(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("rival");
    let post = b.post("rival");
    b.opinion("v", "prof:rival", -1.0, 1.0);
    let _ = post;
    cases.push(Case {
        name: "a negative score sorts at the bottom, present",
        slice: b.build(),
        params: every_kind(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("a");
    b.person("c");
    b.person("x");
    let post = b.post("x");
    b.opinion("v", "prof:a", 1.0, 1.0);
    b.opinion("v", "prof:c", 1.0, 1.0);
    b.opinion("a", &post, 1.0, 1.0);
    b.opinion("c", &post, -1.0, 1.0);
    cases.push(Case {
        name: "opposing paths cancel to a present zero",
        slice: b.build(),
        params: RankParams::default(),
        network: network(8),
    });

    let mut b = Builder::new();
    b.person("x");
    b.person("y");
    let older = b.post("x");
    let newer = b.post("y");
    b.epoch = 5;
    b.opinion("v", &older, 1.0, 1.0);
    b.opinion("v", &newer, 1.0, 1.0);
    cases.push(Case {
        name: "a strict score tie breaks by genesis recency, newest first",
        slice: b.build(),
        params: RankParams::default(),
        network: network(8),
    });

    cases
}

/// Vector set (d): equal path costs, broken by the canonical hop key.
pub fn cost_tie_cases() -> Vec<Case> {
    let mut cases = Vec::new();
    for k in [8, 1] {
        let mut b = Builder::new();
        b.person("alpha");
        b.person("beta");
        b.person("z");
        let post = b.post("z");
        b.epoch = 5;
        b.opinion("v", "prof:beta", 1.0, 1.0);
        b.opinion("v", "prof:alpha", 1.0, 1.0);
        b.opinion("beta", &post, 1.0, 1.0);
        b.opinion("alpha", &post, 1.0, 1.0);
        cases.push(Case {
            name: if k == 8 {
                "equal-cost paths extract in hop-key order"
            } else {
                "at k = 1 the least hop key is the one path"
            },
            slice: b.build(),
            params: RankParams::default(),
            network: network(k),
        });
    }
    cases
}

fn key_json(key: &CausalKey) -> Value {
    json!({"landingEpoch": key.landing_epoch, "actTime": key.act_time, "position": key.position})
}

pub fn slice_json(slice: &Slice) -> Value {
    json!({
        "asOfEpoch": slice.as_of_epoch,
        "viewer": slice.viewer,
        "nodes": slice.nodes.iter().map(|n| json!({
            "graphId": n.graph_id,
            "id": n.id,
            "kind": n.kind.map(|k| k.wire_name()),
            "genesis": n.genesis.as_ref().map(key_json),
        })).collect::<Vec<_>>(),
        "records": slice.records.iter().map(|r| json!({
            "recordId": r.record_id,
            "family": r.family.wire_name(),
            "author": r.author,
            "key": key_json(&r.key),
            "legs": r.legs.iter().map(|l| json!({
                "role": l.role.wire_name(),
                "source": l.source,
                "target": l.target,
                "pDirectedBits": bits(l.p_d),
                "pInterestBits": bits(l.p_i),
                "tauBits": bits(l.tau),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
    })
}

pub fn entry_json(entry: &FeedEntry) -> Value {
    json!({
        "targetId": entry.target_id,
        "targetGraphId": entry.target_graph_id,
        "kind": entry.kind.wire_name(),
        "scoreBits": bits(entry.score),
        "genesisEpochAge": entry.tie_breakers.genesis_epoch_age,
        "paths": entry.paths.iter().map(|p| json!({
            "nodes": p.nodes,
            "sign": p.sign,
            "magnitudeBits": bits(p.magnitude),
            "recencyBits": bits(p.recency),
            "contributionBits": bits(p.contribution),
            "hops": p.hops.iter().map(|h| json!({
                "family": h.family.wire_name(),
                "role": h.role.wire_name(),
                "author": h.author,
                "source": h.source,
                "target": h.target,
                "records": h.members.iter().map(|m| m.record_id.clone()).collect::<Vec<_>>(),
                "pDirectedBits": bits(h.p_directed),
                "pInterestBits": bits(h.p_interest),
                "tauBits": bits(h.tau),
                "weightBits": bits(h.weight),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
    })
}
