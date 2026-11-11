//! The error codes no other suite provokes at the wire (charter API rule
//! 3: every declared `ErrorCode` has an integration test that provokes
//! it): the reset token's spent and expired refusals, the staged write
//! collected before it was signed, the three registration-and-attach
//! refusals, the collapsed `INTERNAL` fault, and the read-side
//! `BAD_INPUT` of a malformed argument, one test per class of malformed
//! read argument. Every request goes
//! through the real router. Requires a live Postgres (`make up`).
//!
//! Census, `removeContent`: its codes are provoked in
//! `content_removal.rs` — UNAUTHENTICATED, NOT_FOUND, FORBIDDEN,
//! BAD_INPUT (out-of-scope family, carried act, an edit on a removed
//! node) and INTERNAL (an injected tombstone fault). RATE_LIMITED and
//! EMAIL_NOT_VERIFIED are not provocable on it by design: the verb has no
//! limiter scope (it is author-bounded, signs and mails nothing) and is
//! not member-gated (it acts on nothing; api-spec.md "Authentication").

use api::ratelimit::RateLimitConfig;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use common::l1::wire;
use postgres_store::PgPool;
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::WireRig;

const CONFIRM_RESET: &str = "mutation($input: ConfirmPasswordResetInput!) {
    confirmPasswordReset(input: $input) { ok userErrors { code field } }
}";

const REGISTER: &str = "mutation($input: RegisterInput!) {
    register(input: $input) { auth { accessToken } userErrors { code field } }
}";

fn first_error(data: &Value, operation: &str) -> Value {
    data[operation]["userErrors"][0].clone()
}

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// An invite link from the given member.
async fn invite_link(rig: &WireRig, token: &str) -> String {
    let link = rig
        .gql(
            Some(token),
            "mutation($input: CreateInviteLinkInput!) {
               createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
             }",
            json!({ "input": { "expiresAt": "2099-01-01T00:00:00Z" }}),
        )
        .await;
    link["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .to_string()
}

fn registration(link: &str, handle: &str, email: &str) -> Value {
    json!({ "input": {
        "inviteLink": link,
        "handle": handle,
        "email": email,
        "password": "an applicant's password",
    }})
}

/// A reset token is spent by its first confirmation; the second, with
/// the same token, is refused at the token.
///
/// A spent reset token is refused at the token with the reset-token code.
/// ´claim:auth:a-spent-reset-token-is-refused-at-the-token´
#[sqlx::test(migrations = "../../migrations")]
async fn confirm_password_reset_with_a_spent_token_is_reset_token_invalid(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("forgetful", "forgetful@example.com").await;
    rig.gql(
        None,
        "mutation($input: RequestPasswordResetInput!) {
           requestPasswordReset(input: $input) { ok }
         }",
        json!({ "input": { "email": "forgetful@example.com" }}),
    )
    .await;
    let token = rig.mailer.latest_token_for("forgetful@example.com");
    let confirm = json!({ "input": {
        "resetToken": token,
        "newPassword": "a fresh strong password",
    }});

    let data = rig.gql(None, CONFIRM_RESET, confirm.clone()).await;
    assert_eq!(data["confirmPasswordReset"]["ok"], true, "{data}");

    let data = rig.gql(None, CONFIRM_RESET, confirm).await;
    let error = first_error(&data, "confirmPasswordReset");
    assert_eq!(error["code"], "RESET_TOKEN_INVALID", "{data}");
    assert_eq!(error["field"], json!(["resetToken"]));
}

/// A reset link opened after its window answers exactly as a spent one
/// does — the expired-while-open case (seam 053.5) needs no contract of
/// its own.
///
/// An expired reset token is refused at the token exactly as a spent one is.
/// ´claim:auth:an-expired-reset-token-is-refused-at-the-token´
#[sqlx::test(migrations = "../../migrations")]
async fn confirm_password_reset_with_an_expired_token_is_reset_token_invalid(pool: PgPool) {
    let rig = rig(pool);
    let (user, _) = rig.seed_member("late", "late@example.com").await;
    let secret = api::auth::new_secret();
    postgres_store::auth::create_password_reset(
        &rig.pool,
        Uuid::new_v4(),
        user,
        &secret.hash,
        Utc::now() - Duration::minutes(1),
    )
    .await
    .expect("reset row");

    let data = rig
        .gql(
            None,
            CONFIRM_RESET,
            json!({ "input": {
                "resetToken": secret.token,
                "newPassword": "a fresh strong password",
            }}),
        )
        .await;
    let error = first_error(&data, "confirmPasswordReset");
    assert_eq!(error["code"], "RESET_TOKEN_INVALID", "{data}");
    assert_eq!(error["field"], json!(["resetToken"]));
}

