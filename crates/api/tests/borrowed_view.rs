//! Whose view a reader borrows (`design/readme.md` §13). A feed is rooted
//! in the viewer's own outgoing stances, so a reader with none is served
//! someone else's — and `borrowedView` is what the borrowed-view band
//! reads to name it. A member borrows the view of the issuer of the invite
//! link they registered through until their
//! first Opinion is signed, toward any target (VouchBack.md:15); null is
//! the end of the ladder on purpose.
//!
//! The vouch-back prompt is a separate question with its own account
//! state: `vouchBackDismissed`, set by `dismissVouchBack`.

use std::sync::Arc;

use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use common::l1::identifier::NodeId;
use postgres_store::{PgPool, auth as store, genesis, mirror};
use serde_json::{Value, json};
use uuid::Uuid;

use api::auth::Viewer;
use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;
use rig::{MEMBER_PASSWORD, WireRig};

const QUERY: &str = "{ borrowedView { ... on User { handle } } }";

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) {
    writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const DISMISS: &str = "mutation { dismissVouchBack { user { vouchBackDismissed } } }";

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
async fn register(pool: &PgPool, inviter: Uuid, handle: &str, password_hash: &str) -> Uuid {
    let link = Uuid::new_v4();
    store::create_invite_link(pool, link, inviter, false, Utc::now() + Duration::days(7))
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
        password_hash,
        b"token-hash",
        Utc::now() - Duration::days(1),
    )
    .await
    .expect("register");
    assert_eq!(outcome, store::RegisterOutcome::Created);
    account
}

async fn seed_applicant(pool: &PgPool, inviter: Uuid, handle: &str) -> Uuid {
    register(pool, inviter, handle, "argon2-placeholder").await
}

/// The key ceremony's server half: the device-minted key and address
/// attached while the account is still an applicant.
async fn attach_key(pool: &PgPool, account: Uuid) -> ActorKey {
    let key = ActorKey::generate();
    assert_eq!(
        store::attach_actor_key(pool, account, &key.public_key_bytes(), &key.address())
            .await
            .expect("attach"),
        store::AttachOutcome::Attached
    );
    key
}

/// Lands the account through its registration path with no ceremony
/// behind it — the rig's shortcut to the `member` state these tests start
/// from; the ceremony itself is `tests/entry_landing.rs`'s.
async fn land(pool: &PgPool, account: Uuid) {
    let path = store::current_application_for(pool, account)
        .await
        .expect("query")
        .expect("path");
    assert!(store::land_path_directly(pool, path.id).await.expect("land"));
}

fn viewer(user_id: Uuid) -> Option<Viewer> {
    Some(Viewer {
        user_id,
        session_id: Uuid::new_v4(),
    })
}

/// A signed Opinion staged straight onto the row, for the acts the API
/// surface cannot stage for an applicant: an Opinion carried from the
/// application signs with the vouch-in batch (auth.md "Application"), so
/// the row stands in for that batch's member. Only the probe's columns —
/// actor, family, state — carry meaning here.
async fn stage_signed_opinion(pool: &PgPool, account: Uuid, address: &str, target: &str) {
    let author = NodeId::Addr(address.to_string()).to_string();
    sqlx::query(
        "INSERT INTO staged_writes
             (id, actor_id, act_id, author, seq, family, target,
              p_d, p_i, payload, prepared_epoch, state)
         VALUES ($1, $2, $3, $4, 1, 'opinion', $5, 0.1, 0.1, ''::bytea, 0, 'relaying')",
    )
    .bind(Uuid::new_v4())
    .bind(account)
    .bind(format!("act:{author}:1:opinion"))
    .bind(&author)
    .bind(target)
    .execute(pool)
    .await
    .expect("stage");
}

/// A landed member reachable over the HTTP surface: registered through
/// `issuer`'s link, key attached, funded, landed, logged in.
async fn wire_member(rig: &WireRig, issuer: Uuid, handle: &str) -> (Uuid, ActorKey, String) {
    let hash = api::auth::hash_password(MEMBER_PASSWORD).expect("hash");
    let account = register(&rig.pool, issuer, handle, &hash).await;
    let key = attach_key(&rig.pool, account).await;
    rig.standin
        .credit_burn(&key.address(), 10_000_000)
        .await
        .expect("burn");
    land(&rig.pool, account).await;
    let token = rig.log_in(&format!("{handle}@example.com")).await;
    (account, key, token)
}

