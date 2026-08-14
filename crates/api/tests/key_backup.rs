//! The key-backup surface through the API (auth.md "Key recovery"):
//! the signed upload and its challenge, the size cap, replacement and
//! its notice, and viewer-scoped retrieval. Requires a live Postgres
//! (`make up`).

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use common::l1::key_backup;
use ed25519_dalek::SigningKey;
use postgres_store::PgPool;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use api::ratelimit::RateLimitConfig;

mod rig;

const EMAIL: &str = "a@example.com";
const NOTICE_SUBJECT: &str = "Your CoGra recovery code was replaced";

struct Rig {
    app: axum::Router,
    pool: PgPool,
    mailer: Arc<rig::TestMailer>,
}

/// A logged-in account together with the actor key its uploads sign
/// under — the pair every legitimate upload needs.
struct Account {
    token: String,
    key: SigningKey,
}

impl Rig {
    fn new(pool: PgPool) -> Self {
        let mailer = Arc::new(rig::TestMailer::default());
        Self {
            app: rig::connect_info_app(pool.clone(), mailer.clone(), RateLimitConfig::unlimited()),
            pool,
            mailer,
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

    /// A credentialed account with an attached actor key, logged in.
    async fn logged_in_user(&self) -> Account {
        let seed = [11u8; 32];
        let key = ActorKey::from_seed(seed);
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
        postgres_store::genesis::insert_credentials(&self.pool, id, EMAIL, &hash)
            .await
            .expect("credentials");
        let login = self
            .gql(
                None,
                "mutation($input: LogInInput!) {
                    logIn(input: $input) { auth { accessToken } userErrors { code } }
                }",
                json!({ "input": { "email": EMAIL, "password": "a strong password" } }),
            )
            .await;
        Account {
            token: login["data"]["logIn"]["auth"]["accessToken"]
                .as_str()
                .expect("access token")
                .to_owned(),
            key: SigningKey::from_bytes(&seed),
        }
    }

    async fn challenge(&self, token: &str) -> Value {
        self.gql(
            Some(token),
            "mutation { createKeyBackupChallenge { challenge expiresAt } }",
            json!({}),
        )
        .await
    }

    /// The whole legitimate flow: take a challenge, sign the blob under
    /// it, upload.
    async fn upload(&self, account: &Account, blob: &[u8]) -> Value {
        let issued = self.challenge(&account.token).await;
        let challenge = issued["data"]["createKeyBackupChallenge"]["challenge"]
            .as_str()
            .unwrap_or_else(|| panic!("challenge: {issued}"))
            .to_owned();
        let signature = self.sign(account, &challenge, blob);
        self.upload_raw(&account.token, blob, &challenge, &signature)
            .await
    }

    fn sign(&self, account: &Account, challenge_b64: &str, blob: &[u8]) -> String {
        let challenge = B64.decode(challenge_b64).expect("base64 challenge");
        B64.encode(key_backup::sign_upload(&account.key, &challenge, blob))
    }

    async fn upload_raw(
        &self,
        token: &str,
        blob: &[u8],
        challenge_b64: &str,
        signature_b64: &str,
    ) -> Value {
        self.gql(
            Some(token),
            "mutation($input: UploadKeyBackupInput!) {
                uploadKeyBackup(input: $input) { ok userErrors { code field } }
            }",
            json!({ "input": {
                "blob": B64.encode(blob),
                "challenge": challenge_b64,
                "signature": signature_b64,
            }}),
        )
        .await
    }

    async fn stored_backup(&self, token: &str) -> Value {
        self.gql(Some(token), "{ me { keyBackup } }", json!({}))
            .await["data"]["me"]["keyBackup"]
            .clone()
    }

