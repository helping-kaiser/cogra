//! The path-set, score and sort properties (ranker-core §7.2, the RK-1
//! rows), the cross-packet tests ranked-feed-api §14.2 assigns this crate,
//! the spot-check protocol (§7.3) and the error surface (§5).

use std::collections::BTreeSet;

use proptest::prelude::*;

use crate::bundle::CausalKey;
use crate::census::{Family, LegRole};
use crate::error::RankError;
use crate::graph::Graph;
use crate::input::{NetworkParams, NodeKind, RankParams, Slice, SliceRecord, TieBreakerKey, TieStatistics};
use crate::output::FeedEntry;
use crate::rank::{rank, rank_search, score_target};
use crate::spot::{SpotCheck, spot_check};
use crate::testkit::{Builder, any_slice, check, id_of, network};
use crate::view::{PeopleMark, SettlingCandidate, feed_ranking};
use crate::weight::damped_weight;

fn ranked(slice: &Slice) -> Vec<FeedEntry> {
    rank(slice, &RankParams::default(), &network()).expect("a generated slice ranks")
}

fn all_kinds() -> RankParams {
    RankParams {
        kinds: Some(NodeKind::ALL.to_vec()),
        ..RankParams::default()
    }
}

fn entry<'a>(entries: &'a [FeedEntry], graph_id: &str) -> Option<&'a FeedEntry> {
    entries.iter().find(|e| e.target_graph_id == graph_id)
}

fn score(slice: &Slice, graph_id: &str) -> Option<f64> {
    score_target(slice, &id_of(graph_id), &RankParams::default(), &network())
        .expect("ranks")
        .map(|e| e.score)
}

fn w(family: Family, role: LegRole, p_d: f64, p_i: f64, tau: f64) -> f64 {
    damped_weight(family, role, p_d, p_i, tau).expect("in domain")
}

/// feed-ranking.md §3.1: an inert hop carries no path, so what only it
/// reached is absent.
///
/// A hop with a zero parameter carries no path, so a target only it reached is absent.
/// ´claim:properties:an-inert-hop-carries-no-path´
#[test]
fn t_zero_an_inert_hop_carries_no_path() {
    let mut b = Builder::new("v");
    let p = b.post("v", 1.0);
    b.person("a");
    let q = b.post("a", 1.0);
    b.opinion("v", "prof:a", 0.0, 1.0);
    let entries = ranked(&b.build());
    assert!(entry(&entries, &q).is_none());
    assert!(entry(&entries, &p).is_some());
}

/// feed-ranking.md §1 and §4: a record pointing at the viewer moves nothing
/// toward the viewer.
///
/// Adding any record into the viewer never changes the viewer's ranking.
/// ´claim:properties:inbound-records-never-change-the-feed´
#[test]
fn t_fwd_inbound_records_never_change_the_feed() {
    check(256, (any_slice(), prop::collection::vec((0usize..8, -1.0..=1.0f64, -1.0..=1.0f64), 1..6)), |(slice, inbound)| {
        let before = ranked(&slice);
        let mut more = slice.clone();
        let people: Vec<String> = slice
            .nodes
            .iter()
            .filter(|n| n.graph_id.starts_with("prof:") && n.id.as_deref() != Some(slice.viewer.as_str()))
            .map(|n| n.graph_id.trim_start_matches("prof:").to_string())
            .collect();
        let viewer = slice
            .nodes
            .iter()
            .find(|n| n.id.as_deref() == Some(slice.viewer.as_str()))
            .map(|n| n.graph_id.clone())
            .expect("the viewer is a node");
        for (i, (who, p_d, p_i)) in inbound.into_iter().enumerate() {
            if people.is_empty() {
                break;
            }
            let atom = &people[who % people.len()];
            more.records.push(SliceRecord {
                record_id: format!("act:{atom}:{}:opinion", 1000 + i),
                family: Family::Opinion,
                author: atom.clone(),
                key: CausalKey { landing_epoch: 9, act_time: 10_000 + i as i64, position: 10_000 + i as i64 },
                legs: vec![crate::input::SliceLeg {
                    role: LegRole::Binary,
                    source: format!("addr:{atom}"),
                    target: viewer.clone(),
                    p_d,
                    p_i,
                    tau: 0.5,
                    census_unknown: false,
                }],
            });
        }
        prop_assert_eq!(format!("{before:?}"), format!("{:?}", ranked(&more)));
        Ok(())
    });
}

/// feed-ranking.md §4 "Simple by construction" and §6.1 "strongest first":
/// a path's product only falls along it, and the extraction yields paths in
/// falling product. The cost decides the order; the product is rounded on
/// its own, so the second comparison allows one rounding's slack.
///
/// Products fall along every path, and the paths of an entry come strongest first.
/// ´claim:properties:paths-come-strongest-first´
#[test]
fn t_mono_paths_come_strongest_first() {
    check(256, any_slice(), |slice| {
        for entry in rank(&slice, &all_kinds(), &network()).expect("ranks") {
            for path in &entry.paths {
                let mut m = 1.0;
                for hop in &path.hops {
                    let next = m * hop.weight;
                    prop_assert!(next <= m);
                    m = next;
                }
                prop_assert_eq!(m.to_bits(), path.magnitude.to_bits());
            }
            for pair in entry.paths.windows(2) {
                prop_assert!(pair[1].magnitude <= pair[0].magnitude * (1.0 + 1e-12));
            }
        }
        Ok(())
    });
}

/// Unit-capacity max-flow from the viewer to `target` over every hop of the
/// graph, gated or not, interior nodes of capacity one and the direct
/// adjacency counted once — a superset of what the extraction may use, so
/// an upper bound on any disjoint path count.
fn menger_bound(g: &Graph, target: usize) -> usize {
    let n = g.nodes.len();
    let size = 2 * n;
    let mut cap = vec![vec![0i32; size]; size];
    let (inn, out) = (|v: usize| 2 * v, |v: usize| 2 * v + 1);
    for v in 0..n {
        cap[inn(v)][out(v)] = if v == g.root || v == target { n as i32 } else { 1 };
    }
    for hop in &g.hops {
        if hop.target == g.root {
            continue;
        }
        cap[out(hop.source)][inn(hop.target)] = 1;
    }
    let (s, t) = (out(g.root), inn(target));
    let mut flow = 0;
    loop {
        let mut prev = vec![usize::MAX; size];
        prev[s] = s;
        let mut queue = std::collections::VecDeque::from([s]);
        while let Some(x) = queue.pop_front() {
            for y in 0..size {
                if prev[y] == usize::MAX && cap[x][y] > 0 {
                    prev[y] = x;
                    queue.push_back(y);
                }
            }
        }
        if prev[t] == usize::MAX {
            return flow;
        }
        let mut y = t;
        while y != s {
            let x = prev[y];
            cap[x][y] -= 1;
            cap[y][x] += 1;
            y = x;
        }
        flow += 1;
    }
}

