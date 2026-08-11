// Service-side authentication (auth.md): Argon2id password hashing, the
// JWT access + rotating opaque refresh token pair, session issuance and
// rotation with reuse detection, and the handle/email/password validation
// the application flow applies. Auth gates the service, never the graph —
// no session fact can author, block, or revoke a record.

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use argon2::Argon2;
use argon2::password_hash::rand_core::OsRng as PasswordOsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::SigningKey;
use ed25519_dalek::pkcs8::spki::der::pem::LineEnding;
use ed25519_dalek::pkcs8::{EncodePrivateKey, EncodePublicKey};
use hkdf::Hkdf;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use postgres_store::auth::RevokedReason;
use postgres_store::{PgPool, auth as store};
use rand::RngCore;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// Access-token lifetime (auth.md "Access token").
const ACCESS_TTL_MINUTES: i64 = 15;
/// Refresh-token lifetime, sliding (auth.md "Refresh token").
const REFRESH_TTL_DAYS: i64 = 30;
/// How long a rotated token answers its replay with the same successor
/// instead of the theft path (auth.md "Rotation"). Covers the client
/// retry/double-fire races; vendor practice is 10-30 s windows.
const ROTATION_GRACE_SECONDS: i64 = 10;

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("session-signing key: {0}")]
    Key(String),
    #[error("successor seal: {0}")]
    Seal(String),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// The session-token machinery: one Ed25519 service key that signs
/// sessions and nothing else, unrelated to any actor's L1 key.
#[derive(Clone)]
pub struct AuthConfig {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl AuthConfig {
    /// Builds from the 32-byte session-signing seed (`SESSION_SIGNING_SEED`,
    /// hex — development.md).
    pub fn from_seed(seed: [u8; 32]) -> Result<Self, AuthError> {
        let key = SigningKey::from_bytes(&seed);
        let private_pem = key
            .to_pkcs8_pem(LineEnding::LF)
            .map_err(|e| AuthError::Key(e.to_string()))?;
        let public_pem = key
            .verifying_key()
            .to_public_key_pem(LineEnding::LF)
            .map_err(|e| AuthError::Key(e.to_string()))?;
        Ok(Self {
            encoding_key: EncodingKey::from_ed_pem(private_pem.as_bytes())
                .map_err(|e| AuthError::Key(e.to_string()))?,
            decoding_key: DecodingKey::from_ed_pem(public_pem.as_bytes())
                .map_err(|e| AuthError::Key(e.to_string()))?,
        })
    }

    /// A throwaway config for tests and dev tools.
    pub fn ephemeral() -> Result<Self, AuthError> {
        let mut seed = [0u8; 32];
        OsRng.fill_bytes(&mut seed);
        Self::from_seed(seed)
    }
}

/// The access-token claims (auth.md "Access token"): subject, times, and
/// the issuing session — no role claims; authorization reads live state.
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: Uuid,
    iat: i64,
    exp: i64,
    jti: Uuid,
}

/// The resolved viewer of an authenticated request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Viewer {
    pub user_id: Uuid,
    pub session_id: Uuid,
}

fn mint_access_token(
    cfg: &AuthConfig,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<String, AuthError> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id,
        iat: now.timestamp(),
        exp: (now + Duration::minutes(ACCESS_TTL_MINUTES)).timestamp(),
        jti: session_id,
    };
    jsonwebtoken::encode(&Header::new(Algorithm::EdDSA), &claims, &cfg.encoding_key)
        .map_err(|e| AuthError::Key(e.to_string()))
}

/// Validates a bearer token; None for anything but a live, well-signed
/// access token.
pub fn verify_access_token(cfg: &AuthConfig, token: &str) -> Option<Viewer> {
    let data = jsonwebtoken::decode::<Claims>(
        token,
        &cfg.decoding_key,
        &Validation::new(Algorithm::EdDSA),
    )
    .ok()?;
    Some(Viewer {
        user_id: data.claims.sub,
        session_id: data.claims.jti,
    })
}

