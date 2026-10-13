//! The release registry over the wire and through the operator's publish
//! step (api-spec.md "Application versions", `appVersions`; the
//! release-registry packet): an anonymous read, newest first by
//! `releasedAt`, narrowed per component, walked by an opaque keyset
//! cursor; and the CLI library that writes its rows.

mod rig;

use api::ratelimit::RateLimitConfig;
use api::registry::{self, AppComponent, PublishError, PublishInput, RELEASES_URL};
use chrono::{DateTime, Utc};
use postgres_store::registry::RegistryError;
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const APP_VERSIONS: &str = r#"query(
  $component: AppComponent, $first: Int, $after: String, $last: Int, $before: String
) {
  appVersions(component: $component, first: $first, after: $after, last: $last, before: $before) {
    totalCount
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges {
      cursor
      node { component version notes patchNotesUrl releasedBy releasedAt }
    }
  }
}"#;

fn at(secs: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// Publishes `version` on `components` at `secs`, through the operator's
/// own publish step.
async fn publish(pool: &PgPool, components: &[AppComponent], version: &str, secs: i64) {
    registry::run(
        pool,
        PublishInput {
            components: components.to_vec(),
            version: version.to_string(),
            notes: format!("What {version} brings"),
            released_at: Some(at(secs)),
            ..PublishInput::default()
        },
    )
    .await
    .expect("publish");
}

async fn read(rig: &WireRig, variables: Value) -> Value {
    rig.gql(None, APP_VERSIONS, variables).await["appVersions"].clone()
}

fn versions(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"]["version"].as_str().expect("version").to_string())
        .collect()
}

/// The one error a refused read carries: its message, and its code when
/// it has one.
fn refusal(response: &Value) -> (String, Value) {
    let errors = response["errors"].as_array().expect("errors");
    assert_eq!(errors.len(), 1, "{response}");
    (
        errors[0]["message"].as_str().expect("message").to_string(),
        errors[0]["extensions"]["code"].clone(),
    )
}

/// A guest, an applicant and a member read the same registry: the read
/// needs no session at all.
///
/// The registry reads without a session.
/// ´claim:releases:the-registry-reads-anonymously´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_reads_without_a_session(pool: PgPool) {
    let rig = rig(pool);
    publish(&rig.pool, &[AppComponent::Web], "0.1.0", 1).await;

    let page = read(&rig, json!({ "component": "WEB" })).await;
    assert_eq!(versions(&page), ["0.1.0"]);
}

/// A bearer that does not verify degrades to anonymous at the handler, so
/// the registry is served to it as to anyone, never refused as
/// UNAUTHENTICATED.
///
/// An invalid bearer still reads the registry, never unauthenticated.
/// ´claim:releases:an-invalid-bearer-still-reads´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_ignores_an_invalid_token(pool: PgPool) {
    let rig = rig(pool);
    publish(&rig.pool, &[AppComponent::Android], "0.1.0", 1).await;

    let response = rig
        .gql_raw(
            Some("not-a-token"),
            APP_VERSIONS,
            json!({ "component": "ANDROID" }),
        )
        .await;
    assert!(response.get("errors").is_none(), "{response}");
    assert_eq!(versions(&response["data"]["appVersions"]), ["0.1.0"]);
}

/// The registry's order is `releasedAt`, never a comparison of version
/// strings: `0.10.0` released after `0.9.0` leads, though it sorts below
/// it as text, and the rows are listed in the order they shipped whatever
/// order they were written in.
///
/// The registry lists newest first by release time.
/// ´claim:releases:newest-first-by-release-time´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_lists_newest_first(pool: PgPool) {
    let rig = rig(pool);
    publish(&rig.pool, &[AppComponent::Web], "0.9.0", 2).await;
    publish(&rig.pool, &[AppComponent::Web], "0.10.0", 3).await;
    publish(&rig.pool, &[AppComponent::Web], "0.1.0", 1).await;

    let page = read(&rig, json!({ "component": "WEB" })).await;
    assert_eq!(versions(&page), ["0.10.0", "0.9.0", "0.1.0"]);
}