/// feed-ranking.md §6.1–§6.2: extracted paths are internally node-disjoint
/// (persons as one node), at most `k`, and never more than the minimum
/// interior node cut allows.
///
/// The extracted paths share no interior node, number at most k, and never exceed the node cut.
/// ´claim:properties:extracted-paths-are-disjoint´
#[test]
fn t_disj_extracted_paths_are_disjoint() {
    check(256, any_slice(), |slice| {
        let net = NetworkParams { k: 3, ..network() };
        let g = Graph::build(&slice, 1.0).expect("builds");
        for entry in rank(&slice, &all_kinds(), &net).expect("ranks") {
            prop_assert!(entry.paths.len() <= 3);
            let mut seen = BTreeSet::new();
            for path in &entry.paths {
                let interior: BTreeSet<&String> = path.nodes[1..path.nodes.len() - 1].iter().collect();
                prop_assert!(!interior.contains(&entry.target_graph_id), "a walk ends at its target");
                for node in interior {
                    prop_assert!(seen.insert(node.clone()), "{} shared", node);
                }
            }
            let target = g.index[&entry.target_graph_id];
            prop_assert!(entry.paths.len() <= menger_bound(&g, target));
        }
        Ok(())
    });
}

/// feed-ranking.md §6.2 "a delta-funnel … has min-cut 1": however many
/// members a cluster behind one bridge manufactures, the target scores as
/// the one bridge path.
///
/// A cluster of any size behind one bridge scores exactly one path through the bridge.
/// ´claim:properties:a-funnel-scores-one-bridge-path´
#[test]
fn t_funnel_a_funnel_scores_one_bridge_path() {
    for n in [50, 80] {
        let mut b = Builder::new("v");
        b.person("bridge");
        b.person("boss");
        let t = b.post("boss", 1.0);
        b.opinion("v", "prof:bridge", 1.0, 1.0);
        for i in 0..n {
            let member = format!("m{i}");
            b.person(&member);
            b.opinion("bridge", &format!("prof:{member}"), 1.0, 1.0);
            b.opinion(&member, &t, 1.0, 1.0);
        }
        let entries = ranked(&b.build());
        let e = entry(&entries, &t).expect("reached through the bridge");
        assert_eq!(e.paths.len(), 1, "n = {n}");
        assert!(e.paths[0].nodes.contains(&"prof:bridge".to_string()));
    }
}

/// feed-ranking.md §6.1: the extraction is greedy, exactly as specified. In
/// this graph the strongest path uses the only two nodes the maximal
/// disjoint pair would need, so greedy extracts one path where Menger
/// allows two — the expected behaviour, pinned.
///
/// Greedy extraction takes the strongest path first even where that leaves fewer paths than the disjoint maximum.
/// ´claim:properties:greedy-is-the-spec´
#[test]
fn t_greedy_extracts_the_greedy_set() {
    let mut b = Builder::new("u");
    for p in ["a", "c", "d", "e"] {
        b.person(p);
    }
    b.person("z");
    let t = b.post("z", 1.0);
    b.tau = 0.99;
    b.opinion("u", "prof:a", 1.0, 1.0);
    b.opinion("a", "prof:d", 1.0, 1.0);
    b.opinion("d", &t, 1.0, 1.0);
    b.tau = 0.5;
    b.opinion("u", "prof:c", 0.5, 0.5);
    b.opinion("c", "prof:d", 0.5, 0.5);
    b.opinion("a", "prof:e", 0.5, 0.5);
    b.opinion("e", &t, 0.5, 0.5);
    let slice = b.build();
    let g = Graph::build(&slice, 1.0).expect("builds");
    assert_eq!(menger_bound(&g, g.index[&t]), 2);
    let entries = ranked(&slice);
    let e = entry(&entries, &t).expect("reached");
    assert_eq!(e.paths.len(), 1);
    assert_eq!(e.paths[0].nodes, vec!["prof:u", "prof:a", "prof:d", t.as_str()]);
}

/// feed-ranking.md §7 "Zero-jail": netting the last live entry bundle makes
/// the target absent, never a zero row.
///
/// Netting the last live entry into a target makes it absent rather than zero.
/// ´claim:properties:netting-the-last-entry-is-absence´
#[test]
fn t_jail_netting_the_last_entry_is_absence() {
    let mut b = Builder::new("v");
    b.person("x");
    let t = b.post("x", 1.0);
    b.opinion("v", "prof:x", 0.75, 0.5);
    assert!(entry(&ranked(&b.build()), &t).is_some());
    b.opinion("v", "prof:x", -0.75, -0.5);
    assert!(entry(&ranked(&b.build()), &t).is_none());
}

/// feed-ranking.md §7: "A cancellation S = 0 … is not jail — it sorts as the
/// neutral score it is."
///
/// Opposing live paths that cancel leave the target present with a score of exactly zero.
/// ´claim:properties:a-cancellation-is-present-at-zero´
#[test]
fn t_jail_a_cancellation_is_present_at_zero() {
    let mut b = Builder::new("v");
    b.person("a");
    b.person("c");
    b.person("x");
    let t = b.post("x", 1.0);
    b.opinion("v", "prof:a", 1.0, 1.0);
    b.opinion("v", "prof:c", 1.0, 1.0);
    b.opinion("a", &t, 1.0, 1.0);
    b.opinion("c", &t, -1.0, 1.0);
    let entries = ranked(&b.build());
    let e = entry(&entries, &t).expect("present");
    assert_eq!(e.score.to_bits(), 0.0f64.to_bits());
    assert_eq!(e.paths.len(), 2);
}

/// feed-ranking.md §5.2: balance multiplies the directional signs, taint
/// absorbs on any avoidance, and hate-and-avoid ranks opposite to
/// love-and-seek.
///
/// Balance flips per negative direction, any negative interest taints absorbingly, and the two coherent quadrants rank opposite.
/// ´claim:properties:balance-and-taint-sign-the-path´
#[test]
fn t_sign_balance_and_taint() {
    let mut b = Builder::new("v");
    for p in ["a", "e", "x", "y"] {
        b.person(p);
    }
    let love = b.post("x", 1.0);
    let hate = b.post("y", 1.0);
    b.opinion("v", &love, 1.0, 1.0);
    b.opinion("v", &hate, -1.0, -1.0);
    b.opinion("v", "prof:a", -1.0, 1.0);
    b.opinion("v", "prof:e", 1.0, -1.0);
    let enemy_of_enemy = b.post("a", 1.0);
    let entries = ranked(&b.build());
    let (l, h) = (entry(&entries, &love).expect("love"), entry(&entries, &hate).expect("hate"));
    assert_eq!(h.score.to_bits(), (-l.score).to_bits());
    let mut b2 = Builder::new("v");
    b2.person("a");
    b2.person("z");
    let target = b2.post("z", 1.0);
    b2.opinion("v", "prof:a", -1.0, 1.0);
    b2.opinion("a", &target, -1.0, 1.0);
    let e = ranked(&b2.build());
    assert_eq!(entry(&e, &target).expect("reached").paths[0].sign, 1, "the enemy of my enemy");
    let mut b3 = Builder::new("v");
    b3.person("a");
    b3.person("z");
    let target = b3.post("z", 1.0);
    b3.opinion("v", "prof:a", 1.0, -1.0);
    b3.opinion("a", &target, -1.0, -1.0);
    let e = ranked(&b3.build());
    assert_eq!(entry(&e, &target).expect("reached").paths[0].sign, -1, "taint never composes back");
    assert!(entry(&entries, &enemy_of_enemy).is_some_and(|e| e.score < 0.0));
}

