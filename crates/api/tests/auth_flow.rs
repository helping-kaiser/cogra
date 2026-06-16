//! End-to-end auth-flow integration tests — the slice-0 hand test as code:
//! register → verifyEmail → me → logIn → refreshSession. Require both
//! databases (`make up`); connection comes from DATABASE_URL / MEMGRAPH_HOST /
//! MEMGRAPH_PORT, matching CI's service containers.
//!
//! Both stores are shared across tests, so each test uses unique handles /
//! emails and removes the graph nodes it creates on the way out. To avoid the
//! `:Network` singleton (one per instance, which a shared Memgraph can't host
//! per-test), these tests seed a plain inviter node directly rather than
//! running the genesis bootstrap.

use std::sync::Arc;

use api::auth::jwt::JwtKeys;
use api::auth::keys::generate_signing_key;
use api::auth::{password, tokens};
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use neo4rs::{Graph, query};
use postgres_store::PgPool;
use serde_json::{Value, json};
use tower::util::ServiceExt;
use uuid::Uuid;

struct Harness {
    app: axum::Router,
    pool: PgPool,
    graph: Graph,
}

async fn harness() -> Harness {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = postgres_store::connect(&database_url)
        .await
        .expect("Postgres must be running (make up)");
    postgres_store::run_migrations(&pool)
        .await
        .expect("migrations apply");

    let host = std::env::var("MEMGRAPH_HOST").unwrap_or_else(|_| "localhost".into());
    let port = std::env::var("MEMGRAPH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(7687);
    let graph = graph_engine::connect(&host, port)
        .await
        .expect("Memgraph must be running (make up)");
    graph_engine::schema::apply_schema(&graph)
        .await
        .expect("graph schema applies");

    let jwt = Arc::new(
        JwtKeys::from_pkcs8_base64(&generate_signing_key().expect("keygen")).expect("valid key"),
    );
    let app = api::app(
        api::schema::build(pool.clone(), graph.clone(), jwt.clone()),
        jwt,
    );
    Harness { app, pool, graph }
}

/// Posts a GraphQL request, optionally bearer-authenticated, and returns the
/// parsed response body.
async fn gql(app: &axum::Router, body: Value, bearer: Option<&str>) -> Value {
    let mut req = Request::post("/graphql").header(header::CONTENT_TYPE, "application/json");
    if let Some(token) = bearer {
        req = req.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    let response = app
        .clone()
        .oneshot(req.body(Body::from(body.to_string())).expect("request"))
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("json")
}

/// Seeds a bare inviter `:User` graph node and an invitation row pointing at
/// it, returning `(inviter_id, invite_link_id)`. Enough for a registrant's
/// invitation edges to attach without a full genesis bootstrap.
async fn seed_inviter(pool: &PgPool, graph: &Graph) -> (Uuid, Uuid) {
    let inviter_id = Uuid::new_v4();
    graph
        .run(query("CREATE (:User {id: $id})").param("id", inviter_id.to_string()))
        .await
        .expect("create inviter node");
    let mut conn = pool.acquire().await.expect("connection");
    let invite_link = postgres_store::genesis::insert_genesis_invitation(
        &mut conn,
        inviter_id,
        0.5,
        0.5,
        Utc::now() + Duration::days(7),
    )
    .await
    .expect("insert invitation");
    (inviter_id, invite_link)
}

/// Removes the graph nodes a test created, keeping the shared Memgraph clean.
async fn cleanup_graph(graph: &Graph, ids: &[Uuid]) {
    let id_strings: Vec<String> = ids.iter().map(|i| i.to_string()).collect();
    graph
        .run(query("MATCH (n) WHERE n.id IN $ids DETACH DELETE n").param("ids", id_strings))
        .await
        .expect("cleanup");
}

#[tokio::test]
async fn register_writes_a_pending_record() {
    let h = harness().await;
    let (inviter_id, invite_link) = seed_inviter(&h.pool, &h.graph).await;
    let email = format!("reg-{}@cogra.test", Uuid::new_v4());

    let resp = gql(
        &h.app,
        json!({
            "query": "mutation($i: RegisterInput!) { register(input: $i) {
                expiresAt userErrors { code message field }
            } }",
            "variables": { "i": {
                "inviteLink": invite_link, "handle": format!("u{}", Uuid::new_v4().simple()),
                "email": email, "password": "a-sufficiently-long-password"
            }}
        }),
        None,
    )
    .await;

    assert_eq!(
        resp["data"]["register"]["userErrors"]
            .as_array()
            .map(|e| e.len()),
        Some(0),
        "register succeeds with no userErrors: {resp}"
    );
    assert!(
        resp["data"]["register"]["expiresAt"].is_string(),
        "register returns the pending expiry: {resp}"
    );
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM auth_pending_registrations WHERE email = $1)",
    )
    .bind(&email)
    .fetch_one(&h.pool)
    .await
    .expect("query");
    assert!(exists, "a pending registration row was written");

    sqlx::query("DELETE FROM auth_pending_registrations WHERE email = $1")
        .bind(&email)
        .execute(&h.pool)
        .await
        .expect("cleanup pending");
    sqlx::query("DELETE FROM auth_invitations WHERE id = $1")
        .bind(invite_link)
        .execute(&h.pool)
        .await
        .expect("cleanup invitation");
    cleanup_graph(&h.graph, &[inviter_id]).await;
}

