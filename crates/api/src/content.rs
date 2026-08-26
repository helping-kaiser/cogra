//! ´mod:module:content´
//!
//! Content authoring and promotion — slice 2 (post.md, comment.md,
//! api-spec.md "Content authoring").
//!
//! Prepare-side: build the Publish / Review gestures with Peer Content
//! Envelope payloads and stage them through the ordinary write path.
//! Confirm-side: promote landed content records into carriage and display
//! rows (architecture.md "The write path" step 5).
//!
//! Nothing here is authoritative about the graph — the display rows and
//! their landing-order columns are projections of the mirror, and the
//! envelope bytes verify against the L1 witness.

use common::envelope::CograContent;
use common::l1::census::Family;
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::LandingOrder;
use postgres_store::{PgPool, auth as store, content as content_store, mirror, staged};
use uuid::Uuid;

use crate::ingest::PromotionFailure;
use crate::l1::L1Boundary;
use crate::prepare::{self, Gesture, PrepareError, Target};
use crate::topics::{self, TagDraft, TagError, TopicsError};

/// The low-defaults stance value (invitations.md §3): defaults sit low
/// so stronger stances stay expressible.
pub const DEFAULT_STANCE: f64 = 0.1;

/// The resolution the canonical string renders and the wire accepts:
/// three decimal places. A degree is a judgment, not a measurement, so
/// the grid is coarse enough to be readable and fine enough that no
/// tier CoGra publishes needs rounding.
const AXIS_STEPS: f64 = 1000.0;

/// License qualifiers, declared at authoring time and immutable
/// (post.md §1; platform-guidelines.md §5). Both axes are degrees on
/// `[0, 1]` — attribution `a` and provenance `o` (layer1-interface.md
/// §10); neither is a switch. The pair rides
/// the structural record as public protocol references
/// (layer1-interface.md §8.2) — never the envelope, so it survives every
/// payload state.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct License {
    pub attribution: f64,
    pub provenance: f64,
}

impl License {
    /// Public Domain, `(a, o) = (0, 0)`: the unique point of zero
    /// severity, where a use carries no downstream obligation whatever
    /// (layer1-interface.md §10). CoGra's default license.
    pub const PUBLIC_DOMAIN: Self = Self {
        attribution: 0.0,
        provenance: 0.0,
    };

    /// Checks a caller-supplied pair and snaps each axis to the
    /// published grid. Refuses anything off the square or finer than the
    /// grid, rather than silently publishing bytes the author did not
    /// choose.
    pub fn checked(attribution: f64, provenance: f64) -> Result<Self, ContentError> {
        Ok(Self {
            attribution: axis("license.attribution", attribution)?,
            provenance: axis("license.provenance", provenance)?,
        })
    }

    /// The canonical structural string CoGra publishes
    /// (data-model.md "License qualifiers"): `a=<degree>;o=<degree>`,
    /// each degree a decimal on `[0, 1]` with trailing zeros trimmed.
    pub fn canonical(&self) -> String {
        format!(
            "a={};o={}",
            render_axis(self.attribution),
            render_axis(self.provenance)
        )
    }

    /// The pair a canonical string encodes; None when the string is not
    /// one CoGra published. The read side has no license of its own to
    /// fall back on — a record's own bytes are the only source.
    pub fn parse(canonical: &str) -> Option<Self> {
        let (a, o) = canonical.split_once(';')?;
        let attribution = parse_axis(a.strip_prefix("a=")?)?;
        let provenance = parse_axis(o.strip_prefix("o=")?)?;
        Some(Self {
            attribution,
            provenance,
        })
    }
}

fn axis(field: &'static str, value: f64) -> Result<f64, ContentError> {
    if !value.is_finite() || !(0.0..=1.0).contains(&value) {
        return Err(ContentError::BadInput {
            field,
            message: "a license axis is a degree on [0, 1]".into(),
        });
    }
    let steps = value * AXIS_STEPS;
    if (steps - steps.round()).abs() > 1e-6 {
        return Err(ContentError::BadInput {
            field,
            message: "a license axis carries at most three decimal places".into(),
        });
    }
    Ok(steps.round() / AXIS_STEPS)
}