async fn wire_borrowed(rig: &WireRig, token: &str) -> Option<String> {
    let data = rig.gql(Some(token), QUERY, json!({})).await;
    data["borrowedView"]["handle"].as_str().map(str::to_owned)
}

/// Prepares a stance and returns its staged writes; refusals fail the test.
async fn prepare_stance(rig: &WireRig, token: &str, target: Value) -> Value {
    let mut input = json!({ "pDirected": 0.1, "pInterest": 0.1 });
    for (k, v) in target.as_object().expect("target object") {
        input[k] = v.clone();
    }
    let data = rig
        .gql(Some(token), PREPARE_STANCE, json!({ "input": input }))
        .await;
    assert_eq!(
        data["prepareStance"]["userErrors"],
        json!([]),
        "stance refused: {data}"
    );
    data["prepareStance"]["writes"].clone()
}

/// The device's pre-commitment over each write, and nothing more: the
/// author's signature exists, the act is in flight, nothing has landed.
async fn pre_sign_only(rig: &WireRig, token: &str, key: &ActorKey, writes: &Value) {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD as B64;
    use common::l1::wire;
    for write in writes.as_array().expect("writes") {
        let proposal = wire::decode_proposal(
            &B64.decode(write["canonicalProposal"].as_str().expect("proposal"))
                .expect("b64"),
        )
        .expect("decodes");
        let pre = key.pre_sign(proposal);
        let sealed = rig
            .gql(
                Some(token),
                "mutation($input: SubmitProposalsInput!) {
                   submitProposals(input: $input) { userErrors { code message } }
                 }",
                json!({ "input": { "proposals": [{
                    "stagedWriteId": write["id"],
                    "signature": B64.encode(wire::encode_pre_commitment_of(&pre)),
                }]}}),
            )
            .await;
        assert_eq!(
            sealed["submitProposals"]["userErrors"],
            json!([]),
            "the seal leg refused: {sealed}"
        );
    }
}

async fn staged_state(rig: &WireRig, token: &str, id: &Value) -> Value {
    let data = rig
        .gql(
            Some(token),
            "query($id: UUID!) { stagedWrite(id: $id) { state } }",
            json!({ "id": id }),
        )
        .await;
    data["stagedWrite"]["state"].clone()
}

/// A stance driven all the way to landed, and checked landed — a test
/// whose act silently never landed would prove nothing.
async fn land_stance(rig: &WireRig, token: &str, key: &ActorKey, target: Value) -> Value {
    let writes = prepare_stance(rig, token, target).await;
    rig.sign_prepared(token, key, &writes).await;
    rig.close_and_ingest().await;
    for write in writes.as_array().expect("writes") {
        assert_eq!(staged_state(rig, token, &write["id"]).await, "LANDED");
    }
    writes
}