#[tokio::test]
async fn verify_login_me_refresh_round_trip() {
    let h = harness().await;
    let (inviter_id, invite_link) = seed_inviter(&h.pool, &h.graph).await;

    let email = format!("flow-{}@cogra.test", Uuid::new_v4());
    let handle = format!("u{}", Uuid::new_v4().simple());
    let pw = "another-long-enough-password";

    // Seed a pending registration with a token we know the raw form of — the
    // dev bypass only logs it, so the API can't hand it back.
    let token = tokens::generate();
    postgres_store::auth::upsert_pending_registration(
        &h.pool,
        postgres_store::auth::NewPendingRegistration {
            username: &handle,
            email: &email,
            password_hash: &password::hash_password(pw).expect("hash"),
            invitation_id: invite_link,
            invitee_dim1: 0.5,
            invitee_dim2: 0.5,
            email_verification_token_hash: &token.hash,
            expires_at: Utc::now() + Duration::hours(24),
        },
    )
    .await
    .expect("seed pending");

    // verifyEmail — the dual-store transaction.
    let verified = gql(
        &h.app,
        json!({
            "query": "mutation($i: VerifyEmailInput!) { verifyEmail(input: $i) {
                auth { accessToken refreshToken session { isCurrent } user { id networkRole handle { value } } }
                userErrors { code }
            } }",
            "variables": { "i": { "verificationToken": token.raw, "deviceLabel": "test-device" } }
        }),
        None,
    )
    .await;
    let payload = &verified["data"]["verifyEmail"];
    assert_eq!(
        payload["userErrors"].as_array().map(|e| e.len()),
        Some(0),
        "{verified}"
    );
    let auth = &payload["auth"];
    assert!(
        auth["accessToken"].is_string(),
        "issues access token: {verified}"
    );
    assert_eq!(auth["user"]["networkRole"], "MEMBER");
    assert_eq!(auth["user"]["handle"]["value"], handle);
    assert_eq!(auth["session"]["isCurrent"], true);
    let user_id: Uuid = auth["user"]["id"]
        .as_str()
        .expect("user id")
        .parse()
        .expect("uuid");
    let access = auth["accessToken"]
        .as_str()
        .expect("access token")
        .to_string();
    let refresh = auth["refreshToken"]
        .as_str()
        .expect("refresh token")
        .to_string();

    // me — resolves the bearer token to the viewer's own User.
    let me = gql(
        &h.app,
        json!({ "query": "{ me { id handle { value } } }" }),
        Some(&access),
    )
    .await;
    assert_eq!(
        me["data"]["me"]["id"],
        user_id.to_string(),
        "me resolves the viewer: {me}"
    );

    // me without a token is anonymous (null, not an error).
    let anon = gql(&h.app, json!({ "query": "{ me { id } }" }), None).await;
    assert!(anon["data"]["me"].is_null(), "anonymous me is null: {anon}");

    // logIn — fresh session from credentials.
    let logged_in = gql(
        &h.app,
        json!({
            "query": "mutation($i: LogInInput!) { logIn(input: $i) {
                auth { accessToken user { id } } userErrors { code }
            } }",
            "variables": { "i": { "email": email, "password": pw } }
        }),
        None,
    )
    .await;
    assert_eq!(
        logged_in["data"]["logIn"]["userErrors"]
            .as_array()
            .map(|e| e.len()),
        Some(0),
        "{logged_in}"
    );
    assert_eq!(
        logged_in["data"]["logIn"]["auth"]["user"]["id"],
        user_id.to_string(),
        "{logged_in}"
    );

    // Wrong password is an INVALID_CREDENTIALS userError — data, not a
    // transport error; auth is null.
    let bad = gql(
        &h.app,
        json!({
            "query": "mutation($i: LogInInput!) { logIn(input: $i) {
                auth { accessToken } userErrors { code message field }
            } }",
            "variables": { "i": { "email": email, "password": "wrong-password-entirely" } }
        }),
        None,
    )
    .await;
    assert!(bad["errors"].is_null(), "no transport error: {bad}");
    assert!(
        bad["data"]["logIn"]["auth"].is_null(),
        "auth null on failure: {bad}"
    );
    assert_eq!(
        bad["data"]["logIn"]["userErrors"][0]["code"], "INVALID_CREDENTIALS",
        "{bad}"
    );

    // refreshSession — rotates the refresh token.
    let refreshed = gql(
        &h.app,
        json!({
            "query": "mutation($i: RefreshSessionInput!) { refreshSession(input: $i) {
                auth { accessToken refreshToken } userErrors { code }
            } }",
            "variables": { "i": { "refreshToken": refresh } }
        }),
        None,
    )
    .await;
    let new_refresh = refreshed["data"]["refreshSession"]["auth"]["refreshToken"]
        .as_str()
        .expect("new refresh token");
    assert_ne!(new_refresh, refresh, "rotation issues a new token");

    // Reusing the old (now-revoked) refresh token surfaces a
    // REFRESH_TOKEN_INVALID userError (all sessions revoked behind it).
    let reuse = gql(
        &h.app,
        json!({
            "query": "mutation($i: RefreshSessionInput!) { refreshSession(input: $i) {
                auth { accessToken } userErrors { code }
            } }",
            "variables": { "i": { "refreshToken": refresh } }
        }),
        None,
    )
    .await;
    assert!(reuse["errors"].is_null(), "no transport error: {reuse}");
    assert_eq!(
        reuse["data"]["refreshSession"]["userErrors"][0]["code"], "REFRESH_TOKEN_INVALID",
        "reused refresh token: {reuse}"
    );

    // Cleanup: drop the user's Postgres rows (profile versions have no
    // cascade, so they go first; refresh tokens cascade), then the graph
    // fixtures (the registrant User and its wallet, then the inviter).
    sqlx::query("DELETE FROM user_profile_versions WHERE user_id = $1")
        .bind(user_id)
        .execute(&h.pool)
        .await
        .expect("cleanup profile versions");
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&h.pool)
        .await
        .expect("cleanup user");
    sqlx::query("DELETE FROM auth_invitations WHERE id = $1")
        .bind(invite_link)
        .execute(&h.pool)
        .await
        .expect("cleanup invitation");
    h.graph
        .run(
            query(
                "MATCH (u:User {id: $uid}) OPTIONAL MATCH (u)-[:PAYS_TO]->(w) DETACH DELETE u, w",
            )
            .param("uid", user_id.to_string()),
        )
        .await
        .expect("cleanup registrant + wallet");
    cleanup_graph(&h.graph, &[inviter_id]).await;
}