/// feed-ranking.md §5.3: only the terminal stance record ages; a half-life
/// of zero turns recency off.
///
/// Only the terminal hop's age enters the score, and a zero half-life makes every factor one.
/// ´claim:properties:only-the-terminal-hop-ages´
#[test]
fn t_recency_only_the_terminal_hop_ages() {
    let build = |intermediate: i64, terminal: i64| {
        let mut b = Builder::new("v");
        b.person("a");
        b.person("z");
        b.epoch = 1;
        let t = b.post("z", 1.0);
        b.epoch = intermediate;
        b.opinion("v", "prof:a", 1.0, 1.0);
        b.epoch = terminal;
        b.opinion("a", &t, 1.0, 1.0);
        (b.build(), t)
    };
    let (s1, t) = build(1, 8);
    let (s2, _) = build(7, 8);
    let (s3, _) = build(1, 2);
    let (x, y, z) = (score(&s1, &t), score(&s2, &t), score(&s3, &t));
    assert_eq!(x.map(f64::to_bits), y.map(f64::to_bits));
    assert!(z < x);
    let off = RankParams {
        half_life_epochs: Some(0),
        ..RankParams::default()
    };
    for e in rank(&s3, &off, &network()).expect("ranks") {
        assert!(e.paths.iter().all(|p| p.recency == 1.0));
    }
}

/// feed-ranking.md §4 "Types are sinks": a Type ranks as a target and never
/// transits — not even as a reference's carrier.
///
/// No path ever continues out of a Type.
/// ´claim:properties:no-path-leaves-a-type´
#[test]
fn t_sink_no_path_leaves_a_type() {
    let mut b = Builder::new("v");
    b.person("s");
    let topic = b.topic("rust");
    let p = b.post("s", 1.0);
    b.binary(Family::Affinity, "v", &topic, 1.0, 1.0);
    b.hyper(Family::Reference, "v", &topic, &p, 1.0, 1.0);
    let entries = rank(&b.build(), &all_kinds(), &network()).expect("ranks");
    assert!(entry(&entries, &topic).is_some(), "the Type ranks as a target");
    assert!(entry(&entries, &p).is_none(), "and nothing passes through it");
}

/// feed-ranking.md §4 "References" and "Tags": a stranger's citation or tag
/// reaches its target only through its own author.
///
/// A stranger's citation or tag reaches its target only through its author.
/// ´claim:properties:a-strangers-citation-crosses-only-through-its-author´
#[test]
fn t_chan_a_strangers_citation_crosses_only_through_its_author() {
    for family in [Family::Reference, Family::Tag] {
        let mut b = Builder::new("v");
        b.person("owner");
        b.person("stranger");
        b.person("cited");
        let carrier = b.post("owner", 1.0);
        let target = if family == Family::Tag { b.topic("t") } else { b.post("cited", 1.0) };
        b.opinion("v", &carrier, 1.0, 1.0);
        b.hyper(family, "stranger", &carrier, &target, 1.0, 1.0);
        let params = all_kinds();
        let entries = rank(&b.build(), &params, &network()).expect("ranks");
        assert!(entry(&entries, &target).is_none(), "{family}: the carrier is no switchboard");
        b.opinion("v", "prof:stranger", 1.0, 1.0);
        let entries = rank(&b.build(), &params, &network()).expect("ranks");
        let e = entry(&entries, &target).expect("through the author");
        assert_eq!(e.paths[0].nodes, vec!["prof:v", "prof:stranger", carrier.as_str(), target.as_str()]);
    }
}

/// feed-ranking.md §4: the author's own citation is part of the content, so
/// any arrival at the carrier continues along it.
///
/// The content author's own citation or tag crosses from any arrival at the carrier.
/// ´claim:properties:the-authors-own-citation-crosses-from-any-arrival´
#[test]
fn t_chan_the_authors_own_citation_crosses_from_any_arrival() {
    for family in [Family::Reference, Family::Tag] {
        let mut b = Builder::new("v");
        b.person("owner");
        b.person("cited");
        let carrier = b.post("owner", 1.0);
        let target = if family == Family::Tag { b.topic("t") } else { b.post("cited", 1.0) };
        b.opinion("v", &carrier, 1.0, 1.0);
        b.hyper(family, "owner", &carrier, &target, 1.0, 1.0);
        let entries = rank(&b.build(), &all_kinds(), &network()).expect("ranks");
        let e = entry(&entries, &target).expect("content-intrinsic");
        assert_eq!(e.paths[0].nodes, vec!["prof:v", carrier.as_str(), target.as_str()]);
    }
}

/// feed-ranking.md §4 "Edit legs": a stranger's mismatched edit reaches the
/// Comment only through its own author; the comment's creator edits freely;
/// a genesis Review's T-leg is ungated.
///
/// A stranger's edit reaches the comment only through its author, while the comment's creator's edit and the genesis leg cross freely.
/// ´claim:properties:edit-legs-are-channel-gated´
#[test]
fn t_chan_edit_legs_are_gated() {
    let mut b = Builder::new("v");
    b.person("writer");
    b.person("stranger");
    let parent = b.post("writer", 1.0);
    let other = b.post("stranger", 1.0);
    let comment = b.comment("writer", &parent, 1.0, 1.0);
    b.opinion("v", &other, 1.0, 1.0);
    b.hyper(Family::Review, "stranger", &other, &comment, 1.0, 1.0);
    let params = all_kinds();
    assert!(entry(&rank(&b.build(), &params, &network()).expect("ranks"), &comment).is_none());
    b.opinion("v", &parent, 1.0, 1.0);
    let entries = rank(&b.build(), &params, &network()).expect("ranks");
    let e = entry(&entries, &comment).expect("the genesis leg is ungated");
    assert_eq!(e.paths[0].nodes, vec!["prof:v", parent.as_str(), comment.as_str()]);
}

/// feed-ranking.md §9.4: the seen list removes candidates, never transit.
///
/// A seen node is no candidate, yet paths still cross it.
/// ´claim:properties:a-seen-node-still-transits´
#[test]
fn t_seen_transit_a_seen_node_still_transits() {
    let mut b = Builder::new("v");
    b.person("x");
    b.person("y");
    let seen_post = b.post("x", 1.0);
    let beyond = b.post("y", 1.0);
    b.opinion("v", &seen_post, 1.0, 1.0);
    b.hyper(Family::Reference, "x", &seen_post, &beyond, 1.0, 1.0);
    let params = RankParams {
        seen: vec![id_of(&seen_post)],
        ..RankParams::default()
    };
    let entries = rank(&b.build(), &params, &network()).expect("ranks");
    assert!(entry(&entries, &seen_post).is_none());
    assert!(entry(&entries, &beyond).is_some_and(|e| e.paths[0].nodes.contains(&seen_post)));
}