fn render_axis(value: f64) -> String {
    let rendered = format!("{value:.3}");
    rendered
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_owned()
}

fn parse_axis(value: &str) -> Option<f64> {
    let parsed: f64 = value.parse().ok()?;
    (parsed.is_finite() && (0.0..=1.0).contains(&parsed)).then_some(parsed)
}

#[cfg(test)]
mod license_tests {
    use super::{AXIS_STEPS, ContentError, License};

    #[test]
    fn canonical_renders_the_published_tiers() {
        let cases = [
            (0.0, 0.0, "a=0;o=0"),
            (0.5, 0.0, "a=0.5;o=0"),
            (1.0, 0.5, "a=1;o=0.5"),
            (1.0, 1.0, "a=1;o=1"),
        ];
        for (attribution, provenance, expected) in cases {
            let license = License {
                attribution,
                provenance,
            };
            assert_eq!(license.canonical(), expected);
        }
    }

    #[test]
    fn canonical_round_trips_across_the_whole_grid() {
        for steps in 0..=1000 {
            let license = License::checked(
                f64::from(steps) / AXIS_STEPS,
                f64::from(1000 - steps) / AXIS_STEPS,
            )
            .expect("every grid point is a license");
            assert_eq!(License::parse(&license.canonical()), Some(license));
        }
    }

    #[test]
    fn every_string_the_retired_ladder_published_still_parses() {
        for a in ["0", "1"] {
            for o in ["0", "0.5", "1"] {
                let ladder = format!("a={a};o={o}");
                let parsed = License::parse(&ladder).expect("a ladder string is a float pair");
                assert_eq!(parsed.canonical(), ladder);
            }
        }
    }

    #[test]
    fn parse_refuses_what_cogra_never_published() {
        for bad in [
            "a=0",
            "a=0;o",
            "o=0;a=0",
            "a=;o=0",
            "a=2;o=0",
            "a=-0.5;o=0",
            "a=0;o=NONE",
            "",
        ] {
            assert!(License::parse(bad).is_none(), "{bad} parsed");
        }
    }

    #[test]
    fn checked_accepts_the_whole_square() {
        assert_eq!(
            License::checked(0.25, 0.75).expect("interior points are licenses"),
            License {
                attribution: 0.25,
                provenance: 0.75,
            }
        );
    }

