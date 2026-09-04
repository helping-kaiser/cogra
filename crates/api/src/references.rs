//! ´mod:module:references´
//!
//! Citations — the Reference act (edges.md §3; layer1-interface.md §9.6): a
//! hyper-edge Actor → citing artifact → cited target, one priced act per
//! citation, staged either inside a content-creation batch or on its own.
//!
//! One family covers all three gestures — quoting, embedding, mentioning —
//! and the target's node class is the whole distinction (D2): a Reference
//! whose target is a Profile *is* a mention. Nothing is minted; both
//! endpoints pre-exist.
//!
//! Every passive class is a target except one: a Type is tagged, never
//! referenced (D21). Tagging is the gesture that relates content to a
//! topic, and a second gesture spanning the same pair would split one
//! relation across two families the fold reads apart.
//!
//! # Which slot carries what
//!
//! Reference is Review with its legs transposed, so the census row reads
//! `A: p_d = f, p_i = e` — and since the A-leg renders the act tuple
//! verbatim (`census::leg_params`), **the act tuple is (effort,
//! enthusiasm)**. This inverts the repo's general reading, where `p_d` is
//! the valence slot: on a Reference the valence-shaped quantity sits in
//! `p_i`. It is the single easiest thing in this slice to get backwards.
//!
//! | census name | act slot | user-facing label (D1) | meaning |
//! |---|---|---|---|
//! | effort `f`     | `p_d` | relevance | how load-bearing the cited thing is here |
//! | enthusiasm `e` | `p_i` | support   | endorsing vs refuting |
//!
//! "Relevance" lands in `p_d` for both Tag and Reference, which is why the
//! word carries over from the 2.3 sliders unchanged. The gesture builder
//! writes the act tuple and never a leg rendering — the transposition is
//! the census's, and duplicating it would double-apply it.
//!
//! Both parameters span `[−1, 1]` (unlike Tag's confidence), so withdrawal
//! is *netted* rather than declared: an un-reference is the severance
//! shape, counter-records until the bundle reaches `(0,0)` (D11).
//!
//! Everything a client can get wrong is refused *before* anything is
//! staged, as a field-level `userError`: a malformed batch must not leave
//! half its acts in flight (api-spec.md "Conventions").

use common::l1::census::Family;
use common::l1::identifier::{ActId, NodeId};
use postgres_store::references::ReferenceView;
use postgres_store::{PgPool, references as store_refs};
use uuid::Uuid;

use crate::l1::L1Boundary;
use crate::nodes::{self, NodeError};
use crate::prepare::{self, Gesture, PrepareError, Target};

/// Citations per creation batch (D7). Each is its own priced act, so a
/// maximal creation batch is 1 minting record + 10 tags + 10 references =
/// 21 acts through one prepare: θ prices the author's cost, but not the
/// prepare-side work an unbounded batch demands of the server.
pub const MAX_REFERENCES_PER_BATCH: usize = 10;

/// Citations one author may have *standing* on one artifact (D22).
///
/// [`MAX_REFERENCES_PER_BATCH`] bounds a gesture; this bounds the set a
/// gesture accumulates into. Without it the standing set is unbounded, and
/// the read side has no honest number to price a fold list at — every
/// citation past what the budget assumed is server work nothing charged
/// for. It is CoGra's narrowing, not the substrate's: L1 admits any number
/// of Reference records toward any number of targets.
///
/// "Standing" is what the D4 fold serves — a bundle netted to `(0, 0)` has
/// left the set and freed its slot — so the cap is a live-set cap, never a
/// record count. Fifty is five full batches, which is what the widest
/// realistic gesture (mentioning everyone in a group photo) needs.
pub const MAX_LIVE_REFERENCES_PER_ARTIFACT: usize = 50;

/// Default relevance — effort `f`, the `p_d` slot (D3).
///
/// Effort is not Tag's confidence: it is signed, spans `[−1, 1]`, and
/// multiplies the act's coefficient `√|e·f|`, so the low-defaults policy
/// applies to it as it does to any stance-shaped quantity.
pub const DEFAULT_RELEVANCE: f64 = 0.1;

