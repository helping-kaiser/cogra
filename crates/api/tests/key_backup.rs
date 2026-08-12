//! The key-backup surface through the API (auth.md "Key recovery"):
//! upload, the size cap, replacement, and viewer-scoped retrieval.
//! Requires a live Postgres (`make up`).

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::PgPool;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use api::ratelimit::RateLimitConfig;

mod rig;

struct Rig {
    app: axum::Router,
    pool: PgPool,
}

impl Rig {
    fn new(pool: PgPool) -> Self {
        Self {
            app: rig::connect_info_app(
                pool.clone(),
                Arc::new(rig::TestMailer::default()),
                RateLimitConfig::unlimited(),
            ),
            pool,
        }
    }

    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json");
        if let Some(token) = token {
            builder = builder.header("authorization", format!("Bearer {token}"));
        }
        let body = json!({ "query": query, "variables": variables }).to_string();
        let response = self
            .app
            .clone()
            .oneshot(builder.body(Body::from(body)).expect("request"))
            .await
            .expect("response");
        rig::body_json(response).await
    }

    /// A credentialed account, logged in; returns its access token.
    async fn logged_in_user(&self) -> String {
        let key = common::l1::client::ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        postgres_store::genesis::insert_actor(
            &mut conn,
            id,
            "user",
            "alice",
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor");
        drop(conn);
        let hash = api::auth::hash_password("a strong password").expect("hash");
        postgres_store::genesis::insert_credentials(&self.pool, id, "a@example.com", &hash)
            .await
            .expect("credentials");
        let login = self
            .gql(
                None,
                "mutation($input: LogInInput!) {
                    logIn(input: $input) { auth { accessToken } userErrors { code } }
                }",
                json!({ "input": { "email": "a@example.com", "password": "a strong password" } }),
            )
            .await;
        login["data"]["logIn"]["auth"]["accessToken"]
            .as_str()
            .expect("access token")
            .to_owned()
    }

    async fn upload(&self, token: &str, blob: &[u8]) -> Value {
        self.gql(
            Some(token),
            "mutation($input: UploadKeyBackupInput!) {
                uploadKeyBackup(input: $input) { ok userErrors { code field } }
            }",
            json!({ "input": { "blob": B64.encode(blob) } }),
        )
        .await
    }

    async fn stored_backup(&self, token: &str) -> Value {
        self.gql(Some(token), "{ me { keyBackup } }", json!({}))
            .await["data"]["me"]["keyBackup"]
            .clone()
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_upload_roundtrips_and_replacement_overwrites(pool: PgPool) {
    let rig = Rig::new(pool);
    let token = rig.logged_in_user().await;

    let first = rig.upload(&token, b"ciphertext one").await;
    assert_eq!(first["data"]["uploadKeyBackup"]["ok"], true, "{first}");
    let second = rig.upload(&token, b"ciphertext two").await;
    assert_eq!(second["data"]["uploadKeyBackup"]["ok"], true, "{second}");

    let stored = rig.stored_backup(&token).await;
    assert_eq!(
        stored.as_str().expect("blob"),
        B64.encode(b"ciphertext two")
    );
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM auth_key_backups")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(rows, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_blob_over_the_cap_refuses_and_stores_nothing(pool: PgPool) {
    let rig = Rig::new(pool);
    let token = rig.logged_in_user().await;

    let refused = rig.upload(&token, &vec![0u8; 4097]).await;
    let error = &refused["data"]["uploadKeyBackup"]["userErrors"][0];
    assert_eq!(error["code"], "BAD_INPUT", "{refused}");
    assert_eq!(error["field"][0], "blob");
    assert!(refused["data"]["uploadKeyBackup"]["ok"].is_null());
    assert!(rig.stored_backup(&token).await.is_null());

    // The cap is on decoded bytes: exactly 4096 still stores.
    let at_cap = rig.upload(&token, &vec![0u8; 4096]).await;
    assert_eq!(at_cap["data"]["uploadKeyBackup"]["ok"], true, "{at_cap}");
}
