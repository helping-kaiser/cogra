//! The replay floor of a published epoch: every accepted act's record
//! carries its signed pre-commitment, the host seal, both commitments with
//! the formation edition each names, and the author's approval witness, so
//! authorship and formation verify from the published record alone, with
//! no hidden opening (layer1-interface.md §8.4, "Act envelope"; §8.2,
//! "Verified act" and "Approval witness"). Every package binds the
//! verification-case declarations in force, the empty set included
//! (§11.6, the published epoch package).
//!
//! The checks here recompute every signature from the record's own bytes
//! and the host key the deployment publishes; they read nothing the host
//! keeps beside the record.
//!
//! **Budget: this suite runs in ≤ 10 s.** Like `host.rs`, every test spins
//! its own database and replays the workspace migration set.

use std::path::{Path, PathBuf};

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::client::ActorKey;
use common::l1::crypto::{self, tags};
use common::l1::handshake::{
    ApprovalWitness, Proposal, PublishedRecord, StructuralBody, approval_digest, seal_message,
};
use common::l1::identifier::NodeId;
use common::l1::proposal::{CONTENT_EDITION, DEPENDENCY_EDITION, PreSigned, SealedAct};
use l1_standin::{StandIn, StandInConfig};
use sqlx::PgPool;

/// The price every close charges (tests/host.rs explains why no other).
const THETA: i64 = l1_standin::REFERENCE_THETA_MICRO;

fn standin(pool: PgPool) -> StandIn {
    StandIn::new(
        pool,
        StandInConfig {
            epoch_target_acts: 10_000,
            max_payload_bytes: 1024,
            ..StandInConfig::default()
        },
    )
}

async fn funded_actor(host: &StandIn) -> ActorKey {
    let actor = ActorKey::generate();
    host.credit_burn(&actor.address(), 10 * THETA)
        .await
        .expect("burn");
    actor
}

fn body(
    actor: &ActorKey,
    seq: u64,
    family: Family,
    middle: Option<NodeId>,
    target: NodeId,
) -> StructuralBody {
    StructuralBody {
        author: actor.address(),
        seq,
        family,
        middle,
        target,
        p_d: 1.0,
        p_i: 0.5,
        settlement_ref: None,
        license: None,
        asserted_parents: vec![],
    }
}

/// `n` bytes of a run starting at `from` — fixed nonces a test can look
/// for again.
fn run(from: u8, n: usize) -> Vec<u8> {
    (0..n).map(|i| from.wrapping_add(i as u8)).collect()
}

