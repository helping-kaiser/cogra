//! The node-anchored chronicle, end to end through the real HTTP surface
//! (api-spec.md "Identity and actor interfaces"): `outgoingRecords` and
//! `incomingRecords` on every type implementing `Node`, the filters they
//! share, and the keyset walk they page by.
//!
//! The fixture is the smallest graph that separates the two directions.
//! Alice publishes a post; Bob reviews it, minting a comment, and stances
//! it negatively; Alice stances the comment at (0, 0). That gives every
//! leg role a record — a binary act whose target is a minted node, a
//! hyper act passing *through* one — so a direction that anchored on the
//! wrong end of a leg cannot pass.

use api::content::{self, CommentDraft, License, PostDraft};
use api::l1::{L1Boundary, StandInBoundary};
use api::stance::{self, TargetRef};
use axum::body::Body;
use axum::http::Request;
use common::l1::client::ActorKey;
use http_body_util::BodyExt;
use l1_standin::StandIn;
use postgres_store::staged::{self, PreSignedParts};
use postgres_store::{PgPool, genesis};
use serde_json::{Value, json};
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::TestMailer;

const GC: i64 = 8;

fn license() -> License {
    License {
        attribution: 1.0,
        provenance: 0.0,
    }
}

struct Chronicle {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
}

impl Chronicle {
    async fn new(pool: PgPool) -> Self {
        let mailer = Arc::new(TestMailer::default());
        let (app, standin) = rig::connect_info_app_with_standin(
            pool.clone(),
            mailer,
            api::ratelimit::RateLimitConfig::unlimited(),
        );
        let boundary = StandInBoundary(standin.clone());
        Self {
            app,
            pool,
            standin,
            boundary,
        }
    }