    #[test]
    fn checked_refuses_degrees_off_the_square_or_off_the_grid() {
        for (a, o) in [
            (-0.1, 0.0),
            (1.1, 0.0),
            (0.0, f64::NAN),
            (0.0, f64::INFINITY),
            (0.0, 0.0005),
        ] {
            assert!(
                matches!(License::checked(a, o), Err(ContentError::BadInput { .. })),
                "({a}, {o}) was accepted"
            );
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ContentError {
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    /// The referenced content does not exist.
    #[error("not found")]
    NotFound,
    /// The viewer is not the creator — edit eligibility (post.md §4).
    #[error("only the creator's edits win the fold")]
    NotCreator,
    /// A topic declaration in the creation batch was refused; the path
    /// names the offending entry.
    #[error(transparent)]
    Tags(#[from] TagError),
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<TopicsError> for ContentError {
    fn from(e: TopicsError) -> Self {
        match e {
            TopicsError::BadInput(e) => Self::Tags(e),
            TopicsError::Prepare(e) => Self::Prepare(e),
            TopicsError::Internal(m) => Self::Internal(m),
        }
    }
}

impl From<content_store::ContentError> for ContentError {
    fn from(e: content_store::ContentError) -> Self {
        Self::Internal(e.to_string())
    }
}

impl From<staged::StagedError> for ContentError {
    fn from(e: staged::StagedError) -> Self {
        Self::Internal(e.to_string())
    }
}

impl From<mirror::MirrorError> for ContentError {
    fn from(e: mirror::MirrorError) -> Self {
        Self::Internal(e.to_string())
    }
}

pub struct PostDraft {
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
    pub license: License,
    pub p_directed: Option<f64>,
    /// The topics declared at creation. Explicit structured input, never
    /// parsed from the body, so display content and graph structure stay
    /// decoupled (api-spec.md "Content authoring").
    pub tags: Vec<TagDraft>,
}

/// An edit's complete field set: the payload is the Post's whole new
/// content state, so an absent title or description is a Post without
/// one (post.md §4).
pub struct PostEditDraft {
    pub id: Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
}

pub struct CommentDraft {
    pub target: Uuid,
    pub content: String,
    pub license: License,
    pub p_directed: Option<f64>,
    pub p_interest: Option<f64>,
    /// The topics declared at creation — a Comment is Taggable like any
    /// other passive node (layer1-interface.md §9).
    pub tags: Vec<TagDraft>,
}

pub struct CommentEditDraft {
    pub id: Uuid,
    pub content: String,
}

/// A prepared content write: the staged batch plus the L2 node id the
/// envelope carries (the display row's UUID once it lands).
///
/// Creating content stages a *batch* — the minting record plus one Tag
/// record per declared topic, each its own priced act (api-spec.md
/// "Content authoring"). The minting record is always `writes[0]`; the
/// device signs the whole batch through one handshake loop, so the batch
/// length is what makes the gesture's cost legible before signing.
pub struct PreparedContent {
    pub node: Uuid,
    pub writes: Vec<prepare::Prepared>,
}

impl PreparedContent {
    fn single(node: Uuid, prepared: prepare::Prepared) -> Self {
        Self {
            node,
            writes: vec![prepared],
        }
    }
}

fn stance_range(field: &'static str, v: f64) -> Result<(), ContentError> {
    if (-1.0..=1.0).contains(&v) {
        Ok(())
    } else {
        Err(ContentError::BadInput {
            field,
            message: "stance parameters must lie in [-1, 1]".into(),
        })
    }
}

async fn author_address(pool: &PgPool, viewer: Uuid) -> Result<String, ContentError> {
    store::actor_identity(pool, viewer)
        .await
        .map_err(|e| ContentError::Internal(e.to_string()))?
        .and_then(|identity| identity.l0_address)
        .ok_or_else(|| ContentError::Internal("viewer without an attached address".into()))
}

/// Prepares a new Post: one genesis Publish whose envelope carries the
/// display fields (post.md §1), plus one Tag act per declared topic. The
/// attachment defaults low; `p_i` is census-fixed at 1.
pub async fn prepare_post<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    draft: PostDraft,
) -> Result<PreparedContent, ContentError> {
    let p_d = draft.p_directed.unwrap_or(DEFAULT_STANCE);
    stance_range("pDirected", p_d)?;
    let tags = topics::plan_batch(&draft.tags)?;
    let address = author_address(pool, viewer).await?;
    let node = Uuid::new_v4();
    let payload = CograContent {
        node,
        title: draft.title,
        description: draft.description,
        body: Some(draft.content),
    }
    .encode_payload();
    let prepared = prepare::prepare(
        boundary,
        pool,
        gc_after_epochs,
        viewer,
        Gesture {
            author: address.clone(),
            family: Family::Publish,
            middle: None,
            target: Target::OwnMint,
            p_d,
            p_i: 1.0,
            settlement_ref: None,
            license: Some(draft.license.canonical()),
            asserted_parents: vec![],
            deps: vec![],
            payload,
            node: Some(node),
        },
    )
    .await?;
    let tag_writes = stage_tags(
        pool,
        boundary,
        gc_after_epochs,
        viewer,
        &address,
        &prepared,
        &tags,
    )
    .await?;
    let mut writes = vec![prepared];
    writes.extend(tag_writes);
    Ok(PreparedContent { node, writes })
}

/// The tag half of a creation batch: one Tag per topic, each entering the
/// node the minting record mints.
///
/// The middle is read off the minting record's own target rather than
/// recomputed — for a genesis act that target *is* the node's identifier,
/// and it only exists once prepare has allocated the sequence value. Each
/// Tag declares the minting act as a dependency so the epoch close cannot
/// order a topic claim ahead of the node it claims about
/// (`l1-standin::close` selects only acts whose deps already stand).
async fn stage_tags<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    address: &str,
    minting: &prepare::Prepared,
    tags: &[topics::PlannedTag],
) -> Result<Vec<prepare::Prepared>, ContentError> {
    if tags.is_empty() {
        return Ok(Vec::new());
    }
    let middle = minting.proposal.body.target.clone();
    let deps = vec![minting.proposal.body.act_id()];
    let site = topics::TagSite {
        author: address,
        middle: &middle,
        deps: &deps,
    };
    Ok(topics::stage_tags(pool, boundary, gc_after_epochs, viewer, site, tags).await?)
}

/// Prepares a Post edit: an ordinary-role Publish toward the existing
/// Content node at attachment 0, chained behind the current head
/// (post.md §4; substrate.md §9). Eligibility (creator only) and
/// serialization (one in-flight edit per node and author) are enforced
/// here — the API refuses to prepare a record its fold would never
/// read (api-spec.md "Conventions").
pub async fn prepare_post_edit<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    draft: PostEditDraft,
) -> Result<PreparedContent, ContentError> {
    let post = content_store::post(pool, draft.id)
        .await?
        .ok_or(ContentError::NotFound)?;
    if post.author_id != viewer {
        return Err(ContentError::NotCreator);
    }
    let address = author_address(pool, viewer).await?;
    let node =
        chained_edit_target(pool, viewer, Family::Publish, &post.l1_node_id, &address).await?;
    let payload = CograContent {
        node: post.id,
        title: draft.title,
        description: draft.description,
        body: Some(draft.content),
    }
    .encode_payload();
    let prepared = prepare::prepare(
        boundary,
        pool,
        gc_after_epochs,
        viewer,
        Gesture {
            author: address,
            family: Family::Publish,
            middle: None,
            target: Target::Node(node.target),
            p_d: 0.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![node.parent],
            deps: vec![],
            payload,
            node: Some(post.id),
        },
    )
    .await?;
    Ok(PreparedContent::single(post.id, prepared))
}

/// Prepares a new Comment: one genesis Review — A leg to the parent,
/// terminal leg minting the Comment (comment.md §1) — plus one Tag act
/// per declared topic. This slice offers the comment box on Posts and
/// Comments (which parents the UI offers is product policy, never a
/// substrate limit — comment.md §1).
pub async fn prepare_comment<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    draft: CommentDraft,
) -> Result<PreparedContent, ContentError> {
    let p_d = draft.p_directed.unwrap_or(DEFAULT_STANCE);
    let p_i = draft.p_interest.unwrap_or(DEFAULT_STANCE);
    stance_range("pDirected", p_d)?;
    stance_range("pInterest", p_i)?;
    let tags = topics::plan_batch(&draft.tags)?;
    let parent = parent_node(pool, draft.target).await?;
    let address = author_address(pool, viewer).await?;
    let node = Uuid::new_v4();
    let payload = CograContent {
        node,
        title: None,
        description: None,
        body: Some(draft.content),
    }
    .encode_payload();
    let prepared = prepare::prepare(
        boundary,
        pool,
        gc_after_epochs,
        viewer,
        Gesture {
            author: address.clone(),
            family: Family::Review,
            middle: Some(parent),
            target: Target::OwnMint,
            p_d,
            p_i,
            settlement_ref: None,
            license: Some(draft.license.canonical()),
            asserted_parents: vec![],
            deps: vec![],
            payload,
            node: Some(node),
        },
    )
    .await?;
    let tag_writes = stage_tags(
        pool,
        boundary,
        gc_after_epochs,
        viewer,
        &address,
        &prepared,
        &tags,
    )
    .await?;
    let mut writes = vec![prepared];
    writes.extend(tag_writes);
    Ok(PreparedContent { node, writes })
}

/// Prepares a Comment edit: an ordinary-role Review at (0,0) — A leg to
/// the genesis parent, terminal leg to the existing Comment
/// (comment.md §4).
pub async fn prepare_comment_edit<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    draft: CommentEditDraft,
) -> Result<PreparedContent, ContentError> {
    let comment = content_store::comment(pool, draft.id)
        .await?
        .ok_or(ContentError::NotFound)?;
    if comment.author_id != viewer {
        return Err(ContentError::NotCreator);
    }
    let address = author_address(pool, viewer).await?;
    let node =
        chained_edit_target(pool, viewer, Family::Review, &comment.l1_node_id, &address).await?;
    let parent = parent_node(pool, comment.target_id).await?;
    let payload = CograContent {
        node: comment.id,
        title: None,
        description: None,
        body: Some(draft.content),
    }
    .encode_payload();
    let prepared = prepare::prepare(
        boundary,
        pool,
        gc_after_epochs,
        viewer,
        Gesture {
            author: address,
            family: Family::Review,
            middle: Some(parent),
            target: Target::Node(node.target),
            p_d: 0.0,
            p_i: 0.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![node.parent],
            deps: vec![],
            payload,
            node: Some(comment.id),
        },
    )
    .await?;
    Ok(PreparedContent::single(comment.id, prepared))
}