/// One act through the whole handshake, as the device runs it; returns
/// what the device holds afterwards, which the record is compared with.
async fn land(
    host: &StandIn,
    actor: &ActorKey,
    proposal: Proposal,
    nonce_seed: u8,
) -> (PreSigned, SealedAct, ApprovalWitness) {
    let pre = PreSigned::sign_with_nonces(
        actor,
        proposal,
        run(nonce_seed, 32),
        run(nonce_seed.wrapping_add(100), 32),
    );
    let sealed = host.seal(pre.submission()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("host key");
    let witness = pre.approve(actor, &sealed, &host_key).expect("approves");
    host.approve(witness.clone())
        .await
        .expect("approval accepted");
    (pre, sealed, witness)
}

/// Why a published record fails to verify on its own.
#[derive(Debug, PartialEq, Eq)]
enum Unverified {
    AuthorKey,
    Body,
    Legs,
    PreSignature,
    Seal,
    Approval,
}

/// Verifies one published record from its own fields and the published
/// host key: the author key binds to the record's author, the body is the
/// record's act and the legs its projection, the author signed the
/// pre-commitment, the host sealed the verified act the record publishes,
/// and the author approved that verified act and its seal.
fn verify_from_record(record: &PublishedRecord, host_key: &[u8]) -> Result<(), Unverified> {
    let auth = &record.authentication;
    let author_key =
        crypto::verifying_key_from_bytes(&auth.author_pubkey).ok_or(Unverified::AuthorKey)?;
    if crypto::address_of(&author_key) != record.author {
        return Err(Unverified::AuthorKey);
    }
    if auth.body.act_id() != record.act_id
        || auth.body.author != record.author
        || auth.body.family != record.family
    {
        return Err(Unverified::Body);
    }
    let endpoints: Vec<(LegRole, NodeId, NodeId)> = record
        .legs
        .iter()
        .map(|leg| (leg.role, leg.source.clone(), leg.target.clone()))
        .collect();
    let projected = match &auth.body.middle {
        None => vec![(
            LegRole::Binary,
            auth.body.source(),
            auth.body.target.clone(),
        )],
        Some(middle) => vec![
            (LegRole::A, auth.body.source(), middle.clone()),
            (LegRole::T, middle.clone(), auth.body.target.clone()),
        ],
    };
    if endpoints != projected {
        return Err(Unverified::Legs);
    }
    let pre_commitment: [u8; 32] = auth
        .pre_commitment
        .as_slice()
        .try_into()
        .map_err(|_| Unverified::PreSignature)?;
    if !crypto::verify_digest(&author_key, &pre_commitment, &auth.pre_signature) {
        return Err(Unverified::PreSignature);
    }
    let verified_act = seal_message(&record.seal_frame());
    let host = crypto::verifying_key_from_bytes(host_key).ok_or(Unverified::Seal)?;
    if !crypto::verify(&host, tags::HOST_SEAL, &verified_act, &auth.host_seal) {
        return Err(Unverified::Seal);
    }
    if !crypto::verify_digest(
        &author_key,
        &approval_digest(&verified_act, &auth.host_seal),
        &auth.approval_signature,
    ) {
        return Err(Unverified::Approval);
    }
    Ok(())
}

/// Whether `needle` occurs anywhere in `haystack` as a contiguous run.
fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

/// Every byte string a record carries, flattened, so a test can show no
/// opening hides in any of them.
fn record_bytes(record: &PublishedRecord) -> Vec<u8> {
    let auth = &record.authentication;
    [
        record.payload_witness.as_slice(),
        &auth.body.canonical_bytes(),
        &auth.author_pubkey,
        &auth.pre_commitment,
        &auth.pre_signature,
        &auth.dependency_commitment,
        &auth.host_seal,
        &auth.approval_signature,
    ]
    .concat()
}

/// A client-signed Registration with a payload, an Opinion with an empty
/// payload that declares a dependency, and a hyper-edge Tag with two legs
/// close into one epoch. Each published record verifies from its own
/// fields: the author key binds to the address, the pre-signature verifies
/// over the published pre-commitment, the host seal over the verified act
/// the record publishes, and the approval witness over that act and its
/// seal. The authentication is exactly what the device held — the
/// verified act it approved, the seal and its own witness — with the
/// editions the host sealed under, and the read-back package publishes
/// the same.
///
/// Every accepted act verifies from its published record alone: the author's pre-signature, the host seal and the approval witness.
/// ´claim:standin:every-accepted-act-verifies-from-its-published-record´
#[sqlx::test(migrations = "../../migrations")]
async fn every_accepted_act_verifies_from_its_published_record(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host).await;
    let bob = funded_actor(&host).await;
    let registration = Proposal {
        body: body(
            &alice,
            0,
            Family::Registration,
            None,
            NodeId::Prof(alice.address()),
        ),
        payload: b"profile".to_vec(),
        deps: vec![],
    };
    let registered = registration.body.act_id();
    let opinion = Proposal {
        body: body(
            &bob,
            0,
            Family::Opinion,
            None,
            NodeId::Prof(alice.address()),
        ),
        payload: vec![],
        deps: vec![registered],
    };
    let tag = Proposal {
        body: StructuralBody {
            p_d: 0.0,
            p_i: 0.0,
            ..body(
                &bob,
                1,
                Family::Tag,
                Some(NodeId::Prof(alice.address())),
                NodeId::name("moderator").expect("name node"),
            )
        },
        payload: vec![],
        deps: vec![],
    };
    let mut held = Vec::new();
    held.push(land(&host, &alice, registration, 1).await);
    held.push(land(&host, &bob, opinion, 2).await);
    held.push(land(&host, &bob, tag, 3).await);

    let package = host.close_epoch().await.expect("closes");
    assert_eq!(package.records.len(), 3);
    let host_key = host.host_public_key().await.expect("host key");
    for record in &package.records {
        assert_eq!(
            verify_from_record(record, &host_key),
            Ok(()),
            "{}",
            record.act_id
        );
        let (_, sealed, witness) = held
            .iter()
            .find(|(pre, _, _)| pre.act_id() == record.act_id)
            .expect("an act the device landed");
        let auth = &record.authentication;
        assert_eq!(auth.body, sealed.act.body);
        assert_eq!(auth.pre_commitment, sealed.act.pre_commitment);
        assert_eq!(auth.pre_signature, sealed.act.pre_signature);
        assert_eq!(record.payload_witness, sealed.act.content_commitment);
        assert_eq!(auth.dependency_commitment, sealed.act.dependency_commitment);
        assert_eq!(
            (auth.content_edition, auth.dependency_edition),
            (sealed.act.content_edition, sealed.act.dependency_edition)
        );
        assert_eq!(
            (auth.content_edition, auth.dependency_edition),
            (CONTENT_EDITION, DEPENDENCY_EDITION)
        );
        assert_eq!(auth.host_seal, sealed.host_seal);
        assert_eq!(auth.approval_signature, witness.approval_signature);
    }
    let tag_record = package
        .records
        .iter()
        .find(|r| r.family == Family::Tag)
        .expect("the tag");
    assert_eq!(tag_record.legs.len(), 2, "a hyper-edge publishes two legs");

    assert_eq!(host.epochs_since(0).await.expect("epochs"), vec![package]);
}