    async fn funded_actor(&self, handle: &str) -> (Uuid, ActorKey) {
        let key = ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor row");
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    async fn sign_and_relay(&self, id: Uuid, key: &ActorKey) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        let pre = key.pre_sign(write.proposal);
        let parts = PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        };
        let sealed = api::relay::submit_pre_signed(&self.boundary, &self.pool, id, parts)
            .await
            .expect("seals");
        let host_key = self.boundary.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
    }

    async fn close_and_ingest(&self) {
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    async fn land(&self, id: Uuid, key: &ActorKey) {
        self.sign_and_relay(id, key).await;
        self.close_and_ingest().await;
    }

    async fn post(&self, actor: Uuid, key: &ActorKey, title: &str) -> Uuid {
        let prepared = content::prepare_post(
            &self.pool,
            &self.boundary,
            GC,
            actor,
            PostDraft {
                title: Some(title.into()),
                description: None,
                content: Some("body".into()),
                license: license(),
                p_directed: None,
                tags: vec![],
                references: vec![],
                attachments: vec![],
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares post");
        self.land(prepared.writes[0].id, key).await;
        prepared.node
    }

    async fn comment(&self, actor: Uuid, key: &ActorKey, target: Uuid) -> Uuid {
        let prepared = content::prepare_comment(
            &self.pool,
            &self.boundary,
            GC,
            actor,
            CommentDraft {
                target,
                content: "c".into(),
                license: license(),
                p_directed: None,
                p_interest: None,
                tags: vec![],
                references: vec![],
                attachments: vec![],
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares comment");
        self.land(prepared.writes[0].id, key).await;
        prepared.node
    }

    async fn stance(&self, actor: Uuid, key: &ActorKey, target: Uuid, p_d: f64, p_i: f64) {
        let prepared = stance::prepare_stance(
            &self.pool,
            &self.boundary,
            GC,
            actor,
            &TargetRef::Node(target),
            p_d,
            p_i,
        )
        .await
        .expect("prepares stance");
        self.land(prepared.id, key).await;
    }

    async fn gql(&self, query: &str, variables: Value) -> Value {
        let request = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({ "query": query, "variables": variables }).to_string(),
            ))
            .expect("request");
        let response = self
            .app
            .clone()
            .oneshot(request)
            .await
            .expect("graphql responds");
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        let json: Value = serde_json::from_slice(&bytes).expect("json");
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json["data"].clone()
    }
}

/// The record families a connection served, in the order it served them.
fn families(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"]["family"].as_str().expect("family").to_string())
        .collect()
}

fn sorted_families(connection: &Value) -> Vec<String> {
    let mut f = families(connection);
    f.sort();
    f
}

/// The pair as it reads on a content node, asking through the `Node`
/// interface so the interface declaration and the concrete type's
/// resolver are both exercised.
const CONTENT_QUERY: &str = r#"
query Chronicle($id: UUID!, $family: RecordFamily, $toKind: NodeKind,
                $fromKind: NodeKind, $pd: Sign, $pi: Sign,
                $marked: Boolean, $since: Int, $until: Int,
                $first: Int, $after: String, $last: Int, $before: String) {
  node(id: $id) {
    ... on Post {
      outgoingRecords(family: $family, toKind: $toKind, pDirectedSign: $pd,
                      pInterestSign: $pi, payloadMarked: $marked,
                      sinceEpoch: $since, untilEpoch: $until,
                      first: $first, after: $after, last: $last, before: $before) {
        edges { cursor node { id family landingEpoch } }
        pageInfo { hasNextPage hasPreviousPage }
      }
      incomingRecords(family: $family, fromKind: $fromKind, pDirectedSign: $pd,
                      pInterestSign: $pi, payloadMarked: $marked,
                      sinceEpoch: $since, untilEpoch: $until,
                      first: $first, after: $after, last: $last, before: $before) {
        edges { cursor node { id family landingEpoch } }
        pageInfo { hasNextPage hasPreviousPage }
      }
    }
    ... on Comment {
      outgoingRecords(family: $family, toKind: $toKind, pDirectedSign: $pd,
                      pInterestSign: $pi, payloadMarked: $marked,
                      sinceEpoch: $since, untilEpoch: $until,
                      first: $first, after: $after, last: $last, before: $before) {
        edges { cursor node { id family landingEpoch } }
        pageInfo { hasNextPage hasPreviousPage }
      }
      incomingRecords(family: $family, fromKind: $fromKind, pDirectedSign: $pd,
                      pInterestSign: $pi, payloadMarked: $marked,
                      sinceEpoch: $since, untilEpoch: $until,
                      first: $first, after: $after, last: $last, before: $before) {
        edges { cursor node { id family landingEpoch } }
        pageInfo { hasNextPage hasPreviousPage }
      }
    }
  }
}
"#;

/// The same pair on the actor type.
const ACTOR_QUERY: &str = r#"
query ActorChronicle($id: UUID!, $family: RecordFamily, $toKind: NodeKind,
                     $fromKind: NodeKind, $pd: Sign, $pi: Sign,
                     $marked: Boolean, $first: Int) {
  user(id: $id) {
    outgoingRecords(family: $family, toKind: $toKind, pDirectedSign: $pd,
                    pInterestSign: $pi, payloadMarked: $marked, first: $first) {
      edges { cursor node { id family } }
      pageInfo { hasNextPage hasPreviousPage }
    }
    incomingRecords(family: $family, fromKind: $fromKind, pDirectedSign: $pd,
                    pInterestSign: $pi, payloadMarked: $marked, first: $first) {
      edges { cursor node { id family } }
      pageInfo { hasNextPage hasPreviousPage }
    }
  }
}
"#;

struct Fixture {
    alice: Uuid,
    bob: Uuid,
    post: Uuid,
    comment: Uuid,
}

async fn fixture(rig: &Chronicle) -> Fixture {
    let (alice, alice_key) = rig.funded_actor("alice").await;
    let (bob, bob_key) = rig.funded_actor("bob").await;
    let post = rig.post(alice, &alice_key, "T").await;
    let comment = rig.comment(bob, &bob_key, post).await;
    rig.stance(bob, &bob_key, post, -0.5, 0.25).await;
    rig.stance(alice, &alice_key, comment, 0.0, 0.0).await;
    Fixture {
        alice,
        bob,
        post,
        comment,
    }
}

/// A leg runs source → target — author → target on a binary act, and
/// author → middle → terminal on a hyper one (layer1-interface.md §9.6)
/// — so which end a traversal anchors on *is* the direction. Outgoing
/// walks the legs the node is the source of; incoming, the legs it is
/// the target of. The post therefore reads its own Publish, the review
/// aimed at it and the stance against it as *incoming*, while the review
/// leaves it again toward the comment it minted; and the comment, which
/// authors nothing, has an empty outgoing chronicle. An actor's outgoing
/// page is their authored chronicle, which is what makes the same field
/// the generic relationship reader on every type.
///
/// Outgoing anchors on the legs a node is the source of and incoming on the legs it is the target of, so a node that authors nothing has an empty outgoing chronicle.
/// ´claim:chronicle:the-pair-anchors-on-the-leg-ends´
#[sqlx::test(migrations = "../../migrations")]
async fn the_pair_anchors_on_the_ends_of_a_leg(pool: PgPool) {
    let rig = Chronicle::new(pool).await;
    let f = fixture(&rig).await;

    let post = rig.gql(CONTENT_QUERY, json!({ "id": f.post })).await;
    let post = &post["node"];
    assert_eq!(
        sorted_families(&post["incomingRecords"]),
        vec!["OPINION", "PUBLISH", "REVIEW"],
        "everything aimed at the post, whatever leg carried it"
    );
    assert_eq!(
        families(&post["outgoingRecords"]),
        vec!["REVIEW"],
        "the review is the one act that leaves the post again — its terminal leg"
    );

    let comment = rig.gql(CONTENT_QUERY, json!({ "id": f.comment })).await;
    let comment = &comment["node"];
    assert_eq!(
        sorted_families(&comment["incomingRecords"]),
        vec!["OPINION", "REVIEW"],
        "the minting review and the stance against it point at the comment"
    );
    assert!(
        families(&comment["outgoingRecords"]).is_empty(),
        "a comment authors nothing, so nothing leaves it"
    );

    let alice = rig.gql(ACTOR_QUERY, json!({ "id": f.alice })).await;
    assert_eq!(
        sorted_families(&alice["user"]["outgoingRecords"]),
        vec!["OPINION", "PUBLISH"],
        "an actor's outgoing page is the chronicle they authored"
    );
    let bob = rig.gql(ACTOR_QUERY, json!({ "id": f.bob })).await;
    assert_eq!(
        sorted_families(&bob["user"]["outgoingRecords"]),
        vec!["OPINION", "REVIEW"],
        "and carries no act anyone else authored"
    );
    assert!(
        families(&bob["user"]["incomingRecords"]).is_empty(),
        "nothing in this graph points at Bob"
    );
}

/// Every filter the pair declares narrows the anchored page, and each
/// narrows the same way it would on the top-level chronicle, because
/// both read one filter surface. The parameter signs are read off the
/// leg the API publishes as `pDirected` / `pInterest`, so a page filtered
/// by sign and the `pDirected` its own edges carry can never disagree —
/// which is what makes `(0, 0)` a sign filter rather than a special case.
/// The far-end kind is the node's kind as CoGra types it, so the same
/// actor's chronicle separates what points at posts from what points at
/// comments.
///
/// Every declared filter narrows the anchored page, and a sign filter agrees with the parameters the page's own edges carry.
/// ´claim:chronicle:the-filters-narrow-the-anchored-page´
#[sqlx::test(migrations = "../../migrations")]
async fn the_filters_narrow_the_anchored_page(pool: PgPool) {
    let rig = Chronicle::new(pool).await;
    let f = fixture(&rig).await;

    let by_family = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "family": "OPINION" }))
        .await;
    assert_eq!(
        families(&by_family["node"]["incomingRecords"]),
        vec!["OPINION"],
        "family narrows to the stance against the post"
    );

    let negative = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "pd": "NEGATIVE" }))
        .await;
    assert_eq!(
        families(&negative["node"]["incomingRecords"]),
        vec!["OPINION"],
        "only Bob's stance was authored negative"
    );
    let positive = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "pd": "POSITIVE" }))
        .await;
    assert_eq!(
        sorted_families(&positive["node"]["incomingRecords"]),
        vec!["PUBLISH", "REVIEW"],
        "and the two content acts carry the default positive stance"
    );

    let marked = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "marked": true }))
        .await;
    assert_eq!(
        sorted_families(&marked["node"]["incomingRecords"]),
        vec!["PUBLISH", "REVIEW"],
        "the acts that committed a payload"
    );
    let unmarked = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "marked": false }))
        .await;
    assert_eq!(
        families(&unmarked["node"]["incomingRecords"]),
        vec!["OPINION"],
        "a stance commits none"
    );

    let from_users = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "fromKind": "USER" }))
        .await;
    assert_eq!(
        sorted_families(&from_users["node"]["incomingRecords"]),
        vec!["OPINION", "PUBLISH", "REVIEW"],
        "every act aimed at the post was authored by a person"
    );
    let from_posts = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "fromKind": "POST" }))
        .await;
    assert!(
        families(&from_posts["node"]["incomingRecords"]).is_empty(),
        "and none of them came from a post"
    );

    let alice_posts = rig
        .gql(ACTOR_QUERY, json!({ "id": f.alice, "toKind": "POST" }))
        .await;
    assert_eq!(
        families(&alice_posts["user"]["outgoingRecords"]),
        vec!["PUBLISH"],
        "Alice's one act toward a post is publishing it"
    );
    let alice_comments = rig
        .gql(ACTOR_QUERY, json!({ "id": f.alice, "toKind": "COMMENT" }))
        .await;
    assert_eq!(
        families(&alice_comments["user"]["outgoingRecords"]),
        vec!["OPINION"],
        "and her one act toward a comment is the stance on it"
    );

    let zero = rig
        .gql(ACTOR_QUERY, json!({ "id": f.alice, "pd": "ZERO", "pi": "ZERO" }))
        .await;
    assert_eq!(
        families(&zero["user"]["outgoingRecords"]),
        vec!["OPINION"],
        "the inert (0, 0) stance is reachable by sign like any other"
    );

    let epochs: Vec<i64> = post_incoming_epochs(&rig, f.post).await;
    let (first, last) = (epochs[epochs.len() - 1], epochs[0]);
    let windowed = rig
        .gql(
            CONTENT_QUERY,
            json!({ "id": f.post, "since": first, "until": first }),
        )
        .await;
    assert_eq!(
        families(&windowed["node"]["incomingRecords"]),
        vec!["PUBLISH"],
        "a one-epoch window holds only what landed in it"
    );
    let after_first = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "since": first + 1 }))
        .await;
    assert_eq!(
        sorted_families(&after_first["node"]["incomingRecords"]),
        vec!["OPINION", "REVIEW"],
        "and an open window from the next epoch holds the rest"
    );
    let beyond = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "since": last + 1 }))
        .await;
    assert!(
        families(&beyond["node"]["incomingRecords"]).is_empty(),
        "a window past the last landing is empty, not an error"
    );
}

