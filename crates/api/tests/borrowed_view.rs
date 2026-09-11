//! Whose view a reader borrows (`design/readme.md` §13). A feed is rooted
//! in the viewer's own outgoing stances, so a reader with none is served
//! someone else's — and `borrowedView` is what the borrowed-view band
//! reads to name it. Three readers, three answers, and the third one is
//! null on purpose.

use std::sync::Arc;

use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use postgres_store::{PgPool, auth as store, genesis};
use uuid::Uuid;

use api::auth::Viewer;
use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;

const QUERY: &str = "{ borrowedView { ... on User { handle } } }";

fn schema(pool: PgPool) -> ApiSchema {
    let (ctx, _auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    build_with(ctx, QueryBudgets::release())
}

/// The handle the field names for this viewer; None when it resolves null.
/// `Option<Viewer>` is the request datum the HTTP handler injects, so
/// passing None here is exactly an anonymous request.
async fn borrowed_handle(schema: &ApiSchema, viewer: Option<Viewer>) -> Option<String> {
    let response = schema
        .execute(async_graphql::Request::new(QUERY).data(viewer))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let json = response.data.into_json().expect("json");
    json["borrowedView"]["handle"].as_str().map(str::to_owned)
}

/// The bootstrap's Genesis Moderator: a user-kind actor holding a
/// custodied genesis key, which is what tells it apart from every other
/// account without knowing the runtime handle.
async fn seed_genesis_moderator(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    let key = ActorKey::generate();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor");
    genesis::insert_system_key(&mut conn, id, &key.seed())
        .await
        .expect("system key");
    id
}

/// One of the system cast — same custodied key, `system` kind.
async fn seed_system_actor(pool: &PgPool, handle: &str) {
    let key = ActorKey::generate();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        Uuid::new_v4(),
        "system",
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor");
}

/// A member who can issue invites.
async fn seed_inviter(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    let key = ActorKey::generate();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor");
    drop(conn);
    genesis::insert_credentials(
        pool,
        id,
        &format!("{handle}@example.com"),
        "argon2-placeholder",
    )
    .await
    .expect("credentials");
    id
}

/// Registers an account through `inviter`'s link, exactly as step 2 of the
/// application does: no email proof, no key, `applicant` state.
async fn seed_applicant(pool: &PgPool, inviter: Uuid, handle: &str) -> Uuid {
    let link = Uuid::new_v4();
    store::create_invite_link(
        pool,
        link,
        inviter,
        0.4,
        0.4,
        false,
        Utc::now() + Duration::days(7),
    )
    .await
    .expect("link");
    let account = Uuid::new_v4();
    let outcome = store::register_account(
        pool,
        account,
        Uuid::new_v4(),
        link,
        handle,
        &format!("{handle}@example.com"),
        "argon2-placeholder",
        b"token-hash",
        Utc::now() - Duration::days(1),
        Utc::now() + Duration::days(7),
    )
    .await
    .expect("register");
    assert_eq!(outcome, store::RegisterOutcome::Created);
    account
}

/// Approves and lands the application, which is what flips the account to
/// `member` — the moment the reader's own view begins.
async fn land(pool: &PgPool, account: Uuid) {
    sqlx::query("UPDATE auth_applications SET approved_at = NOW() WHERE account_id = $1")
        .bind(account)
        .execute(pool)
        .await
        .expect("approve");
    assert!(store::land_account(pool, account).await.expect("land"));
}

fn viewer(user_id: Uuid) -> Option<Viewer> {
    Some(Viewer {
        user_id,
        session_id: Uuid::new_v4(),
    })
}

/// The Genesis Moderator is found by the custodied key, not by handle —
/// the handle is the operator's runtime input and the API never sees it —
/// and the system cast holding the same kind of key is passed over for
/// being system-kind.
///
/// A signed-out reader borrows the Genesis Moderator's view, and the system cast is never offered as the vantage.
/// ´claim:borrowed:a-signed-out-reader-borrows-the-genesis-moderator´
#[sqlx::test(migrations = "../../migrations")]
async fn a_signed_out_reader_borrows_the_genesis_moderator(pool: PgPool) {
    for handle in [
        genesis::PUBLISHER_HANDLE,
        genesis::MODERATOR_HANDLE,
        genesis::TREASURY_HANDLE,
    ] {
        seed_system_actor(&pool, handle).await;
    }
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let schema = schema(pool);

    assert_eq!(
        borrowed_handle(&schema, None).await.as_deref(),
        Some("genesis_mod")
    );
}

/// The account exists from step 2 of the application, before either proof
/// lands, and the band must name the vantage from that moment — the defect
/// this pins is a fresh, email-unverified account seeing no band at all.
///
/// An applicant borrows their inviter's view from the moment the account exists, unverified and keyless.
/// ´claim:borrowed:an-unverified-applicant-borrows-their-inviter´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_applicant_borrows_their_inviter(pool: PgPool) {
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let inviter = seed_inviter(&pool, "mira").await;
    let applicant = seed_applicant(&pool, inviter, "noa").await;

    let credentials = store::credentials_by_actor(&pool, applicant)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(credentials.account_state, store::AccountState::Applicant);
    assert!(credentials.email_verified_at.is_none());

    let schema = schema(pool);
    assert_eq!(
        borrowed_handle(&schema, viewer(applicant)).await.as_deref(),
        Some("mira")
    );
}