/// A write prepared and left unsigned past the GC bound is collected; the
/// device's late pre-signature then meets `STAGED_WRITE_EXPIRED`, the
/// code the contract names for exactly this, rather than a generic
/// refusal.
///
/// Epochs advance only when something lands, so a second member lands a
/// post per epoch. They close one at a time under a GC bound of one, so
/// the pass that expires the write cannot also reap it — reaping waits a
/// further bound.
///
/// A staged write collected before it was signed refuses its late signature as expired.
/// ´claim:relay:a-collected-staged-write-refuses-as-expired´
#[sqlx::test(migrations = "../../migrations")]
async fn a_staged_write_past_gc_is_staged_write_expired(pool: PgPool) {
    let rig = rig(pool);
    let (_, key) = rig.seed_member("slow", "slow@example.com").await;
    let token = rig.log_in("slow@example.com").await;
    let prepared = rig
        .gql(
            Some(&token),
            "mutation($input: PreparePostInput!) {
               preparePost(input: $input) { writes { id canonicalProposal } userErrors { code } }
             }",
            json!({ "input": {
                "content": "never signed in time",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "pDirected": 0.1,
            }}),
        )
        .await;
    let write = &prepared["preparePost"]["writes"][0];
    let id = write["id"].as_str().expect("id");

    let (_, walker_key) = rig.seed_member("walker", "walker@example.com").await;
    let walker = rig.log_in("walker@example.com").await;
    let mut state = Value::Null;
    for n in 0..4 {
        let walk = rig
            .gql(
                Some(&walker),
                "mutation($input: PreparePostInput!) {
                   preparePost(input: $input) { writes { id canonicalProposal } }
                 }",
                json!({ "input": {
                    "content": format!("a step of the clock, {n}"),
                    "license": { "attribution": 0.0, "provenance": 0.0 },
                    "pDirected": 0.1,
                }}),
            )
            .await;
        rig.sign_prepared(&walker, &walker_key, &walk["preparePost"]["writes"])
            .await;
        rig.close_and_ingest_under(1).await;
        let observed = rig
            .gql(
                Some(&token),
                "query($id: UUID!) { stagedWrite(id: $id) { state } }",
                json!({ "id": id }),
            )
            .await;
        state = observed["stagedWrite"]["state"].clone();
        if state == "EXPIRED" {
            break;
        }
    }
    assert_eq!(state, "EXPIRED", "the GC collected the unsigned write");

    let proposal = wire::decode_proposal(
        &B64.decode(write["canonicalProposal"].as_str().expect("proposal"))
            .expect("b64"),
    )
    .expect("decodes");
    let pre = key.pre_sign(proposal);
    let data = rig
        .gql(
            Some(&token),
            "mutation($input: SubmitProposalsInput!) {
               submitProposals(input: $input) { stagedWrites { id } userErrors { code field } }
             }",
            json!({ "input": { "proposals": [{
                "stagedWriteId": id,
                "signature": B64.encode(wire::encode_pre_commitment_of(&pre)),
            }]}}),
        )
        .await;
    let error = first_error(&data, "submitProposals");
    assert_eq!(error["code"], "STAGED_WRITE_EXPIRED", "{data}");
    assert_eq!(error["field"], json!(["proposals", "0"]));
}

