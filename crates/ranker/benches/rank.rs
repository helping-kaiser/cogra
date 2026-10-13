//! The ranker's measured budgets (ranker-core §7.4): fold and graph build,
//! `rank` over every candidate, `score_target` for one, and `spot_check`
//! over five, at 1 000, 50 000 and 500 000 slice records.
//!
//! A plain `harness = false` bench on stable Rust: a seeded xorshift builds
//! the same synthetic slice every run, and each row reports the median and
//! the minimum of its repetitions. Run with
//! `cargo bench -p ranker --bench rank` (release profile); pass a size
//! (`S`, `M`, `L`) to run one, and `RANKER_BENCH_SKIP_RANK_ALL=1` to skip
//! the all-candidates row where it would run for hours.
//!
//! # Measured budgets
//!
//! Recorded in the RK-2 lane report and the ranker-core packet; a later run
//! over budget is a finding, not absorbed.

use std::collections::BTreeMap;
use std::time::Instant;

use ranker::{
    CausalKey, Family, LegRole, NetworkParams, NodeKind, RankParams, RecencyShape, Slice, SliceLeg,
    SliceNode, SliceRecord, TieBreakerKey, rank, score_target, spot_check,
};

/// A deterministic xorshift64*: the same slice every run, no dependency.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
    fn param(&mut self) -> f64 {
        [-1.0, -0.5, 0.25, 0.5, 0.75, 1.0][self.below(6)]
    }
}

/// A social-shaped slice of about `records` records: people, one post
/// each, follows between people, opinions on posts, comments and tags.
fn slice(records: usize) -> Slice {
    let mut rng = Rng(0x0C06_4A5E_2026_1013);
    let people = (records / 10).max(10);
    let mut nodes: BTreeMap<String, SliceNode> = BTreeMap::new();
    let mut out: Vec<SliceRecord> = Vec::with_capacity(records);
    let mut clock = 0i64;
    let mut seq = vec![0u64; people];
    let mut key = |epoch: i64| {
        clock += 1;
        CausalKey {
            landing_epoch: epoch,
            act_time: clock,
            position: clock,
        }
    };
    let id = |g: &str| format!("id/{g}");
    for p in 0..people {
        let g = format!("prof:p{p}");
        nodes.insert(g.clone(), SliceNode { graph_id: g.clone(), id: Some(id(&g)), kind: Some(NodeKind::User), genesis: Some(key(0)), statistics: None });
    }
    let leg = |role, s: String, t: String, p_d, p_i, tau| SliceLeg { role, source: s, target: t, p_d, p_i, tau, census_unknown: false };
    let mut posts = Vec::with_capacity(people);
    for p in 0..people {
        seq[p] += 1;
        let record = format!("act:p{p}:{}:publish", seq[p]);
        let g = format!("mint:{record}");
        let k = key((p % 20) as i64);
        nodes.insert(g.clone(), SliceNode { graph_id: g.clone(), id: Some(id(&g)), kind: Some(NodeKind::Post), genesis: Some(k), statistics: None });
        out.push(SliceRecord { record_id: record, family: Family::Publish, author: format!("p{p}"), key: k, legs: vec![leg(LegRole::Binary, format!("addr:p{p}"), g.clone(), 1.0, 1.0, 0.5)] });
        posts.push(g);
    }
    let types: Vec<String> = (0..20).map(|t| format!("name:t{t}")).collect();
    for t in &types {
        nodes.insert(t.clone(), SliceNode { graph_id: t.clone(), id: Some(id(t)), kind: Some(NodeKind::Hashtag), genesis: None, statistics: None });
    }
    while out.len() < records {
        let a = rng.below(people);
        let epoch = rng.below(20) as i64;
        let tau = [0.0, 0.3, 0.6, 0.9][rng.below(4)];
        seq[a] += 1;
        let author = format!("p{a}");
        let roll = rng.below(10);
        let (family, legs) = if roll < 5 {
            let b = rng.below(people);
            (Family::Opinion, vec![leg(LegRole::Binary, format!("addr:{author}"), format!("prof:p{b}"), rng.param(), rng.param(), tau)])
        } else if roll < 8 {
            let post = posts[rng.below(posts.len())].clone();
            (Family::Opinion, vec![leg(LegRole::Binary, format!("addr:{author}"), post, rng.param(), rng.param(), tau)])
        } else if roll < 9 {
            let post = posts[rng.below(posts.len())].clone();
            let t = types[rng.below(types.len())].clone();
            let (r, c) = (rng.param(), [0.5, 1.0][rng.below(2)]);
            (Family::Tag, vec![leg(LegRole::A, format!("addr:{author}"), post.clone(), r, c, tau), leg(LegRole::T, post, t, c, r, tau)])
        } else {
            let parent = posts[rng.below(posts.len())].clone();
            let record = format!("act:{author}:{}:review", seq[a]);
            let comment = format!("mint:{record}");
            let k = key(epoch);
            nodes.insert(comment.clone(), SliceNode { graph_id: comment.clone(), id: Some(id(&comment)), kind: Some(NodeKind::Comment), genesis: Some(k), statistics: None });
            let (p_d, p_i) = (rng.param(), rng.param());
            out.push(SliceRecord { record_id: record, family: Family::Review, author: author.clone(), key: k, legs: vec![leg(LegRole::A, format!("addr:{author}"), parent.clone(), p_d, p_i, tau), leg(LegRole::T, parent, comment, p_i, p_d, tau)] });
            continue;
        };
        let token = if family == Family::Tag { "tag" } else { "opinion" };
        out.push(SliceRecord { record_id: format!("act:{author}:{}:{token}", seq[a]), family, author, key: key(epoch), legs });
    }
    Slice { as_of_epoch: 20, viewer: id("prof:p0"), nodes: nodes.into_values().collect(), records: out }
}