/// The landing epochs of what points at the post, newest first.
async fn post_incoming_epochs(rig: &Chronicle, post: Uuid) -> Vec<i64> {
    let page = rig.gql(CONTENT_QUERY, json!({ "id": post })).await;
    page["node"]["incomingRecords"]["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"]["landingEpoch"].as_i64().expect("epoch"))
        .collect()
}

/// The anchored page is the chronicle's own keyset walk, so it pages
/// forward from a cursor and backward from one, and the `pageInfo` it
/// reports is the walk's, not the filter's. Paging is what makes the
/// generic reader usable on a node with a long history, and a backward
/// walk that served the forward page's neighbours in the wrong order
/// would be invisible to a forward-only test.
///
/// The anchored page walks the keyset in both directions and reports the walk's own pageInfo.
/// ´claim:chronicle:the-anchored-page-walks-both-ways´
#[sqlx::test(migrations = "../../migrations")]
async fn the_anchored_page_walks_both_ways(pool: PgPool) {
    let rig = Chronicle::new(pool).await;
    let f = fixture(&rig).await;

    let whole = rig.gql(CONTENT_QUERY, json!({ "id": f.post })).await;
    let whole = families(&whole["node"]["incomingRecords"]);
    assert_eq!(whole.len(), 3, "the unpaged page holds all three");

    let first_page = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "first": 1 }))
        .await;
    let first_page = &first_page["node"]["incomingRecords"];
    assert_eq!(families(first_page), whole[..1].to_vec());
    assert_eq!(first_page["pageInfo"]["hasNextPage"], json!(true));
    assert_eq!(first_page["pageInfo"]["hasPreviousPage"], json!(false));

    let cursor = first_page["edges"][0]["cursor"]
        .as_str()
        .expect("cursor")
        .to_string();
    let second_page = rig
        .gql(
            CONTENT_QUERY,
            json!({ "id": f.post, "first": 1, "after": cursor }),
        )
        .await;
    let second_page = &second_page["node"]["incomingRecords"];
    assert_eq!(families(second_page), whole[1..2].to_vec());
    assert_eq!(second_page["pageInfo"]["hasPreviousPage"], json!(true));

    let second_cursor = second_page["edges"][0]["cursor"]
        .as_str()
        .expect("cursor")
        .to_string();
    let backward = rig
        .gql(
            CONTENT_QUERY,
            json!({ "id": f.post, "last": 1, "before": second_cursor }),
        )
        .await;
    let backward = &backward["node"]["incomingRecords"];
    assert_eq!(
        families(backward),
        whole[..1].to_vec(),
        "walking back from the middle serves the newer neighbour"
    );
    assert_eq!(backward["pageInfo"]["hasNextPage"], json!(true));

    let tail = rig
        .gql(CONTENT_QUERY, json!({ "id": f.post, "last": 2 }))
        .await;
    assert_eq!(
        families(&tail["node"]["incomingRecords"]),
        whole[1..].to_vec(),
        "the backward page still reads newest-first"
    );
}

