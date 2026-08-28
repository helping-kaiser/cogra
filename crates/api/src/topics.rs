//! ´mod:module:topics´
//!
//! Topic declarations — the Tag act (hashtag.md §3; edges.md §3): a
//! hyper-edge Actor → content → Type, one priced act per topic, staged
//! either inside a content-creation batch or on its own.
//!
//! A Tag's act tuple is (relevance, confidence): `p_d = r`, `p_i = c`,
//! and the census transposes it on the T-leg (layer1-interface.md §9.6).
//! The gesture builder here writes the act tuple, never a leg rendering —
//! the transposition is the census's, and duplicating it would be the
//! single easiest thing in this slice to get backwards.
//!
//! Everything a client can get wrong is refused *before* anything is
//! staged, as a field-level `userError` (api-spec.md "Conventions"): a
//! malformed batch must not leave half its acts in flight, and a θ-priced
//! act must never be staged on input the fold would then ignore.
//!
//! There is no creation gesture for a Type and no un-tag gesture: a Type
//! exists as soon as an accepted record names it, and un-tagging is a
//! further Tag at relevance 0, which the current-topics fold reads as
//! withdrawn (hashtag.md §2, §4).

use common::hashtag::{HashtagNameError, canonicalize};
use common::l1::census::Family;
use common::l1::identifier::{ActId, NodeId};
use postgres_store::{PgPool, auth as store, content as content_store, topics as topics_store};
use uuid::Uuid;

use crate::l1::L1Boundary;
use crate::prepare::{self, Gesture, PrepareError, Target};

/// Tags per creation batch (D18). Each tag is its own priced act, so an
/// N-tag post is an N+1-act batch through one prepare, one device signing
/// loop, and one approve: θ prices the author's cost, but not the
/// prepare-side work an unbounded batch demands of the server.
pub const MAX_TAGS_PER_BATCH: usize = 10;

/// Topics one author may have *standing* on one artifact (D22).
///
/// [`MAX_TAGS_PER_BATCH`] bounds a gesture; this bounds the set a gesture
/// accumulates into. Both fold families carry the same cap for the same
/// reason: the read side prices an author-owned fold list at a stated
/// bound, and a standing set past that bound is server work nothing
/// charged for. L1 admits any number of Tag records; the narrowing is
/// CoGra's.
///
/// "Standing" is what the current-topics fold serves, so a topic withdrawn
/// at relevance 0 has left the set and freed its slot.
pub const MAX_LIVE_TOPICS_PER_ARTIFACT: usize = 50;

/// Default relevance — the low-defaults policy value, as everywhere else
/// (invitations.md §3): a modest claim, leaving stronger ones expressible.
pub const DEFAULT_RELEVANCE: f64 = 0.1;

/// Default confidence (D13). Confidence is not a stance whose headroom
/// needs preserving: an author declaring their own content's topic
/// believes their own declaration, and `c = 0.1` would say the opposite.
pub const DEFAULT_CONFIDENCE: f64 = 1.0;

/// A field-level refusal, carrying the path into the input that names the
/// offender (api-spec.md "Conventions" — `userErrors[].field`).
#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct TagError {
    pub path: Vec<String>,
    pub message: String,
}

