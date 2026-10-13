//! ´mod:module:app-versions´
//!
//! `appVersions` (api-spec.md "Application versions"): the release
//! registry read, newest first, anonymous like every read. Each client
//! reads its own component and finds the version running here in the
//! list; a newer release above it is what the client calls behind.
//!
//! The registry is not record-backed, so its cursor is its own — a keyset
//! over `(releasedAt, component, version)`, which the primary key makes
//! unique — and the landing-order helpers do not apply. Bad page
//! arguments refuse exactly as theirs do: a message-only validation
//! error.

use async_graphql::connection::{Connection, Edge};
use async_graphql::{Context, Object, SimpleObject};
use chrono::{DateTime, Utc};
use postgres_store::PgPool;
use postgres_store::registry::Release;
use uuid::Uuid;

use super::types::{DEFAULT_PAGE_SIZE, validate_page_args};
use crate::registry::{AppComponent, decode_cursor, encode_cursor};

/// One release of a platform component, from the append-only
/// application registry — operational metadata, never ranked.
#[derive(SimpleObject, Debug, Clone)]
pub struct AppVersion {
    pub component: AppComponent,
    /// Human-readable version string; unique per component.
    pub version: String,
    /// The release's notes in plain words, one line per entry, in the
    /// order written — what a reader can now do. Written when the release
    /// ships; the same words on every component the release ships on.
    pub notes: Vec<String>,
    /// The release's public page: its full notes and its code.
    pub patch_notes_url: String,
    /// Actor ids the release credits beyond the upstream repo's commit
    /// history (designers, translators, testers) — Users and Collectives
    /// in one list, resolved via `nodes`. Empty when nobody beyond the
    /// commit history is credited. Display-only, never an input to
    /// ranking or economics.
    pub released_by: Vec<Uuid>,
    pub released_at: DateTime<Utc>,
}

impl AppVersion {
    fn from_row(row: Release) -> async_graphql::Result<Self> {
        let component = AppComponent::from_store(&row.component).ok_or_else(|| {
            async_graphql::Error::new(format!("unknown registry component {}", row.component))
        })?;
        Ok(Self {
            component,
            version: row.version,
            notes: row.notes,
            patch_notes_url: row.patch_notes_url,
            released_by: row.released_by.unwrap_or_default(),
            released_at: row.released_at,
        })
    }
}

/// A page of the registry.
pub type AppVersionConnection = Connection<
    String,
    AppVersion,
    AppVersionConnectionFields,
    async_graphql::connection::EmptyFields,
    async_graphql::connection::DefaultConnectionName,
    async_graphql::connection::DefaultEdgeName,
    async_graphql::connection::DisableNodesField,
>;

/// `AppVersionConnection`'s connection-level fields: the component that
/// narrowed the edges, so the count runs under the same predicate and
/// only when asked.
pub struct AppVersionConnectionFields {
    component: Option<AppComponent>,
}

#[Object]
impl AppVersionConnectionFields {
    /// How many releases the registry holds under this narrowing, across
    /// every page. Priced at zero like every connection count; saturates
    /// at [`i32::MAX`].
    #[graphql(complexity = 0)]
    async fn total_count(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<i32>> {
        let pool = ctx.data::<PgPool>()?;
        let total = postgres_store::registry::count_releases(
            pool,
            self.component.map(AppComponent::as_store),
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(Some(i32::try_from(total).unwrap_or(i32::MAX)))
    }
}

/// The `appVersions` read: one keyset page of the registry, newest first.
pub async fn app_versions(
    pool: &PgPool,
    component: Option<AppComponent>,
    first: Option<i32>,
    after: Option<String>,
    last: Option<i32>,
    before: Option<String>,
) -> async_graphql::Result<AppVersionConnection> {
    validate_page_args(first, last, after.as_deref(), before.as_deref())?;
    let backward = last.is_some() || before.is_some();
    let cursor = match if backward { &before } else { &after } {
        Some(raw) => {
            Some(decode_cursor(raw).ok_or_else(|| async_graphql::Error::new("invalid cursor"))?)
        }
        None => None,
    };
    let limit = i64::from(last.or(first).unwrap_or(DEFAULT_PAGE_SIZE));
    let mut rows = postgres_store::registry::list_releases(
        pool,
        component.map(AppComponent::as_store),
        cursor.as_ref(),
        backward,
        limit + 1,
    )
    .await
    .map_err(|e| async_graphql::Error::new(e.to_string()))?;
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
    let mut connection = AppVersionConnection::with_additional_fields(
        has_previous,
        has_next,
        AppVersionConnectionFields { component },
    );
    for row in rows {
        let cursor = encode_cursor(&row.cursor());
        connection
            .edges
            .push(Edge::new(cursor, AppVersion::from_row(row)?));
    }
    Ok(connection)
}