/// A per-entry refusal names the entry by the input list it came in:
/// `UserError.field` is the path to the offending input field
/// (api-spec.md "Error types"), and `approveActs` takes `approvals`
/// (`ApproveActsInput`). The entry is a write approved before it was
/// sealed, which the relay refuses at that entry.
///
/// A refused approval is pinned to its own entry in the approvals list.
/// ´claim:relay:an-approval-refusal-names-its-approvals-entry´
#[sqlx::test(migrations = "../../migrations")]
async fn an_approval_refusal_names_its_approvals_entry(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("eager", "eager@example.com").await;
    let token = rig.log_in("eager@example.com").await;
    let prepared = rig
        .gql(
            Some(&token),
            "mutation($input: PreparePostInput!) {
               preparePost(input: $input) { writes { id } userErrors { code } }
             }",
            json!({ "input": {
                "content": "approved before it was sealed",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "pDirected": 0.1,
            }}),
        )
        .await;
    let id = prepared["preparePost"]["writes"][0]["id"]
        .as_str()
        .expect("id");
    let data = rig
        .gql(
            Some(&token),
            "mutation($input: ApproveActsInput!) {
               approveActs(input: $input) { stagedWrites { id } userErrors { code field } }
             }",
            json!({ "input": { "approvals": [{
                "stagedWriteId": id,
                "signature": B64.encode([0u8; 64]),
            }]}}),
        )
        .await;
    let error = first_error(&data, "approveActs");
    assert_eq!(error["code"], "BAD_INPUT", "{data}");
    assert_eq!(error["field"], json!(["approvals", "0"]), "{data}");
}

/// A link that does not exist registers nobody.
///
/// Registering through a link that is not usable is refused as an unusable invite.
/// ´claim:onboarding:a-dead-link-is-refused-at-the-wire´
#[sqlx::test(migrations = "../../migrations")]
async fn registering_through_an_unknown_link_is_invite_unusable(pool: PgPool) {
    let rig = rig(pool);
    let data = rig
        .gql(
            None,
            REGISTER,
            registration(
                &Uuid::new_v4().to_string(),
                "hopeful",
                "hopeful@example.com",
            ),
        )
        .await;
    assert_eq!(
        first_error(&data, "register")["code"],
        "INVITE_UNUSABLE",
        "{data}"
    );
    assert_eq!(data["register"]["auth"], Value::Null);
}

/// The one actor namespace refuses a handle a member already holds, at
/// the handle.
///
/// Registering under a handle a member already holds is refused at the handle.
/// ´claim:onboarding:a-held-handle-is-refused-at-the-wire´
#[sqlx::test(migrations = "../../migrations")]
async fn registering_a_held_handle_is_handle_taken(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("taken", "holder@example.com").await;
    let token = rig.log_in("holder@example.com").await;
    let link = invite_link(&rig, &token).await;

    let data = rig
        .gql(
            None,
            REGISTER,
            registration(&link, "taken", "newcomer@example.com"),
        )
        .await;
    let error = first_error(&data, "register");
    assert_eq!(error["code"], "HANDLE_TAKEN", "{data}");
    assert_eq!(error["field"], json!(["handle"]));
}

/// An address binds at most one account: an applicant attaching a key a
/// member already holds is refused at the key.
///
/// Attaching a key another account already holds is refused at the key.
/// ´claim:onboarding:a-bound-key-is-refused-at-the-wire´
#[sqlx::test(migrations = "../../migrations")]
async fn attaching_a_bound_key_is_actor_key_in_use(pool: PgPool) {
    let rig = rig(pool);
    let (_, member_key): (Uuid, ActorKey) =
        rig.seed_member("keyholder", "keyholder@example.com").await;
    let token = rig.log_in("keyholder@example.com").await;
    let link = invite_link(&rig, &token).await;
    let registered = rig
        .gql(
            None,
            REGISTER,
            registration(&link, "copycat", "copycat@example.com"),
        )
        .await;
    let applicant = registered["register"]["auth"]["accessToken"]
        .as_str()
        .expect("session")
        .to_string();

    let data = rig
        .gql(
            Some(&applicant),
            "mutation($input: AttachActorKeyInput!) {
               attachActorKey(input: $input) { user { id } userErrors { code field } }
             }",
            json!({ "input": {
                "actorPubkey": B64.encode(member_key.public_key_bytes()),
                "realizationAddress": member_key.address(),
            }}),
        )
        .await;
    let error = first_error(&data, "attachActorKey");
    assert_eq!(error["code"], "ACTOR_KEY_IN_USE", "{data}");
    assert_eq!(error["field"], json!(["actorPubkey"]));
}