struct ChainedTarget {
    target: NodeId,
    parent: ActId,
}

/// The edit-chain plumbing shared by both edit prepares: refuse a
/// second in-flight edit per (node, author), and assert the current
/// chain head as the causal parent (substrate.md §9 "Chain root" — the
/// backend populates the parent and serializes edits, so CoGra's own
/// clients never author a branch).
///
/// The display row exists, so the genesis record landed: a missing chain
/// head is therefore a diverged mirror — an operational fault, not user
/// input.
async fn chained_edit_target(
    pool: &PgPool,
    viewer: Uuid,
    family: Family,
    l1_node_id: &str,
    author: &str,
) -> Result<ChainedTarget, ContentError> {
    if staged::has_pending_targeting(pool, viewer, family, l1_node_id).await? {
        return Err(ContentError::BadInput {
            field: "id",
            message: "an edit of this content is already in flight".into(),
        });
    }
    let head = mirror::chain_head(pool, author, family, l1_node_id)
        .await?
        .ok_or_else(|| ContentError::Internal("edit chain head missing from the mirror".into()))?;
    let target = NodeId::parse(l1_node_id)
        .map_err(|e| ContentError::Internal(format!("stored node id unparseable: {e}")))?;
    let parent = ActId::parse(&head)
        .map_err(|e| ContentError::Internal(format!("chain head unparseable: {e}")))?;
    Ok(ChainedTarget { target, parent })
}