fn first_error_code(json: &Value) -> Value {
    json["errors"][0]["extensions"]["code"].clone()
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

/// Landing is not the handover: membership is granted by a vouch, while
/// the view becomes the member's own only once they have pointed somewhere
/// themselves (§13). Between the two the feed is still ranked from the
/// issuer's vantage, so the band must still name them.
///
/// A member who has landed but signed no opinion is still borrowing their issuer's view.
/// ´claim:borrowed:a-landed-member-borrows-until-their-first-opinion´
#[sqlx::test(migrations = "../../migrations")]
async fn a_landed_member_borrows_until_their_first_opinion(pool: PgPool) {
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let inviter = seed_inviter(&pool, "mira").await;
    let account = seed_applicant(&pool, inviter, "noa").await;
    attach_key(&pool, account).await;
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

/// The first opinion need not be the vouch-back: any target ends the
/// borrowing (VouchBack.md:15). Once landed it latches, and the latch is
/// what holds while the mirror is rebuilt — the band must not flicker back
/// over a cache catching up.
///
/// A member's first opinion on someone other than their issuer ends the borrowing, and the landed opinion latches.
/// ´claim:borrowed:an-opinion-toward-any-target-ends-the-borrowing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_on_a_stranger_ends_the_borrowing(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (stranger, _) = rig.seed_member("sol", "sol@example.com").await;
    let (account, key, token) = wire_member(&rig, mira, "noa").await;
    assert_eq!(wire_borrowed(&rig, &token).await.as_deref(), Some("mira"));

    land_stance(&rig, &token, &key, json!({ "target": stranger })).await;
    assert_eq!(wire_borrowed(&rig, &token).await, None);
    assert!(
        store::landed_vouch_state(&rig.pool, account)
            .await
            .expect("query")
            .expect("landed")
            .first_opinion_latched,
        "a landed opinion latches"
    );

    mirror::reset(&rig.pool).await.expect("reset");
    sqlx::query("DELETE FROM staged_writes WHERE actor_id = $1")
        .bind(account)
        .execute(&rig.pool)
        .await
        .expect("clear");
    assert_eq!(
        wire_borrowed(&rig, &token).await,
        None,
        "the latch answers while the mirror rebuilds"
    );
}

/// "Toward any target" covers content as much as people: a first opinion
/// on a post ends the borrowing too.
///
/// (´claim:borrowed:an-opinion-toward-any-target-ends-the-borrowing´)
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_on_a_post_ends_the_borrowing(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (_, sol_key) = rig.seed_member("sol", "sol@example.com").await;
    let sol = rig.log_in("sol@example.com").await;
    let prepared = rig
        .gql(
            Some(&sol),
            PREPARE_POST,
            json!({ "input": {
                "title": "a post",
                "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
            }}),
        )
        .await;
    let post = prepared["preparePost"]["node"].clone();
    rig.sign_prepared(&sol, &sol_key, &prepared["preparePost"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let (_, key, token) = wire_member(&rig, mira, "noa").await;
    assert_eq!(wire_borrowed(&rig, &token).await.as_deref(), Some("mira"));
    land_stance(&rig, &token, &key, json!({ "target": post })).await;
    assert_eq!(wire_borrowed(&rig, &token).await, None);
}

/// Following a topic is the Affinity family, not an opinion, and only an
/// opinion starts the member's own view (VouchBack.md:19).
///
/// A landed Affinity never ends the borrowing.
/// ´claim:borrowed:an-affinity-never-ends-the-borrowing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_affinity_never_ends_the_borrowing(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (account, key, token) = wire_member(&rig, mira, "noa").await;

    let writes = land_stance(&rig, &token, &key, json!({ "topicName": "gardening" })).await;
    assert_eq!(writes[0]["family"], "AFFINITY");
    assert_eq!(wire_borrowed(&rig, &token).await.as_deref(), Some("mira"));
    assert!(
        !store::landed_vouch_state(&rig.pool, account)
            .await
            .expect("query")
            .expect("landed")
            .first_opinion_latched
    );
}

/// "Signed" is the pre-commitment: a prepared write nobody has signed ends
/// nothing, and the moment the device's signature is in, the borrowing is
/// over — before anything lands (VouchBack.md:15).
///
/// A signed, in-flight first opinion ends the borrowing; a prepared, unsigned one does not.
/// ´claim:borrowed:an-in-flight-first-opinion-ends-the-borrowing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_in_flight_first_opinion_ends_the_borrowing(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (stranger, _) = rig.seed_member("sol", "sol@example.com").await;
    let (account, key, token) = wire_member(&rig, mira, "noa").await;

    let writes = prepare_stance(&rig, &token, json!({ "target": stranger })).await;
    assert_eq!(
        wire_borrowed(&rig, &token).await.as_deref(),
        Some("mira"),
        "an unsigned prepare ends nothing"
    );

    pre_sign_only(&rig, &token, &key, &writes).await;
    assert_eq!(wire_borrowed(&rig, &token).await, None);
    assert!(
        !store::landed_vouch_state(&rig.pool, account)
            .await
            .expect("query")
            .expect("landed")
            .first_opinion_latched,
        "an in-flight opinion never latches"
    );
}

/// The in-flight answer does not latch, which is what lets an expiry hand
/// the borrowing back: nothing of the member's ever reached the graph
/// (VouchBack.md:17).
///
/// A first opinion that expires with none landed returns the borrowing.
/// ´claim:borrowed:an-expired-first-opinion-returns-the-borrowing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_expired_first_opinion_returns_the_borrowing(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (stranger, _) = rig.seed_member("sol", "sol@example.com").await;
    let (_, key, token) = wire_member(&rig, mira, "noa").await;

    let writes = prepare_stance(&rig, &token, json!({ "target": stranger })).await;
    pre_sign_only(&rig, &token, &key, &writes).await;
    assert_eq!(wire_borrowed(&rig, &token).await, None);

    let (_, walker_key) = rig.seed_member("walker", "walker@example.com").await;
    let walker = rig.log_in("walker@example.com").await;
    let id = &writes[0]["id"];
    let mut state = Value::Null;
    for n in 0..6 {
        let walk = rig
            .gql(
                Some(&walker),
                PREPARE_POST,
                json!({ "input": {
                    "content": format!("a step of the clock, {n}"),
                    "license": { "attribution": 0.0, "provenance": 0.0 },
                }}),
            )
            .await;
        rig.sign_prepared(&walker, &walker_key, &walk["preparePost"]["writes"])
            .await;
        rig.close_and_ingest_under(1).await;
        state = staged_state(&rig, &token, id).await;
        if state == "EXPIRED" || state.is_null() {
            break;
        }
    }
    assert!(
        state == "EXPIRED" || state.is_null(),
        "the GC collected the signed, unapproved opinion: {state}"
    );
    assert_eq!(wire_borrowed(&rig, &token).await.as_deref(), Some("mira"));
}