/// ranker-core D-d: the input order is irrelevant.
///
/// Shuffling the slice's nodes and records leaves the ranking bit-identical.
/// ´claim:properties:input-order-is-irrelevant´
#[test]
fn t_permute_input_order_is_irrelevant() {
    check(
        256,
        any_slice().prop_flat_map(|s| {
            let nodes = Just(s.nodes.clone()).prop_shuffle();
            let records = Just(s.records.clone()).prop_shuffle();
            (Just(s), nodes, records)
        }),
        |(slice, nodes, records)| {
            let shuffled = Slice { nodes, records, ..slice.clone() };
            prop_assert_eq!(
                format!("{:?}", rank(&slice, &all_kinds(), &network())),
                format!("{:?}", rank(&shuffled, &all_kinds(), &network()))
            );
            Ok(())
        },
    );
}

/// feed-ranking.md §2 "It never reads": the public input structs carry the
/// four inputs and nothing else. Each is destructured exhaustively, so a
/// new field fails to compile until this allowlist names it.
///
/// The ranker's input structs carry only the fields the published inputs name.
/// ´claim:properties:the-input-surface-is-the-allowlist´
#[test]
fn t_noai_the_input_surface_is_the_allowlist() {
    let slice = Builder::new("v").build();
    let Slice { as_of_epoch: _, viewer: _, nodes, records } = slice;
    for crate::input::SliceNode { graph_id: _, id: _, kind: _, genesis: _, statistics } in nodes {
        if let Some(TieStatistics { net_stance: _, gross_volume: _ }) = statistics {}
    }
    for SliceRecord { record_id: _, family: _, author: _, key, legs } in records {
        let CausalKey { landing_epoch: _, act_time: _, position: _ } = key;
        for crate::input::SliceLeg { role: _, source: _, target: _, p_d: _, p_i: _, tau: _, census_unknown: _ } in legs {}
    }
    let RankParams { kinds: _, topic: _, gamma: _, dust_floor: _, half_life_epochs: _, seen: _ } = RankParams::default();
    let NetworkParams { k: _, gamma: _, dust_floor: _, half_life_epochs: _, shape: _, tie_breakers: _ } = network();
    let SettlingCandidate { reference: _, author: _, family: _, p_d: _, p_i: _, authored_at: _ } = SettlingCandidate {
        reference: String::new(),
        author: String::new(),
        family: Family::Publish,
        p_d: 0.0,
        p_i: 0.0,
        authored_at: 0,
    };
}

/// ranker-core §6: the public surface stays inside UniFFI's type set — no
/// tuples, no 128-bit integers, no borrowed or generic records, no trait
/// objects, and none of common's types re-exported. The public items are
/// read from the source and held against the allowlist; every free function
/// and every public field is held against the type rules. Methods are Rust
/// conveniences UniFFI does not export from a record, so only their names
/// are inventoried.
///
/// The public surface stays inside the UniFFI type allowlist.
/// ´claim:properties:the-public-surface-is-ffi-clean´
#[test]
fn t_ffi_surface_is_ffi_clean() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let test_only = ["properties.rs", "reference.rs", "testkit.rs"];
    let mut public_lines = Vec::new();
    let mut exported = Vec::new();
    let mut entries: Vec<_> = std::fs::read_dir(&dir).expect("src").filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.file_name());
    for file in entries {
        let name = file.file_name().to_string_lossy().to_string();
        if test_only.contains(&name.as_str()) || name == "lib.rs" {
            continue;
        }
        let text = std::fs::read_to_string(file.path()).expect("readable");
        let body = text.split("#[cfg(test)]").next().unwrap_or_default();
        let mut enclosing = String::new();
        for line in body.lines() {
            let t = line.trim_start();
            let indented = line.starts_with(' ');
            if !indented && !t.is_empty() && !t.starts_with("//") && !t.starts_with('#') && !t.starts_with('}') {
                enclosing = t.to_string();
            }
            if !t.starts_with("pub ") || t.starts_with("pub use") {
                continue;
            }
            let public_item = enclosing.starts_with("pub struct") || enclosing.starts_with("pub enum");
            if !indented {
                public_lines.push(format!("{name}: {t}"));
                exported.push(format!("{name}: {t}"));
            } else if t.starts_with("pub fn") || t.starts_with("pub const") {
                if enclosing.starts_with("impl") {
                    public_lines.push(format!("{name}: {t}"));
                }
            } else if public_item {
                exported.push(format!("{name}: {t}"));
            }
        }
    }
    let forbidden = ["u128", "i128", "&'", "<'", "dyn ", "HashMap", "HashSet", "seam::", "common::"];
    for line in &exported {
        for f in forbidden {
            assert!(!line.contains(f), "{line} uses {f}");
        }
        let item = line.split_once(": ").map_or(line.as_str(), |(_, t)| t);
        let returns = item.split("->").nth(1).unwrap_or_default();
        assert!(!returns.trim_start().starts_with('('), "{line} returns a tuple");
        if !item.contains("fn ") {
            if let Some((_, field_type)) = item.split_once(": ") {
                assert!(!field_type.trim_start().starts_with('('), "{line} has a tuple field");
            }
        }
    }
    let items: BTreeSet<String> = public_lines
        .iter()
        .filter_map(|l| {
            let t = l.split(": ").nth(1)?;
            let mut words = t.split_whitespace();
            let kind = words.nth(1)?;
            let name = words.next()?.split(['(', '<', '{', ':', ';']).next()?;
            matches!(kind, "struct" | "enum" | "fn" | "const").then(|| format!("{kind} {name}"))
        })
        .collect();
    let allowed: BTreeSet<String> = [
        "const ALL", "const BETA", "const ETA", "enum Family", "enum LegRole", "enum NodeKind",
        "enum PeopleMark", "enum RankError", "enum RecencyShape", "enum SpotCheck", "enum TieBreakerKey",
        "fn coherence", "fn damped_weight", "fn determinant", "fn epoch_age", "fn feed_ranking",
        "fn fold_members", "fn from_parameter", "fn from_wire", "fn is_inert", "fn maturity_gain",
        "fn parameter_name", "fn parity", "fn path_view", "fn rank", "fn rank_search", "fn recency_factor",
        "fn roles", "fn score_target", "fn spot_check", "fn temporal_entropy", "fn wire_name",
        "struct CausalKey", "struct FeedEntry", "struct FeedRanking", "struct Folded", "struct HopMember",
        "struct Member", "struct NetworkParams", "struct PathView", "struct RankHop", "struct RankParams",
        "struct RankPath", "struct RankedEntry", "struct SettlingCandidate", "struct SettlingPlace",
        "struct Slice", "struct SliceLeg", "struct SliceNode", "struct SliceRecord", "struct TieBreakers",
        "struct TieStatistics",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    assert_eq!(items, allowed);
}

/// ranked-feed-api X-2: a node CoGra carries no row for still transits and
/// is never a candidate.
///
/// A row-less node transits and is never a candidate.
/// ´claim:properties:a-row-less-node-transits-and-is-never-a-candidate´
#[test]
fn a_row_less_node_transits_and_is_never_a_candidate() {
    let mut b = Builder::new("v");
    b.person("x");
    let ghost = b.rowless("mint:act:x:900:publish");
    let beyond = b.post("x", 1.0);
    b.opinion("v", &ghost, 1.0, 1.0);
    b.hyper(Family::Reference, "x", &ghost, &beyond, 1.0, 1.0);
    let entries = rank(&b.build(), &all_kinds(), &network()).expect("ranks");
    assert!(entries.iter().all(|e| e.target_graph_id != ghost));
    assert!(entry(&entries, &beyond).is_some_and(|e| e.paths[0].nodes.contains(&ghost)));
}