/// Each client reads its own component's list; without `component` every
/// component's rows are served, and the count follows the narrowing.
///
/// The component argument narrows the registry to one platform component.
/// ´claim:releases:component-narrows´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_narrows_to_one_component(pool: PgPool) {
    let rig = rig(pool);
    publish(
        &rig.pool,
        &[AppComponent::Web, AppComponent::Android],
        "0.1.0",
        1,
    )
    .await;
    publish(&rig.pool, &[AppComponent::Web], "0.1.1", 2).await;

    let android = read(&rig, json!({ "component": "ANDROID" })).await;
    assert_eq!(versions(&android), ["0.1.0"]);
    assert_eq!(android["edges"][0]["node"]["component"], "ANDROID");
    assert_eq!(android["totalCount"], 1);

    let web = read(&rig, json!({ "component": "WEB" })).await;
    assert_eq!(versions(&web), ["0.1.1", "0.1.0"]);
    assert_eq!(web["totalCount"], 2);

    let every = read(&rig, json!({})).await;
    assert_eq!(every["totalCount"], 3);
    assert_eq!(every["edges"].as_array().expect("edges").len(), 3);
}

/// The keyset walk serves each release exactly once going forward,
/// reports whether more lie beyond the page, and walks back from any
/// cursor in the same newest-first order; the count is the whole list's.
///
/// The registry pages forward and back with its own pageInfo and count.
/// ´claim:releases:the-keyset-walks-both-ways´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_pages_forward_and_back(pool: PgPool) {
    let rig = rig(pool);
    for (i, version) in ["0.1.0", "0.1.1", "0.1.2", "0.1.3", "0.1.4"]
        .iter()
        .enumerate()
    {
        publish(&rig.pool, &[AppComponent::Web], version, i as i64).await;
    }

    let first = read(&rig, json!({ "component": "WEB", "first": 2 })).await;
    assert_eq!(versions(&first), ["0.1.4", "0.1.3"]);
    assert_eq!(first["totalCount"], 5);
    assert_eq!(first["pageInfo"]["hasNextPage"], true);
    assert_eq!(first["pageInfo"]["hasPreviousPage"], false);

    let second = read(
        &rig,
        json!({ "component": "WEB", "first": 2, "after": first["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(versions(&second), ["0.1.2", "0.1.1"]);
    assert_eq!(second["pageInfo"]["hasNextPage"], true);
    assert_eq!(second["pageInfo"]["hasPreviousPage"], true);

    let third = read(
        &rig,
        json!({ "component": "WEB", "first": 2, "after": second["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(versions(&third), ["0.1.0"]);
    assert_eq!(third["pageInfo"]["hasNextPage"], false);

    let back = read(
        &rig,
        json!({ "component": "WEB", "last": 2, "before": third["pageInfo"]["startCursor"] }),
    )
    .await;
    assert_eq!(versions(&back), ["0.1.2", "0.1.1"]);
    assert_eq!(back["pageInfo"]["hasPreviousPage"], true);
    assert_eq!(back["pageInfo"]["hasNextPage"], true);
}

/// Over-asking refuses rather than clamping, with the message-only
/// validation error every connection answers.
///
/// Asking the registry for more than a hundred releases refuses.
/// ´claim:releases:over-asking-refuses´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_refuses_more_than_a_hundred(pool: PgPool) {
    let rig = rig(pool);
    for variables in [json!({ "first": 101 }), json!({ "last": 101 })] {
        let refused = rig.gql_raw(None, APP_VERSIONS, variables.clone()).await;
        let (message, code) = refusal(&refused);
        assert!(message.contains("at most 100"), "{variables}: {refused}");
        assert_eq!(code, Value::Null, "message-only: {refused}");
    }
    let served = rig
        .gql_raw(None, APP_VERSIONS, json!({ "first": 100 }))
        .await;
    assert!(served.get("errors").is_none(), "{served}");
}

/// A cursor this list did not issue — garbage, another list's, or one
/// naming no component — refuses rather than serving some page.
///
/// A malformed registry cursor refuses.
/// ´claim:releases:a-malformed-cursor-refuses´
#[sqlx::test(migrations = "../../migrations")]
async fn app_versions_refuses_a_malformed_cursor(pool: PgPool) {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD as B64;
    let rig = rig(pool);
    publish(&rig.pool, &[AppComponent::Web], "0.1.0", 1).await;
    for cursor in [
        "not base64 at all".to_string(),
        B64.encode(format!("history:1:{}", Uuid::new_v4())),
        B64.encode("release:1:desktop:0.1.0"),
        B64.encode("release:soon:web:0.1.0"),
    ] {
        let refused = rig
            .gql_raw(None, APP_VERSIONS, json!({ "after": cursor }))
            .await;
        let (message, code) = refusal(&refused);
        assert_eq!(message, "invalid cursor", "{cursor}: {refused}");
        assert_eq!(code, Value::Null, "message-only: {refused}");
    }
}

/// A release nobody is credited on beyond the commit history reads an
/// empty list, never null; a credited one reads its credits.
///
/// An uncredited release reads an empty credit list.
/// ´claim:releases:no-credit-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn an_uncredited_release_reads_an_empty_credit_list(pool: PgPool) {
    let rig = rig(pool);
    publish(&rig.pool, &[AppComponent::Web], "0.1.0", 1).await;
    let credited = Uuid::new_v4();
    registry::run(
        &rig.pool,
        PublishInput {
            components: vec![AppComponent::Web],
            version: "0.1.1".into(),
            notes: "Credited".into(),
            released_by: vec![credited],
            released_at: Some(at(2)),
            ..PublishInput::default()
        },
    )
    .await
    .expect("publish");

    let page = read(&rig, json!({ "component": "WEB" })).await;
    assert_eq!(
        page["edges"][0]["node"]["releasedBy"],
        json!([credited.to_string()])
    );
    assert_eq!(page["edges"][1]["node"]["releasedBy"], json!([]));
}

/// The card draws each note as its own paragraph in the order written,
/// and ends in the release's public page, which every row carries.
///
/// A release serves its notes in the order written and its public page.
/// ´claim:releases:notes-in-order-and-the-page´
#[sqlx::test(migrations = "../../migrations")]
async fn a_release_serves_its_notes_in_order_and_its_page(pool: PgPool) {
    let rig = rig(pool);
    registry::run(
        &rig.pool,
        PublishInput {
            components: vec![AppComponent::Android],
            version: "0.1.2".into(),
            notes: "You can now save a post.\nAnd find it again under Saved.\n".into(),
            released_at: Some(at(5)),
            ..PublishInput::default()
        },
    )
    .await
    .expect("publish");

    let page = read(&rig, json!({ "component": "ANDROID" })).await;
    let node = &page["edges"][0]["node"];
    assert_eq!(
        node["notes"],
        json!(["You can now save a post.", "And find it again under Saved."])
    );
    assert_eq!(node["patchNotesUrl"], format!("{RELEASES_URL}/tag/v0.1.2"));
    assert_eq!(node["releasedAt"], at(5).to_rfc3339());
}

/// Before any release is published the read is an empty connection, not
/// an error and not null.
///
/// An empty registry reads an empty connection.
/// ´claim:releases:empty-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_registry_reads_an_empty_connection(pool: PgPool) {
    let rig = rig(pool);
    let page = read(&rig, json!({ "component": "WEB", "first": 100 })).await;
    assert_eq!(page["edges"], json!([]));
    assert_eq!(page["totalCount"], 0);
    assert_eq!(page["pageInfo"]["hasNextPage"], false);
    assert_eq!(page["pageInfo"]["endCursor"], Value::Null);
}

/// A release's page defaults to its tag under the public releases page,
/// and the operator can name another.
///
/// Publishing derives the release's GitHub tag page unless one is given.
/// ´claim:registry:the-page-defaults-to-the-tag´
#[sqlx::test(migrations = "../../migrations")]
async fn publish_derives_the_github_tag_url(pool: PgPool) {
    let derived = registry::run(
        &pool,
        PublishInput {
            components: vec![AppComponent::Web],
            version: "0.1.3".into(),
            notes: "A note".into(),
            ..PublishInput::default()
        },
    )
    .await
    .expect("publish");
    assert_eq!(
        derived[0].patch_notes_url,
        "https://github.com/helping-kaiser/cogra/releases/tag/v0.1.3"
    );

    let named = registry::run(
        &pool,
        PublishInput {
            components: vec![AppComponent::Android],
            version: "0.1.3".into(),
            notes: "A note".into(),
            patch_notes_url: Some("https://example.test/0.1.3".into()),
            ..PublishInput::default()
        },
    )
    .await
    .expect("publish");
    assert_eq!(named[0].patch_notes_url, "https://example.test/0.1.3");
}

/// One publish writes one row per named component, a component named
/// twice once, all at one instant; a component that already has the
/// version refuses the whole publish, and nothing of it lands.
///
/// Publishing writes one row per named component, all or nothing.
/// ´claim:registry:one-row-per-component-all-or-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn publish_writes_one_row_per_component(pool: PgPool) {
    let input = |components: Vec<AppComponent>| PublishInput {
        components,
        version: "0.2.0".into(),
        notes: "A note".into(),
        ..PublishInput::default()
    };
    let written = registry::run(
        &pool,
        input(vec![
            AppComponent::Android,
            AppComponent::Web,
            AppComponent::Android,
        ]),
    )
    .await
    .expect("publish");
    let components: Vec<AppComponent> = written.iter().map(|p| p.component).collect();
    assert_eq!(components, [AppComponent::Android, AppComponent::Web]);
    assert_eq!(written[0].released_at, written[1].released_at);

    let refused = registry::run(&pool, input(vec![AppComponent::Ios, AppComponent::Web])).await;
    assert!(
        matches!(
            refused,
            Err(PublishError::Registry(
                RegistryError::AlreadyPublished { .. }
            ))
        ),
        "{refused:?}"
    );
    assert_eq!(
        postgres_store::registry::count_releases(&pool, Some("ios"))
            .await
            .expect("count"),
        0,
        "the refused publish wrote nothing"
    );
}

/// Every line of the notes file is one note, so an empty file or a blank
/// line among the notes refuses the publish, naming the line, and writes
/// nothing.
///
/// Publishing refuses empty notes and blank note lines.
/// ´claim:registry:blank-notes-refuse´
#[sqlx::test(migrations = "../../migrations")]
async fn publish_refuses_blank_notes(pool: PgPool) {
    for (notes, expected) in [
        ("", "NoNotes"),
        ("First\n\nThird\n", "BlankNote(2)"),
        ("   \nSecond", "BlankNote(1)"),
    ] {
        let refused = registry::run(
            &pool,
            PublishInput {
                components: vec![AppComponent::Web],
                version: "0.3.0".into(),
                notes: notes.into(),
                ..PublishInput::default()
            },
        )
        .await;
        let got = match refused {
            Err(PublishError::NoNotes) => "NoNotes".to_string(),
            Err(PublishError::BlankNote { line }) => format!("BlankNote({line})"),
            other => panic!("{notes:?}: {other:?}"),
        };
        assert_eq!(got, expected, "{notes:?}");
    }
    assert_eq!(
        postgres_store::registry::count_releases(&pool, None)
            .await
            .expect("count"),
        0
    );
}
