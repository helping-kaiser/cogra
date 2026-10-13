//! ´mod:module:schema-notifications´
//!
//! The notification list's GraphQL vocabulary (api-spec.md "Private
//! viewer state"; notifications.md "The contract"): the row, its kind,
//! the connection `User.notifications` serves, and the two read-state
//! mutations' inputs and payloads.

use std::collections::HashMap;

use async_graphql::connection::{Connection, Edge};
use async_graphql::dataloader::DataLoader;
use async_graphql::{Context, Enum, InputObject, Object, SimpleObject};
use chrono::{DateTime, Utc};
use postgres_store::notifications::{self as store, Kind};
use postgres_store::{PgPool, auth as auth_store, mirror};
use uuid::Uuid;

use super::types::{
    Actor, Application, CommentType, DEFAULT_PAGE_SIZE, Node, PostType, Record, User, UserError,
    resolve_node_id, validate_page_args,
};
use crate::loaders::ActorByIdLoader;
use crate::nodes::ContentNode;

/// The nine addressed acts. A kind is the act plus what it reached,
/// which is what a reader needs to know before opening.
#[derive(Enum, Copy, Clone, Debug, PartialEq, Eq)]
pub enum NotificationKind {
    /// A comment on the viewer's post.
    Comment,
    /// A reply to the viewer's comment.
    Reply,
    /// A citation whose target is the viewer's profile.
    Mention,
    /// A citation whose target is the viewer's post or comment.
    Citation,
    /// An opinion whose target is the viewer's profile — a first one or a
    /// revision; a withdrawal reports nothing.
    ProfileOpinion,
    /// An application waiting in the viewer's queue became approvable —
    /// email verified and key attached.
    ApplicationApprovable,
    /// An account the viewer vouched for landed — the vouch that completed
    /// its entry was the viewer's.
    InviteLanded,
    /// A member vouched for the viewer's application — their signed
    /// approval.
    ApplicationApproved,
    /// The approver closed the viewer's application without approving it —
    /// that queue entry only; the account and its ask link remain.
    ApplicationRejected,
}

impl NotificationKind {
    fn from_store(kind: Kind) -> Self {
        match kind {
            Kind::Comment => Self::Comment,
            Kind::Reply => Self::Reply,
            Kind::Mention => Self::Mention,
            Kind::Citation => Self::Citation,
            Kind::ProfileOpinion => Self::ProfileOpinion,
            Kind::ApplicationApprovable => Self::ApplicationApprovable,
            Kind::InviteLanded => Self::InviteLanded,
            Kind::ApplicationApproved => Self::ApplicationApproved,
            Kind::ApplicationRejected => Self::ApplicationRejected,
        }
    }
}

/// One notification row with its subject and context already resolved by
/// the page's batch.
pub struct NotificationType {
    row: store::Notification,
    kind: Kind,
    subject: Option<ContentOrProfile>,
    context: Option<ContentOrProfile>,
}

/// A row's subject or context as the page's one batch resolved it.
#[derive(Clone)]
enum ContentOrProfile {
    Content(ContentNode),
    Profile(auth_store::ActorIdentity),
}

impl ContentOrProfile {
    fn node(self) -> Node {
        match self {
            Self::Content(ContentNode::Post(post)) => Node::Post(PostType(post)),
            Self::Content(ContentNode::Comment(comment)) => Node::Comment(CommentType(comment)),
            Self::Profile(identity) => Node::Profile(User {
                identity,
                viewer_session: None,
            }),
        }
    }
}

/// Something another actor did that reached the viewer's content, profile
/// or application — one row per act (notifications.md). A pointer, never a
/// copy: every displayed fact resolves through the nodes, record and
/// application below.
#[Object(name = "Notification")]
impl NotificationType {
    async fn id(&self) -> Uuid {
        self.row.id
    }

    async fn kind(&self) -> NotificationKind {
        NotificationKind::from_store(self.kind)
    }

    /// Who acted. For APPLICATION_APPROVABLE this is the applicant account
    /// — an actor row with a handle and nothing on the graph yet, named
    /// only to the approver of the path that staged it.
    async fn actor(&self, ctx: &Context<'_>) -> async_graphql::Result<Actor> {
        let identity = ctx
            .data::<DataLoader<ActorByIdLoader>>()?
            .load_one(self.row.actor_id)
            .await?
            .ok_or_else(|| async_graphql::Error::new("a notification's actor vanished"))?;
        Ok(Actor::User(User {
            identity,
            viewer_session: None,
        }))
    }