/// The record holds commitments, seals, witnesses and order, never an
/// opening: neither nonce, neither salt, the dependency list's encoding nor
/// the payload occurs anywhere in a published record's bytes.
///
/// A published record holds no opening: no nonce, no salt, no dependency list and no payload.
/// ´claim:standin:a-published-record-holds-no-opening´
#[sqlx::test(migrations = "../../migrations")]
async fn a_published_record_holds_no_opening(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host).await;
    let bob = funded_actor(&host).await;
    let registration = Proposal {
        body: body(
            &alice,
            0,
            Family::Registration,
            None,
            NodeId::Prof(alice.address()),
        ),
        payload: b"a payload only its carriage holds".to_vec(),
        deps: vec![],
    };
    let registered = registration.body.act_id();
    let held_registration = land(&host, &alice, registration, 7).await;
    let opinion = Proposal {
        body: body(
            &bob,
            0,
            Family::Opinion,
            None,
            NodeId::Prof(alice.address()),
        ),
        payload: vec![],
        deps: vec![registered],
    };
    let held_opinion = land(&host, &bob, opinion, 9).await;

    let package = host.close_epoch().await.expect("closes");
    for (pre, sealed, _) in [&held_registration, &held_opinion] {
        let record = package
            .records
            .iter()
            .find(|r| r.act_id == pre.act_id())
            .expect("published");
        let bytes = record_bytes(record);
        let openings: [(&str, &[u8]); 4] = [
            ("content nonce", &pre.content_nonce),
            ("dependency nonce", &pre.dependency_nonce),
            ("content salt", &sealed.content_salt),
            ("dependency salt", &sealed.dependency_salt),
        ];
        for (what, opening) in openings {
            assert!(!contains(&bytes, opening), "{what} is published");
        }
        if !pre.proposal.payload.is_empty() {
            assert!(
                !contains(&bytes, &pre.proposal.payload),
                "payload is published"
            );
        }
        if !pre.proposal.deps.is_empty() {
            let encoded = common::l1::handshake::canonical_deps(&pre.proposal.deps);
            assert!(!contains(&bytes, &encoded), "dependency list is published");
        }
    }
}

