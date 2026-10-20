//! Profile display-content store tests (data-model.md "Actors"):
//! newest-wins version reads, the append-only insert, and the
//! one-namespace handle lookup. Requires Postgres (`make up`).

use chrono::{Duration, SubsecRound, Utc};
use postgres_store::content::{self, LandingOrder};
use postgres_store::{auth, genesis, profile};
use sqlx::PgPool;
use uuid::Uuid;

fn order(epoch: i64, position: i64) -> LandingOrder {
    LandingOrder {
        landed_epoch: epoch,
        act_time: position + 1,
        position,
    }
}

/// Seeds one user actor with its first profile version. The key is derived
/// from the handle only because the pubkey column is UNIQUE — any distinct
/// bytes serve a store test.
async fn seed_actor(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut pubkey = [0u8; 32];
    pubkey[..handle.len().min(32)].copy_from_slice(&handle.as_bytes()[..handle.len().min(32)]);
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        &pubkey,
        &format!("addr_{handle}"),
    )
    .await
    .expect("actor");
    genesis::insert_profile_version(&mut conn, id, handle, None)
        .await
        .expect("seed profile");
    id
}

/// The read serves the newest version, and the insert is append-only — the
/// older row survives underneath it.
///
/// The profile read serves the newest version while every older row survives underneath it.
/// ´claim:profile:the-newest-version-serves-and-the-older-ones-survive´
#[sqlx::test(migrations = "../../migrations")]
async fn current_profile_serves_the_newest_version(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let first = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("seeded");
    assert_eq!(first.display_name, "ada");
    assert_eq!(first.bio, None);

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Ada L",
        Some("Curious."),
        None,
        Some("https://ada.example"),
        Some(order(1, 0)),
        Utc::now(),
    )
    .await
    .expect("inserts");
    tx.commit().await.expect("commits");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Ada L");
    assert_eq!(current.bio.as_deref(), Some("Curious."));
    assert_eq!(current.website_url.as_deref(), Some("https://ada.example"));
    assert!(current.created_at >= first.created_at);

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM actor_profile_versions WHERE actor_id = $1")
            .bind(actor)
            .fetch_one(&pool)
            .await
            .expect("count");
    assert_eq!(count, 2);
}

/// Two version rows carrying the same `created_at` — two landed writes
/// authored at one instant — are the same-instant collision the
/// monotonic key exists for. Both rows are given one landing order too,
/// which is the only state in which every key above `version_id` ties
/// and the monotonic key alone decides.
///
/// Two version rows sharing one instant are told apart by the monotonic key alone.
/// ´claim:profile:the-monotonic-key-alone-breaks-a-shared-instant´
#[sqlx::test(migrations = "../../migrations")]
async fn same_instant_writes_both_land_and_the_later_one_is_current(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let at = Utc::now();

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "First",
        None,
        None,
        None,
        Some(order(1, 0)),
        at,
    )
    .await
    .expect("first insert");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Second",
        None,
        None,
        None,
        Some(order(1, 0)),
        at,
    )
    .await
    .expect("second insert");
    tx.commit().await.expect("commits");

    let stamps: Vec<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT created_at FROM actor_profile_versions
         WHERE actor_id = $1 AND display_name IN ('First', 'Second')
         ORDER BY version_id",
    )
    .bind(actor)
    .fetch_all(&pool)
    .await
    .expect("stamps");
    assert_eq!(stamps.len(), 2, "both same-instant rows survive");
    assert_eq!(stamps[0], stamps[1], "the collision is real, not near-miss");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Second", "the later write is current");
}

/// The records decide, not the clock. Both versions are written through
/// the real insert, the second authored later, and the landing
/// coordinates run the other way: the row written second promotes a
/// record that landed *earlier*, which a promotion pass replaying two
/// epochs out of order produces. The profile must be the one whose record
/// landed last.
///
/// The current profile is the one whose record landed last, never the one whose row was written last.
/// ´claim:profile:the-record-that-landed-last-is-current´
#[sqlx::test(migrations = "../../migrations")]
async fn the_record_that_landed_last_is_current_even_when_written_first(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let first = Utc::now();

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Landed later",
        None,
        None,
        None,
        Some(order(9, 0)),
        first,
    )
    .await
    .expect("first insert");
    tx.commit().await.expect("commits");

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Landed earlier",
        None,
        None,
        None,
        Some(order(2, 0)),
        first + Duration::seconds(1),
    )
    .await
    .expect("second insert");
    tx.commit().await.expect("commits");

    let stamps: Vec<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT created_at FROM actor_profile_versions
         WHERE actor_id = $1 AND display_name LIKE 'Landed%'
         ORDER BY version_id",
    )
    .bind(actor)
    .fetch_all(&pool)
    .await
    .expect("stamps");
    assert!(
        stamps[0] < stamps[1],
        "the clock must disagree with the records for this to prove anything"
    );

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(
        current.display_name, "Landed later",
        "the newest version is the one whose record landed last"
    );
}