fn topic_params(topic: &str) -> RankParams {
    RankParams {
        topic: Some(id_of(topic)),
        ..RankParams::default()
    }
}

/// ranked-feed-api X-3, hashtag.md §4–§5: the author's own tag admits.
///
/// A topic admits content its own author tagged toward it.
/// ´claim:topic:the-authors-own-tag-admits´
#[test]
fn a_topic_admits_the_authors_own_tag() {
    let mut b = Builder::new("v");
    b.person("x");
    let topic = b.topic("rust");
    let p = b.post("x", 1.0);
    let q = b.post("x", 1.0);
    b.opinion("v", "prof:x", 1.0, 1.0);
    b.hyper(Family::Tag, "x", &p, &topic, 1.0, 1.0);
    let entries = rank(&b.build(), &topic_params(&topic), &network()).expect("ranks");
    assert!(entry(&entries, &p).is_some());
    assert!(entry(&entries, &q).is_none());
}

/// A third party's tag admits when the viewer reaches the tagger.
///
/// A topic admits a third party's tag when a live path reaches the tagger.
/// ´claim:topic:a-reachable-taggers-tag-admits´
#[test]
fn a_topic_admits_a_reachable_taggers_tag() {
    let mut b = Builder::new("v");
    b.person("x");
    b.person("tagger");
    let topic = b.topic("rust");
    let p = b.post("x", 1.0);
    b.opinion("v", &p, 1.0, 1.0);
    b.opinion("v", "prof:tagger", 1.0, 1.0);
    b.hyper(Family::Tag, "tagger", &p, &topic, 1.0, 1.0);
    let entries = rank(&b.build(), &topic_params(&topic), &network()).expect("ranks");
    assert!(entry(&entries, &p).is_some());
}

/// An unreachable stranger's tag never admits.
///
/// A topic never admits an unreachable stranger's tag.
/// ´claim:topic:an-unreachable-strangers-tag-never-admits´
#[test]
fn a_topic_never_admits_an_unreachable_strangers_tag() {
    let mut b = Builder::new("v");
    b.person("x");
    b.person("stranger");
    let topic = b.topic("rust");
    let p = b.post("x", 1.0);
    b.opinion("v", &p, 1.0, 1.0);
    b.hyper(Family::Tag, "stranger", &p, &topic, 1.0, 1.0);
    let entries = rank(&b.build(), &topic_params(&topic), &network()).expect("ranks");
    assert!(entries.is_empty());
}

/// Relevance 0 reads as withdrawn.
///
/// A tag withdrawn at relevance zero admits nothing.
/// ´claim:topic:a-withdrawn-tag-admits-nothing´
#[test]
fn a_withdrawn_tag_at_relevance_zero_admits_nothing() {
    let mut b = Builder::new("v");
    b.person("x");
    let topic = b.topic("rust");
    let p = b.post("x", 1.0);
    b.opinion("v", &p, 1.0, 1.0);
    b.hyper(Family::Tag, "x", &p, &topic, 1.0, 1.0);
    b.hyper(Family::Tag, "x", &p, &topic, 0.0, 1.0);
    let entries = rank(&b.build(), &topic_params(&topic), &network()).expect("ranks");
    assert!(entries.is_empty());
}

/// The topic fold is newest-wins: re-tagging after a withdrawal admits
/// again, where a sum of relevances would have stayed at zero.
///
/// The topic fold takes the newest tag, never a sum.
/// ´claim:topic:the-fold-is-newest-wins´
#[test]
fn the_topic_fold_is_newest_wins_not_summed() {
    let mut b = Builder::new("v");
    b.person("x");
    let topic = b.topic("rust");
    let p = b.post("x", 1.0);
    b.opinion("v", &p, 1.0, 1.0);
    b.hyper(Family::Tag, "x", &p, &topic, 0.5, 1.0);
    b.hyper(Family::Tag, "x", &p, &topic, -0.5, 1.0);
    let entries = rank(&b.build(), &topic_params(&topic), &network()).expect("ranks");
    assert!(entry(&entries, &p).is_some(), "a sum would read 0, the newest reads -0.5");
}

/// Two targets that tie on `S` exactly: one person reaching each over the
/// same parameters, maturity and epoch.
fn tied(b: &mut Builder) -> (String, String) {
    b.person("x");
    b.person("y");
    let first = b.post("x", 1.0);
    let second = b.post("y", 1.0);
    b.epoch = 5;
    b.opinion("v", &first, 1.0, 1.0);
    b.opinion("v", &second, 1.0, 1.0);
    (first, second)
}

/// ranked-feed-api X-5, feed-ranking.md §7: on strict equality the governed
/// composition decides key by key — net stance, then gross volume, then
/// genesis recency.
///
/// Equal scores break by net stance, then gross volume, then genesis recency, in the governed order.
/// ´claim:rank:equal-scores-break-by-the-governed-composition´
#[test]
fn equal_scores_break_by_net_stance_then_gross_volume_then_genesis_recency() {
    let mut b = Builder::new("v");
    let (older, newer) = tied(&mut b);
    let mut slice = b.build();
    let net = NetworkParams {
        tie_breakers: vec![TieBreakerKey::NetStance, TieBreakerKey::GrossVolume, TieBreakerKey::Recency],
        ..network()
    };
    let set = |slice: &mut Slice, id: &str, n: f64, g: f64| {
        if let Some(node) = slice.nodes.iter_mut().find(|x| x.graph_id == id) {
            node.statistics = Some(TieStatistics { net_stance: n, gross_volume: g });
        }
    };
    let order = |slice: &Slice| -> Vec<String> {
        rank(slice, &RankParams::default(), &net)
            .expect("ranks")
            .into_iter()
            .map(|e| e.target_graph_id)
            .collect()
    };
    set(&mut slice, &older, 2.0, 1.0);
    set(&mut slice, &newer, 1.0, 9.0);
    assert_eq!(order(&slice), vec![older.clone(), newer.clone()], "net stance first");
    set(&mut slice, &older, 1.0, 3.0);
    set(&mut slice, &newer, 1.0, 2.0);
    assert_eq!(order(&slice), vec![older.clone(), newer.clone()], "then gross volume");
    set(&mut slice, &older, 1.0, 2.0);
    assert_eq!(order(&slice), vec![newer.clone(), older.clone()], "then the newer genesis");
    if let Some(node) = slice.nodes.iter_mut().find(|x| x.graph_id == older) {
        node.statistics = None;
    }
    assert!(matches!(
        rank(&slice, &RankParams::default(), &net),
        Err(RankError::MalformedSlice { .. })
    ));
    let seeded = rank(&slice, &RankParams::default(), &network()).expect("the seed names no statistic");
    assert!(seeded.iter().all(|e| e.tie_breakers.net_stance.is_none() && e.tie_breakers.gross_volume.is_none()));
}