/// A `register` selecting the receipt and the userErrors list — the one flat
/// shape that carries whichever expected failure occurred.
const REGISTER_ARM_QUERY: &str = "mutation($i: RegisterInput!) { register(input: $i) {
    expiresAt userErrors { code message field }
} }";

#[tokio::test]
async fn register_rejects_unknown_invite() {
    let h = harness().await;
    let resp = gql(
        &h.app,
        json!({
            "query": REGISTER_ARM_QUERY,
            "variables": { "i": {
                "inviteLink": Uuid::new_v4(), "handle": format!("u{}", Uuid::new_v4().simple()),
                "email": format!("nv-{}@cogra.test", Uuid::new_v4()),
                "password": "a-sufficiently-long-password"
            }}
        }),
        None,
    )
    .await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    assert!(resp["data"]["register"]["expiresAt"].is_null(), "{resp}");
    let err = &resp["data"]["register"]["userErrors"][0];
    assert_eq!(err["code"], "INVITE_UNUSABLE", "{resp}");
    assert_eq!(err["field"][0], "inviteLink", "{resp}");
}

#[tokio::test]
async fn register_rejects_short_password() {
    // The password floor is checked before any DB work, so no invite need exist.
    let h = harness().await;
    let resp = gql(
        &h.app,
        json!({
            "query": REGISTER_ARM_QUERY,
            "variables": { "i": {
                "inviteLink": Uuid::new_v4(), "handle": format!("u{}", Uuid::new_v4().simple()),
                "email": format!("wp-{}@cogra.test", Uuid::new_v4()), "password": "short"
            }}
        }),
        None,
    )
    .await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    let err = &resp["data"]["register"]["userErrors"][0];
    assert_eq!(err["code"], "WEAK_PASSWORD", "{resp}");
    assert_eq!(err["field"][0], "password", "{resp}");
}