/// A row with no landing coordinates — a seed, or one written before the
/// coordinates existed — never outranks one that has them, however late
/// it was written. That is what NULLS LAST buys, and the coordinate-less
/// row is written last here so nothing but NULLS LAST can produce the
/// answer.
///
/// A profile version carrying no landing coordinates ranks below every version the graph ordered, however late it was written.
/// ´claim:profile:a-version-without-coordinates-ranks-last´
#[sqlx::test(migrations = "../../migrations")]
async fn a_row_without_coordinates_never_outranks_a_landed_one(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Ada L",
        None,
        None,
        None,
        Some(order(1, 0)),
        Utc::now(),
    )
    .await
    .expect("inserts");
    tx.commit().await.expect("commits");

    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_profile_version(&mut conn, actor, "no record behind me", None)
        .await
        .expect("coordinate-less row");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(
        current.display_name, "Ada L",
        "a version the graph never ordered cannot displace one it did"
    );
}

/// A pending version is served ahead of every landed one — including one
/// whose record landed after the pending update was signed — because an
/// update is its author's content from the signature, and it has no place
/// in the order yet. The landed read leaves it out: that is the base the
/// next update's delta merges onto.
///
/// A pending profile version is current ahead of every landed one, and the landed read leaves it out.
/// ´claim:profile:a-pending-version-is-current-ahead-of-every-landed-one´
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_version_is_current_ahead_of_every_landed_one(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let signed = Utc::now().trunc_subsecs(6);

    let mut tx = pool.begin().await.expect("tx");
    assert!(
        profile::insert_profile_version(&mut tx, actor, "Pending", None, None, None, None, signed)
            .await
            .expect("pending insert")
    );
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Landed",
        None,
        None,
        None,
        Some(order(9, 0)),
        signed + Duration::seconds(1),
    )
    .await
    .expect("landed insert");
    tx.commit().await.expect("commits");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Pending");
    assert!(current.pending);
    assert_eq!(current.created_at, signed);

    let landed = profile::landed_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(landed.display_name, "Landed");
    assert!(!landed.pending);
}

/// A pending row is keyed by its authoring instant: a second insert at
/// the same instant writes nothing (a retried pre-sign), landing stamps
/// exactly that row, and a landing naming another instant finds nothing
/// to flip.
///
/// A pending profile version is named by its authoring instant, so a retry writes nothing and a landing flips only that row.
/// ´claim:profile:a-pending-version-is-named-by-its-instant´
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_version_is_named_by_its_instant(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let signed = Utc::now().trunc_subsecs(6);

    let mut tx = pool.begin().await.expect("tx");
    assert!(
        profile::insert_profile_version(&mut tx, actor, "Ada L", None, None, None, None, signed)
            .await
            .expect("inserts")
    );
    assert!(
        !profile::insert_profile_version(&mut tx, actor, "Ada L", None, None, None, None, signed)
            .await
            .expect("retries"),
        "a retry at the same instant writes nothing"
    );
    assert!(
        !profile::land_profile_version(&mut tx, actor, signed + Duration::seconds(1), order(3, 0))
            .await
            .expect("lands"),
        "another instant names no row"
    );
    assert!(
        profile::land_profile_version(&mut tx, actor, signed, order(3, 0))
            .await
            .expect("lands")
    );
    tx.commit().await.expect("commits");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Ada L");
    assert!(!current.pending, "landing drops the mark");
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM actor_profile_versions WHERE actor_id = $1")
            .bind(actor)
            .fetch_one(&pool)
            .await
            .expect("count");
    assert_eq!(count, 2, "the seed and the one landed update");
}

/// Expiry's discard takes the pending row its write staged and nothing
/// else: a landed version at the same instant stays, and the profile
/// falls back to it.
///
/// Expiry discards only the pending profile version its write staged.
/// ´claim:profile:expiry-discards-only-the-pending-version´
#[sqlx::test(migrations = "../../migrations")]
async fn expiry_discards_only_the_pending_version(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let signed = Utc::now().trunc_subsecs(6);

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Landed",
        None,
        None,
        None,
        Some(order(1, 0)),
        signed,
    )
    .await
    .expect("landed insert");
    profile::insert_profile_version(&mut tx, actor, "Pending", None, None, None, None, signed)
        .await
        .expect("pending insert");
    content::discard_pending(&mut tx, actor, signed)
        .await
        .expect("discards");
    tx.commit().await.expect("commits");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Landed");
    assert!(!current.pending);
}

/// An actor the store has never seen has no current profile at all.
/// ´claim:profile:an-unknown-actor-has-no-profile´
#[sqlx::test(migrations = "../../migrations")]
async fn current_profile_is_none_for_unknown_actor(pool: PgPool) {
    assert!(
        profile::current_profile(&pool, Uuid::new_v4())
            .await
            .expect("reads")
            .is_none()
    );
}

/// A handle resolves to the one actor that holds it, and to nothing when nobody does.
/// ´claim:profile:a-handle-resolves-to-one-actor-or-to-none´
#[sqlx::test(migrations = "../../migrations")]
async fn handle_lookup_resolves_exactly_one_actor(pool: PgPool) {
    let ada = seed_actor(&pool, "ada").await;
    seed_actor(&pool, "adam").await;

    let found = auth::actor_identity_by_handle(&pool, "ada")
        .await
        .expect("reads")
        .expect("resolves");
    assert_eq!(found.id, ada);
    assert_eq!(found.kind, "user");

    assert!(
        auth::actor_identity_by_handle(&pool, "nobody")
            .await
            .expect("reads")
            .is_none()
    );
}