/// feed-ranking.md §7: "An update record never refreshes it."
///
/// An update to a target never refreshes its genesis recency.
/// ´claim:rank:an-update-never-refreshes-genesis-recency´
#[test]
fn an_update_record_never_refreshes_genesis_recency() {
    let mut b = Builder::new("v");
    let (older, newer) = tied(&mut b);
    b.epoch = 9;
    b.binary(Family::Publish, "x", &older, 1.0, 1.0);
    let slice = b.build();
    let order: Vec<String> = ranked(&slice).into_iter().map(|e| e.target_graph_id).collect();
    let position = |id: &str| order.iter().position(|x| x == id);
    let (o, n) = (score(&slice, &older), score(&slice, &newer));
    assert_eq!(o.map(f64::to_bits), n.map(f64::to_bits), "still tied: an update is no stance hop of the viewer's");
    assert!(position(&newer) < position(&older));
}

/// The display age is the genesis record's, not the newest terminal's.
///
/// The genesis epoch age reads the target's genesis record, not its newest terminal record.
/// ´claim:rank:genesis-age-reads-the-genesis-record´
#[test]
fn genesis_epoch_age_reads_the_targets_genesis_record_not_its_newest_terminal() {
    let mut b = Builder::new("v");
    b.person("x");
    b.epoch = 2;
    let p = b.post("x", 1.0);
    b.epoch = 9;
    b.opinion("v", &p, 1.0, 1.0);
    let e = ranked(&b.build());
    assert_eq!(entry(&e, &p).expect("reached").tie_breakers.genesis_epoch_age, Some(8));
}

/// ranked-feed-api X-6: a census-unknown leg is never folded and never
/// walked.
///
/// A census-unknown leg never folds and never transits.
/// ´claim:graph:a-census-unknown-leg-never-folds-or-transits´
#[test]
fn a_census_unknown_leg_never_folds_or_transits() {
    let mut b = Builder::new("v");
    b.person("x");
    let p = b.post("x", 1.0);
    b.opinion("v", "prof:x", 1.0, 1.0);
    b.census_unknown_last();
    assert!(entry(&ranked(&b.build()), &p).is_none());
    b.opinion("v", &p, 0.5, 0.5);
    let before = score(&b.build(), &p);
    b.opinion("v", &p, -0.5, -0.5);
    b.census_unknown_last();
    assert_eq!(score(&b.build(), &p).map(f64::to_bits), before.map(f64::to_bits));
}

fn marks(slice: &Slice) -> Vec<(String, Option<PeopleMark>)> {
    feed_ranking(slice, &all_kinds(), &network(), &[])
        .expect("ranks")
        .entries
        .into_iter()
        .map(|e| (e.entry.target_graph_id, e.mark))
        .collect()
}

/// ranked-feed-api §5.4 (OS-18 S1): the mark is the sign of the viewer's own
/// folded Opinion → Profile bundle toward the row's person.
///
/// A row is marked for, against or signless by the viewer's folded opinion of its person, and unmarked when that bundle is absent or netted.
/// ´claim:view:a-row-is-marked-by-the-viewers-folded-opinion´
#[test]
fn a_row_is_marked_by_the_viewers_folded_opinion_of_its_person() {
    for (p_d, p_i, want) in [
        (0.5, 0.5, Some(PeopleMark::For)),
        (-0.5, 0.5, Some(PeopleMark::Against)),
        (0.0, 0.5, Some(PeopleMark::Signless)),
    ] {
        let mut b = Builder::new("v");
        b.person("x");
        let p = b.post("x", 1.0);
        b.opinion("v", &p, 1.0, 1.0);
        b.opinion("v", "prof:x", p_d, p_i);
        let m = marks(&b.build());
        assert!(m.contains(&(p.clone(), want)), "{p_d}, {p_i}");
        if p_d != 0.0 {
            assert!(m.contains(&("prof:x".to_string(), want)), "a profile row by its own person");
        }
    }
    let mut b = Builder::new("v");
    b.person("x");
    let p = b.post("x", 1.0);
    b.opinion("v", &p, 1.0, 1.0);
    assert!(marks(&b.build()).contains(&(p.clone(), None)), "never stanced");
    b.opinion("v", "prof:x", 0.5, 0.5);
    b.opinion("v", "prof:x", -0.5, -0.5);
    assert!(marks(&b.build()).contains(&(p.clone(), None)), "netted to (0, 0)");
    b.opinion("v", "prof:x", 0.5, 0.5);
    b.census_unknown_last();
    assert!(marks(&b.build()).contains(&(p, None)), "a census-unknown leg never moves a mark");
}

/// PR-44: a Tags row belongs to no one; a comment's person is its genesis
/// author.
///
/// A tags row is never marked, and a comment row is marked by its genesis author.
/// ´claim:view:tags-rows-are-never-marked´
#[test]
fn a_tags_row_never_carries_a_mark() {
    let mut b = Builder::new("v");
    b.person("x");
    b.person("y");
    let topic = b.topic("rust");
    let p = b.post("y", 1.0);
    let c = b.comment("x", &p, 1.0, 1.0);
    b.binary(Family::Affinity, "v", &topic, 1.0, 1.0);
    b.opinion("v", &p, 1.0, 1.0);
    b.opinion("v", "prof:x", -1.0, 1.0);
    b.opinion("v", "prof:y", 1.0, 1.0);
    let m = marks(&b.build());
    assert!(m.contains(&(topic, None)));
    assert!(m.contains(&(c, Some(PeopleMark::Against))));
    assert!(m.contains(&(p, Some(PeopleMark::For))));
}

/// ranked-feed-api §4.10: NEWEST orders by genesis causal key, newest first,
/// a Type after every dated target in its RANKED order; the indices are a
/// permutation; neither marks nor the permutation ever reorder `entries`.
///
/// The NEWEST indices permute the entries by genesis key, newest first, Types last in ranked order, leaving the entries array the neutral rank.
/// ´claim:view:newest-permutes-by-genesis-key´
#[test]
fn the_newest_index_orders_by_genesis_causal_key_descending() {
    check(256, any_slice(), |slice| {
        let answer = feed_ranking(&slice, &all_kinds(), &network(), &[]).expect("ranks");
        let plain = rank(&slice, &all_kinds(), &network()).expect("ranks");
        let entries: Vec<FeedEntry> = answer.entries.iter().map(|e| e.entry.clone()).collect();
        prop_assert_eq!(format!("{entries:?}"), format!("{plain:?}"));
        let mut by_newest = vec![None; entries.len()];
        for (i, e) in answer.entries.iter().enumerate() {
            let slot = &mut by_newest[e.newest_index as usize];
            prop_assert!(slot.is_none(), "a permutation");
            *slot = Some(i);
        }
        let order: Vec<usize> = by_newest.into_iter().map(|s| s.expect("every index used")).collect();
        let genesis = |i: usize| {
            slice
                .nodes
                .iter()
                .find(|n| n.graph_id == entries[i].target_graph_id)
                .and_then(|n| n.genesis)
        };
        for pair in order.windows(2) {
            match (genesis(pair[0]), genesis(pair[1])) {
                (Some(a), Some(b)) => prop_assert!(a > b),
                (None, Some(_)) => prop_assert!(false, "a Type before a dated target"),
                (None, None) => prop_assert!(pair[0] < pair[1], "Types keep their ranked order"),
                (Some(_), None) => {}
            }
        }
        Ok(())
    });
}