/// Resolves a comment target UUID to its minted node identifier — a
/// Post or Comment this slice.
async fn parent_node(pool: &PgPool, target: Uuid) -> Result<NodeId, ContentError> {
    let node_string = match content_store::content_kind(pool, target).await? {
        Some("post") => {
            content_store::post(pool, target)
                .await?
                .ok_or(ContentError::NotFound)?
                .l1_node_id
        }
        Some("comment") => {
            content_store::comment(pool, target)
                .await?
                .ok_or(ContentError::NotFound)?
                .l1_node_id
        }
        _ => {
            return Err(ContentError::BadInput {
                field: "target",
                message: "target is not commentable content".into(),
            });
        }
    };
    NodeId::parse(&node_string)
        .map_err(|e| ContentError::Internal(format!("stored node id unparseable: {e}")))
}

/// Pre-commitment materialization (substrate.md §6; architecture.md
/// "The write path"): from the moment the author signs, a content write's
/// display rows exist and read to everyone, marked pending. A write that
/// mints or edits nothing — Registration, Opinion, Attach — has nothing
/// to materialize and returns quietly.
///
/// `created_at` is the authoring instant the pre-sign leg recorded — the
/// caller has it from `record_pre_signed`, so nothing here reloads the
/// row it was just handed.
///
/// Idempotent, because the pre-sign leg accepts a retry: the entity row
/// is inserted only once, and a version row keyed by the same authoring
/// instant collides with itself.
pub async fn stage_pending(
    pool: &PgPool,
    write: &staged::StagedWrite,
    created_at: chrono::DateTime<chrono::Utc>,
) -> Result<(), ContentError> {
    let body = &write.proposal.body;
    let family = match body.family {
        f @ (Family::Publish | Family::Review) => f,
        _ => return Ok(()),
    };
    if write.node_id.is_none() {
        return Ok(());
    }
    let content = CograContent::decode_payload(&write.proposal.payload)
        .map_err(|e| ContentError::Internal(format!("staged payload not admissible: {e}")))?;
    let own_mint = NodeId::Mint(ActId {
        author: body.author.clone(),
        seq: body.seq,
        family: body.family,
    })
    .to_string();
    let target = body.target.to_string();
    let is_genesis = target == own_mint;

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ContentError::Internal(e.to_string()))?;
    match (family, is_genesis) {
        (Family::Publish, true) => {
            content_store::insert_post(
                &mut tx,
                content.node,
                write.actor_id,
                &target,
                record_license(body)?,
                None,
                created_at,
                clear_to_null(&content.title),
                clear_to_null(&content.description),
                content.body.as_deref().unwrap_or_default(),
            )
            .await?;
        }
        (Family::Publish, false) => {
            let post = content_store::post(pool, content.node)
                .await?
                .ok_or(ContentError::NotFound)?;
            content_store::insert_post_version(
                &mut tx,
                post.id,
                clear_to_null(&content.title),
                clear_to_null(&content.description),
                content.body.as_deref().unwrap_or_default(),
                None,
                created_at,
            )
            .await?;
        }
        (Family::Review, true) => {
            let (target_id, target_type) = comment_parent(pool, body).await?;
            content_store::insert_comment(
                &mut tx,
                content.node,
                target_id,
                target_type,
                write.actor_id,
                &target,
                record_license(body)?,
                None,
                created_at,
                content.body.as_deref().unwrap_or_default(),
            )
            .await?;
        }
        (Family::Review, false) => {
            let comment = content_store::comment(pool, content.node)
                .await?
                .ok_or(ContentError::NotFound)?;
            content_store::insert_comment_version(
                &mut tx,
                comment.id,
                content.body.as_deref().unwrap_or_default(),
                None,
                created_at,
            )
            .await?;
        }
        _ => unreachable!("filtered to content families above"),
    }
    tx.commit()
        .await
        .map_err(|e| ContentError::Internal(e.to_string()))?;
    Ok(())
}

