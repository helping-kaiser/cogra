//! Acting before the email is proven (api-spec.md "Authentication"). An
//! account that has not answered its verification link cannot act, and
//! the refusal has to say *that* rather than the generic non-member one
//! — a person waiting on a link can finish the step, where a guest
//! cannot, and only the code tells the client which of the two it is
//! holding.

use std::sync::Arc;

use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use postgres_store::{PgPool, auth as store, genesis};
use serde_json::Value;
use uuid::Uuid;

use api::auth::Viewer;
use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;

fn schema(pool: PgPool) -> ApiSchema {
    let (ctx, _auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    build_with(ctx, QueryBudgets::release())
}

/// A member with a key, seeded the way the bootstrap seeds the genesis
/// account: terminal state, email marked verified.
async fn seed_member(pool: &PgPool, handle: &str) -> Uuid {
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

/// Registers an account through `inviter`'s link, exactly as step 2 of
/// the application does: no email proof, no key, `applicant` state.
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

/// The email proof, applied directly: the account is then an applicant
/// whose address is proven and whose application is still pending.
async fn mark_verified(pool: &PgPool, account: Uuid) {
    sqlx::query("UPDATE user_credentials SET email_verified_at = NOW() WHERE actor_id = $1")
        .bind(account)
        .execute(pool)
        .await
        .expect("verify");
}

fn viewer(user_id: Uuid) -> Option<Viewer> {
    Some(Viewer {
        user_id,
        session_id: Uuid::new_v4(),
    })
}

/// The response as a client reads it: both error tiers in one document.
async fn execute(schema: &ApiSchema, account: Uuid, mutation: &str) -> Value {
    let response = schema
        .execute(async_graphql::Request::new(mutation).data(viewer(account)))
        .await;
    serde_json::to_value(&response).expect("response json")
}

/// The `extensions.code` of the first transport fault, if the request
/// took one at all.
fn transport_code(json: &Value) -> Option<&str> {
    json["errors"][0]["extensions"]["code"].as_str()
}

/// One acting gesture per kind of act-staging mutation the member gate
/// stands in front of: the comment write HT-7 was reported against, a
/// stance, a standalone tag, and the invite link — which stages no
/// content at all and is gated all the same.
fn acting_mutations(target: Uuid) -> Vec<(&'static str, String)> {
    let expires = (Utc::now() + Duration::days(7)).to_rfc3339();
    vec![
        (
            "prepareComment",
            format!(
                r#"mutation {{ prepareComment(input: {{
                     target: "{target}", content: "a reply",
                     license: {{ attribution: 0.0, provenance: 0.0 }}
                   }}) {{ userErrors {{ code }} }} }}"#
            ),
        ),
        (
            "prepareStance",
            format!(
                r#"mutation {{ prepareStance(input: {{
                     target: "{target}", pDirected: 0.5, pInterest: 0.1
                   }}) {{ userErrors {{ code }} }} }}"#
            ),
        ),
        (
            "prepareTag",
            format!(
                r#"mutation {{ prepareTag(input: {{
                     target: "{target}", name: "birdsong"
                   }}) {{ userErrors {{ code }} }} }}"#
            ),
        ),
        (
            "createInviteLink",
            format!(
                r#"mutation {{ createInviteLink(input: {{
                     expiresAt: "{expires}", prefillPDirected: 0.4,
                     prefillPInterest: 0.4
                   }}) {{ userErrors {{ code }} }} }}"#
            ),
        ),
    ]
}

/// The reported defect: the comment box is reachable on a fresh account,
/// so the refusal is what the person actually meets, and a generic one
/// leaves the client nothing to say.
///
/// An account that has not proven its email is refused the comment write with EMAIL_NOT_VERIFIED.
/// ´claim:verification:an-unproven-address-cannot-sign-a-comment´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_account_signing_a_comment_is_told_why(pool: PgPool) {
    let inviter = seed_member(&pool, "mira").await;
    let applicant = seed_applicant(&pool, inviter, "noa").await;
    let schema = schema(pool);

    let (_, comment) = acting_mutations(inviter).swap_remove(0);
    let refused = execute(&schema, applicant, &comment).await;

    assert_eq!(
        transport_code(&refused),
        Some("EMAIL_NOT_VERIFIED"),
        "{refused}"
    );
    assert!(
        refused["data"]["prepareComment"].is_null(),
        "nothing is prepared for an account that may not act: {refused}"
    );
}

/// The gate is the member gate itself, not a check the content path
/// happens to run, so every gesture that stages or signs an act meets
/// the same answer — including the one that stages no content.
///
/// Every act-staging mutation refuses an unverified account with the same code.
/// ´claim:verification:the-refusal-covers-every-acting-gesture´
#[sqlx::test(migrations = "../../migrations")]
async fn every_acting_gesture_refuses_an_unverified_account(pool: PgPool) {
    let inviter = seed_member(&pool, "mira").await;
    let applicant = seed_applicant(&pool, inviter, "noa").await;
    let schema = schema(pool);

    for (name, mutation) in acting_mutations(inviter) {
        let refused = execute(&schema, applicant, &mutation).await;
        assert_eq!(
            transport_code(&refused),
            Some("EMAIL_NOT_VERIFIED"),
            "{name}: {refused}"
        );
    }
}

/// Verification is one of two proofs, and only the missing one may be
/// named: an applicant who has answered the link is waiting on their
/// inviter, which is the generic refusal and not this one.
///
/// An applicant whose address is proven but whose application is unapproved is refused as FORBIDDEN.
/// ´claim:verification:a-proven-address-leaves-the-generic-refusal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_verified_applicant_meets_the_generic_refusal(pool: PgPool) {
    let inviter = seed_member(&pool, "mira").await;
    let applicant = seed_applicant(&pool, inviter, "noa").await;
    mark_verified(&pool, applicant).await;
    let schema = schema(pool);

    for (name, mutation) in acting_mutations(inviter) {
        let refused = execute(&schema, applicant, &mutation).await;
        assert_eq!(
            transport_code(&refused),
            Some("FORBIDDEN"),
            "{name}: {refused}"
        );
    }
}

/// The gate admits a member: what stops the comment here is the unknown
/// parent, which arrives as a userError on the payload — the tier an
/// expected outcome rides, and proof that the refusal above happened
/// before any of this ran.
///
/// A verified member passes the gate and is refused, if at all, on the gesture's own terms.
/// ´claim:verification:a-verified-member-passes-the-gate´
#[sqlx::test(migrations = "../../migrations")]
async fn a_verified_member_passes_the_gate(pool: PgPool) {
    let member = seed_member(&pool, "mira").await;
    let schema = schema(pool);

    let (_, comment) = acting_mutations(Uuid::new_v4()).swap_remove(0);
    let answered = execute(&schema, member, &comment).await;

    assert_eq!(transport_code(&answered), None, "{answered}");
    let errors = &answered["data"]["prepareComment"]["userErrors"];
    assert!(
        errors
            .as_array()
            .is_some_and(|list| list.iter().all(|e| e["code"] != "EMAIL_NOT_VERIFIED")),
        "{answered}"
    );
}
