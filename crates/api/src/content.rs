// Content authoring and promotion — slice 2 (post.md, comment.md,
// api-spec.md "Content authoring"). Prepare-side: build the Publish /
// Review gestures with Peer Content Envelope payloads and stage them
// through the ordinary write path. Confirm-side: promote landed content
// records into carriage and display rows (architecture.md "The write
// path" step 5). Nothing here is authoritative about the graph — the
// display rows and their landing-order columns are projections of the
// mirror, and the envelope bytes verify against the L1 witness.

use common::envelope::CograContent;
use common::l1::census::Family;
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::LandingOrder;
use postgres_store::{PgPool, auth as store, content as content_store, mirror, staged};
use uuid::Uuid;

use crate::ingest::PromotionFailure;
use crate::l1::L1Boundary;
use crate::prepare::{self, Gesture, PrepareError, Target};

/// The low-defaults stance value (invitations.md §3): defaults sit low
/// so stronger stances stay expressible.
pub const DEFAULT_STANCE: f64 = 0.1;

/// AI-provenance oversight, three-valued (layer1-interface.md §10,
/// `def:content:license-qualifiers`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Oversight {
    /// o = 0 — no AI disclosure required.
    None,
    /// o = 0.5 — generation details disclosed on query.
    Conditional,
    /// o = 1 — full provenance chain published alongside the record.
    Full,
}

/// License qualifiers, declared at authoring time and immutable
/// (post.md §1; platform-guidelines.md §5). They ride the structural
/// record as public protocol references (layer1-interface.md §8.2) —
/// never the envelope, so they survive every payload state.
#[derive(Debug, Clone, Copy)]
pub struct License {
    pub attribution: bool,
    pub oversight: Oversight,
}

impl License {
    /// The canonical structural string CoGra publishes
    /// (data-model.md "License qualifiers"): `a=<0|1>;o=<0|0.5|1>`.
    pub fn canonical(&self) -> String {
        let a = u8::from(self.attribution);
        let o = match self.oversight {
            Oversight::None => "0",
            Oversight::Conditional => "0.5",
            Oversight::Full => "1",
        };
        format!("a={a};o={o}")
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
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error("internal: {0}")]
    Internal(String),
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
}

pub struct CommentEditDraft {
    pub id: Uuid,
    pub content: String,
}

/// A prepared content write: the staged handshake plus the L2 node id
/// the envelope carries (the display row's UUID once it lands).
pub struct PreparedContent {
    pub node: Uuid,
    pub prepared: prepare::Prepared,
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
/// display fields (post.md §1). The attachment defaults low; `p_i` is
/// census-fixed at 1.
pub async fn prepare_post<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    draft: PostDraft,
) -> Result<PreparedContent, ContentError> {
    let p_d = draft.p_directed.unwrap_or(DEFAULT_STANCE);
    stance_range("pDirected", p_d)?;
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
            author: address,
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
    Ok(PreparedContent { node, prepared })
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
    Ok(PreparedContent {
        node: post.id,
        prepared,
    })
}

/// Prepares a new Comment: one genesis Review — A leg to the parent,
/// terminal leg minting the Comment (comment.md §1). This slice offers
/// the comment box on Posts and Comments (which parents the UI offers
/// is product policy, never a substrate limit — comment.md §1).
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
            author: address,
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
    Ok(PreparedContent { node, prepared })
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
    Ok(PreparedContent {
        node: comment.id,
        prepared,
    })
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
        .ok_or_else(|| {
            // The display row exists, so the genesis record landed; a
            // missing head means the mirror diverged — an operational
            // fault, not a user input.
            ContentError::Internal("edit chain head missing from the mirror".into())
        })?;
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
                None,
                created_at,
                clear_to_null(&content.title),
                clear_to_null(&content.description),
                content.body.as_deref().unwrap_or_default(),
            )
            .await?;
        }
        (Family::Publish, false) => {
            // The pending edit's own text shows at once, marked pending —
            // an edit is a record, and a prepared record is its author's
            // content from the moment they sign it (substrate.md §6).
            let post = content_store::post(pool, content.node)
                .await?
                .ok_or(ContentError::NotFound)?;
            content_store::insert_post_version(
                &mut tx,
                post.id,
                clear_to_null(&content.title),
                clear_to_null(&content.description),
                content.body.as_deref().unwrap_or_default(),
                true,
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
                true,
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

async fn land_one(
    pool: &PgPool,
    write: &staged::PromotedWrite,
    family: Family,
) -> Result<(), ContentError> {
    // An expired write still carries its payload — expiry stops serving
    // the content, the reap is what destroys it — so a record landing in
    // that window promotes like any other, and the insert branches below
    // rebuild the display rows expiry took down, this time with the real
    // landing order. Past the reap there is no row to load and the
    // promotion fails loudly.
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

    // The rows are normally already on screen from the pre-commitment, so
    // landing writes the causal key onto them; the insert branches serve a
    // record that landed without a pending row of its own — a mirror
    // rebuild, or a write staged before pending rows existed.
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
                content_store::land_post_version(&mut tx, content.node, created_at).await?;
            } else {
                content_store::insert_post(
                    &mut tx,
                    content.node,
                    write.actor_id,
                    &target,
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
            if !content_store::land_post_version(&mut tx, post.id, created_at).await? {
                content_store::insert_post_version(
                    &mut tx,
                    post.id,
                    clear_to_null(&content.title),
                    clear_to_null(&content.description),
                    content.body.as_deref().unwrap_or_default(),
                    false,
                    created_at,
                )
                .await?;
            }
        }
        (Family::Review, true) => {
            if content_store::land_comment(&mut tx, content.node, order).await? {
                content_store::land_comment_version(&mut tx, content.node, created_at).await?;
            } else {
                let (target_id, target_type) = comment_parent(pool, body).await?;
                content_store::insert_comment(
                    &mut tx,
                    content.node,
                    target_id,
                    target_type,
                    write.actor_id,
                    &target,
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
            if !content_store::land_comment_version(&mut tx, comment.id, created_at).await? {
                content_store::insert_comment_version(
                    &mut tx,
                    comment.id,
                    content.body.as_deref().unwrap_or_default(),
                    false,
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
