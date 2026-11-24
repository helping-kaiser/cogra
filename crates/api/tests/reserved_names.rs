//! CoGra's reserved names at the handle doors (copy-voice.md "Field
//! errors" → "Reserved names"; Join.md, JoinErrors.md,
//! ChangeHandleConfirm.md): a reserved handle is refused on `register`
//! and `changeHandle` with exactly the refusal a held handle gets, and
//! the Rust lists are the design file's lists. The display-name door is
//! exercised in `profile_e2e.rs`, the bootstrap's own seeding in
//! `bootstrap.rs`. Requires a live Postgres (`make up`).

use std::path::Path;

use api::ratelimit::RateLimitConfig;
use api::reserved::{RESERVED_DISPLAY_NAMES, RESERVED_HANDLES};
use postgres_store::PgPool;
use serde_json::{Value, json};

mod rig;
use rig::WireRig;

const REGISTER: &str = "mutation($input: RegisterInput!) {
    register(input: $input) { auth { accessToken } userErrors { code field message } }
}";

const CHANGE_HANDLE: &str = "mutation($input: ChangeHandleInput!) {
    changeHandle(input: $input) { user { handle } userErrors { code field message } }
}";

const OWN_HANDLE: &str = "{ me { handle } }";

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// The spellings of a reserved handle a person might type, each folding
/// to it under the handle normalization: as listed, upper-cased, and
/// padded with spaces in mixed case.
fn spellings(handle: &str) -> [String; 3] {
    let mut mixed = handle.to_string();
    if let Some(first) = mixed.get_mut(0..1) {
        first.make_ascii_uppercase();
    }
    [
        handle.to_string(),
        handle.to_ascii_uppercase(),
        format!("  {mixed} "),
    ]
}

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

async fn register(rig: &WireRig, link: &str, handle: &str, email: &str) -> Value {
    rig.gql(
        None,
        REGISTER,
        json!({ "input": {
            "inviteLink": link,
            "handle": handle,
            "email": email,
            "password": "an applicant's password",
        }}),
    )
    .await
}

async fn change_handle(rig: &WireRig, token: &str, handle: &str) -> Value {
    rig.gql(
        Some(token),
        CHANGE_HANDLE,
        json!({ "input": { "handle": handle } }),
    )
    .await
}

/// Every backtick span of a markdown list item opened by `- {label}:`,
/// read through to the item's end, the item's lines joined so a name the
/// file wraps reads whole.
fn listed(section: &str, label: &str) -> Vec<String> {
    let opener = format!("- {label}:");
    let start = section
        .find(&opener)
        .unwrap_or_else(|| panic!("the section lists {label}"));
    let rest = &section[start + opener.len()..];
    let end = rest
        .find("\n- ")
        .or_else(|| rest.find("\n\n"))
        .unwrap_or(rest.len());
    let item = rest[..end].split_whitespace().collect::<Vec<_>>().join(" ");
    item.split('`')
        .skip(1)
        .step_by(2)
        .map(str::to_string)
        .collect()
}

/// The reserved lists in Rust are the design file's lists, so copy-voice.md stays their one home.
/// ´claim:auth:the-reserved-lists-are-the-design-files-lists´
#[test]
fn the_reserved_lists_are_the_design_files_lists() {
    let copy_voice = std::fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../design/guidelines/copy-voice.md"),
    )
    .expect("copy-voice.md is in the tree");
    let start = copy_voice
        .find("**Reserved names**")
        .expect("copy-voice.md carries the Reserved names section");
    let section = &copy_voice[start..];
    let section = &section[..section.find("\n## ").unwrap_or(section.len())];

    assert_eq!(
        listed(section, "Handles"),
        RESERVED_HANDLES.map(str::to_string).to_vec(),
        "the reserved handles drifted from copy-voice.md"
    );
    assert_eq!(
        listed(section, "Display names"),
        RESERVED_DISPLAY_NAMES.map(str::to_string).to_vec(),
        "the reserved display names drifted from copy-voice.md"
    );
}

