//! End-to-end `editProfile` integration tests — the slice-1 profile-edit cut
//! as code. Require both databases (`make up`); connection comes from
//! DATABASE_URL / MEMGRAPH_HOST / MEMGRAPH_PORT, matching CI's service
//! containers.
//!
//! Both stores are shared across tests, so each test mints a unique handle /
//! email and removes the rows + graph nodes it creates on the way out. Users
//! are created through the real register→verify flow (a seeded pending row with
//! a known token), so every test edits a genuinely-bootstrapped account.

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

/// A user created through the real flow, with the bits a test needs to edit it
/// and clean it up.
struct Account {
    user_id: Uuid,
    handle: String,
    access: String,
    inviter_id: Uuid,
    invite_link: Uuid,
}

fn fresh_handle() -> String {
    format!("u{}", &Uuid::new_v4().simple().to_string()[..16])
}

/// Seeds a bare inviter node + invitation, then registers and verifies a user
/// through `verifyEmail`, returning everything needed to act as that account.
async fn create_account(h: &Harness) -> Account {
    let inviter_id = Uuid::new_v4();
    h.graph
        .run(query("CREATE (:User {id: $id})").param("id", inviter_id.to_string()))
        .await
        .expect("create inviter node");
    let mut conn = h.pool.acquire().await.expect("connection");
    let invite_link = postgres_store::genesis::insert_genesis_invitation(
        &mut conn,
        inviter_id,
        0.5,
        0.5,
        Utc::now() + Duration::days(7),
    )
    .await
    .expect("insert invitation");

    let handle = fresh_handle();
    let email = format!("{handle}@cogra.test");
    let token = tokens::generate();
    postgres_store::auth::upsert_pending_registration(
        &h.pool,
        postgres_store::auth::NewPendingRegistration {
            username: &handle,
            email: &email,
            password_hash: &password::hash_password("a-sufficiently-long-password").expect("hash"),
            invitation_id: invite_link,
            invitee_dim1: 0.5,
            invitee_dim2: 0.5,
            email_verification_token_hash: &token.hash,
            expires_at: Utc::now() + Duration::hours(24),
        },
    )
    .await
    .expect("seed pending");

    let verified = gql(
        &h.app,
        json!({
            "query": "mutation($i: VerifyEmailInput!) { verifyEmail(input: $i) {
                auth { accessToken user { id } } userErrors { code }
            } }",
            "variables": { "i": { "verificationToken": token.raw, "deviceLabel": "test" } }
        }),
        None,
    )
    .await;
    let auth = &verified["data"]["verifyEmail"]["auth"];
    let user_id = auth["user"]["id"]
        .as_str()
        .expect("user id")
        .parse()
        .expect("uuid");
    let access = auth["accessToken"].as_str().expect("access").to_string();
    Account {
        user_id,
        handle,
        access,
        inviter_id,
        invite_link,
    }
}

/// Removes everything an [`Account`] created from both stores.
async fn cleanup(h: &Harness, acc: &Account) {
    for sql in [
        "DELETE FROM user_profile_versions WHERE user_id = $1",
        "DELETE FROM auth_refresh_tokens WHERE user_id = $1",
        "DELETE FROM users WHERE id = $1",
    ] {
        sqlx::query(sql)
            .bind(acc.user_id)
            .execute(&h.pool)
            .await
            .expect("cleanup pg");
    }
    sqlx::query("DELETE FROM auth_invitations WHERE id = $1")
        .bind(acc.invite_link)
        .execute(&h.pool)
        .await
        .expect("cleanup invitation");
    h.graph
        .run(
            query(
                "MATCH (u:User {id: $uid}) OPTIONAL MATCH (u)-[:PAYS_TO]->(w)
                 DETACH DELETE u, w",
            )
            .param("uid", acc.user_id.to_string()),
        )
        .await
        .expect("cleanup user graph");
    h.graph
        .run(query("MATCH (n {id: $id}) DETACH DELETE n").param("id", acc.inviter_id.to_string()))
        .await
        .expect("cleanup inviter");
}

const EDIT_QUERY: &str = "mutation($i: EditProfileInput!) { editProfile(input: $i) {
    user { handle { value } displayName { value } bio { value } websiteUrl { value } updatedAt }
    userErrors { code field message }
} }";