/// A store fault that leaves a resolver as an ordinary error — stringified
/// at the site or carried by a bare `?` — reaches the wire as the
/// collapsed `INTERNAL` code and the fixed message, never the driver's
/// text. The store faults by its pool being closed under the router.
///
/// A store fault leaving a resolver reaches the client as INTERNAL with a fixed message, never the driver's text.
/// ´claim:server:a-store-fault-collapses-to-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_store_fault_reaches_the_wire_as_internal(pool: PgPool) {
    let rig = rig(pool);
    rig.pool.close().await;
    for query in [
        format!("{{ post(id: \"{}\") {{ id }} }}", Uuid::new_v4()),
        format!(
            "{{ inviteLinkCheck(id: \"{}\") {{ usable }} }}",
            Uuid::new_v4()
        ),
    ] {
        let answer = rig.gql_raw(None, &query, json!({})).await;
        let error = &answer["errors"][0];
        assert_eq!(error["extensions"]["code"], "INTERNAL", "{answer}");
        assert_eq!(error["message"], "internal error", "{answer}");
        assert!(!answer.to_string().contains("pool"), "{answer}");
    }
}

/// The collapse touches only errors that name no code and carry a Rust
/// error: a refusal that already declares its code keeps code and
/// message.
///
/// An error that declares its code passes the collapse untouched.
/// ´claim:server:a-declared-code-passes-the-collapse´
#[sqlx::test(migrations = "../../migrations")]
async fn a_declared_code_passes_the_internal_collapse(pool: PgPool) {
    let rig = rig(pool);
    let answer = rig
        .gql_raw(
            None,
            "mutation($input: ApproveActsInput!) { approveActs(input: $input) { userErrors { code } } }",
            json!({ "input": { "approvals": [] }}),
        )
        .await;
    assert_eq!(
        answer["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "{answer}"
    );
    assert_eq!(answer["errors"][0]["message"], "authentication required");
}

/// The `extensions.code` of every error an answer carries.
fn transport_codes(answer: &Value) -> Vec<String> {
    answer["errors"]
        .as_array()
        .map(|errors| {
            errors
                .iter()
                .map(|e| e["extensions"]["code"].as_str().unwrap_or("").to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// Asserts a read is refused at the transport as `BAD_INPUT` alone, with
/// the message the site wrote.
async fn assert_bad_input(rig: &WireRig, token: Option<&str>, query: &str, message: &str) {
    let answer = rig.gql_raw(token, query, json!({})).await;
    assert_eq!(
        transport_codes(&answer),
        vec!["BAD_INPUT"],
        "{query}: {answer}"
    );
    let said = answer["errors"][0]["message"].as_str().unwrap_or("");
    assert!(said.contains(message), "{query}: {answer}");
}

/// A cursor that does not decode is malformed input, on a keyset
/// connection and on the registry's own cursor alike (api-spec.md:1247).
///
/// A cursor that does not decode is refused as malformed input.
/// ´claim:server:a-malformed-cursor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn a_malformed_cursor_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    for query in [
        r#"{ records(after: "not a cursor") { edges { cursor } } }"#,
        r#"{ posts(before: "not a cursor", last: 1) { edges { cursor } } }"#,
        r#"{ appVersions(after: "not a cursor") { edges { cursor } } }"#,
    ] {
        assert_bad_input(&rig, None, query, "invalid cursor").await;
    }
}

/// Over-asking, a negative page and a page asked in both directions are
/// all malformed page arguments (api-spec.md "Pagination is Relay cursor
/// connections": at most 100).
///
/// Page arguments outside the budget, or in both directions, are refused as malformed input.
/// ´claim:server:out-of-bounds-page-arguments-are-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn out_of_bounds_page_arguments_are_bad_input(pool: PgPool) {
    let rig = rig(pool);
    for (query, message) in [
        (
            "{ records(first: 101) { edges { cursor } } }",
            "at most 100",
        ),
        ("{ posts(last: 101) { edges { cursor } } }", "at most 100"),
        (
            "{ appVersions(first: -1) { edges { cursor } } }",
            "non-negative",
        ),
        (
            r#"{ records(first: 1, before: "x") { edges { cursor } } }"#,
            "not both",
        ),
    ] {
        assert_bad_input(&rig, None, query, message).await;
    }
}

/// A `limit`-bounded list takes the page budget too, and over-asking
/// refuses rather than clamping.
///
/// A list limit outside the page budget is refused as malformed input.
/// ´claim:server:an-out-of-bounds-list-limit-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn an_out_of_bounds_list_limit_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    assert_bad_input(
        &rig,
        None,
        r#"{ referenceCandidates(query: "anything", limit: 101) { targetId } }"#,
        "limit must lie in",
    )
    .await;
}