/// Each published member is load-bearing: a record whose pre-signature,
/// seal, approval witness, dependency commitment, edition or body is
/// changed by one value no longer verifies, so the verification above
/// reads every member rather than passing over it.
///
/// Changing any member of a published record's authentication makes it fail to verify.
/// ´claim:standin:every-published-authentication-member-is-checked´
#[sqlx::test(migrations = "../../migrations")]
async fn every_published_authentication_member_is_checked(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host).await;
    let registration = Proposal {
        body: body(
            &alice,
            0,
            Family::Registration,
            None,
            NodeId::Prof(alice.address()),
        ),
        payload: b"profile".to_vec(),
        deps: vec![],
    };
    land(&host, &alice, registration, 11).await;
    let package = host.close_epoch().await.expect("closes");
    let host_key = host.host_public_key().await.expect("host key");
    let record = &package.records[0];
    assert_eq!(verify_from_record(record, &host_key), Ok(()));

    fn flip(bytes: &mut [u8]) {
        bytes[0] ^= 1;
    }
    type Tamper = fn(&mut PublishedRecord);
    let cases: [(&str, Tamper, Unverified); 9] = [
        (
            "author key",
            |r| flip(&mut r.authentication.author_pubkey),
            Unverified::AuthorKey,
        ),
        (
            "body",
            |r| r.authentication.body.p_i = 0.25,
            Unverified::Seal,
        ),
        ("act", |r| r.authentication.body.seq = 1, Unverified::Body),
        (
            "pre-commitment",
            |r| flip(&mut r.authentication.pre_commitment),
            Unverified::PreSignature,
        ),
        (
            "pre-signature",
            |r| flip(&mut r.authentication.pre_signature),
            Unverified::PreSignature,
        ),
        (
            "content commitment",
            |r| flip(&mut r.payload_witness),
            Unverified::Seal,
        ),
        (
            "dependency commitment",
            |r| flip(&mut r.authentication.dependency_commitment),
            Unverified::Seal,
        ),
        (
            "edition",
            |r| r.authentication.dependency_edition += 1,
            Unverified::Seal,
        ),
        (
            "approval",
            |r| flip(&mut r.authentication.approval_signature),
            Unverified::Approval,
        ),
    ];
    for (what, tamper, expected) in cases {
        let mut changed = record.clone();
        tamper(&mut changed);
        assert_eq!(
            verify_from_record(&changed, &host_key),
            Err(expected),
            "{what}"
        );
    }
    let mut resealed = record.clone();
    flip(&mut resealed.authentication.host_seal);
    assert_eq!(
        verify_from_record(&resealed, &host_key),
        Err(Unverified::Seal)
    );
    let mut moved = record.clone();
    moved.legs[0].target = NodeId::Prof("someone-else".into());
    assert_eq!(verify_from_record(&moved, &host_key), Err(Unverified::Legs));
}

/// Every package binds the verification-case declarations in force — none
/// for this deployment — as an explicit empty set, on the close and on the
/// read-back alike, for an epoch with acts and for an empty one.
///
/// Every epoch package binds the empty set of verification-case declarations, as published and as read back.
/// ´claim:standin:every-package-binds-its-case-declarations´
#[sqlx::test(migrations = "../../migrations")]
async fn every_package_binds_its_case_declarations(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host).await;
    let registration = Proposal {
        body: body(
            &alice,
            0,
            Family::Registration,
            None,
            NodeId::Prof(alice.address()),
        ),
        payload: vec![],
        deps: vec![],
    };
    land(&host, &alice, registration, 13).await;
    let with_acts = host.close_epoch().await.expect("closes");
    let empty = host.close_epoch().await.expect("closes empty");
    assert!(empty.records.is_empty());
    for package in [&with_acts, &empty] {
        assert_eq!(package.closure.case_declarations, vec![]);
    }
    let read_back = host.epochs_since(0).await.expect("epochs");
    assert_eq!(read_back, vec![with_acts, empty]);
    let stored: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM l1_epoch_case_declarations")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(stored, 0, "no declaration was in force");
}