/// Registering under any reserved handle, in any spelling the handle folds from, is refused exactly as a held handle is.
/// ´claim:onboarding:a-reserved-handle-registers-as-taken´
#[sqlx::test(migrations = "../../migrations")]
async fn registering_a_reserved_handle_is_refused_as_a_held_one(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("holder", "holder@example.com").await;
    let token = rig.log_in("holder@example.com").await;
    let link = invite_link(&rig, &token).await;
    let held = register(&rig, &link, "holder", "held@example.com").await;
    let taken = &held["register"]["userErrors"];
    assert_eq!(taken[0]["code"], "HANDLE_TAKEN", "{held}");

    for (i, reserved) in RESERVED_HANDLES.iter().enumerate() {
        let spelling = &spellings(reserved)[i % 3];
        let data = register(&rig, &link, spelling, &format!("n{i}@example.com")).await;
        assert_eq!(
            &data["register"]["userErrors"], taken,
            "`{spelling}` answers as a held handle does"
        );
        assert_eq!(data["register"]["auth"], Value::Null, "`{spelling}`");
    }
}

/// A reserved handle meets every earlier refusal of the registration first, as a held handle does, so the order of refusals cannot tell the two apart.
/// ´claim:onboarding:a-reserved-handle-refuses-at-the-held-handles-place´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reserved_handle_refuses_where_a_held_one_does(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("holder", "holder@example.com").await;
    let dead_link = uuid::Uuid::new_v4().to_string();

    for handle in ["holder", "treasury"] {
        let data = register(&rig, &dead_link, handle, "late@example.com").await;
        assert_eq!(
            data["register"]["userErrors"][0]["code"], "INVITE_UNUSABLE",
            "`{handle}`: {data}"
        );
    }
}

/// Changing to any reserved handle, in any spelling it folds from, is refused exactly as a held handle is, and the handle stays.
/// ´claim:auth:a-reserved-handle-refuses-the-change-as-taken´
#[sqlx::test(migrations = "../../migrations")]
async fn changing_to_a_reserved_handle_is_refused_as_a_held_one(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = change_handle(&rig, &token, "bob").await;
    let taken = &held["changeHandle"]["userErrors"];
    assert_eq!(taken[0]["code"], "HANDLE_TAKEN", "{held}");

    for reserved in RESERVED_HANDLES {
        for spelling in spellings(reserved) {
            let data = change_handle(&rig, &token, &spelling).await;
            assert_eq!(
                &data["changeHandle"]["userErrors"], taken,
                "`{spelling}` answers as a held handle does"
            );
            assert_eq!(data["changeHandle"]["user"], Value::Null, "`{spelling}`");
        }
    }
    let me = rig.gql(Some(&token), OWN_HANDLE, json!({})).await;
    assert_eq!(me["me"]["handle"], "alice");
}

/// An account that already holds a reserved handle keeps it and may re-save it, but once it moves away the handle is kept from it like from anyone.
/// ´claim:auth:a-reserved-handle-stays-with-its-holder´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reserved_handle_stays_with_its_holder_alone(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("moderator", "holder@example.com").await;
    let token = rig.log_in("holder@example.com").await;

    let resaved = change_handle(&rig, &token, " Moderator").await;
    assert_eq!(
        resaved["changeHandle"]["userErrors"],
        json!([]),
        "{resaved}"
    );
    assert_eq!(resaved["changeHandle"]["user"]["handle"], "moderator");

    let moved = change_handle(&rig, &token, "former_moderator").await;
    assert_eq!(moved["changeHandle"]["userErrors"], json!([]), "{moved}");
    let back = change_handle(&rig, &token, "moderator").await;
    assert_eq!(
        back["changeHandle"]["userErrors"][0]["code"], "HANDLE_TAKEN",
        "{back}"
    );
}
