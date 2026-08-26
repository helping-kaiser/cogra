// The naming-service registry (hashtag.md §1): CoGra's own index of the
// Type names it has seen, keyed by the content-addressed
// `UUIDv5(HASHTAG_NAMESPACE, canonical_name)`.
//
// The registry is an index, never an authority. A Type is anchored
// vacuously — it exists as soon as an accepted record references its name
// — so every well-formed name already denotes a Type whether or not a row
// here exists. Reads therefore never write (D4): a row is created only by
// the act of tagging, in the same transaction that stages it (D5).
//
// Names reaching these functions are canonical: `common::hashtag::
// canonicalize` is what produces one, and the table's own CHECK constraint
// re-derives the key as defense-in-depth.

use common::hashtag_uuid;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// Records a canonical name in the registry, returning its
/// content-addressed id.
///
/// Takes a `&mut PgConnection` so it can run inside the transaction that
/// stages the Tag act: the name and the act that references it commit
/// together or not at all. Idempotent — the row is the same row on every
/// call, and a staged act that later expires leaves behind a row naming a
/// Type that exists vacuously anyway.
///
/// The id is not read back from the row: it is a pure function of the
/// name, and the table's CHECK constraint is what holds the two
/// derivations to each other.
pub async fn upsert(conn: &mut PgConnection, canonical_name: &str) -> Result<Uuid, sqlx::Error> {
    let id = hashtag_uuid(canonical_name);
    sqlx::query!(
        "INSERT INTO hashtags (id, name) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING",
        id,
        canonical_name,
    )
    .execute(conn)
    .await?;
    Ok(id)
}

/// Looks up a canonical name without writing anything (D4).
///
/// `None` means only that no record has referenced the name through this
/// instance — not that the Type does not exist. Callers that need the
/// name's id regardless should derive it with `common::hashtag_uuid`.
pub async fn id_by_name(pool: &PgPool, canonical_name: &str) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!("SELECT id FROM hashtags WHERE name = $1", canonical_name)
        .fetch_optional(pool)
        .await
}

/// Resolves a registry id back to its canonical name.
///
/// The reverse direction is what a UUID-typed API target needs: a stance
/// toward a hashtag arrives as an id and has to become the `name(s)`
/// identifier the record carries.
pub async fn name_by_id(pool: &PgPool, id: Uuid) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar!("SELECT name FROM hashtags WHERE id = $1", id)
        .fetch_optional(pool)
        .await
}