/// Default support — enthusiasm `e`, the `p_i` slot (D3).
///
/// Strictly positive on both axes by default, which means **a default
/// mention vouches** — weakly, at coefficient `√0.01 = 0.1`. Defaulting
/// effort to 0 instead would make the default gesture contribute to no
/// standing entry and reach its target through no channel at all, i.e. a
/// decorative act.
pub const DEFAULT_SUPPORT: f64 = 0.1;

/// A field-level refusal, carrying the path into the input that names the
/// offender (api-spec.md "Conventions" — `userErrors[].field`).
#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct ReferenceError {
    pub path: Vec<String>,
    pub message: String,
}

impl ReferenceError {
    fn at(path: Vec<String>, message: impl Into<String>) -> Self {
        Self {
            path,
            message: message.into(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ReferencesError {
    #[error(transparent)]
    BadInput(#[from] ReferenceError),
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<NodeError> for ReferencesError {
    fn from(e: NodeError) -> Self {
        match e {
            NodeError::Storage(e) => Self::Storage(e),
            NodeError::Internal(m) => Self::Internal(m),
        }
    }
}

impl From<store_refs::ReferencesError> for ReferencesError {
    fn from(e: store_refs::ReferencesError) -> Self {
        match e {
            store_refs::ReferencesError::Storage(e) => Self::Storage(e),
        }
    }
}

/// One citation as the wire carries it: the target's L2 id plus the
/// optional parameter pair.
#[derive(Debug, Clone)]
pub struct ReferenceDraft {
    pub target: Uuid,
    /// Effort `f` — the `p_d` slot. See the module header.
    pub relevance: Option<f64>,
    /// Enthusiasm `e` — the `p_i` slot.
    pub support: Option<f64>,
}

/// A checked citation: the resolved target node and the act tuple that
/// will be written verbatim.
#[derive(Debug, Clone, PartialEq)]
pub struct PlannedReference {
    /// The target as the client named it, kept so a refusal can quote it.
    pub target_id: Uuid,
    pub target: NodeId,
    /// Effort `f` — written to `p_d`.
    pub relevance: f64,
    /// Enthusiasm `e` — written to `p_i`.
    pub support: f64,
}

/// The number of priced acts a planned batch stages — one θ-debit per
/// citation (api-spec.md "Content authoring").
///
/// D19's cumulative pre-check prices the whole creation batch — the
/// minting record plus its tags plus its references — before staging any
/// act, so the batch either goes through entirely or not at all. This is
/// the reference half of that count.
pub fn act_count(planned: &[PlannedReference]) -> usize {
    planned.len()
}

/// Range-checks one citation's parameters, returning the offending leaf
/// field on refusal.
///
/// Both parameters span the census's whole `[−1, 1]` — Reference narrows
/// neither, unlike Tag's `c ∈ [0, 1]`. The check is here rather than left
/// to `params_check` so an out-of-range value surfaces as an actionable
/// field refusal rather than a formation fault.
///
/// The leaf names are the input's own — `relevance` and `support` (D1) —
/// because a field path a client cannot find in the input it sent is a
/// refusal it cannot attach to anything.
fn check(draft: &ReferenceDraft) -> Result<(f64, f64), (&'static str, String)> {
    let relevance = draft.relevance.unwrap_or(DEFAULT_RELEVANCE);
    let support = draft.support.unwrap_or(DEFAULT_SUPPORT);
    if !(-1.0..=1.0).contains(&relevance) {
        return Err((
            "relevance",
            "reference relevance must lie in [-1, 1]".to_string(),
        ));
    }
    if !(-1.0..=1.0).contains(&support) {
        return Err((
            "support",
            "reference support must lie in [-1, 1]".to_string(),
        ));
    }
    Ok((relevance, support))
}

/// Resolves one citation's target, refusing an id nothing answers to.
///
/// CoGra "refuses to prepare a record its published fold would never read"
/// (api-spec.md "Conventions"): L1 would admit a dangling target as
/// fold-neutral, but an author who cited nothing at all has paid θ for a
/// record no read surface will ever show them.
async fn resolve(
    pool: &PgPool,
    draft: &ReferenceDraft,
) -> Result<Result<PlannedReference, (&'static str, String)>, ReferencesError> {
    let (relevance, support) = match check(draft) {
        Ok(pair) => pair,
        Err(e) => return Ok(Err(e)),
    };
    let Some(target) = nodes::resolve_id(pool, draft.target).await? else {
        return Ok(Err(("target", "no such reference target".to_string())));
    };
    if let Err(e) = refuse_topic_target(&target) {
        return Ok(Err(e));
    }
    Ok(Ok(PlannedReference {
        target_id: draft.target,
        target,
        relevance,
        support,
    }))
}

/// Checks a standalone citation, with the refusal rooted at the mutation
/// input's own fields.
pub async fn plan_one(
    pool: &PgPool,
    draft: &ReferenceDraft,
) -> Result<PlannedReference, ReferencesError> {
    resolve(pool, draft)
        .await?
        .map_err(|(field, message)| ReferenceError::at(vec![field.to_string()], message).into())
}

/// Checks a whole creation batch before a single act is staged.
///
/// The cap is checked first: an over-long batch is refused as a batch, not
/// as whichever of its entries happens to also be malformed. Targets are
/// compared *after* resolution, so two ids naming the same node are one
/// citation submitted twice — refused rather than deduplicated, because
/// silently dropping an act the author asked for is the helpfulness the
/// write path exists to avoid, and staging both charges two θ for one
/// bundle the fold reads once.
pub async fn plan_batch(
    pool: &PgPool,
    drafts: &[ReferenceDraft],
) -> Result<Vec<PlannedReference>, ReferencesError> {
    if drafts.len() > MAX_REFERENCES_PER_BATCH {
        return Err(ReferenceError::at(
            vec!["references".to_string()],
            format!(
                "at most {MAX_REFERENCES_PER_BATCH} references per batch, got {}",
                drafts.len()
            ),
        )
        .into());
    }
    let mut planned: Vec<PlannedReference> = Vec::with_capacity(drafts.len());
    for (i, draft) in drafts.iter().enumerate() {
        let reference = resolve(pool, draft)
            .await?
            .map_err(|(field, message)| ReferenceError::at(path(i, field), message))?;
        if planned.iter().any(|p| p.target == reference.target) {
            return Err(ReferenceError::at(
                path(i, "target"),
                "this target is cited twice in this batch",
            )
            .into());
        }
        planned.push(reference);
    }
    Ok(planned)
}

fn path(index: usize, field: &str) -> Vec<String> {
    vec![
        "references".to_string(),
        index.to_string(),
        field.to_string(),
    ]
}

/// The Reference gesture: the act tuple `(effort, enthusiasm)` toward the
/// citing artifact, terminating at the cited target. `deps` orders the act
/// behind the records it must not be ordered ahead of — the act that mints
/// its middle, and the act that mints a still-pending target (D17).
///
/// The payload stays empty (D14). A note would make the record
/// payload-marked, and payload-marked records are read individually and
/// never through the author's netted bundle — so attaching one would
/// silently remove the record from the very fold the read side is built on.
pub fn reference_gesture(
    author: &str,
    middle: NodeId,
    reference: &PlannedReference,
    deps: Vec<ActId>,
) -> Gesture {
    Gesture {
        author: author.to_string(),
        family: Family::Reference,
        middle: Some(middle),
        target: Target::Node(reference.target.clone()),
        p_d: reference.relevance,
        p_i: reference.support,
        settlement_ref: None,
        license: None,
        asserted_parents: vec![],
        deps,
        payload: vec![],
        node: None,
    }
}

/// Where a batch of Reference acts attaches: who authors them, the artifact
/// they cite from, and the acts they must not be ordered ahead of.
#[derive(Debug, Clone, Copy)]
pub struct ReferenceSite<'a> {
    /// The citing author's L0 address atom.
    pub author: &'a str,
    /// The middle node — the artifact the citations are hung off.
    pub middle: &'a NodeId,
    pub deps: &'a [ActId],
}

/// Stages one Reference act per citation, all at the same site.
///
/// The self-citation check runs over the whole batch before anything is
/// staged. A creation batch cannot express one — the minting node's id is
/// allocated server-side — so this guards the standalone path and anything
/// that later hands a caller-named artifact in.
pub async fn stage_references<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    site: ReferenceSite<'_>,
    planned: &[PlannedReference],
) -> Result<Vec<prepare::Prepared>, ReferencesError> {
    refuse_self_citation(site.middle, planned)?;
    let mut staged = Vec::with_capacity(planned.len());
    for reference in planned {
        let gesture = reference_gesture(
            site.author,
            site.middle.clone(),
            reference,
            site.deps.to_vec(),
        );
        staged.push(prepare::prepare(boundary, pool, gc_after_epochs, viewer, gesture).await?);
    }
    Ok(staged)
}

/// An artifact citing itself carries no information a reader could use:
/// the citation's whole content is the pair it relates, and a self-citation
/// relates a node to itself. L1 would admit it — it resolves to the
/// author's own self-retention channel rather than dangling — so this is
/// CoGra's API surface being narrower than the substrate, as it is for Tag.
fn refuse_self_citation(
    middle: &NodeId,
    planned: &[PlannedReference],
) -> Result<(), ReferenceError> {
    match planned.iter().position(|p| p.target == *middle) {
        Some(i) => Err(ReferenceError::at(
            path(i, "target"),
            "an artifact cannot cite itself",
        )),
        None => Ok(()),
    }
}

/// A Type is tagged, never referenced (D21): topics are the Tag family's
/// business, and every *other* passive class is the Reference family's.
/// Two gestures spanning the same (content, topic) pair would divide one
/// relation between two folds that read it apart — a topic's standing on a
/// node would then depend on which gesture its author happened to pick.
///
/// L1's incidence admits a Type target like any other passive node, so
/// this is CoGra declining to prepare what the substrate would accept —
/// the same narrowing shape as the self-citation refusal above.
///
/// The offending field is `target` on both write shapes; `plan_batch`
/// re-roots it at the entry's index.
fn refuse_topic_target(target: &NodeId) -> Result<(), (&'static str, String)> {
    match target {
        NodeId::Name(_) => Err(("target", "a topic is tagged, never referenced".to_string())),
        _ => Ok(()),
    }
}

/// The refusal message when a batch would leave the author standing past
/// [`MAX_LIVE_REFERENCES_PER_ARTIFACT`] citations on one artifact, or
/// `None` when it fits (D22). The caller roots the path, because the field
/// that names the offender differs between the write shapes.
///
/// `live` is the fold's own current view of the author's set on this
/// artifact — read pending-inclusive, or fifty staged citations would sail
/// through one after another while none of them had landed yet.
///
/// A citation claims a slot only when it is toward a target the author is
/// not already standing on *and* carries something to stand on. Both
/// conditions are exact rather than conservative: a target absent from the
/// fold has no records or has netted to `(0, 0)`, so the new record's own
/// pair is the whole resulting bundle, and a `(0, 0)` citation therefore
/// leaves the set exactly as it found it — priced, admitted, and
/// routing-inert, which is what the proposal-targeting gesture wants.
fn over_the_standing_cap(live: &[String], planned: &[PlannedReference]) -> Option<String> {
    let claiming = planned
        .iter()
        .filter(|p| {
            (p.relevance != 0.0 || p.support != 0.0) && !live.contains(&p.target.to_string())
        })
        .count();
    (live.len() + claiming > MAX_LIVE_REFERENCES_PER_ARTIFACT).then(|| {
        format!(
            "at most {MAX_LIVE_REFERENCES_PER_ARTIFACT} references may stand \
             on one artifact at once; withdraw one first"
        )
    })
}

/// The author's standing citations on one artifact, as the fold serves
/// them — the input [`over_the_standing_cap`] measures against.
async fn live_targets(
    pool: &PgPool,
    author: &str,
    middle: &NodeId,
) -> Result<Vec<String>, ReferencesError> {
    Ok(store_refs::references_of(
        pool,
        &middle.to_string(),
        author,
        ReferenceView::IncludingPending { actor: author },
    )
    .await?
    .into_iter()
    .map(|claim| claim.target)
    .collect())
}

/// Prepares one standalone citation — the gesture that hangs a reference
/// off existing content, which post.md §3 and comment.md §3 both promise
/// ("alongside the Publish or later") and which D10 adds to the contract.
///
/// The standing cap is checked here and not on the creation path because a
/// creation batch mints the artifact it cites from: its set starts empty,
/// and [`MAX_REFERENCES_PER_BATCH`] already bounds it well under
/// [`MAX_LIVE_REFERENCES_PER_ARTIFACT`]. This is the only gesture that can
/// reach the cap, and it is refused before anything is staged.
///
/// Citing is unconstrained by the artifact's ownership: anyone can hang a
/// citation off anyone's content, and the read side is what gates the
/// difference (D12 serves the carrier author's own citations alone).
pub async fn prepare_reference<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    artifact: Uuid,
    draft: &ReferenceDraft,
) -> Result<prepare::Prepared, ReferencesError> {
    let reference = plan_one(pool, draft).await?;
    let middle = citing_node(pool, artifact).await?;
    refuse_self_citation(&middle, std::slice::from_ref(&reference))
        .map_err(|e| ReferenceError::at(vec!["target".to_string()], e.message))?;
    let author = author_address(pool, viewer).await?;
    let live = live_targets(pool, &author, &middle).await?;
    if let Some(message) = over_the_standing_cap(&live, std::slice::from_ref(&reference)) {
        return Err(ReferenceError::at(vec!["target".to_string()], message).into());
    }
    let gesture = reference_gesture(&author, middle, &reference, vec![]);
    Ok(prepare::prepare(boundary, pool, gc_after_epochs, viewer, gesture).await?)
}

/// Prepares the withdrawal of one citation: the counter-records that net
/// the author's `(author, artifact, target)` bundle to `(0, 0)` (D11).
///
/// Records are never deleted, and Reference withdrawal is per-leg net
/// stance — not Tag's newest-wins-at-relevance-0, which exists only
/// because Tag's confidence is census-bounded to `[0, 1]` and cannot be
/// netted. Both Reference parameters are signed, so netting is expressible
/// here, and the cost is `⌈max(|Σ_d|, |Σ_i|)⌉` acts rather than one.
///
/// The batch is computed against the pending-inclusive view, so a
/// withdrawal followed by a refetch reads as withdrawn at once rather than
/// after the acts land.
pub async fn prepare_reference_withdrawal<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    artifact: Uuid,
    target: Uuid,
) -> Result<Vec<prepare::Prepared>, ReferencesError> {
    let middle = citing_node(pool, artifact).await?;
    let Some(target_node) = nodes::resolve_id(pool, target).await? else {
        return Err(
            ReferenceError::at(vec!["target".to_string()], "no such reference target").into(),
        );
    };
    refuse_topic_target(&target_node)
        .map_err(|(field, message)| ReferenceError::at(vec![field.to_string()], message))?;
    let author = author_address(pool, viewer).await?;
    let sum = store_refs::bundle(
        pool,
        &author,
        &middle.to_string(),
        &target_node.to_string(),
        ReferenceView::IncludingPending { actor: &author },
    )
    .await?;
    let batch = sum.severance_batch();
    if batch.is_empty() {
        return Err(ReferenceError::at(
            vec!["target".to_string()],
            "the citation bundle toward this target already nets to (0, 0)",
        )
        .into());
    }
    prepare::check_batch_solvency(boundary, &author, batch.len()).await?;
    let mut prepared = Vec::with_capacity(batch.len());
    for (relevance, support) in batch {
        let counter = PlannedReference {
            target_id: target,
            target: target_node.clone(),
            relevance,
            support,
        };
        let gesture = reference_gesture(&author, middle.clone(), &counter, vec![]);
        prepared.push(prepare::prepare(boundary, pool, gc_after_epochs, viewer, gesture).await?);
    }
    Ok(prepared)
}

/// The minted node a citation hangs off. The substrate admits every
/// passive node as a citing artifact (layer1-interface.md §9.3); the
/// classes with an API surface to cite from are the content nodes this
/// slice carries, exactly as `taggable_node` narrows Tag.
async fn citing_node(pool: &PgPool, artifact: Uuid) -> Result<NodeId, ReferencesError> {
    crate::nodes::resolve_content_node(pool, artifact)
        .await
        .map_err(|e| ReferencesError::Internal(e.to_string()))?
        .ok_or_else(|| {
            ReferenceError::at(vec!["artifact".to_string()], "no such citing artifact").into()
        })
}

async fn author_address(pool: &PgPool, viewer: Uuid) -> Result<String, ReferencesError> {
    crate::nodes::required_address(pool, viewer)
        .await
        .map_err(|e| ReferencesError::Internal(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::l1::census::{LegRole, leg_params};

    fn planned(target: &str, relevance: f64, support: f64) -> PlannedReference {
        PlannedReference {
            target_id: Uuid::nil(),
            target: NodeId::parse(target).expect("node"),
            relevance,
            support,
        }
    }

    fn middle() -> NodeId {
        NodeId::parse("mint:act:alice:0:publish").expect("node")
    }

    /// The claim-9 trap, pinned against the census itself rather than
    /// against a remembered orientation: the A-leg renders the act tuple
    /// verbatim, and the census row for Reference reads `A: p_d = f,
    /// p_i = e`. So the tuple this gesture writes must be
    /// (effort, enthusiasm) = (relevance, support).
    ///
    /// The Reference gesture writes the act tuple the census fixes, never a leg's rendering of it.
    /// ´claim:references:the-gesture-writes-the-act-tuple´
    #[test]
    fn the_reference_gesture_writes_the_act_tuple_never_a_leg_rendering() {
        let reference = planned("prof:bob", -0.25, 0.75);
        let g = reference_gesture("alice", middle(), &reference, vec![]);

        assert_eq!(g.p_d, -0.25, "p_d carries relevance (effort f)");
        assert_eq!(g.p_i, 0.75, "p_i carries support (enthusiasm e)");

        let (a_pd, a_pi) = leg_params(LegRole::A, g.p_d, g.p_i);
        assert_eq!(
            (a_pd, a_pi),
            (reference.relevance, reference.support),
            "the A-leg renders the act tuple verbatim"
        );
        let (t_pd, t_pi) = leg_params(LegRole::T, g.p_d, g.p_i);
        assert_eq!(
            (t_pd, t_pi),
            (reference.support, reference.relevance),
            "the T-leg transposes, so a read of it must swap back"
        );
    }

    /// The planned gesture is a well-formed Reference, down to the family, the legs and the parameters the census fixes.
    /// ´claim:references:the-planned-gesture-is-well-formed´
    #[test]
    fn the_gesture_is_a_well_formed_reference() {
        let reference = planned("prof:bob", 1.0, -1.0);
        let g = reference_gesture("alice", middle(), &reference, vec![]);
        g.family.params_check(g.p_d, g.p_i).expect("params");
        let target = match &g.target {
            Target::Node(n) => n.clone(),
            Target::OwnMint => panic!("a reference never targets its own mint"),
        };
        g.family
            .endpoint_check(
                "alice",
                &NodeId::Addr("alice".into()),
                g.middle.as_ref(),
                &target,
            )
            .expect("endpoints");
        assert_eq!(g.family, Family::Reference);
        assert!(g.payload.is_empty(), "a citation carries no payload (D14)");
    }

    /// A (0,0) citation is legitimate — priced, admitted, structurally
    /// permanent, and routing-inert (claim 12). It is the proposal- and
    /// campaign-targeting gesture, so formation must admit it.
    ///
    /// A citation inert on both axes is well-formed and admitted, being the proposal- and campaign-targeting gesture.
    /// ´claim:references:an-inert-citation-is-well-formed´
    #[test]
    fn a_zero_zero_citation_is_well_formed() {
        let g = reference_gesture("alice", middle(), &planned("prof:bob", 0.0, 0.0), vec![]);
        g.family.params_check(g.p_d, g.p_i).expect("params");
    }

    /// An omitted citation parameter takes the declared default rather than zero or a refusal.
    /// ´claim:references:omitted-parameters-take-the-defaults´
    #[test]
    fn omitted_reference_parameters_take_the_declared_defaults() {
        let (relevance, support) = check(&ReferenceDraft {
            target: Uuid::nil(),
            relevance: None,
            support: None,
        })
        .expect("legal");
        assert_eq!(relevance, DEFAULT_RELEVANCE);
        assert_eq!(support, DEFAULT_SUPPORT);
        assert!(
            relevance > 0.0 && support > 0.0,
            "a default mention vouches weakly (D3)"
        );
    }

    /// The refusal names the field the client actually sent, which on
    /// `ReferenceInput` is `relevance` / `support` (D1) and not the
    /// census-slot spelling `TagInput` still uses.
    ///
    /// An out-of-range parameter is refused against the field the client actually sent, never the census slot behind it.
    /// ´claim:references:a-refusal-names-the-clients-own-field´
    #[test]
    fn out_of_range_parameters_name_their_own_input_field() {
        let over = ReferenceDraft {
            target: Uuid::nil(),
            relevance: Some(1.5),
            support: None,
        };
        assert_eq!(check(&over).expect_err("refused").0, "relevance");

        let under = ReferenceDraft {
            target: Uuid::nil(),
            relevance: None,
            support: Some(-1.5),
        };
        assert_eq!(check(&under).expect_err("refused").0, "support");
    }

    /// Both citation axes accept the whole signed range, negative ends included.
    /// ´claim:references:both-axes-take-the-whole-signed-range´
    #[test]
    fn the_whole_signed_range_is_accepted_on_both_axes() {
        for v in [-1.0, -0.5, 0.0, 0.5, 1.0] {
            let d = ReferenceDraft {
                target: Uuid::nil(),
                relevance: Some(v),
                support: Some(v),
            };
            assert_eq!(check(&d).expect("legal"), (v, v));
        }
    }

    /// An artifact may not cite itself, and only the entry that tried is refused for it.
    /// ´claim:references:an-artifact-cannot-cite-itself´
    #[test]
    fn an_artifact_citing_itself_is_refused_at_its_own_index() {
        let batch = [
            planned("prof:bob", 0.1, 0.1),
            planned(&middle().to_string(), 0.1, 0.1),
        ];
        let e = refuse_self_citation(&middle(), &batch).expect_err("refused");
        assert_eq!(
            e.path,
            vec![
                "references".to_string(),
                "1".to_string(),
                "target".to_string()
            ]
        );
    }

    /// (´claim:references:an-artifact-cannot-cite-itself´)
    #[test]
    fn a_batch_that_cites_others_passes_the_self_check() {
        let batch = [
            planned("prof:bob", 0.1, 0.1),
            planned("mint:act:carol:0:publish", 0.1, 0.1),
        ];
        refuse_self_citation(&middle(), &batch).expect("legal");
    }

    /// A citation batch prices at one act per citation.
    /// ´claim:references:one-act-per-citation´
    #[test]
    fn the_act_count_is_one_per_citation() {
        let batch = [
            planned("prof:bob", 0.1, 0.1),
            planned("mint:act:carol:0:publish", 0.1, 0.1),
        ];
        assert_eq!(act_count(&batch), 2);
        assert_eq!(act_count(&[]), 0);
    }

    /// D21: the one passive class the Reference family does not reach.
    /// L1 would admit the record — a Type is a passive node like any
    /// other — so nothing but this refusal keeps the gesture out.
    ///
    /// A topic is the one passive class the Reference family does not reach, and nothing but this refusal keeps the gesture out of it.
    /// ´claim:references:a-topic-is-no-reference-target´
    #[test]
    fn a_topic_is_refused_as_a_reference_target() {
        let (field, message) =
            refuse_topic_target(&NodeId::name("rust").expect("node")).expect_err("refused");
        assert_eq!(field, "target");
        assert!(message.contains("tagged"), "{message}");
    }

    fn standing(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("prof:p{i}")).collect()
    }

    /// The boundary itself: the fiftieth citation is the last one the
    /// artifact carries, and the fifty-first is refused rather than
    /// clamped or silently dropped.
    ///
    /// The standing set caps at fifty citations: the fiftieth is carried and the fifty-first refused rather than clamped or dropped.
    /// ´claim:references:the-standing-set-caps-at-fifty´
    #[test]
    fn the_standing_cap_admits_the_fiftieth_citation_and_refuses_the_next() {
        let fresh = [planned("prof:new", 0.1, 0.1)];
        assert!(
            over_the_standing_cap(&standing(MAX_LIVE_REFERENCES_PER_ARTIFACT - 1), &fresh)
                .is_none(),
            "the set reaches exactly the cap"
        );
        let refusal = over_the_standing_cap(&standing(MAX_LIVE_REFERENCES_PER_ARTIFACT), &fresh)
            .expect("refused");
        assert!(refusal.contains("withdraw one first"), "{refusal}");
    }

    /// The cap counts what stands, not what was ever authored: the fold
    /// drops a bundle netted to `(0, 0)`, so a withdrawal hands its slot
    /// back and the next citation fits.
    ///
    /// The standing cap counts what stands rather than what was ever authored, so a slot no longer claimed comes back.
    /// ´claim:references:the-standing-cap-counts-what-stands´
    #[test]
    fn a_withdrawn_citation_frees_its_slot_under_the_standing_cap() {
        let mut live = standing(MAX_LIVE_REFERENCES_PER_ARTIFACT);
        live.pop();
        assert!(
            over_the_standing_cap(&live, &[planned("prof:new", 0.1, 0.1)]).is_none(),
            "the withdrawn bundle is not in the fold's view"
        );
    }

    /// Revising a citation the author already stands on claims no slot —
    /// the bundle it folds into is already counted.
    ///
    /// (´claim:references:the-standing-cap-counts-what-stands´)
    #[test]
    fn re_citing_a_standing_target_claims_no_further_slot() {
        let live = standing(MAX_LIVE_REFERENCES_PER_ARTIFACT);
        assert!(
            over_the_standing_cap(&live, &[planned("prof:p7", 0.5, 0.5)]).is_none(),
            "a revision is the same bundle"
        );
    }

    /// A `(0, 0)` citation toward a fresh target leaves the fold exactly
    /// as it found it, so the cap has nothing to refuse.
    ///
    /// (´claim:references:the-standing-cap-counts-what-stands´)
    #[test]
    fn an_inert_citation_does_not_claim_a_slot() {
        let live = standing(MAX_LIVE_REFERENCES_PER_ARTIFACT);
        assert!(over_the_standing_cap(&live, &[planned("prof:new", 0.0, 0.0)]).is_none());
    }

    /// Every other passive class stays a target — the narrowing is one
    /// class wide, not a general suspicion of non-content targets.
    ///
    /// Every passive class but the topic stays a citation target, the narrowing being one class wide and not a suspicion of non-content targets.
    /// ´claim:references:the-narrowing-is-one-class-wide´
    #[test]
    fn the_other_passive_classes_stay_reference_targets() {
        for target in ["prof:bob", "mint:act:carol:0:publish"] {
            refuse_topic_target(&NodeId::parse(target).expect("node")).expect("legal");
        }
    }
}