/// The batch node lookup is bounded by the page budget; a longer list is
/// malformed input, before anything is read.
///
/// A batch lookup past the page budget is refused as malformed input.
/// ´claim:server:too-many-ids-per-lookup-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn too_many_ids_per_lookup_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let ids: Vec<String> = (0..101)
        .map(|_| format!("\"{}\"", Uuid::new_v4()))
        .collect();
    let query = format!("{{ nodes(ids: [{}]) {{ id }} }}", ids.join(", "));
    assert_bad_input(&rig, None, &query, "ids per lookup").await;
}

/// An actor is looked up by its id or by its handle — naming neither, or
/// both, is malformed input on `user` and `actor` alike.
///
/// An actor lookup naming neither or both of id and handle is refused as malformed input.
/// ´claim:server:an-actor-lookup-takes-exactly-one-key´
#[sqlx::test(migrations = "../../migrations")]
async fn an_actor_lookup_takes_exactly_one_key(pool: PgPool) {
    let rig = rig(pool);
    let id = Uuid::new_v4();
    for query in [
        "{ user { id } }".to_string(),
        format!(r#"{{ actor(id: "{id}", handle: "someone") {{ id }} }}"#),
    ] {
        assert_bad_input(&rig, None, &query, "exactly one of id or handle").await;
    }
}

/// An argument a scalar refuses to parse — a malformed UUID, a Dimension
/// off its grid — is the caller's malformed input: `BAD_INPUT`, with the
/// library's message naming what was wrong, never the collapsed
/// `INTERNAL`.
///
/// An argument a scalar cannot parse is refused as malformed input, its message kept.
/// ´claim:server:an-unparsable-argument-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unparsable_argument_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    assert_bad_input(&rig, None, r#"{ post(id: "not-a-uuid") { id } }"#, "UUID").await;

    rig.seed_member("caller", "caller@example.com").await;
    let token = rig.log_in("caller@example.com").await;
    let answer = rig
        .gql_raw(
            Some(&token),
            "mutation($input: PrepareStanceInput!) { prepareStance(input: $input) { userErrors { code } } }",
            json!({ "input": { "target": Uuid::new_v4(), "pDirected": 0.005, "pInterest": 0.0 }}),
        )
        .await;
    assert_eq!(transport_codes(&answer), vec!["BAD_INPUT"], "{answer}");
    assert!(
        answer["errors"][0]["message"]
            .as_str()
            .is_some_and(|m| m.contains("Dimension")),
        "{answer}"
    );
}

/// A member whose profile chain has no head in the mirror is a diverged
/// mirror — an operational fault, never user input. The refusal is the
/// collapsed `INTERNAL` code with a generic message; the detail goes to
/// the log, not the wire.
///
/// A server fault reaches the client as the collapsed internal code, its detail kept off the wire.
/// ´claim:profile:a-diverged-chain-is-collapsed-to-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_diverged_mirror_surfaces_as_internal(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("unanchored", "unanchored@example.com")
        .await;
    let token = rig.log_in("unanchored@example.com").await;

    let data = rig
        .gql(
            Some(&token),
            "mutation($input: PrepareProfileUpdateInput!) {
               prepareProfileUpdate(input: $input) { writes { id } userErrors { code message field } }
             }",
            json!({ "input": { "bio": "no Registration ever landed for me" }}),
        )
        .await;
    let error = first_error(&data, "prepareProfileUpdate");
    assert_eq!(error["code"], "INTERNAL", "{data}");
    assert_eq!(error["message"], "internal error");
    assert_eq!(error["field"], Value::Null);
}