/// An opinion staged during the application signs with the vouch-in
/// batch, so the borrowing is already over at landing: the band never
/// stands (VouchBack.md:21). Before landing the same signed row ends
/// nothing — the applicant keeps the issuer's view.
///
/// An opinion carried from the application ends the borrowing at the landing itself.
/// ´claim:borrowed:a-carried-opinion-ends-the-borrowing-at-landing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_carried_from_the_application_ends_the_borrowing_at_landing(pool: PgPool) {
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let inviter = seed_inviter(&pool, "mira").await;
    let stranger = seed_inviter(&pool, "sol").await;
    let stranger_address = store::actor_identity(&pool, stranger)
        .await
        .expect("query")
        .expect("row")
        .realization_address
        .expect("address");
    let account = seed_applicant(&pool, inviter, "noa").await;
    let key = attach_key(&pool, account).await;
    stage_signed_opinion(
        &pool,
        account,
        &key.address(),
        &NodeId::Prof(stranger_address).to_string(),
    )
    .await;
    let schema = schema(pool.clone());
    assert_eq!(
        borrowed_handle(&schema, viewer(account)).await.as_deref(),
        Some("mira")
    );

    land(&pool, account).await;
    assert_eq!(borrowed_handle(&schema, viewer(account)).await, None);
}

/// Whatever an applicant stages — the vouch-back included — the issuer's
/// view holds until landing: the probe is never consulted before it.
///
/// An applicant keeps their issuer's view whatever they have staged and signed.
/// ´claim:borrowed:an-applicant-keeps-the-issuers-view´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicants_staged_opinion_does_not_end_the_borrowing(pool: PgPool) {
    seed_genesis_moderator(&pool, "genesis_mod").await;
    let inviter = seed_inviter(&pool, "mira").await;
    let inviter_address = store::actor_identity(&pool, inviter)
        .await
        .expect("query")
        .expect("row")
        .realization_address
        .expect("address");
    let account = seed_applicant(&pool, inviter, "noa").await;
    let key = attach_key(&pool, account).await;
    stage_signed_opinion(
        &pool,
        account,
        &key.address(),
        &NodeId::Prof(inviter_address).to_string(),
    )
    .await;

    let schema = schema(pool);
    assert_eq!(
        borrowed_handle(&schema, viewer(account)).await.as_deref(),
        Some("mira")
    );
}