#[tokio::test]
async fn register_rejects_taken_handle() {
    let h = harness().await;
    let (inviter_id, invite_link) = seed_inviter(&h.pool, &h.graph).await;

    // A committed account already holds this handle.
    let taken_id = Uuid::new_v4();
    let handle = format!("u{}", Uuid::new_v4().simple());
    sqlx::query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(taken_id)
        .bind(&handle)
        .bind(format!("taken-{}@cogra.test", Uuid::new_v4()))
        .bind("x")
        .execute(&h.pool)
        .await
        .expect("seed taken handle");

    let resp = gql(
        &h.app,
        json!({
            "query": REGISTER_ARM_QUERY,
            "variables": { "i": {
                "inviteLink": invite_link, "handle": handle,
                "email": format!("ht-{}@cogra.test", Uuid::new_v4()),
                "password": "a-sufficiently-long-password"
            }}
        }),
        None,
    )
    .await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    assert_eq!(
        resp["data"]["register"]["userErrors"][0]["code"], "HANDLE_TAKEN",
        "{resp}"
    );

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(taken_id)
        .execute(&h.pool)
        .await
        .expect("cleanup user");
    sqlx::query("DELETE FROM auth_invitations WHERE id = $1")
        .bind(invite_link)
        .execute(&h.pool)
        .await
        .expect("cleanup invitation");
    cleanup_graph(&h.graph, &[inviter_id]).await;
}

#[tokio::test]
async fn register_rejects_email_with_pending_registration() {
    let h = harness().await;
    let (inviter_id, invite_link) = seed_inviter(&h.pool, &h.graph).await;
    let email = format!("inprog-{}@cogra.test", Uuid::new_v4());

    let token = tokens::generate();
    postgres_store::auth::upsert_pending_registration(
        &h.pool,
        postgres_store::auth::NewPendingRegistration {
            username: &format!("u{}", Uuid::new_v4().simple()),
            email: &email,
            password_hash: &password::hash_password("another-long-enough-pw").expect("hash"),
            invitation_id: invite_link,
            invitee_dim1: 0.5,
            invitee_dim2: 0.5,
            email_verification_token_hash: &token.hash,
            expires_at: Utc::now() + Duration::hours(24),
        },
    )
    .await
    .expect("seed pending");

    // A fresh handle (so the handle check passes) but the same email.
    let resp = gql(
        &h.app,
        json!({
            "query": REGISTER_ARM_QUERY,
            "variables": { "i": {
                "inviteLink": invite_link, "handle": format!("u{}", Uuid::new_v4().simple()),
                "email": email, "password": "a-sufficiently-long-password"
            }}
        }),
        None,
    )
    .await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    assert_eq!(
        resp["data"]["register"]["userErrors"][0]["code"], "REGISTRATION_IN_PROGRESS",
        "{resp}"
    );

    sqlx::query("DELETE FROM auth_pending_registrations WHERE email = $1")
        .bind(&email)
        .execute(&h.pool)
        .await
        .expect("cleanup pending");
    sqlx::query("DELETE FROM auth_invitations WHERE id = $1")
        .bind(invite_link)
        .execute(&h.pool)
        .await
        .expect("cleanup invitation");
    cleanup_graph(&h.graph, &[inviter_id]).await;
}

#[tokio::test]
async fn verify_email_rejects_unknown_token() {
    let h = harness().await;
    let resp = gql(
        &h.app,
        json!({
            "query": "mutation($i: VerifyEmailInput!) { verifyEmail(input: $i) {
                auth { accessToken } userErrors { code }
            } }",
            "variables": { "i": { "verificationToken": tokens::generate().raw } }
        }),
        None,
    )
    .await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    assert!(resp["data"]["verifyEmail"]["auth"].is_null(), "{resp}");
    assert_eq!(
        resp["data"]["verifyEmail"]["userErrors"][0]["code"], "VERIFICATION_TOKEN_INVALID",
        "{resp}"
    );
}

/// A malformed query is a transport fault, not a userError: it rides the
/// top-level `errors` array, and the ErrorCodes extension stamps it BAD_INPUT.
#[tokio::test]
async fn malformed_query_carries_a_transport_code() {
    let h = harness().await;
    let resp = gql(
        &h.app,
        // `me` exists; `notARealField` does not — a validation error, raised
        // before any resolver runs.
        json!({ "query": "{ me { notARealField } }" }),
        None,
    )
    .await;
    assert!(
        resp["data"].is_null(),
        "validation fails before execution: {resp}"
    );
    assert_eq!(
        resp["errors"][0]["extensions"]["code"], "BAD_INPUT",
        "transport fault carries a stable code: {resp}"
    );
}