async fn edit(h: &Harness, access: &str, input: Value) -> Value {
    gql(
        &h.app,
        json!({ "query": EDIT_QUERY, "variables": { "i": input } }),
        Some(access),
    )
    .await
}

#[tokio::test]
async fn edit_profile_sets_all_text_fields_and_advances_updated_at() {
    let h = harness().await;
    let acc = create_account(&h).await;

    // updatedAt before the edit — equals createdAt for a never-edited profile.
    let before = gql(
        &h.app,
        json!({ "query": "{ me { updatedAt } }" }),
        Some(&acc.access),
    )
    .await["data"]["me"]["updatedAt"]
        .as_str()
        .expect("updatedAt")
        .to_string();

    let resp = edit(
        &h,
        &acc.access,
        json!({ "displayName": "Ada Lovelace", "bio": "first programmer", "websiteUrl": "https://ada.example" }),
    )
    .await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    let user = &resp["data"]["editProfile"]["user"];
    assert_eq!(
        resp["data"]["editProfile"]["userErrors"]
            .as_array()
            .map(Vec::len),
        Some(0),
        "{resp}"
    );
    assert_eq!(user["displayName"]["value"], "Ada Lovelace");
    assert_eq!(user["bio"]["value"], "first programmer");
    assert_eq!(user["websiteUrl"]["value"], "https://ada.example");
    assert_ne!(
        user["updatedAt"].as_str().expect("updatedAt"),
        before,
        "a successful edit advances updatedAt: {resp}"
    );

    // The change is durable — a fresh `me` reads the new top version.
    let me = gql(
        &h.app,
        json!({ "query": "{ me { displayName { value } bio { value } } }" }),
        Some(&acc.access),
    )
    .await;
    assert_eq!(me["data"]["me"]["displayName"]["value"], "Ada Lovelace");

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_carries_omitted_fields_forward() {
    let h = harness().await;
    let acc = create_account(&h).await;

    edit(&h, &acc.access, json!({ "bio": "set once" })).await;
    // A second edit touches only displayName; the bio must survive.
    let resp = edit(&h, &acc.access, json!({ "displayName": "Renamed" })).await;
    let user = &resp["data"]["editProfile"]["user"];
    assert_eq!(user["displayName"]["value"], "Renamed");
    assert_eq!(
        user["bio"]["value"], "set once",
        "an omitted field carries forward: {resp}"
    );

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_blank_clears_an_optional_field() {
    let h = harness().await;
    let acc = create_account(&h).await;

    edit(&h, &acc.access, json!({ "bio": "to be cleared" })).await;
    let resp = edit(&h, &acc.access, json!({ "bio": "" })).await;
    let user = &resp["data"]["editProfile"]["user"];
    assert!(
        user["bio"]["value"].is_null(),
        "an empty bio clears the field: {resp}"
    );

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_changes_handle_across_both_stores() {
    let h = harness().await;
    let acc = create_account(&h).await;
    let new_handle = fresh_handle();

    let resp = edit(&h, &acc.access, json!({ "handle": &new_handle })).await;
    assert_eq!(
        resp["data"]["editProfile"]["userErrors"]
            .as_array()
            .map(Vec::len),
        Some(0),
        "{resp}"
    );
    assert_eq!(
        resp["data"]["editProfile"]["user"]["handle"]["value"],
        new_handle
    );

    // Postgres `users.username` reflects the change.
    let pg_handle: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(acc.user_id)
        .fetch_one(&h.pool)
        .await
        .expect("pg username");
    assert_eq!(pg_handle, new_handle);

    // The graph node's `username` data property is relabeled, and a second
    // layer is appended (the seed layer plus this change).
    let mut rows = h
        .graph
        .execute(
            query("MATCH (u:User {id: $id}) RETURN u.username AS username, size(u.username_layers) AS layers")
                .param("id", acc.user_id.to_string()),
        )
        .await
        .expect("graph read");
    let row = rows.next().await.expect("row").expect("some row");
    let graph_handle: String = row.get("username").expect("username");
    let layers: i64 = row.get("layers").expect("layers");
    assert_eq!(graph_handle, new_handle, "graph username relabeled");
    assert_eq!(layers, 2, "a new username layer is appended");

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_handle_unchanged_is_idempotent_on_the_graph() {
    let h = harness().await;
    let acc = create_account(&h).await;

    // Submitting the current handle is not a change: no new graph layer.
    let resp = edit(&h, &acc.access, json!({ "handle": &acc.handle })).await;
    assert_eq!(
        resp["data"]["editProfile"]["userErrors"]
            .as_array()
            .map(Vec::len),
        Some(0),
        "submitting the same handle is accepted, not a self-collision: {resp}"
    );
    let mut rows = h
        .graph
        .execute(
            query("MATCH (u:User {id: $id}) RETURN size(u.username_layers) AS layers")
                .param("id", acc.user_id.to_string()),
        )
        .await
        .expect("graph read");
    let layers: i64 = rows
        .next()
        .await
        .expect("row")
        .expect("some row")
        .get("layers")
        .expect("layers");
    assert_eq!(layers, 1, "an unchanged handle appends no layer");

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_rejects_a_taken_handle() {
    let h = harness().await;
    let holder = create_account(&h).await;
    let editor = create_account(&h).await;

    let resp = edit(&h, &editor.access, json!({ "handle": &holder.handle })).await;
    assert!(resp["errors"].is_null(), "no transport error: {resp}");
    assert!(
        resp["data"]["editProfile"]["user"].is_null(),
        "user is null on rejection: {resp}"
    );
    let err = &resp["data"]["editProfile"]["userErrors"][0];
    assert_eq!(err["code"], "HANDLE_TAKEN", "{resp}");
    assert_eq!(err["field"][0], "handle");

    // The editor's own handle is untouched.
    let unchanged: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(editor.user_id)
        .fetch_one(&h.pool)
        .await
        .expect("pg username");
    assert_eq!(unchanged, editor.handle);

    cleanup(&h, &holder).await;
    cleanup(&h, &editor).await;
}

#[tokio::test]
async fn edit_profile_rejects_bad_field_values() {
    let h = harness().await;
    let acc = create_account(&h).await;

    // Empty display name (a required field).
    let blank = edit(&h, &acc.access, json!({ "displayName": "   " })).await;
    assert_eq!(
        blank["data"]["editProfile"]["userErrors"][0]["code"],
        "BAD_INPUT"
    );
    assert_eq!(
        blank["data"]["editProfile"]["userErrors"][0]["field"][0],
        "displayName"
    );

    // A non-http(s) URL must never reach storage.
    let js = edit(
        &h,
        &acc.access,
        json!({ "websiteUrl": "javascript:alert(1)" }),
    )
    .await;
    assert_eq!(
        js["data"]["editProfile"]["userErrors"][0]["code"],
        "BAD_INPUT"
    );
    assert_eq!(
        js["data"]["editProfile"]["userErrors"][0]["field"][0],
        "websiteUrl"
    );

    // A rejected edit writes nothing: still the registration-seeded version.
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM user_profile_versions WHERE user_id = $1")
            .bind(acc.user_id)
            .fetch_one(&h.pool)
            .await
            .expect("count");
    assert_eq!(count, 1, "a rejected edit appends no version");

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_requires_at_least_one_field() {
    let h = harness().await;
    let acc = create_account(&h).await;

    let resp = edit(&h, &acc.access, json!({})).await;
    assert!(
        resp["data"]["editProfile"]["user"].is_null(),
        "an empty edit is rejected: {resp}"
    );
    assert_eq!(
        resp["data"]["editProfile"]["userErrors"][0]["code"], "BAD_INPUT",
        "{resp}"
    );

    cleanup(&h, &acc).await;
}

#[tokio::test]
async fn edit_profile_requires_authentication() {
    let h = harness().await;

    // No bearer token: an UNAUTHENTICATED transport fault (tier 1), not a
    // userError — this is what the client's refresh-and-replay keys on.
    let resp = gql(
        &h.app,
        json!({ "query": EDIT_QUERY, "variables": { "i": { "displayName": "Nobody" } } }),
        None,
    )
    .await;
    assert!(
        resp["data"]["editProfile"].is_null(),
        "no data on an auth fault: {resp}"
    );
    assert_eq!(
        resp["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "{resp}"
    );
}