/// A freshly generated secret: the url-safe token the client stores and
/// the SHA-256 hash the database stores. Raw token material never
/// persists (auth.md "Refresh token").
pub struct Secret {
    pub token: String,
    pub hash: [u8; 32],
}

pub fn new_secret() -> Secret {
    let mut raw = [0u8; 32];
    OsRng.fill_bytes(&mut raw);
    let token = URL_SAFE_NO_PAD.encode(raw);
    Secret {
        hash: Sha256::digest(token.as_bytes()).into(),
        token,
    }
}

/// The stored hash of a presented token.
pub fn hash_of(token: &str) -> [u8; 32] {
    Sha256::digest(token.as_bytes()).into()
}

// ---------------------------------------------------------------------
// Passwords and identifier validation
// ---------------------------------------------------------------------

/// Argon2id at the crate's current OWASP-aligned defaults
/// (auth.md "Password storage").
pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut PasswordOsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AuthError::Key(e.to_string()))?
        .to_string())
}

pub fn verify_password(hash: &str, password: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// The password floor (auth.md "Password requirements"): minimum 12
/// characters, no maximum, no composition rules.
pub fn check_password(password: &str) -> Result<(), &'static str> {
    if password.chars().count() < 12 {
        return Err("password must be at least 12 characters");
    }
    Ok(())
}

/// The full new-password gate (auth.md "Password requirements"): the
/// floor, then the breach corpus. A corpus lookup failure fails OPEN —
/// logged and allowed; the corpus bounds online guessing that rate
/// limiting already throttles, and a provider outage must not block
/// registration or a reset.
pub async fn validate_new_password(
    corpus: &dyn crate::breach::BreachCorpus,
    password: &str,
) -> Result<(), String> {
    check_password(password).map_err(str::to_string)?;
    match corpus.is_breached(password).await {
        Ok(false) => Ok(()),
        Ok(true) => {
            Err("this password appears in a known data breach; choose a different one".to_string())
        }
        Err(e) => {
            tracing::warn!(error = %e, "breach-corpus lookup failed; allowing the password");
            Ok(())
        }
    }
}

/// Handle normalization (auth.md "Handle and email format"): case-folded
/// to lowercase; 3–30 characters of [a-z0-9_]. The charset excludes `-`,
/// keeping the redaction sentinel unreachable.
pub fn normalize_handle(handle: &str) -> Result<String, &'static str> {
    let folded = handle.trim().to_lowercase();
    let count = folded.chars().count();
    if !(3..=30).contains(&count) {
        return Err("handle must be 3-30 characters");
    }
    if !folded
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err("handle may contain only a-z, 0-9, and _");
    }
    Ok(folded)
}

/// Email normalization (auth.md): trimmed and lowercased to the canonical
/// form both storage and login use; the shape check is deliberately
/// lenient — the verification email is the authoritative proof.
pub fn normalize_email(email: &str) -> Result<String, &'static str> {
    let canonical = email.trim().to_lowercase();
    if canonical.len() > 254 {
        return Err("email is too long");
    }
    let Some((local, domain)) = canonical.split_once('@') else {
        return Err("email must contain exactly one @");
    };
    if local.is_empty() || domain.contains('@') {
        return Err("email must contain exactly one @");
    }
    let dot = domain.split_once('.');
    match dot {
        Some((host, rest)) if !host.is_empty() && !rest.is_empty() => Ok(canonical),
        _ => Err("email domain must be dotted"),
    }
}

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

/// One issued session: the token pair plus the row identity.
pub struct IssuedSession {
    pub access_token: String,
    pub refresh_token: String,
    pub session_id: Uuid,
    pub user_id: Uuid,
}

/// Mints a session for an account: refresh row + access token.
pub async fn issue_session(
    pool: &PgPool,
    cfg: &AuthConfig,
    user_id: Uuid,
    device_label: Option<&str>,
) -> Result<IssuedSession, AuthError> {
    let secret = new_secret();
    let session_id = Uuid::new_v4();
    store::insert_session(
        pool,
        session_id,
        user_id,
        &secret.hash,
        refresh_expiry(),
        device_label,
    )
    .await?;
    Ok(IssuedSession {
        access_token: mint_access_token(cfg, user_id, session_id)?,
        refresh_token: secret.token,
        session_id,
        user_id,
    })
}