/// A content record's canonical license string. Declaration is mandatory
/// at authoring time (platform-guidelines.md §5), so a content record
/// reaching promotion without one is a broken record — not a
/// public-domain one, which is a choice only its author can make.
fn record_license(body: &common::l1::handshake::StructuralBody) -> Result<&str, ContentError> {
    body.license
        .as_deref()
        .ok_or_else(|| ContentError::Internal("content record without license qualifiers".into()))
}

/// A genesis Review's parent as the display store names it — the A leg's
/// node, pending or landed alike (a pending comment on a pending post is
/// two staged writes and one thread).
async fn comment_parent(
    pool: &PgPool,
    body: &common::l1::handshake::StructuralBody,
) -> Result<(Uuid, &'static str), ContentError> {
    let parent = body
        .middle
        .as_ref()
        .ok_or_else(|| ContentError::Internal("review without a parent leg".into()))?
        .to_string();
    if let Some(post) = content_store::post_by_node(pool, &parent).await? {
        Ok((post.id, "post"))
    } else if let Some(comment) = content_store::comment_by_node(pool, &parent).await? {
        Ok((comment.id, "comment"))
    } else {
        Err(ContentError::Internal(
            "comment parent has no display row".into(),
        ))
    }
}

/// Confirm-side promotion (architecture.md "The write path" step 5):
/// for every landed content record, move the payload into permanent
/// carriage and drop the display rows' pending mark. A failure leaves
/// the record un-promoted — the mirror governs, and a later rebuild can
/// re-run promotion — and is returned rather than swallowed, so the
/// ingestion pass reports what did not follow.
pub async fn land_promoted(
    pool: &PgPool,
    promoted: &[staged::PromotedWrite],
) -> Vec<PromotionFailure> {
    let mut failures = Vec::new();
    for write in promoted {
        let family = match common::l1::census::Family::parse(&write.family) {
            Some(f @ (Family::Publish | Family::Review)) => f,
            _ => continue,
        };
        if let Err(e) = land_one(pool, write, family).await {
            failures.push(PromotionFailure {
                stage: "content",
                staged: write.id,
                act_id: write.act_id.clone(),
                error: e.to_string(),
            });
        }
    }
    failures
}