fn settling(reference: &str, author: &str, p: f64, at: i64) -> SettlingCandidate {
    SettlingCandidate {
        reference: reference.to_string(),
        author: format!("prof:{author}"),
        family: Family::Publish,
        p_d: p,
        p_i: 1.0,
        authored_at: at,
    }
}

/// ranked-feed-api X-8′ and W-2: the key is the author's reach times the
/// pending record's own landing factor; a key tied with a landed score
/// stands after it; the weave never moves a landed entry; an unreached
/// author gets no place; the viewer's own content is reached over the empty
/// walk.
///
/// A settling row is keyed by its author's reach times its own landing factor and stands after every landed entry scoring at least that key.
/// ´claim:view:a-settling-key-places-the-row-after-the-landed-entries-at-or-above-it´
#[test]
fn a_settling_key_is_the_authors_reach_times_its_own_edge_factor() {
    let mut b = Builder::new("v");
    b.person("a");
    b.person("stranger");
    b.person("netted");
    b.epoch = 10;
    b.tau = 0.0;
    b.opinion("v", "prof:a", 1.0, 1.0);
    b.opinion("v", "prof:netted", 0.5, 0.5);
    b.opinion("v", "prof:netted", -0.5, -0.5);
    let landed = b.post("a", 1.0);
    let slice = b.build();
    let reach = score(&slice, "prof:a").expect("a is reached");
    let factor = w(Family::Publish, LegRole::Binary, 1.0, 1.0, 0.0);
    assert_eq!(score(&slice, &landed).map(f64::to_bits), Some((reach * factor).to_bits()));
    let answer = feed_ranking(
        &slice,
        &all_kinds(),
        &network(),
        &[
            settling("tie", "a", 1.0, 5),
            settling("low", "a", 0.1, 4),
            settling("mine", "v", 1.0, 3),
            settling("unreached", "stranger", 1.0, 2),
            settling("severed", "netted", 1.0, 1),
        ],
    )
    .expect("weaves");
    let place = |r: &str| answer.settling.iter().find(|p| p.reference == r);
    assert!(place("unreached").is_none() && place("severed").is_none());
    let landed_at = answer.entries.iter().position(|e| e.entry.target_graph_id == landed).expect("landed");
    let woven: Vec<u32> = answer.settling.iter().map(|p| p.ranked_position).collect();
    let landed_position = (0..answer.entries.len() + woven.len())
        .filter(|i| !woven.contains(&(*i as u32)))
        .nth(landed_at)
        .expect("a slot");
    assert!(place("tie").expect("keyed").ranked_position as usize > landed_position, "ties go to the landed row");
    assert!(place("low").expect("keyed").ranked_position > place("tie").expect("keyed").ranked_position);
    let mine = place("mine").expect("the viewer reaches themself");
    assert_eq!(
        mine.ranked_position, 1,
        "S(u,u)·φ = φ ties the viewer's one-hop reach to a, and the tie goes to the landed row"
    );
    assert_eq!(
        answer.settling.iter().map(|p| p.newest_position).collect::<BTreeSet<_>>(),
        (0..answer.settling.len() as u32).collect::<BTreeSet<_>>(),
        "every settling row stands ahead of every landed row under NEWEST"
    );
    assert_eq!(place("tie").expect("keyed").newest_position, 0, "newest authored first");
}

/// W-2's in-gap order (PR-66): equal keys break by the newest authoring
/// instant, then the reference.
///
/// Settling rows in one gap order by key, then newest authoring instant, then reference.
/// ´claim:view:settling-rows-in-one-gap-order-by-key-then-instant-then-reference´
#[test]
fn equal_settling_keys_break_by_authored_at_then_id() {
    let mut b = Builder::new("v");
    b.person("a");
    b.opinion("v", "prof:a", 1.0, 1.0);
    let slice = b.build();
    let answer = feed_ranking(
        &slice,
        &all_kinds(),
        &network(),
        &[settling("b", "a", 1.0, 7), settling("a", "a", 1.0, 7), settling("c", "a", 1.0, 9)],
    )
    .expect("weaves");
    let order: Vec<&str> = {
        let mut rows: Vec<_> = answer.settling.iter().collect();
        rows.sort_by_key(|p| p.ranked_position);
        rows.into_iter().map(|p| p.reference.as_str()).collect()
    };
    assert_eq!(order, vec!["c", "a", "b"]);
    assert!(
        answer.settling.iter().all(|p| p.mark == Some(PeopleMark::For)),
        "a settling row is marked by its author"
    );
}

/// X-8′: no candidates, no places; an out-of-range parameter, a repeated
/// reference, or a family the feed never walks is the caller's bad input.
///
/// No settling candidates return no places, and a malformed candidate is bad input.
/// ´claim:view:malformed-settling-candidates-are-bad-input´
#[test]
fn an_out_of_range_candidate_parameter_is_bad_input() {
    let slice = Builder::new("v").build();
    let run = |c: &[SettlingCandidate]| feed_ranking(&slice, &RankParams::default(), &network(), c);
    assert!(run(&[]).expect("empty").settling.is_empty());
    assert!(matches!(run(&[settling("x", "v", 1.5, 0)]), Err(RankError::BadInput { .. })));
    assert!(matches!(run(&[settling("x", "v", 1.0, 0), settling("x", "v", 1.0, 1)]), Err(RankError::BadInput { .. })));
    let mut leave = settling("x", "v", 1.0, 0);
    leave.family = Family::Leave;
    assert!(matches!(run(&[leave]), Err(RankError::BadInput { .. })));
}

/// The woven lists over random slices and candidates (W-1..W-4): landed rows
/// keep their order in both lists, every position set indexes its list
/// exactly once, and a landed id never repeats as a settling row.
///
/// Both woven lists keep the landed rows in order and index every slot exactly once.
/// ´claim:view:the-weave-never-moves-a-landed-entry´
#[test]
fn the_weave_never_moves_a_landed_entry() {
    let candidates = prop::collection::vec((0usize..6, prop::sample::select(vec![-1.0, 0.25, 1.0]), 0i64..4), 0..6);
    check(256, (any_slice(), candidates), |(slice, picks)| {
        let people: Vec<String> = slice.nodes.iter().filter(|n| n.graph_id.starts_with("prof:")).map(|n| n.graph_id.clone()).collect();
        let mut cands: Vec<SettlingCandidate> = picks
            .iter()
            .enumerate()
            .map(|(i, (who, p, at))| SettlingCandidate {
                reference: format!("pending/{i}"),
                author: people[who % people.len()].clone(),
                family: Family::Publish,
                p_d: *p,
                p_i: 1.0,
                authored_at: *at,
            })
            .collect();
        if let Some(n) = slice.nodes.iter().find(|n| n.kind == Some(NodeKind::Post)) {
            cands.push(SettlingCandidate { reference: n.id.clone().unwrap_or_default(), ..settling("", "p0", 1.0, 0) });
        }
        let answer = feed_ranking(&slice, &RankParams::default(), &network(), &cands).expect("weaves");
        let total = answer.entries.len() + answer.settling.len();
        let landed_ids: BTreeSet<&str> = answer.entries.iter().map(|e| e.entry.target_id.as_str()).collect();
        prop_assert!(answer.settling.iter().all(|p| !landed_ids.contains(p.reference.as_str())));
        for positions in [
            answer.settling.iter().map(|p| p.ranked_position).collect::<Vec<_>>(),
            answer.settling.iter().map(|p| p.newest_position).collect::<Vec<_>>(),
        ] {
            let set: BTreeSet<u32> = positions.iter().copied().collect();
            prop_assert_eq!(set.len(), positions.len());
            prop_assert!(positions.iter().all(|&p| (p as usize) < total));
        }
        let mut newest_set: Vec<u32> = answer.settling.iter().map(|p| p.newest_position).collect();
        newest_set.sort_unstable();
        prop_assert_eq!(newest_set, (0..answer.settling.len() as u32).collect::<Vec<_>>());
        for pair in answer.entries.windows(2) {
            prop_assert!(pair[1].entry.score <= pair[0].entry.score);
        }
        Ok(())
    });
}