    /// The pre-ceremony state: credentials exist, no actor key attached.
    async fn detach_actor_key(&self) {
        sqlx::query(
            "UPDATE actors SET actor_pubkey = NULL, l0_address = NULL
              WHERE id = (SELECT actor_id FROM user_credentials WHERE email = $1)",
        )
        .bind(EMAIL)
        .execute(&self.pool)
        .await
        .expect("detach");
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_signed_upload_roundtrips_and_replacement_overwrites(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let first = rig.upload(&account, b"ciphertext one").await;
    assert_eq!(first["data"]["uploadKeyBackup"]["ok"], true, "{first}");
    let second = rig.upload(&account, b"ciphertext two").await;
    assert_eq!(second["data"]["uploadKeyBackup"]["ok"], true, "{second}");

    let stored = rig.stored_backup(&account.token).await;
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
async fn only_replacement_mails_the_notice(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    // Enabling backup destroys nothing, so it stays silent.
    rig.upload(&account, b"ciphertext one").await;
    assert_eq!(rig.mailer.subjects_for(EMAIL), Vec::<String>::new());

    rig.upload(&account, b"ciphertext two").await;
    rig.upload(&account, b"ciphertext three").await;
    assert_eq!(
        rig.mailer.subjects_for(EMAIL),
        vec![NOTICE_SUBJECT.to_string(), NOTICE_SUBJECT.to_string()],
        "every replacement, not just the first"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_blob_over_the_cap_refuses_and_stores_nothing(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let refused = rig.upload(&account, &vec![0u8; 4097]).await;
    let error = &refused["data"]["uploadKeyBackup"]["userErrors"][0];
    assert_eq!(error["code"], "BAD_INPUT", "{refused}");
    assert_eq!(error["field"][0], "blob");
    assert!(refused["data"]["uploadKeyBackup"]["ok"].is_null());
    assert!(rig.stored_backup(&account.token).await.is_null());

    // The cap is on decoded bytes: exactly 4096 still stores.
    let at_cap = rig.upload(&account, &vec![0u8; 4096]).await;
    assert_eq!(at_cap["data"]["uploadKeyBackup"]["ok"], true, "{at_cap}");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_session_without_the_actor_key_cannot_overwrite_the_blob(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;
    rig.upload(&account, b"the real backup").await;

    // The stolen-login attacker: a live session, no actor key. They can
    // still take a challenge, but nothing they sign with verifies.
    let issued = rig.challenge(&account.token).await;
    let challenge = issued["data"]["createKeyBackupChallenge"]["challenge"]
        .as_str()
        .expect("challenge")
        .to_owned();
    let stranger = Account {
        token: account.token.clone(),
        key: SigningKey::from_bytes(&[99u8; 32]),
    };
    let signature = rig.sign(&stranger, &challenge, b"garbage");
    let refused = rig
        .upload_raw(&account.token, b"garbage", &challenge, &signature)
        .await;

    let error = &refused["data"]["uploadKeyBackup"]["userErrors"][0];
    assert_eq!(error["code"], "SIGNATURE_INVALID", "{refused}");
    assert_eq!(error["field"][0], "signature");
    assert_eq!(
        rig.stored_backup(&account.token).await.as_str(),
        Some(B64.encode(b"the real backup").as_str()),
        "the victim's blob survives"
    );
    assert_eq!(rig.mailer.subjects_for(EMAIL), Vec::<String>::new());
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_signature_for_other_bytes_does_not_authorize_this_blob(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let issued = rig.challenge(&account.token).await;
    let challenge = issued["data"]["createKeyBackupChallenge"]["challenge"]
        .as_str()
        .expect("challenge")
        .to_owned();
    let signature = rig.sign(&account, &challenge, b"what was signed");
    let refused = rig
        .upload_raw(&account.token, b"what was sent", &challenge, &signature)
        .await;

    assert_eq!(
        refused["data"]["uploadKeyBackup"]["userErrors"][0]["code"], "SIGNATURE_INVALID",
        "{refused}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_challenge_is_single_use(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let issued = rig.challenge(&account.token).await;
    let challenge = issued["data"]["createKeyBackupChallenge"]["challenge"]
        .as_str()
        .expect("challenge")
        .to_owned();
    let signature = rig.sign(&account, &challenge, b"ciphertext");

    let first = rig
        .upload_raw(&account.token, b"ciphertext", &challenge, &signature)
        .await;
    assert_eq!(first["data"]["uploadKeyBackup"]["ok"], true, "{first}");

    // The replay: identical bytes, identical signature, second time.
    let replayed = rig
        .upload_raw(&account.token, b"ciphertext", &challenge, &signature)
        .await;
    let error = &replayed["data"]["uploadKeyBackup"]["userErrors"][0];
    assert_eq!(error["code"], "CHALLENGE_EXPIRED", "{replayed}");
    assert_eq!(error["field"][0], "challenge");
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_expired_challenge_refuses(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let issued = rig.challenge(&account.token).await;
    let challenge = issued["data"]["createKeyBackupChallenge"]["challenge"]
        .as_str()
        .expect("challenge")
        .to_owned();
    sqlx::query("UPDATE auth_key_backup_challenges SET expires_at = NOW() - INTERVAL '1 second'")
        .execute(&rig.pool)
        .await
        .expect("expire");

    let signature = rig.sign(&account, &challenge, b"ciphertext");
    let refused = rig
        .upload_raw(&account.token, b"ciphertext", &challenge, &signature)
        .await;
    assert_eq!(
        refused["data"]["uploadKeyBackup"]["userErrors"][0]["code"], "CHALLENGE_EXPIRED",
        "{refused}"
    );
    assert!(rig.stored_backup(&account.token).await.is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_challenge_never_issued_refuses(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let invented = B64.encode([7u8; key_backup::CHALLENGE_LEN]);
    let signature = rig.sign(&account, &invented, b"ciphertext");
    let refused = rig
        .upload_raw(&account.token, b"ciphertext", &invented, &signature)
        .await;
    assert_eq!(
        refused["data"]["uploadKeyBackup"]["userErrors"][0]["code"], "CHALLENGE_EXPIRED",
        "{refused}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn issuing_again_discards_the_previous_challenge(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let first = rig.challenge(&account.token).await;
    let stale = first["data"]["createKeyBackupChallenge"]["challenge"]
        .as_str()
        .expect("challenge")
        .to_owned();
    rig.challenge(&account.token).await;

    let signature = rig.sign(&account, &stale, b"ciphertext");
    let refused = rig
        .upload_raw(&account.token, b"ciphertext", &stale, &signature)
        .await;
    assert_eq!(
        refused["data"]["uploadKeyBackup"]["userErrors"][0]["code"], "CHALLENGE_EXPIRED",
        "{refused}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_bad_signature_does_not_burn_the_challenge(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    let issued = rig.challenge(&account.token).await;
    let challenge = issued["data"]["createKeyBackupChallenge"]["challenge"]
        .as_str()
        .expect("challenge")
        .to_owned();

    let wrong = rig.sign(
        &Account {
            token: account.token.clone(),
            key: SigningKey::from_bytes(&[42u8; 32]),
        },
        &challenge,
        b"ciphertext",
    );
    rig.upload_raw(&account.token, b"ciphertext", &challenge, &wrong)
        .await;

    // The same challenge still works for the rightful holder.
    let signature = rig.sign(&account, &challenge, b"ciphertext");
    let accepted = rig
        .upload_raw(&account.token, b"ciphertext", &challenge, &signature)
        .await;
    assert_eq!(
        accepted["data"]["uploadKeyBackup"]["ok"], true,
        "{accepted}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn malformed_base64_refuses_on_the_offending_field(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;

    for (blob, challenge, signature, field) in [
        ("!!not base64", "AAAA", "AAAA", "blob"),
        ("AAAA", "!!not base64", "AAAA", "challenge"),
        ("AAAA", "AAAA", "!!not base64", "signature"),
    ] {
        let refused = rig
            .gql(
                Some(&account.token),
                "mutation($input: UploadKeyBackupInput!) {
                    uploadKeyBackup(input: $input) { ok userErrors { code field } }
                }",
                json!({ "input": {
                    "blob": blob, "challenge": challenge, "signature": signature,
                }}),
            )
            .await;
        let error = &refused["data"]["uploadKeyBackup"]["userErrors"][0];
        assert_eq!(error["code"], "BAD_INPUT", "{refused}");
        assert_eq!(error["field"][0], field, "{refused}");
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_account_with_no_attached_key_cannot_challenge_or_upload(pool: PgPool) {
    let rig = Rig::new(pool);
    let account = rig.logged_in_user().await;
    rig.detach_actor_key().await;

    let issued = rig.challenge(&account.token).await;
    assert_eq!(
        issued["errors"][0]["extensions"]["code"], "FORBIDDEN",
        "{issued}"
    );

    let invented = B64.encode([7u8; key_backup::CHALLENGE_LEN]);
    let signature = rig.sign(&account, &invented, b"ciphertext");
    let refused = rig
        .upload_raw(&account.token, b"ciphertext", &invented, &signature)
        .await;
    assert_eq!(
        refused["errors"][0]["extensions"]["code"], "FORBIDDEN",
        "{refused}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_challenge_needs_a_session(pool: PgPool) {
    let rig = Rig::new(pool);
    let issued = rig.challenge("not-a-token").await;
    assert_eq!(
        issued["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "{issued}"
    );
}