/// A node CoGra carries no records for answers with an empty page rather
/// than an error, the contract an unresolvable id already carries on the
/// top-level chronicle. Two shapes reach that emptiness from opposite
/// directions: a fresh post, whose inbound attention is its own Publish
/// and no more, and a keyless account — an applicant before its key
/// ceremony — which fronts no node on the graph at all. The second is
/// the one worth pinning: a page anchored on nothing must serve nothing,
/// never an unanchored page of everyone's records.
///
/// A node with no records on one end serves an empty page, and so does an account that fronts no node on the graph yet.
/// ´claim:chronicle:an-unanchored-read-serves-an-empty-page´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unanchored_read_serves_an_empty_page(pool: PgPool) {
    let rig = Chronicle::new(pool).await;
    let (alice, alice_key) = rig.funded_actor("alice").await;
    let post = rig.post(alice, &alice_key, "T").await;

    let page = rig.gql(CONTENT_QUERY, json!({ "id": post })).await;
    let page = &page["node"];
    assert_eq!(
        families(&page["incomingRecords"]),
        vec!["PUBLISH"],
        "the act that minted it is the only thing aimed at it"
    );
    assert!(
        families(&page["outgoingRecords"]).is_empty(),
        "and nothing has left it"
    );
    assert_eq!(
        page["outgoingRecords"]["pageInfo"]["hasNextPage"],
        json!(false)
    );

    let applicant = Uuid::new_v4();
    sqlx::query("INSERT INTO actors (id, kind, handle) VALUES ($1, 'user', 'applicant')")
        .bind(applicant)
        .execute(&rig.pool)
        .await
        .expect("keyless actor row");
    let keyless = rig.gql(ACTOR_QUERY, json!({ "id": applicant })).await;
    assert!(
        families(&keyless["user"]["outgoingRecords"]).is_empty(),
        "an account with no address anchors on nothing, so it reads nothing"
    );
    assert!(
        families(&keyless["user"]["incomingRecords"]).is_empty(),
        "in either direction"
    );
}