impl TagError {
    fn at(path: Vec<String>, message: impl Into<String>) -> Self {
        Self {
            path,
            message: message.into(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TopicsError {
    #[error(transparent)]
    BadInput(#[from] TagError),
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error("internal: {0}")]
    Internal(String),
}

/// One topic declaration as the wire carries it: a raw name plus the
/// optional parameter pair.
#[derive(Debug, Clone)]
pub struct TagDraft {
    pub name: String,
    pub relevance: Option<f64>,
    pub confidence: Option<f64>,
}

/// A checked declaration: the canonical Type name and the act tuple that
/// will be written verbatim.
#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTag {
    pub name: String,
    pub relevance: f64,
    pub confidence: f64,
}

/// The message a name refusal carries. The three variants exist to make
/// the refusal actionable — "too long" and "not an atom" want different
/// fixes from an author (D3: refused, never encoded).
fn name_message(e: &HashtagNameError) -> String {
    e.to_string()
}

/// Checks one declaration, returning the offending leaf field on refusal.
///
/// Relevance needs no range check of its own: `Dimension` already bounds
/// the wire to `[-1, 1]`, which is the census's whole range for `r`.
/// Confidence is narrower than its scalar — `c ∈ [0, 1]` — so it is
/// checked here rather than left to `params_check`, whose refusal is a
/// formation fault and would surface as an internal-shaped error (D12).
fn check(draft: &TagDraft) -> Result<PlannedTag, (&'static str, String)> {
    let name = canonicalize(&draft.name).map_err(|e| ("name", name_message(&e)))?;
    let relevance = draft.relevance.unwrap_or(DEFAULT_RELEVANCE);
    let confidence = draft.confidence.unwrap_or(DEFAULT_CONFIDENCE);
    if !(0.0..=1.0).contains(&confidence) {
        return Err(("pInterest", "tag confidence must lie in [0, 1]".to_string()));
    }
    Ok(PlannedTag {
        name,
        relevance,
        confidence,
    })
}

/// Checks a standalone declaration, with the refusal rooted at the
/// mutation input's own fields.
pub fn plan_one(draft: &TagDraft) -> Result<PlannedTag, TagError> {
    check(draft).map_err(|(field, message)| TagError::at(vec![field.to_string()], message))
}

/// Checks a whole creation batch before a single act is staged.
///
/// The cap is checked first: an over-long batch is refused as a batch,
/// not as whichever of its entries happens to also be malformed. Names
/// are compared *after* canonicalization, so `["rust", "Rust", "#rust"]`
/// is one claim submitted three times — refused rather than deduplicated,
/// because silently dropping two acts an author asked for is exactly the
/// helpfulness the write path exists to avoid, and staging all three
/// charges three θ for one claim the fold reads once (D17).
pub fn plan_batch(drafts: &[TagDraft]) -> Result<Vec<PlannedTag>, TagError> {
    if drafts.len() > MAX_TAGS_PER_BATCH {
        return Err(TagError::at(
            vec!["tags".to_string()],
            format!(
                "at most {MAX_TAGS_PER_BATCH} tags per batch, got {}",
                drafts.len()
            ),
        ));
    }
    let mut planned: Vec<PlannedTag> = Vec::with_capacity(drafts.len());
    for (i, draft) in drafts.iter().enumerate() {
        let tag = check(draft).map_err(|(field, message)| TagError::at(path(i, field), message))?;
        if planned.iter().any(|p| p.name == tag.name) {
            return Err(TagError::at(
                path(i, "name"),
                format!("`{}` is declared twice in this batch", tag.name),
            ));
        }
        planned.push(tag);
    }
    Ok(planned)
}

fn path(index: usize, field: &str) -> Vec<String> {
    vec!["tags".to_string(), index.to_string(), field.to_string()]
}

/// The Tag gesture: the A-leg's act tuple toward the middle, terminating
/// at the Type. `deps` orders the act behind the record that mints its
/// middle, when the two are staged together.
pub fn tag_gesture(
    author: &str,
    middle: NodeId,
    tag: &PlannedTag,
    deps: Vec<ActId>,
) -> Result<Gesture, TopicsError> {
    let target = NodeId::name(&tag.name)
        .map_err(|e| TopicsError::Internal(format!("canonical name is not an atom: {e}")))?;
    Ok(Gesture {
        author: author.to_string(),
        family: Family::Tag,
        middle: Some(middle),
        target: Target::Node(target),
        p_d: tag.relevance,
        p_i: tag.confidence,
        settlement_ref: None,
        license: None,
        asserted_parents: vec![],
        deps,
        payload: vec![],
        node: None,
    })
}

/// Where a batch of Tag acts attaches: who declares them, the node they
/// enter, and the acts they must not be ordered ahead of.
#[derive(Debug, Clone, Copy)]
pub struct TagSite<'a> {
    /// The declaring author's L0 address atom.
    pub author: &'a str,
    /// The middle node — the content the claims are about.
    pub middle: &'a NodeId,
    pub deps: &'a [ActId],
}

/// Stages one Tag act per declared topic, all at the same site.
///
/// The registry row for each name is written by `prepare` itself, inside
/// the transaction that stages the act (D5) — this function never writes
/// a name of its own.
pub async fn stage_tags<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    site: TagSite<'_>,
    planned: &[PlannedTag],
) -> Result<Vec<prepare::Prepared>, TopicsError> {
    let mut staged = Vec::with_capacity(planned.len());
    for tag in planned {
        let gesture = tag_gesture(site.author, site.middle.clone(), tag, site.deps.to_vec())?;
        staged.push(prepare::prepare(boundary, pool, gc_after_epochs, viewer, gesture).await?);
    }
    Ok(staged)
}

/// The refusal message when a batch would leave the author standing past
/// [`MAX_LIVE_TOPICS_PER_ARTIFACT`] topics on one artifact, or `None` when
/// it fits (D22). The caller roots the path.
///
/// `live` is the current-topics fold's own view, read pending-inclusive —
/// otherwise fifty staged tags would sail through one after another while
/// none of them had landed.
///
/// A declaration claims a slot only when it names a topic the author is
/// not already standing on *and* carries a non-zero relevance. Both
/// conditions are exact under newest-wins: the record being staged is the
/// one the fold will read, so its own relevance decides whether the topic
/// stands, and relevance 0 is the un-tag.
fn over_the_standing_cap(live: &[String], planned: &[PlannedTag]) -> Option<String> {
    let claiming = planned
        .iter()
        .filter(|t| t.relevance != 0.0 && !live.contains(&t.name))
        .count();
    (live.len() + claiming > MAX_LIVE_TOPICS_PER_ARTIFACT).then(|| {
        format!(
            "at most {MAX_LIVE_TOPICS_PER_ARTIFACT} topics may stand on one \
             artifact at once; withdraw one first"
        )
    })
}

/// The author's standing topics on one artifact, as the fold serves them.
async fn live_names(
    pool: &PgPool,
    author: &str,
    middle: &NodeId,
) -> Result<Vec<String>, TopicsError> {
    Ok(topics_store::topics_of(
        pool,
        &middle.to_string(),
        author,
        topics_store::TopicView::IncludingPending { actor: author },
    )
    .await
    .map_err(|e| TopicsError::Internal(e.to_string()))?
    .into_iter()
    .map(|claim| claim.name)
    .collect())
}

/// Prepares one standalone Tag — the gesture that adds a topic to
/// existing content, and, at relevance 0, the one that withdraws it
/// (post.md §3; hashtag.md §4). Tagging is unconstrained by authorship:
/// the content's author declares its topics, anyone else makes a
/// third-party claim, and the read side is what gates the difference.
///
/// The standing cap is checked here and not on the creation path because a
/// creation batch mints the artifact it tags: its set starts empty, and
/// [`MAX_TAGS_PER_BATCH`] already bounds it well under
/// [`MAX_LIVE_TOPICS_PER_ARTIFACT`]. This is the only gesture that can
/// reach the cap, and it is refused before anything is staged.
pub async fn prepare_tag<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    target: Uuid,
    draft: &TagDraft,
) -> Result<prepare::Prepared, TopicsError> {
    let tag = plan_one(draft)?;
    let middle = taggable_node(pool, target).await?;
    let author = author_address(pool, viewer).await?;
    let live = live_names(pool, &author, &middle).await?;
    if let Some(message) = over_the_standing_cap(&live, std::slice::from_ref(&tag)) {
        return Err(TagError::at(vec!["name".to_string()], message).into());
    }
    let gesture = tag_gesture(&author, middle, &tag, vec![])?;
    Ok(prepare::prepare(boundary, pool, gc_after_epochs, viewer, gesture).await?)
}