fn refresh_expiry() -> DateTime<Utc> {
    Utc::now() + Duration::days(REFRESH_TTL_DAYS)
}

#[derive(Debug, thiserror::Error)]
pub enum RefreshError {
    /// Unknown or expired token, or the benign replay of an owner- or
    /// security-revoked one — REFRESH_TOKEN_INVALID.
    #[error("refresh token invalid")]
    Invalid,
    /// A rotated token was replayed outside the grace window: likely
    /// theft. Every session of the account has been revoked (auth.md
    /// "Reuse detection").
    #[error("refresh token reuse detected")]
    Reuse,
    #[error(transparent)]
    Auth(#[from] AuthError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// Rotation: consumes the presented refresh token and mints its
/// successor. Replays of a revoked token dispatch on the revocation
/// reason — only a rotated token outside the grace window signals theft
/// and revokes every session (auth.md "Reuse detection").
pub async fn refresh_session(
    pool: &PgPool,
    cfg: &AuthConfig,
    refresh_token: &str,
) -> Result<IssuedSession, RefreshError> {
    let hash = hash_of(refresh_token);
    let session = store::session_by_token_hash(pool, &hash)
        .await?
        .ok_or(RefreshError::Invalid)?;
    if session.revoked_at.is_some() {
        return replayed_revoked(pool, cfg, refresh_token, &session).await;
    }
    if session.expires_at <= Utc::now() {
        return Err(RefreshError::Invalid);
    }
    let secret = new_secret();
    let new_id = Uuid::new_v4();
    let sealed = seal_successor(refresh_token, &secret.token)?;
    if !store::rotate_session(
        pool,
        session.id,
        new_id,
        &secret.hash,
        refresh_expiry(),
        &sealed,
    )
    .await?
    {
        // Lost a concurrent rotation of the same token. The winner just
        // linked a successor, so the replay dispatch answers this racer
        // idempotently from the grace path.
        let session = store::session_by_token_hash(pool, &hash)
            .await?
            .ok_or(RefreshError::Invalid)?;
        return replayed_revoked(pool, cfg, refresh_token, &session).await;
    }
    Ok(IssuedSession {
        access_token: mint_access_token(cfg, session.user_id, new_id)?,
        refresh_token: secret.token,
        session_id: new_id,
        user_id: session.user_id,
    })
}

/// A revoked token was presented. `rotated` inside the grace window
/// answers with the same successor (the benign refresh race); `rotated`
/// outside it is the theft path; `owner` and `security` revocations
/// replay benignly — a signed-out device retrying its dead token is not
/// an attack (auth.md "Reuse detection").
async fn replayed_revoked(
    pool: &PgPool,
    cfg: &AuthConfig,
    presented: &str,
    session: &store::Session,
) -> Result<IssuedSession, RefreshError> {
    match session.revoked_reason {
        Some(RevokedReason::Rotated) => {
            if let Some(issued) = grace_successor(pool, cfg, presented, session).await? {
                return Ok(issued);
            }
            store::revoke_sessions(pool, session.user_id, None, RevokedReason::Security).await?;
            store::mark_reuse_detected(pool, session.user_id).await?;
            tracing::warn!(user = %session.user_id, "refresh-token reuse detected; all sessions revoked");
            Err(RefreshError::Reuse)
        }
        _ => Err(RefreshError::Invalid),
    }
}

/// The idempotent answer to a grace-window replay: the successor pair,
/// recovered by unsealing the stored successor token with the presented
/// parent. None when the window has passed, the successor is no longer
/// active, or the seal does not open — the caller falls through to the
/// theft path.
async fn grace_successor(
    pool: &PgPool,
    cfg: &AuthConfig,
    presented: &str,
    session: &store::Session,
) -> Result<Option<IssuedSession>, RefreshError> {
    let (Some(revoked_at), Some(successor_id), Some(sealed)) = (
        session.revoked_at,
        session.successor_id,
        session.successor_enc.as_deref(),
    ) else {
        return Ok(None);
    };
    if Utc::now() - revoked_at > Duration::seconds(ROTATION_GRACE_SECONDS) {
        return Ok(None);
    }
    let Some(successor) = store::session(pool, successor_id).await? else {
        return Ok(None);
    };
    if successor.revoked_at.is_some() || successor.expires_at <= Utc::now() {
        return Ok(None);
    }
    let Some(refresh_token) = open_successor(presented, sealed) else {
        return Ok(None);
    };
    Ok(Some(IssuedSession {
        access_token: mint_access_token(cfg, successor.user_id, successor.id)?,
        refresh_token,
        session_id: successor.id,
        user_id: successor.user_id,
    }))
}

// ---------------------------------------------------------------------
// The sealed successor
// ---------------------------------------------------------------------
//
// The store holds only token hashes, so it cannot answer a grace-window
// replay with the successor's raw token — unless the successor rides
// the parent row encrypted under the raw parent token itself. Only the
// replayer, who by definition presents that token, can derive the key;
// a database read still yields nothing usable (auth.md "Refresh
// token"). Same HKDF-SHA-256 + AES-256-GCM stack as the key backup; the
// parent token is full-entropy and sealed under at most once, so a
// random nonce and no salt suffice.

const SUCCESSOR_NONCE_LEN: usize = 12;
const SUCCESSOR_HKDF_INFO: &[u8] = b"cogra:refresh-successor:v1";

fn successor_key(parent_token: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    Hkdf::<Sha256>::new(None, parent_token.as_bytes())
        .expand(SUCCESSOR_HKDF_INFO, &mut key)
        .expect("32 bytes is a valid HKDF-SHA-256 output length");
    key
}

/// Seals the successor token under the parent token: nonce ‖ ciphertext.
fn seal_successor(parent_token: &str, successor_token: &str) -> Result<Vec<u8>, AuthError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&successor_key(parent_token)));
    let mut nonce = [0u8; SUCCESSOR_NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), successor_token.as_bytes())
        .map_err(|e| AuthError::Seal(e.to_string()))?;
    let mut sealed = nonce.to_vec();
    sealed.extend_from_slice(&ciphertext);
    Ok(sealed)
}