fn network() -> NetworkParams {
    NetworkParams { k: 8, gamma: 1.0, dust_floor: 0.0, half_life_epochs: 30, shape: RecencyShape::Exponential, tie_breakers: vec![TieBreakerKey::Recency] }
}

/// Runs `f` `reps` times and prints the median and the minimum.
fn measure(row: &str, size: &str, reps: usize, mut f: impl FnMut()) {
    let mut times: Vec<f64> = (0..reps)
        .map(|_| {
            let start = Instant::now();
            f();
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    times.sort_by(f64::total_cmp);
    println!("{row:<40} {size:<3} median {:>12.1} ms   min {:>12.1} ms   (n={reps})", times[reps / 2], times[0]);
}

fn main() {
    let wanted: Vec<String> = std::env::args().skip(1).filter(|a| !a.starts_with('-')).collect();
    let skip_all = std::env::var_os("RANKER_BENCH_SKIP_RANK_ALL").is_some();
    for (size, records, reps) in [("S", 1_000usize, 7usize), ("M", 50_000, 3), ("L", 500_000, 1)] {
        if !wanted.is_empty() && !wanted.iter().any(|w| w == size) {
            continue;
        }
        let s = slice(records);
        println!("{size}: {} records, {} nodes", s.records.len(), s.nodes.len());
        let none = RankParams { kinds: Some(Vec::new()), ..RankParams::default() };
        let net = network();
        measure("fold + graph build", size, reps, || {
            let _ = rank(&s, &none, &net);
        });
        let target = s.nodes.iter().find(|n| n.kind == Some(NodeKind::Post) && n.graph_id.contains(":p1:")).and_then(|n| n.id.clone()).unwrap_or_default();
        measure("score_target (one candidate)", size, reps, || {
            let _ = score_target(&s, &target, &RankParams::default(), &net);
        });
        let entries = if skip_all {
            Vec::new()
        } else {
            let mut held = Vec::new();
            measure("rank (k = 8, all candidates)", size, reps, || {
                held = rank(&s, &RankParams::default(), &net).unwrap_or_default();
            });
            println!("{:<40} {size:<3} {} entries", "", held.len());
            held
        };
        let sample: Vec<String> = s.nodes.iter().filter(|n| n.kind == Some(NodeKind::Post)).take(5).filter_map(|n| n.id.clone()).collect();
        measure("spot_check (5 targets)", size, reps, || {
            let _ = spot_check(&s, &RankParams::default(), &net, &entries, &sample);
        });
    }
}