/// The minted node a tag's middle leg enters. The Taggable classes the
/// substrate admits are wider than this (layer1-interface.md §9); the
/// classes with an API surface to tag are the content nodes this slice
/// carries.
async fn taggable_node(pool: &PgPool, target: Uuid) -> Result<NodeId, TopicsError> {
    let node = match content_store::content_kind(pool, target)
        .await
        .map_err(|e| TopicsError::Internal(e.to_string()))?
    {
        Some("post") => content_store::post(pool, target)
            .await
            .map_err(|e| TopicsError::Internal(e.to_string()))?
            .map(|p| p.l1_node_id),
        Some("comment") => content_store::comment(pool, target)
            .await
            .map_err(|e| TopicsError::Internal(e.to_string()))?
            .map(|c| c.l1_node_id),
        _ => None,
    };
    let node =
        node.ok_or_else(|| TagError::at(vec!["target".to_string()], "no such taggable content"))?;
    NodeId::parse(&node).map_err(|e| TopicsError::Internal(format!("stored node id: {e}")))
}

async fn author_address(pool: &PgPool, viewer: Uuid) -> Result<String, TopicsError> {
    store::actor_identity(pool, viewer)
        .await
        .map_err(|e| TopicsError::Internal(e.to_string()))?
        .and_then(|identity| identity.l0_address)
        .ok_or_else(|| TopicsError::Internal("viewer without an attached address".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft(name: &str) -> TagDraft {
        TagDraft {
            name: name.to_string(),
            relevance: None,
            confidence: None,
        }
    }

    #[test]
    fn omitted_parameters_take_the_declared_defaults() {
        let planned = plan_one(&draft("#Rust")).expect("legal");
        assert_eq!(planned.name, "rust", "the name is canonicalized first");
        assert_eq!(planned.relevance, DEFAULT_RELEVANCE);
        assert_eq!(planned.confidence, DEFAULT_CONFIDENCE);
    }

    #[test]
    fn an_illegal_name_names_the_name_field() {
        for bad in ["", "#", "has space", "münchen", &"a".repeat(129)] {
            let e = plan_one(&draft(bad)).expect_err("refused");
            assert_eq!(e.path, vec!["name".to_string()], "for {bad:?}");
        }
    }

    #[test]
    fn confidence_outside_the_census_range_names_pinterest() {
        let mut d = draft("rust");
        d.confidence = Some(-0.5);
        let e = plan_one(&d).expect_err("refused");
        assert_eq!(e.path, vec!["pInterest".to_string()]);
    }

    #[test]
    fn the_whole_confidence_range_is_accepted() {
        for c in [0.0, 0.5, 1.0] {
            let mut d = draft("rust");
            d.confidence = Some(c);
            assert_eq!(plan_one(&d).expect("legal").confidence, c);
        }
    }

    #[test]
    fn relevance_zero_is_the_un_tag_and_is_legal() {
        let mut d = draft("rust");
        d.relevance = Some(0.0);
        assert_eq!(plan_one(&d).expect("legal").relevance, 0.0);
    }

    #[test]
    fn negative_relevance_is_legal() {
        let mut d = draft("rust");
        d.relevance = Some(-1.0);
        assert_eq!(plan_one(&d).expect("legal").relevance, -1.0);
    }

    #[test]
    fn the_batch_cap_admits_ten_and_refuses_eleven() {
        let at_cap: Vec<TagDraft> = (0..MAX_TAGS_PER_BATCH)
            .map(|i| draft(&format!("t{i}")))
            .collect();
        assert_eq!(
            plan_batch(&at_cap).expect("legal").len(),
            MAX_TAGS_PER_BATCH
        );

        let over: Vec<TagDraft> = (0..MAX_TAGS_PER_BATCH + 1)
            .map(|i| draft(&format!("t{i}")))
            .collect();
        let e = plan_batch(&over).expect_err("refused");
        assert_eq!(e.path, vec!["tags".to_string()]);
    }

    /// An over-long batch is refused as a batch even when it also carries
    /// a malformed name: the whole-batch fault is the one to report.
    #[test]
    fn the_cap_is_checked_before_the_entries() {
        let mut over: Vec<TagDraft> = (0..MAX_TAGS_PER_BATCH + 1)
            .map(|i| draft(&format!("t{i}")))
            .collect();
        over[0] = draft("not an atom");
        let e = plan_batch(&over).expect_err("refused");
        assert_eq!(e.path, vec!["tags".to_string()]);
    }

    fn standing(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("t{i}")).collect()
    }

    fn tag(name: &str, relevance: f64) -> PlannedTag {
        PlannedTag {
            name: name.to_string(),
            relevance,
            confidence: 1.0,
        }
    }

    /// The boundary itself: the fiftieth topic is the last one the
    /// artifact carries, and the fifty-first is refused.
    #[test]
    fn the_standing_cap_admits_the_fiftieth_topic_and_refuses_the_next() {
        let fresh = [tag("fresh", 0.1)];
        assert!(
            over_the_standing_cap(&standing(MAX_LIVE_TOPICS_PER_ARTIFACT - 1), &fresh).is_none(),
            "the set reaches exactly the cap"
        );
        let refusal = over_the_standing_cap(&standing(MAX_LIVE_TOPICS_PER_ARTIFACT), &fresh)
            .expect("refused");
        assert!(refusal.contains("withdraw one first"), "{refusal}");
    }

    /// The cap counts what stands: an un-tag is a further Tag at
    /// relevance 0, the fold drops it, and its slot comes back.
    #[test]
    fn an_untagged_topic_frees_its_slot_under_the_standing_cap() {
        let mut live = standing(MAX_LIVE_TOPICS_PER_ARTIFACT);
        live.pop();
        assert!(over_the_standing_cap(&live, &[tag("fresh", 0.1)]).is_none());
    }

    /// Withdrawing is never refused for want of room — a full artifact
    /// must stay un-taggable, or the cap would trap the author inside it.
    #[test]
    fn the_un_tag_is_admitted_at_the_standing_cap() {
        let live = standing(MAX_LIVE_TOPICS_PER_ARTIFACT);
        assert!(over_the_standing_cap(&live, &[tag("fresh", 0.0)]).is_none());
        assert!(
            over_the_standing_cap(&live, &[tag("t3", 0.0)]).is_none(),
            "un-tagging a standing topic is what frees a slot"
        );
    }

    /// Re-declaring a topic the author already stands on claims no slot —
    /// newest-wins replaces the winner rather than adding a chip.
    #[test]
    fn re_declaring_a_standing_topic_claims_no_further_slot() {
        let live = standing(MAX_LIVE_TOPICS_PER_ARTIFACT);
        assert!(over_the_standing_cap(&live, &[tag("t7", 0.9)]).is_none());
    }

    #[test]
    fn names_colliding_after_canonicalization_are_refused() {
        let batch = [draft("rust"), draft("Rust")];
        let e = plan_batch(&batch).expect_err("refused");
        assert_eq!(
            e.path,
            vec!["tags".to_string(), "1".to_string(), "name".to_string()],
            "the later declaration is the offender"
        );
        assert!(e.message.contains("rust"), "{}", e.message);
    }

    #[test]
    fn the_sigil_does_not_make_a_name_distinct() {
        let batch = [draft("rust"), draft("#rust")];
        assert!(plan_batch(&batch).is_err());
    }

    #[test]
    fn a_batch_entry_refusal_carries_its_index() {
        let batch = [draft("ok"), draft("also-ok"), draft("nope!")];
        let e = plan_batch(&batch).expect_err("refused");
        assert_eq!(
            e.path,
            vec!["tags".to_string(), "2".to_string(), "name".to_string()]
        );
    }

    #[test]
    fn an_empty_batch_plans_to_nothing() {
        assert!(plan_batch(&[]).expect("legal").is_empty());
    }

    /// The census transposes on the T-leg, so the gesture must carry
    /// `(r, c)` for that transposition to land where the fold reads it.
    #[test]
    fn the_gesture_writes_the_act_tuple_never_a_leg_rendering() {
        let tag = PlannedTag {
            name: "rust".into(),
            relevance: -0.25,
            confidence: 0.75,
        };
        let middle = NodeId::parse("mint:act:alice:0:publish").expect("node");
        let g = tag_gesture("alice", middle.clone(), &tag, vec![]).expect("gesture");
        assert_eq!(g.p_d, -0.25, "p_d carries relevance");
        assert_eq!(g.p_i, 0.75, "p_i carries confidence");
        assert_eq!(g.family, Family::Tag);
        assert_eq!(g.middle, Some(middle));
        assert!(matches!(g.target, Target::Node(NodeId::Name(ref n)) if n == "rust"));
        assert!(g.payload.is_empty(), "a topic claim carries no payload");
    }

    #[test]
    fn the_gesture_is_a_well_formed_tag() {
        let tag = PlannedTag {
            name: "rust".into(),
            relevance: 1.0,
            confidence: 0.0,
        };
        let middle = NodeId::parse("mint:act:alice:0:publish").expect("node");
        let g = tag_gesture("alice", middle, &tag, vec![]).expect("gesture");
        g.family.params_check(g.p_d, g.p_i).expect("params");
        let target = match &g.target {
            Target::Node(n) => n.clone(),
            Target::OwnMint => panic!("a tag never targets its own mint"),
        };
        g.family
            .endpoint_check(
                "alice",
                &NodeId::Addr("alice".into()),
                g.middle.as_ref(),
                &target,
            )
            .expect("endpoints");
    }
}