const UNDER_TEST: &str = "20261120230000_l1_standin_replay_floor.sql";

fn migrations() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../migrations")
}

/// Applies every migration that precedes the one under test, in order, one
/// file to a transaction as sqlx applies them.
async fn migrate_to_just_before(pool: &PgPool) {
    let mut files: Vec<PathBuf> = std::fs::read_dir(migrations())
        .expect("the migrations directory")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.extension().is_some_and(|e| e == "sql"))
        .filter(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n < UNDER_TEST)
        })
        .collect();
    files.sort();
    for path in files {
        let text = std::fs::read_to_string(&path).expect("a readable migration");
        let mut tx = pool.begin().await.expect("begin");
        sqlx::raw_sql(&text)
            .execute(&mut *tx)
            .await
            .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        tx.commit().await.expect("commit");
    }
}

async fn apply_under_test(pool: &PgPool) -> Result<(), sqlx::Error> {
    let text =
        std::fs::read_to_string(migrations().join(UNDER_TEST)).expect("the migration under test");
    let mut tx = pool.begin().await?;
    sqlx::raw_sql(&text).execute(&mut *tx).await?;
    tx.commit().await
}

/// Inserts one act in the given status, with or without its approval
/// witness, into `l1_acts` as it stands before the migration.
async fn insert_act(pool: &PgPool, seq: i64, status: &str, approval: Option<&[u8]>) {
    sqlx::query(
        "INSERT INTO l1_acts (
             act_id, author, seq, family, author_pubkey, target, p_d, p_i,
             asserted_parents, deps, dependency_nonce, pre_signature, pre_commitment,
             content_salt, deps_salt, content_commitment, deps_commitment, host_seal,
             approval_signature, status)
         VALUES ('act:alice:' || $1 || ':opinion', 'alice', $1, 'opinion', '\\x01',
                 'prof:bob', 1, 1, '{}', '{}', '\\x02', '\\x03', '\\x04',
                 CASE WHEN $2 = 'accepted' THEN NULL ELSE '\\x05'::BYTEA END,
                 '\\x06', '\\x07', '\\x08', '\\x09', $3, $2)",
    )
    .bind(seq)
    .bind(status)
    .bind(approval)
    .execute(pool)
    .await
    .expect("an act, in the table as it was");
}

/// On a world whose stand-in holds an approved act without its approval
/// witness — one its published record could not carry at the floor — the
/// migration raises before anything changes: the case table is not
/// created. A world whose acts past approval all hold their witness, with
/// a sealed act still waiting for one, migrates, and afterwards an act
/// past approval cannot be stored without its witness.
///
/// The replay-floor migration refuses a world with an approved act lacking its witness, and pins the witness on every later one.
/// ´claim:standin:the-replay-floor-migration-refuses-an-act-without-its-witness´
#[sqlx::test(migrations = false)]
async fn the_migration_refuses_an_act_without_its_witness(pool: PgPool) {
    migrate_to_just_before(&pool).await;
    insert_act(&pool, 0, "approved", None).await;

    let refused = apply_under_test(&pool)
        .await
        .expect_err("an approved act without its witness is refused");
    assert!(
        refused.to_string().contains("without its approval witness"),
        "{refused}"
    );
    let created: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables
                        WHERE table_schema = current_schema()
                          AND table_name = 'l1_epoch_case_declarations')",
    )
    .fetch_one(&pool)
    .await
    .expect("catalog");
    assert!(!created, "nothing changed");

    sqlx::query("UPDATE l1_acts SET approval_signature = '\\x0a'")
        .execute(&pool)
        .await
        .expect("the witness");
    insert_act(&pool, 1, "sealed", None).await;
    apply_under_test(&pool).await.expect("migrates");

    let violated = sqlx::query("UPDATE l1_acts SET approval_signature = NULL WHERE seq = 0")
        .execute(&pool)
        .await
        .expect_err("an approved act keeps its witness");
    assert!(
        violated
            .to_string()
            .contains("l1_acts_approved_holds_witness"),
        "{violated}"
    );
}
