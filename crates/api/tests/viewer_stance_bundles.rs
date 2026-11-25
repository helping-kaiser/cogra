//! The batched member bundle read (`api::stance::bundles`) against the
//! single one (`api::stance::bundle`, `api::stance::topic_bundle`): one
//! batch holding several viewers' faces — the shape a schema-wide loader
//! sees when requests meet in one batch window — answers each face as
//! the single read answers it, the corners the GraphQL surface cannot
//! reach included: a viewer with no actor, an id nothing answers to, a
//! name the substrate could never carry, and one bundle asked in both
//! views at once.

use std::collections::HashMap;

use api::stance::{FaceKey, FaceTarget, StanceError, TargetBundle};
use common::l1::client::ActorKey;
use postgres_store::PgPool;
use serde_json::{Value, json};
use uuid::Uuid;

use api::ratelimit::RateLimitConfig;

mod rig;
use rig::WireRig;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) { node writes { id canonicalProposal } userErrors { code } }
}"#;

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) { writes { id canonicalProposal } userErrors { code } }
}"#;

async fn stance(rig: &WireRig, who: &(String, ActorKey), target: Value, p: (f64, f64), land: bool) {
    let mut input = json!({ "pDirected": p.0, "pInterest": p.1 });
    for (k, v) in target.as_object().expect("target").clone() {
        input[k.as_str()] = v;
    }
    let prepared = rig
        .gql(Some(&who.0), PREPARE_STANCE, json!({ "input": input }))
        .await;
    assert_eq!(
        prepared["prepareStance"]["userErrors"],
        json!([]),
        "{prepared}"
    );
    rig.sign_prepared(&who.0, &who.1, &prepared["prepareStance"]["writes"])
        .await;
    if land {
        rig.close_and_ingest().await;
    }
}

/// The single read's answer, as an option: absent exactly where it
/// refuses the face as bad input or internal.
fn single(read: Result<TargetBundle, StanceError>) -> Option<(String, common::l1::fold::Standing)> {
    match read {
        Ok(read) => Some((read.node.to_string(), read.standing)),
        Err(StanceError::BadInput { .. } | StanceError::Internal(_)) => None,
        Err(e) => panic!("the single read faulted: {e}"),
    }
}

/// One batch of every viewer × target × view equals the single read of
/// each face, and a bundle asked in both views is summed once in each.
///
/// One batch of several viewers' faces answers each face as the single read does, an unknown viewer, an unknown id, an uncarriable name and one bundle in both views included.
/// ´claim:stance:a-mixed-viewer-batch-equals-the-single-reads´
#[sqlx::test(migrations = "../../migrations")]
async fn a_mixed_viewer_batch_equals_the_single_reads(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (ada_id, ada_key) = rig.seed_member("ada", "ada@example.com").await;
    let (bob_id, bob_key) = rig.seed_member("bob", "bob@example.com").await;
    let (carol_id, carol_key) = rig.seed_member("carol", "carol@example.com").await;
    let ada = (rig.log_in("ada@example.com").await, ada_key);
    let bob = (rig.log_in("bob@example.com").await, bob_key);
    let carol = (rig.log_in("carol@example.com").await, carol_key);

    let prepared = rig
        .gql(
            Some(&carol.0),
            PREPARE_POST,
            json!({ "input": {
                "title": "a post", "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "pDirected": 0.1,
                "tags": [{ "name": "rust", "pDirected": 0.1, "pInterest": 1.0 }],
            }}),
        )
        .await;
    rig.sign_prepared(&carol.0, &carol.1, &prepared["preparePost"]["writes"])
        .await;
    rig.close_and_ingest().await;
    let post: Uuid = prepared["preparePost"]["node"]
        .as_str()
        .expect("node")
        .parse()
        .expect("uuid");

    stance(&rig, &ada, json!({ "target": post }), (0.6, 0.4), true).await;
    stance(&rig, &bob, json!({ "target": post }), (-0.3, 0.9), true).await;
    stance(&rig, &ada, json!({ "target": carol_id }), (0.5, 0.5), true).await;
    stance(&rig, &ada, json!({ "topicName": "rust" }), (0.2, 0.8), true).await;
    stance(&rig, &ada, json!({ "target": post }), (0.1, -0.1), false).await;
    stance(&rig, &bob, json!({ "topicName": "rust" }), (-0.4, 0.4), false).await;

    let viewers = [ada_id, bob_id, carol_id, Uuid::new_v4()];
    let targets = [
        FaceTarget::Node(post),
        FaceTarget::Node(carol_id),
        FaceTarget::Node(ada_id),
        FaceTarget::Node(Uuid::new_v4()),
        FaceTarget::Topic("rust".into()),
        FaceTarget::Topic("not a name!".into()),
    ];
    let mut keys = Vec::new();
    for viewer in viewers {
        for target in &targets {
            for include_pending in [true, false] {
                keys.push(FaceKey {
                    viewer,
                    target: target.clone(),
                    include_pending,
                });
            }
        }
    }

    let batch: HashMap<FaceKey, TargetBundle> = api::stance::bundles(&rig.pool, &keys)
        .await
        .expect("the batch reads");
    let mut answered = 0;
    for key in &keys {
        let want = match &key.target {
            FaceTarget::Node(id) => single(
                api::stance::bundle(&rig.pool, key.viewer, *id, key.include_pending).await,
            ),
            FaceTarget::Topic(name) => single(
                api::stance::topic_bundle(&rig.pool, key.viewer, name, key.include_pending).await,
            ),
        };
        let got = batch
            .get(key)
            .map(|read| (read.node.to_string(), read.standing));
        assert_eq!(got, want, "{key:?}");
        answered += usize::from(got.is_some());
    }
    assert_eq!(
        answered, 24,
        "three viewers with an actor, four resolvable targets, two views"
    );
    let ada_post = |include_pending| {
        batch[&FaceKey {
            viewer: ada_id,
            target: FaceTarget::Node(post),
            include_pending,
        }]
        .standing
        .sum
        .records
    };
    assert_eq!(ada_post(false), 1, "the landed half once");
    assert_eq!(ada_post(true), 2, "and the act in flight once beside it");
}