/// The vouch-back is an opinion like any other here: it ends the
/// borrowing, and it is also the one that answers the prompt.
///
/// A member's landed vouch-back ends the borrowing and reads as reciprocated.
/// ´claim:borrowed:the-vouch-back-ends-the-borrowing´
#[sqlx::test(migrations = "../../migrations")]
async fn the_vouch_back_ends_the_borrowing(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (account, key, token) = wire_member(&rig, mira, "noa").await;

    land_stance(&rig, &token, &key, json!({ "target": mira })).await;
    assert_eq!(wire_borrowed(&rig, &token).await, None);
    let me = rig
        .gql(
            Some(&token),
            "{ me { invitedBy { id } hasReciprocated } }",
            json!({}),
        )
        .await;
    assert_eq!(me["me"]["hasReciprocated"], true);
    assert_eq!(me["me"]["invitedBy"]["id"], mira.to_string());
    assert!(
        store::admitting_voucher_of(&rig.pool, account)
            .await
            .expect("query")
            .is_some()
    );
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

/// The dismissal is account state, never a device-local bit: put away on
/// one session, it stays away on every other (VouchBack.md:27), and a
/// repeat is harmless. The prompt's own question is untouched.
///
/// Dismissing the vouch-back prompt holds on every session of the account, and dismissing again changes nothing.
/// ´claim:vouch:the-dismissal-is-account-state´
#[sqlx::test(migrations = "../../migrations")]
async fn dismissing_the_vouch_back_holds_on_every_session(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let (_, _, phone) = wire_member(&rig, mira, "noa").await;
    let laptop = rig.log_in("noa@example.com").await;
    let read = "{ me { vouchBackDismissed hasReciprocated } }";

    let before = rig.gql(Some(&laptop), read, json!({})).await;
    assert_eq!(before["me"]["vouchBackDismissed"], false);

    let dismissed = rig.gql(Some(&phone), DISMISS, json!({})).await;
    assert_eq!(
        dismissed["dismissVouchBack"]["user"]["vouchBackDismissed"],
        true
    );
    let after = rig.gql(Some(&laptop), read, json!({})).await;
    assert_eq!(after["me"]["vouchBackDismissed"], true);
    assert_eq!(after["me"]["hasReciprocated"], false);

    let again = rig.gql(Some(&laptop), DISMISS, json!({})).await;
    assert_eq!(
        again["dismissVouchBack"]["user"]["vouchBackDismissed"],
        true
    );
}

/// Like `hasReciprocated`, the field exists only for the account's own
/// prompt; another viewer reads false rather than learning it.
///
/// Another viewer always reads the dismissal as false.
/// ´claim:vouch:the-dismissal-is-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn vouch_back_dismissed_is_viewer_only(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let mira_token = rig.log_in("mira@example.com").await;
    let (account, _, token) = wire_member(&rig, mira, "noa").await;
    rig.gql(Some(&token), DISMISS, json!({})).await;

    let read = "query($id: UUID!) { user(id: $id) { vouchBackDismissed } }";
    let own = rig.gql(Some(&token), read, json!({ "id": account })).await;
    assert_eq!(own["user"]["vouchBackDismissed"], true);
    let other = rig
        .gql(Some(&mira_token), read, json!({ "id": account }))
        .await;
    assert_eq!(other["user"]["vouchBackDismissed"], false);
    let anonymous = rig.gql(None, read, json!({ "id": account })).await;
    assert_eq!(anonymous["user"]["vouchBackDismissed"], false);
}

/// Dismissing is the account's own act, so it needs the account's session.
///
/// Dismissing without a session is refused as unauthenticated.
/// ´claim:vouch:dismissing-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn dismiss_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let json = rig.gql_raw(None, DISMISS, json!({})).await;
    assert_eq!(first_error_code(&json), "UNAUTHENTICATED", "{json}");
}

/// An applicant has no prompt and no landed row to keep the dismissal on,
/// so the call is refused rather than answered with a success that would
/// not survive landing.
///
/// An applicant's dismissal is refused as forbidden and leaves nothing behind.
/// ´claim:vouch:an-applicant-cannot-dismiss´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_cannot_dismiss(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (mira, _) = rig.seed_member("mira", "mira@example.com").await;
    let hash = api::auth::hash_password(MEMBER_PASSWORD).expect("hash");
    let account = register(&rig.pool, mira, "noa", &hash).await;
    let token = rig.log_in("noa@example.com").await;

    let json = rig.gql_raw(Some(&token), DISMISS, json!({})).await;
    assert_eq!(first_error_code(&json), "FORBIDDEN", "{json}");

    land(&rig.pool, account).await;
    let me = rig
        .gql(Some(&token), "{ me { vouchBackDismissed } }", json!({}))
        .await;
    assert_eq!(me["me"]["vouchBackDismissed"], false);
}