/// Opens a sealed successor with the presented parent token; None when
/// the seal does not verify.
fn open_successor(parent_token: &str, sealed: &[u8]) -> Option<String> {
    let (nonce, ciphertext) = sealed.split_at_checked(SUCCESSOR_NONCE_LEN)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&successor_key(parent_token)));
    let plaintext = cipher.decrypt(Nonce::from_slice(nonce), ciphertext).ok()?;
    String::from_utf8(plaintext).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn access_tokens_round_trip_and_reject_forgeries() {
        let cfg = AuthConfig::ephemeral().expect("cfg");
        let user = Uuid::new_v4();
        let session = Uuid::new_v4();
        let token = mint_access_token(&cfg, user, session).expect("mints");
        let viewer = verify_access_token(&cfg, &token).expect("verifies");
        assert_eq!(viewer.user_id, user);
        assert_eq!(viewer.session_id, session);
        // A token signed by a different service key never verifies.
        let other = AuthConfig::ephemeral().expect("cfg");
        assert!(verify_access_token(&other, &token).is_none());
        // Garbage never verifies.
        assert!(verify_access_token(&cfg, "not-a-token").is_none());
    }

    #[test]
    fn password_hashing_verifies_and_rejects() {
        let hash = hash_password("correct horse battery staple").expect("hashes");
        assert!(verify_password(&hash, "correct horse battery staple"));
        assert!(!verify_password(&hash, "wrong password entirely"));
        assert!(!verify_password("not-a-phc-string", "anything"));
    }

    #[test]
    fn password_floor_is_twelve_characters_no_composition_rules() {
        assert!(check_password("elevenchars").is_err());
        assert!(check_password("twelve chars").is_ok());
        assert!(check_password("all lowercase no digits works").is_ok());
    }

    /// A corpus with a scripted answer, standing in for HIBP.
    struct ScriptedCorpus(Result<bool, ()>);

    impl crate::breach::BreachCorpus for ScriptedCorpus {
        fn is_breached<'a>(
            &'a self,
            _password: &'a str,
        ) -> std::pin::Pin<
            Box<dyn Future<Output = Result<bool, crate::breach::BreachError>> + Send + 'a>,
        > {
            let answer = self.0;
            Box::pin(async move {
                answer.map_err(|()| {
                    crate::breach::BreachError::Status(reqwest::StatusCode::INTERNAL_SERVER_ERROR)
                })
            })
        }
    }

    use std::future::Future;

    #[tokio::test]
    async fn breached_passwords_are_rejected_with_the_reason() {
        let err = validate_new_password(&ScriptedCorpus(Ok(true)), "long enough password")
            .await
            .expect_err("breached must refuse");
        assert!(err.contains("data breach"), "the reason names the breach");
    }

    #[tokio::test]
    async fn clean_passwords_pass_the_corpus() {
        assert!(
            validate_new_password(&ScriptedCorpus(Ok(false)), "long enough password")
                .await
                .is_ok()
        );
    }

    #[tokio::test]
    async fn a_corpus_failure_fails_open() {
        assert!(
            validate_new_password(&ScriptedCorpus(Err(())), "long enough password")
                .await
                .is_ok()
        );
    }

    #[tokio::test]
    async fn the_floor_refuses_before_the_corpus_runs() {
        // A breached-everything corpus never sees an under-floor password:
        // the refusal is the floor's message, not the breach message.
        let err = validate_new_password(&ScriptedCorpus(Ok(true)), "short")
            .await
            .expect_err("under the floor");
        assert!(err.contains("12 characters"));
    }

    #[test]
    fn handles_fold_and_validate() {
        assert_eq!(normalize_handle("Alice_01").expect("ok"), "alice_01");
        assert_eq!(normalize_handle("  bob  ").expect("ok"), "bob");
        assert!(normalize_handle("ab").is_err());
        assert!(normalize_handle(&"x".repeat(31)).is_err());
        assert!(normalize_handle("has-dash").is_err());
        assert!(normalize_handle("has space").is_err());
        assert!(normalize_handle("Ünïcode").is_err());
    }

    #[test]
    fn emails_normalize_and_validate_leniently() {
        assert_eq!(
            normalize_email("  User@Example.COM ").expect("ok"),
            "user@example.com"
        );
        assert!(normalize_email("no-at-sign").is_err());
        assert!(normalize_email("two@@example.com").is_err());
        assert!(normalize_email("@example.com").is_err());
        assert!(normalize_email("user@nodot").is_err());
        assert!(normalize_email(&format!("{}@example.com", "x".repeat(250))).is_err());
    }

    #[test]
    fn token_secrets_are_url_safe_and_hash_consistently() {
        let s = new_secret();
        assert!(!s.token.contains('=') && !s.token.contains('+') && !s.token.contains('/'));
        assert_eq!(hash_of(&s.token), s.hash);
        assert_ne!(new_secret().token, s.token);
    }

    #[test]
    fn sealed_successors_open_only_under_the_parent_token() {
        let parent = new_secret();
        let successor = new_secret();
        let sealed = seal_successor(&parent.token, &successor.token).expect("seals");
        assert_eq!(
            open_successor(&parent.token, &sealed).as_deref(),
            Some(successor.token.as_str())
        );
        // A different token derives a different key: the seal never opens.
        assert!(open_successor(&new_secret().token, &sealed).is_none());
        // Truncated or corrupted seals never open.
        assert!(open_successor(&parent.token, &sealed[..8]).is_none());
        let mut corrupted = sealed.clone();
        corrupted[SUCCESSOR_NONCE_LEN + 1] ^= 0x01;
        assert!(open_successor(&parent.token, &corrupted).is_none());
    }
}