    /// What opening the row lands on: the new comment or reply, the citing
    /// post or comment, the acting actor's profile. Null for
    /// APPLICATION_APPROVABLE and APPLICATION_REJECTED, whose destinations
    /// are the invites screen and the viewer's own application state, and
    /// whenever the node no longer resolves.
    async fn subject(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Node>> {
        if let Some(subject) = &self.subject {
            return Ok(Some(subject.clone().node()));
        }
        if self.row.subject_id.is_some() {
            return Ok(None);
        }
        // A content row whose node had no display row when the row was
        // written resolves through its record: the minted comment, or the
        // citing artifact.
        let leg = match self.kind {
            Kind::Comment | Kind::Reply => "t",
            Kind::Mention | Kind::Citation => "a",
            _ => return Ok(None),
        };
        let Some(record) = self.record_full(ctx).await? else {
            return Ok(None);
        };
        let Some(node) = record.legs.iter().find(|l| l.leg == leg).map(|l| &l.target) else {
            return Ok(None);
        };
        resolve_node_id(ctx, node).await
    }

    /// The viewer's own node the act reached: the post commented on, the
    /// comment replied to, the cited post or comment, the viewer's own
    /// profile for a mention. Null for PROFILE_OPINION and the four
    /// application kinds.
    async fn context(&self) -> Option<Node> {
        self.context.clone().map(ContentOrProfile::node)
    }

    /// The landed L1 record behind the act — the row's traceable source,
    /// and where an opinion row reads its pair. INVITE_LANDED's record is
    /// the admission Registration. Null for APPLICATION_APPROVABLE,
    /// APPLICATION_APPROVED and APPLICATION_REJECTED, which are moments in
    /// an application's life with no record of their own.
    async fn record(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Record>> {
        Ok(self.record_full(ctx).await?.map(Record))
    }

    /// The application the act concerns — the waiting application for
    /// APPLICATION_APPROVABLE, the viewer's own path for
    /// APPLICATION_APPROVED and APPLICATION_REJECTED, the landed path for
    /// INVITE_LANDED; null for the five content kinds. Resolves while the
    /// row exists; an application later closed or landed reads in its
    /// current state.
    async fn application(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Application>> {
        let Some(id) = self.row.application_id else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        Ok(auth_store::application(pool, id).await?.map(Application))
    }

    /// When the act reached the viewer — the moment its landing was
    /// observed, or the moment the account transition committed.
    async fn created_at(&self) -> DateTime<Utc> {
        self.row.created_at
    }

    /// When the viewer opened this row; null while unread.
    async fn read_at(&self) -> Option<DateTime<Utc>> {
        self.row.read_at
    }
}

impl NotificationType {
    async fn record_full(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Option<mirror::RecordFull>> {
        let Some(id) = &self.row.record_id else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        Ok(mirror::record_full(pool, id).await?)
    }
}

/// Resolves a page's subjects and contexts in one batch: the content
/// classes first, then the actors the rest name.
pub(crate) async fn hydrate(
    pool: &PgPool,
    rows: Vec<store::Notification>,
) -> async_graphql::Result<Vec<NotificationType>> {
    let mut ids: Vec<Uuid> = rows
        .iter()
        .flat_map(|r| [r.subject_id, r.context_id])
        .flatten()
        .collect();
    ids.sort_unstable();
    ids.dedup();
    let content = crate::nodes::resolve_content_many(pool, &ids)
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;
    let rest: Vec<Uuid> = ids
        .iter()
        .filter(|id| !content.contains_key(id))
        .copied()
        .collect();
    let actors: HashMap<Uuid, auth_store::ActorIdentity> =
        auth_store::actor_identities_by_ids(pool, &rest)
            .await?
            .into_iter()
            .map(|identity| (identity.id, identity))
            .collect();
    let resolve = |id: Option<Uuid>| -> Option<ContentOrProfile> {
        let id = id?;
        content
            .get(&id)
            .cloned()
            .map(ContentOrProfile::Content)
            .or_else(|| actors.get(&id).cloned().map(ContentOrProfile::Profile))
    };
    rows.into_iter()
        .map(|row| {
            let kind = Kind::parse(&row.kind).ok_or_else(|| {
                async_graphql::Error::new(format!("unknown notification kind {}", row.kind))
            })?;
            Ok(NotificationType {
                subject: resolve(row.subject_id),
                context: resolve(row.context_id),
                kind,
                row,
            })
        })
        .collect()
}

/// Names the connection `NotificationConnection`, as the contract does.
pub struct NotificationConnectionName;

impl async_graphql::connection::ConnectionNameType for NotificationConnectionName {
    fn type_name<T: async_graphql::OutputType>() -> String {
        "NotificationConnection".to_string()
    }
}

/// Names the edge `NotificationEdge`.
pub struct NotificationEdgeName;

impl async_graphql::connection::EdgeNameType for NotificationEdgeName {
    fn type_name<T: async_graphql::OutputType>() -> String {
        "NotificationEdge".to_string()
    }
}

/// A page of the viewer's notification list.
pub type NotificationConnection = Connection<
    String,
    NotificationType,
    NotificationConnectionFields,
    async_graphql::connection::EmptyFields,
    NotificationConnectionName,
    NotificationEdgeName,
    async_graphql::connection::DisableNodesField,
>;

/// `NotificationConnection`'s connection-level fields: the viewer whose
/// list served the edges, so the count runs only when asked.
pub struct NotificationConnectionFields {
    viewer: Uuid,
}

#[Object]
impl NotificationConnectionFields {
    /// How many rows the viewer's list serves, across every page. Priced at
    /// zero like every connection count; saturates at [`i32::MAX`].
    #[graphql(complexity = 0)]
    async fn total_count(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<i32>> {
        let pool = ctx.data::<PgPool>()?;
        let total = store::count(pool, self.viewer).await?;
        Ok(Some(i32::try_from(total).unwrap_or(i32::MAX)))
    }
}

/// One page of `viewer`'s list (api-spec `User.notifications`): keyset on
/// `(createdAt, id)`, newest first, a hidden actor's rows left out.
pub(crate) async fn page(
    ctx: &Context<'_>,
    viewer: Uuid,
    first: Option<i32>,
    after: Option<String>,
    last: Option<i32>,
    before: Option<String>,
) -> async_graphql::Result<NotificationConnection> {
    let pool = ctx.data::<PgPool>()?;
    validate_page_args(first, last, after.as_deref(), before.as_deref())
        .map_err(|e| super::query::bad_input(e.message))?;
    let backward = last.is_some() || before.is_some();
    let cursor = match if backward { &before } else { &after } {
        Some(raw) => Some(
            crate::notifications::decode_cursor(raw)
                .ok_or_else(|| super::query::bad_input("invalid cursor"))?,
        ),
        None => None,
    };
    let limit = i64::from(last.or(first).unwrap_or(DEFAULT_PAGE_SIZE));
    let mut rows = store::list(pool, viewer, cursor, backward, limit + 1).await?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        if backward {
            rows.remove(0);
        } else {
            rows.pop();
        }
    }
    let (has_previous, has_next) = if backward {
        (has_more, cursor.is_some())
    } else {
        (cursor.is_some(), has_more)
    };
    let mut connection = NotificationConnection::with_additional_fields(
        has_previous,
        has_next,
        NotificationConnectionFields { viewer },
    );
    connection
        .edges
        .extend(hydrate(pool, rows).await?.into_iter().map(|item| {
            Edge::new(crate::notifications::encode_cursor(item.row.cursor()), item)
        }));
    Ok(connection)
}

/// Clears the bell's dot: the seen pointer moves to `through`.
#[derive(InputObject)]
pub struct MarkNotificationsSeenInput {
    /// The createdAt of the newest row the opened list holds — everything
    /// at or before it becomes seen. A row that arrived after the list was
    /// read stays unseen and lights the bell at the next root load. A
    /// moment after now is BAD_INPUT.
    pub through: DateTime<Utc>,
}

/// The bell as the moved pointer leaves it.
#[derive(SimpleObject)]
pub struct MarkNotificationsSeenPayload {
    /// Whether anything is still unseen — a row that arrived after
    /// `through`.
    pub has_unread_notifications: Option<bool>,
    pub user_errors: Vec<UserError>,
}

/// Marks one row read.
#[derive(InputObject)]
pub struct MarkNotificationReadInput {
    /// One of the viewer's own rows.
    pub notification: Uuid,
}

/// The row as the mark leaves it.
#[derive(SimpleObject)]
pub struct MarkNotificationReadPayload {
    pub notification: Option<NotificationType>,
    pub user_errors: Vec<UserError>,
}