/// Promotes one landed content record into carriage and display rows.
///
/// An expired write still carries its payload — expiry stops serving the
/// content, the reap is what destroys it — so a record landing in that
/// window promotes like any other, and the insert branches rebuild the
/// display rows expiry took down, this time under the real landing order.
/// Past the reap there is no row left to load and the promotion fails
/// loudly.
///
/// Those insert branches are otherwise the uncommon path: the rows are
/// normally already on screen from the pre-commitment, so landing only
/// writes the causal key onto them. An insert means a record landed
/// without a pending row of its own — a mirror rebuild, or a write staged
/// before pending rows existed.
async fn land_one(
    pool: &PgPool,
    write: &staged::PromotedWrite,
    family: Family,
) -> Result<(), ContentError> {
    let staged_row = staged::load(pool, write.id).await?;
    let payload = &staged_row.proposal.payload;
    let sealed = staged_row
        .sealed
        .as_ref()
        .ok_or_else(|| ContentError::Internal("landed write without sealed parts".into()))?;
    let content = CograContent::decode_payload(payload)
        .map_err(|e| ContentError::Internal(format!("landed payload not admissible: {e}")))?;
    let meta = mirror::record_meta(pool, &write.act_id)
        .await?
        .ok_or_else(|| ContentError::Internal("promoted record missing from mirror".into()))?;
    let order = LandingOrder {
        landed_epoch: meta.epoch,
        act_time: meta.act_time,
        position: meta.position,
    };
    let body = &staged_row.proposal.body;
    let own_mint = NodeId::Mint(ActId {
        author: body.author.clone(),
        seq: body.seq,
        family: body.family,
    })
    .to_string();
    let target = body.target.to_string();
    let is_genesis = target == own_mint;

    let created_at = staged_row.pre_signed_at.unwrap_or_else(chrono::Utc::now);

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ContentError::Internal(e.to_string()))?;
    content_store::insert_act_payload(&mut tx, &write.act_id, payload, &sealed.content_salt)
        .await?;
    match (family, is_genesis) {
        (Family::Publish, true) => {
            if content_store::land_post(&mut tx, content.node, order).await? {
                content_store::land_post_version(&mut tx, content.node, created_at, order).await?;
            } else {
                content_store::insert_post(
                    &mut tx,
                    content.node,
                    write.actor_id,
                    &target,
                    record_license(body)?,
                    Some(order),
                    created_at,
                    clear_to_null(&content.title),
                    clear_to_null(&content.description),
                    content.body.as_deref().unwrap_or_default(),
                )
                .await?;
            }
        }
        (Family::Publish, false) => {
            let post = content_store::post_by_node(pool, &target)
                .await?
                .ok_or_else(|| ContentError::Internal("edited post has no display row".into()))?;
            if !content_store::land_post_version(&mut tx, post.id, created_at, order).await? {
                content_store::insert_post_version(
                    &mut tx,
                    post.id,
                    clear_to_null(&content.title),
                    clear_to_null(&content.description),
                    content.body.as_deref().unwrap_or_default(),
                    Some(order),
                    created_at,
                )
                .await?;
            }
        }
        (Family::Review, true) => {
            if content_store::land_comment(&mut tx, content.node, order).await? {
                content_store::land_comment_version(&mut tx, content.node, created_at, order)
                    .await?;
            } else {
                let (target_id, target_type) = comment_parent(pool, body).await?;
                content_store::insert_comment(
                    &mut tx,
                    content.node,
                    target_id,
                    target_type,
                    write.actor_id,
                    &target,
                    record_license(body)?,
                    Some(order),
                    created_at,
                    content.body.as_deref().unwrap_or_default(),
                )
                .await?;
            }
        }
        (Family::Review, false) => {
            let comment = content_store::comment_by_node(pool, &target)
                .await?
                .ok_or_else(|| {
                    ContentError::Internal("edited comment has no display row".into())
                })?;
            if !content_store::land_comment_version(&mut tx, comment.id, created_at, order).await? {
                content_store::insert_comment_version(
                    &mut tx,
                    comment.id,
                    content.body.as_deref().unwrap_or_default(),
                    Some(order),
                    created_at,
                )
                .await?;
            }
        }
        _ => unreachable!("filtered to content families above"),
    }
    tx.commit()
        .await
        .map_err(|e| ContentError::Internal(e.to_string()))?;
    Ok(())
}

/// A snapshot's optional display field: absent or empty stores NULL,
/// text stores itself.
fn clear_to_null(field: &Option<String>) -> Option<&str> {
    field.as_deref().filter(|s| !s.is_empty())
}
