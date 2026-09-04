//! Schema-level integration tests for the foundation migration. Each
//! `#[sqlx::test]` runs in its own throwaway database created from
//! `DATABASE_URL`, with the workspace migrations applied — requires
//! Postgres to be running (`make up`).

use common::hashtag_uuid;
use postgres_store::genesis::{self, RESERVED_TYPES};
use sqlx::PgPool;
use uuid::Uuid;

/// Type ids are derived from the name, and both sides enforce the
/// derivation: re-seeding is idempotent, the CHECK rejects a non-derived id
/// even from a buggy writer, and the id SQL accepts is the one the Rust
/// helper computes.
///
/// A type id is derived from its name, and SQL and Rust derive it identically.
/// ´claim:schema:a-type-id-is-derived-from-its-name-on-both-sides´
#[sqlx::test(migrations = "../../migrations")]
async fn hashtag_ids_are_content_addressed(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    for name in RESERVED_TYPES {
        genesis::seed_reserved_type(&mut conn, name)
            .await
            .expect("seeds");
    }
    genesis::seed_reserved_type(&mut conn, "bot-defense")
        .await
        .expect("idempotent");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hashtags")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(count, RESERVED_TYPES.len() as i64);

    let err = sqlx::query("INSERT INTO hashtags (id, name) VALUES ($1, $2)")
        .bind(Uuid::new_v4())
        .bind("rogue")
        .execute(&pool)
        .await;
    assert!(
        err.is_err(),
        "non-derived hashtag id must violate the CHECK"
    );

    let stored: Uuid = sqlx::query_scalar("SELECT id FROM hashtags WHERE name = 'bot-defense'")
        .fetch_one(&pool)
        .await
        .expect("row");
    assert_eq!(stored, hashtag_uuid("bot-defense"));
}

/// Handles live in one namespace across actor kinds, so a mention resolves
/// to exactly one actor (data-model.md "Actors"); the kind column admits
/// only the kinds its CHECK names.
///
/// One handle namespace spans every actor kind, so a mention can resolve exactly one way.
/// ´claim:schema:one-handle-namespace-spans-every-actor-kind´
#[sqlx::test(migrations = "../../migrations")]
async fn handles_share_one_namespace_across_kinds(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(&mut conn, Uuid::new_v4(), "user", "alice", b"key1", "addr1")
        .await
        .expect("user row");
    let clash = genesis::insert_actor(
        &mut conn,
        Uuid::new_v4(),
        "collective",
        "alice",
        b"key2",
        "addr2",
    )
    .await;
    assert!(clash.is_err());

    let bad_kind =
        genesis::insert_actor(&mut conn, Uuid::new_v4(), "robot", "bob", b"key3", "addr3").await;
    assert!(bad_kind.is_err());
}

/// The L2-half gate flips only once all three system actors are seeded,
/// each with its own key and address, as the real bootstrap gives them
/// (data-model.md "Actors").
///
/// The L2 half of the bootstrap gate flips only once every system actor is seeded with its own key.
/// ´claim:schema:the-l2-gate-waits-for-every-system-actor´
#[sqlx::test(migrations = "../../migrations")]
async fn genesis_seed_round_trips(pool: PgPool) {
    assert!(!genesis::system_actors_present(&pool).await.expect("gate"));
    let mut tx = pool.begin().await.expect("tx");
    for handle in [
        genesis::PUBLISHER_HANDLE,
        genesis::MODERATOR_HANDLE,
        genesis::TREASURY_HANDLE,
    ] {
        let id = Uuid::new_v4();
        let pk = format!("pk-{handle}");
        let addr = format!("addr-{handle}");
        genesis::insert_actor(&mut tx, id, "system", handle, pk.as_bytes(), &addr)
            .await
            .expect("actor");
        genesis::insert_profile_version(&mut tx, id, handle, None)
            .await
            .expect("profile");
        genesis::insert_system_key(&mut tx, id, &[7u8; 32])
            .await
            .expect("key");
    }
    tx.commit().await.expect("commit");
    assert!(genesis::system_actors_present(&pool).await.expect("gate"));

    let publisher = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(publisher.kind, "system");
    let seed = genesis::system_key(&pool, publisher.id)
        .await
        .expect("query")
        .expect("custodied seed");
    assert_eq!(seed, vec![7u8; 32]);
    assert!(
        genesis::actor_by_handle(&pool, "nobody")
            .await
            .expect("query")
            .is_none()
    );
}