/// ranker-core §7.3: an honest ranking passes the spot-check; every
/// tampering is caught by name — a flipped contribution, two entries
/// swapped, a dropped path, a hop whose fold disagrees with its own records.
///
/// The spot-check accepts an honest ranking and names the field of every tampering.
/// ´claim:spot:honest-passes-and-tampering-is-named´
#[test]
fn spot_check_accepts_honest_and_flags_tampered() {
    check(128, any_slice(), |slice| {
        let params = all_kinds();
        let honest = rank(&slice, &params, &network()).expect("ranks");
        let sample: Vec<String> = honest.iter().take(5).map(|e| e.target_id.clone()).collect();
        prop_assert_eq!(spot_check(&slice, &params, &network(), &honest, &sample).expect("checks"), SpotCheck::Clean);
        if honest.is_empty() {
            return Ok(());
        }
        let flagged = |claimed: &[FeedEntry], sample: &[String]| {
            !matches!(spot_check(&slice, &params, &network(), claimed, sample).expect("checks"), SpotCheck::Clean)
        };
        let mut flipped = honest.clone();
        flipped[0].paths[0].contribution = -flipped[0].paths[0].contribution - 1.0;
        prop_assert!(flagged(&flipped, &sample));
        let mut dropped = honest.clone();
        dropped[0].paths.pop();
        prop_assert!(flagged(&dropped, &sample));
        let mut refolded = honest.clone();
        refolded[0].paths[0].hops[0].p_directed = 0.123;
        prop_assert!(flagged(&refolded, &sample));
        if honest.len() >= 2 && honest[0].score != honest[1].score {
            let mut swapped = honest.clone();
            swapped.swap(0, 1);
            prop_assert!(flagged(&swapped, &sample));
        }
        Ok(())
    });
}

/// ranker-core §5: the viewer's calibration overrides are range-checked
/// by name.
///
/// An out-of-range gamma, dust floor or half-life is refused as bad input naming the field.
/// ´claim:rank:out-of-range-overrides-are-bad-input´
#[test]
fn bad_input_names_the_parameter() {
    let slice = Builder::new("v").build();
    let field = |params: RankParams| match rank(&slice, &params, &network()) {
        Err(RankError::BadInput { field, .. }) => field,
        other => panic!("expected bad input, got {other:?}"),
    };
    for g in [0.0, -0.5, 1.5, f64::NAN] {
        assert_eq!(field(RankParams { gamma: Some(g), ..RankParams::default() }), "gamma");
    }
    assert_eq!(field(RankParams { dust_floor: Some(-1.0), ..RankParams::default() }), "dustFloor");
    assert_eq!(field(RankParams { dust_floor: Some(0.5), ..RankParams::default() }), "dustFloor");
    assert_eq!(field(RankParams { half_life_epochs: Some(-1), ..RankParams::default() }), "recencyHalfLifeEpochs");
    let bad_net = NetworkParams { tie_breakers: vec![TieBreakerKey::Recency, TieBreakerKey::Recency], ..network() };
    assert!(matches!(rank(&slice, &RankParams::default(), &bad_net), Err(RankError::NetworkParameters { .. })));
}

/// ranker-core §3.9: a family whose traversal needs an L2 fold this ranker
/// does not build is refused loudly, never skipped.
///
/// A slice holding a chat or invitation family record is refused by name, never skipped.
/// ´claim:graph:unsupported-families-error-loudly´
#[test]
fn unsupported_family_errors_loudly() {
    for family in [Family::Participant, Family::Invitation, Family::DeInvite] {
        let mut b = Builder::new("v");
        b.person("x");
        let chat = b.rowless("mint:act:x:77:participant");
        b.hyper(family, "x", &chat, "prof:v", 1.0, 1.0);
        assert!(matches!(
            rank(&b.build(), &RankParams::default(), &network()),
            Err(RankError::UnsupportedFamily { family: f, .. }) if f == family
        ));
    }
}

/// ranker-core §5: a slice breaking its own contract is refused.
///
/// A slice naming a node it lacks, repeating a record, or reusing a causal key is refused as malformed.
/// ´claim:graph:a-malformed-slice-is-refused´
#[test]
fn malformed_slice_errors() {
    let mut b = Builder::new("v");
    b.person("x");
    b.opinion("v", "prof:x", 1.0, 1.0);
    let good = b.build();
    let malformed = |s: Slice| matches!(rank(&s, &RankParams::default(), &network()), Err(RankError::MalformedSlice { .. }));
    let mut absent = good.clone();
    absent.records[0].legs[0].target = "prof:nobody".into();
    assert!(malformed(absent));
    let mut twice = good.clone();
    twice.records.push(good.records[0].clone());
    assert!(malformed(twice));
    let mut same_key = good.clone();
    let mut copy = good.records[0].clone();
    copy.record_id = "act:v:99:opinion".into();
    same_key.records.push(copy);
    assert!(malformed(same_key));
    let mut no_viewer = good.clone();
    no_viewer.viewer = "id/nobody".into();
    assert!(malformed(no_viewer));
    let mut out_of_range = good;
    out_of_range.records[0].legs[0].p_d = 2.0;
    assert!(malformed(out_of_range));
}

/// The rank, rank_search and score_target entry points agree: a search over
/// every candidate is the feed over every kind, and one target alone is its
/// own entry, bit for bit.
///
/// Ranking, search re-ranking and scoring one target alone agree bit for bit.
/// ´claim:rank:the-entry-points-agree´
#[test]
fn score_target_equals_the_entry() {
    check(128, any_slice(), |slice| {
        let params = all_kinds();
        let entries = rank(&slice, &params, &network()).expect("ranks");
        let ids: Vec<String> = slice.nodes.iter().filter_map(|n| n.id.clone()).collect();
        let searched = rank_search(&slice, &ids, &params, &network()).expect("ranks");
        prop_assert_eq!(format!("{entries:?}"), format!("{searched:?}"));
        for e in &entries {
            let alone = score_target(&slice, &e.target_id, &params, &network()).expect("ranks");
            prop_assert_eq!(format!("{:?}", Some(e)), format!("{:?}", alone.as_ref()));
        }
        Ok(())
    });
}