/// Landing is not the handover: membership is granted by the inviter,
/// while the view becomes the member's own only once they have pointed
/// somewhere themselves (§13). Between the two the feed is still ranked
/// from the inviter's vantage, so the band must still name them.
///
/// A member who has landed but not vouched back is still borrowing their inviter's view.
/// ´claim:borrowed:a-landed-member-borrows-until-the-vouch-back´
#[sqlx::test(migrations = "../../migrations")]
async fn a_landed_member_borrows_until_the_vouch_back(pool: PgPool) {
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let inviter = seed_inviter(&pool, "mira").await;
    let account = seed_applicant(&pool, inviter, "noa").await;
    land(&pool, account).await;

    let credentials = store::credentials_by_actor(&pool, account)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(credentials.account_state, store::AccountState::Member);

    let schema = schema(pool);
    assert_eq!(
        borrowed_handle(&schema, viewer(account)).await.as_deref(),
        Some("mira")
    );
}

/// The reciprocation latch is the mirror-confirmed vouch-back, and it is
/// what ends the borrowing — the same fact `hasReciprocated` reports, read
/// through the one query path both fields share.
///
/// A member who has vouched back borrows nobody's view, inviter still on file.
/// ´claim:borrowed:the-vouch-back-ends-the-borrowing´
#[sqlx::test(migrations = "../../migrations")]
async fn the_vouch_back_ends_the_borrowing(pool: PgPool) {
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let inviter = seed_inviter(&pool, "mira").await;
    let account = seed_applicant(&pool, inviter, "noa").await;
    land(&pool, account).await;
    assert!(
        store::latch_reciprocated(&pool, account)
            .await
            .expect("latch")
    );

    // The provenance outlives the handover: the band leaves, the trace stays.
    assert!(
        store::inviter_of(&pool, account)
            .await
            .expect("query")
            .is_some()
    );
    let schema = schema(pool);
    assert_eq!(borrowed_handle(&schema, viewer(account)).await, None);
}

/// The genesis account came through no invite at all, so there is no
/// vantage to hand over and none to name.
///
/// An account with no inviter borrows nobody's view from the start.
/// ´claim:borrowed:an-account-with-no-inviter-borrows-nobody´
#[sqlx::test(migrations = "../../migrations")]
async fn an_account_with_no_inviter_borrows_nobody(pool: PgPool) {
    let genesis_id = seed_genesis_moderator(&pool, "genesis_mod").await;

    let schema = schema(pool);
    assert_eq!(borrowed_handle(&schema, viewer(genesis_id)).await, None);
}