/// The parameter carrier is layered, never overwritten: a second seed of
/// the same parameter appends a version row beside the first.
///
/// The parameter carrier is layered: a second seed appends a version beside the first rather than overwriting it.
/// ´claim:schema:the-parameter-carrier-appends-rather-than-overwrites´
#[sqlx::test(migrations = "../../migrations")]
async fn parameter_carrier_versions_append(pool: PgPool) {
    assert!(!genesis::parameters_seeded(&pool).await.expect("check"));
    let mut conn = pool.acquire().await.expect("conn");
    genesis::seed_parameter(&mut conn, "gamma", &serde_json::json!(1.0))
        .await
        .expect("seed");
    assert!(genesis::parameters_seeded(&pool).await.expect("check"));
    genesis::seed_parameter(&mut conn, "gamma", &serde_json::json!(0.9))
        .await
        .expect("append");
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM network_parameter_versions WHERE parameter = 'gamma'",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(count, 2);
}

/// Every version table is keyed the same way (data-model.md
/// "Display-content versioning"), including the tables whose surfaces are
/// not built yet — the rule is the schema's, not each reader's, so a new
/// version table that skips it fails here rather than at the first read
/// that quietly orders by the clock.
///
/// Landing-order keying is the schema's rule and not each reader's, so a table that skips it fails here rather than at its first read.
/// ´claim:schema:the-landing-key-is-the-schemas-rule-not-each-readers´
#[sqlx::test(migrations = "../../migrations")]
async fn every_version_table_is_keyed_on_the_landing_order(pool: PgPool) {
    const TABLES: [&str; 7] = [
        "actor_profile_versions",
        "post_versions",
        "comment_versions",
        "chat_versions",
        "chat_message_versions",
        "item_versions",
        "network_parameter_versions",
    ];

    for table in TABLES {
        let columns: Vec<String> = sqlx::query_scalar(
            "SELECT column_name FROM information_schema.columns
             WHERE table_name = $1
               AND column_name IN ('landed_epoch', 'act_time', 'position')",
        )
        .bind(table)
        .fetch_all(&pool)
        .await
        .expect("columns");
        assert_eq!(
            columns.len(),
            3,
            "{table} must carry the whole landing-order triple"
        );

        let identity: Option<String> = sqlx::query_scalar(
            "SELECT is_identity FROM information_schema.columns
             WHERE table_name = $1 AND column_name = 'version_id'",
        )
        .bind(table)
        .fetch_optional(&pool)
        .await
        .expect("version_id");
        assert_eq!(
            identity.as_deref(),
            Some("YES"),
            "{table} must carry the monotonic key that decides where no record does"
        );
    }
}

/// The coordinates are one fact in three columns: a row holding part of
/// a landing position would order against a key the graph never issued.
///
/// A landing position is one fact in three columns, and a row holding part of it is refused.
/// ´claim:schema:a-landing-position-is-all-three-columns-or-none´
#[sqlx::test(migrations = "../../migrations")]
async fn a_partial_landing_position_is_rejected(pool: PgPool) {
    let chat = Uuid::new_v4();
    sqlx::query("INSERT INTO chats (id) VALUES ($1)")
        .bind(chat)
        .execute(&pool)
        .await
        .expect("chat");

    let partial = sqlx::query(
        "INSERT INTO chat_versions (chat_id, name, landed_epoch) VALUES ($1, 'half', 1)",
    )
    .bind(chat)
    .execute(&pool)
    .await;
    assert!(partial.is_err(), "part of a position is not a position");

    sqlx::query(
        "INSERT INTO chat_versions (chat_id, name, landed_epoch, act_time, position)
         VALUES ($1, 'whole', 1, 1, 0)",
    )
    .bind(chat)
    .execute(&pool)
    .await
    .expect("a whole position is accepted");
}

/// Refusals key on constraint *names*: PostgreSQL reports the constraint
/// and not the column on a unique violation, and two of the four names
/// `auth::constraints` relies on were never written down by a migration —
/// PostgreSQL derived them from an inline `UNIQUE`. A migration that
/// re-declares either one under a name of its own turns `HANDLE_TAKEN`
/// and `EMAIL_IN_USE` into 500s, with nothing else to catch it.
///
/// Every constraint name a refusal keys on exists in the schema.
/// ´claim:schema:every-refusal-name-exists-in-the-schema´
#[sqlx::test(migrations = "../../migrations")]
async fn refusal_constraint_names_exist(pool: PgPool) {
    for name in postgres_store::auth::constraints::ALL {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = $1 AND contype = 'u')",
        )
        .bind(name)
        .fetch_one(&pool)
        .await
        .expect("constraint lookup");
        assert!(exists, "no unique constraint named {name}");
    }
}
