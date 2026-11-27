//! The replay floor of a published epoch: every accepted act's record
//! carries two members — the act, with both commitments, its approval
//! witness and the public key the record maps the author's signatures to,
//! and beside it the seal attestation, with the signed pre-commitment, the
//! formation edition each commitment names, the frame version and the host
//! seal — so each signature and the act's formation verify from the
//! published record alone, with no hidden opening (layer1-interface.md
//! §13.3, "Published Epoch Replay Floor"; §8.4, "Act envelope"; §8.2,
//! "Verified act" and "Approval witness"). Every package states the
//! approval form its witnesses verify in and binds the verification-case
//! declarations in force, the empty set included (§11.6, the published
//! epoch package).
//!
//! The checks here recompute every signature from the record's own bytes
//! and the host key the deployment publishes; they read nothing the host
//! keeps beside the record. Like the floor's own checks, they relate no key
//! to the stated Actor; that the stand-in seals only under the key its
//! author's address derives from is its own submission check, asserted
//! apart.
//!
//! **Budget: this suite runs in ≤ 10 s.** Like `host.rs`, every test spins
//! its own database and replays the workspace migration set.

use std::path::{Path, PathBuf};

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::client::ActorKey;
use common::l1::crypto::{self, tags};
use common::l1::handshake::{
    ApprovalForm, ApprovalWitness, EpochPackage, Proposal, PublishedRecord, StructuralBody,
    approval_digest,
    seal_message,
};
use common::l1::identifier::NodeId;
use common::l1::proposal::{CONTENT_EDITION, DEPENDENCY_EDITION, PreSigned, SealedAct};
use ed25519_dalek::SigningKey;
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
        p_i: 1.0,
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
    SigningKey,
    Body,
    Legs,
    PreSignature,
    Seal,
    Approval,
}

/// Verifies one published record from its own two members, the approval
/// form its epoch states and the published host key: the body is the
/// record's act and the legs its projection, the pre-signature verifies
/// over the pre-commitment under the key the record maps it to, the host
/// seal over the verified act the record publishes under the host key, and
/// the approval witness under the same recorded key over the message the
/// form names — the act alone, or, in the form of the earlier epochs, the
/// verified act and its seal. It relates that key to no Actor.
fn verify_from_record(
    record: &PublishedRecord,
    form: ApprovalForm,
    host_key: &[u8],
) -> Result<(), Unverified> {
    let (act, attestation) = (&record.approval, &record.attestation);
    let signing_key =
        crypto::verifying_key_from_bytes(&act.author_pubkey).ok_or(Unverified::SigningKey)?;
    if act.body.act_id() != record.act_id
        || act.body.author != record.author
        || act.body.family != record.family
    {
        return Err(Unverified::Body);
    }
    let endpoints: Vec<(LegRole, NodeId, NodeId)> = record
        .legs
        .iter()
        .map(|leg| (leg.role, leg.source.clone(), leg.target.clone()))
        .collect();
    let projected = match &act.body.middle {
        None => vec![(
            LegRole::Binary,
            act.body.source(),
            act.body.target.clone(),
        )],
        Some(middle) => vec![
            (LegRole::A, act.body.source(), middle.clone()),
            (LegRole::T, middle.clone(), act.body.target.clone()),
        ],
    };
    if endpoints != projected {
        return Err(Unverified::Legs);
    }
    let pre_commitment: [u8; 32] = attestation
        .pre_commitment
        .as_slice()
        .try_into()
        .map_err(|_| Unverified::PreSignature)?;
    if !crypto::verify_digest(&signing_key, &pre_commitment, &attestation.pre_signature) {
        return Err(Unverified::PreSignature);
    }
    let verified_act = seal_message(&record.seal_frame());
    let host = crypto::verifying_key_from_bytes(host_key).ok_or(Unverified::Seal)?;
    if !crypto::verify(&host, tags::HOST_SEAL, &verified_act, &attestation.host_seal) {
        return Err(Unverified::Seal);
    }
    if !crypto::verify_digest(
        &signing_key,
        &record.approval_digest(form),
        &act.approval_signature,
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
    let (act, attestation) = (&record.approval, &record.attestation);
    [
        record.payload_witness.as_slice(),
        &act.body.canonical_bytes(),
        &act.author_pubkey,
        &attestation.pre_commitment,
        &attestation.pre_signature,
        &act.dependency_commitment,
        &attestation.host_seal,
        &act.approval_signature,
    ]
    .concat()
}

/// A client-signed Registration with a payload, an Opinion with an empty
/// payload that declares a dependency, and a hyper-edge Tag with two legs
/// close into one epoch, which states the current approval form. Each
/// published record verifies from its own members: the pre-signature
/// verifies over the published pre-commitment and the approval witness over
/// the act alone, both under the key the record maps them to, and the host
/// seal over the verified act under the host key. The members are exactly
/// what the device held — the verified act it approved, the seal, its own witness and its
/// own key — with the editions the host sealed under, and the read-back
/// package publishes the same. Apart from the record checks, the recorded
/// key is the one the author's address derives from: the stand-in seals
/// under no other.
///
/// Every accepted act verifies from its published record alone: the pre-signature, the host seal and the approval witness.
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
    assert_eq!(package.closure.approval_form, ApprovalForm::CURRENT);
    assert_eq!(package.records.len(), 3);
    let host_key = host.host_public_key().await.expect("host key");
    for record in &package.records {
        assert_eq!(
            verify_from_record(record, package.closure.approval_form, &host_key),
            Ok(()),
            "{}",
            record.act_id
        );
        let (pre, sealed, witness) = held
            .iter()
            .find(|(pre, _, _)| pre.act_id() == record.act_id)
            .expect("an act the device landed");
        let (act, attestation) = (&record.approval, &record.attestation);
        assert_eq!(act.author_pubkey, pre.author_pubkey);
        let signing_key =
            crypto::verifying_key_from_bytes(&act.author_pubkey).expect("a well-formed key");
        assert_eq!(
            crypto::address_of(&signing_key),
            record.author,
            "the stand-in seals only under the key the author's address derives from"
        );
        assert_eq!(act.body, sealed.act.body);
        assert_eq!(attestation.pre_commitment, sealed.act.pre_commitment);
        assert_eq!(attestation.pre_signature, sealed.act.pre_signature);
        assert_eq!(record.payload_witness, sealed.act.content_commitment);
        assert_eq!(act.dependency_commitment, sealed.act.dependency_commitment);
        assert_eq!(
            (attestation.content_edition, attestation.dependency_edition),
            (sealed.act.content_edition, sealed.act.dependency_edition)
        );
        assert_eq!(
            (attestation.content_edition, attestation.dependency_edition),
            (CONTENT_EDITION, DEPENDENCY_EDITION)
        );
        assert_eq!(attestation.host_seal, sealed.host_seal);
        assert_eq!(act.approval_signature, witness.approval_signature);
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

/// Each published member is load-bearing: a record whose signing key,
/// pre-signature, seal, approval witness, dependency commitment, edition,
/// frame version or body is changed by one value no longer verifies, so the verification
/// above reads every member rather than passing over it. A different
/// well-formed key fails at the first signature it is checked under.
///
/// Changing any part of either member of a published record makes it fail to verify.
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
    assert_eq!(verify_from_record(record, package.closure.approval_form, &host_key), Ok(()));

    fn flip(bytes: &mut [u8]) {
        bytes[0] ^= 1;
    }
    type Tamper = fn(&mut PublishedRecord);
    let cases: [(&str, Tamper, Unverified); 11] = [
        (
            "malformed signing key",
            |r| r.approval.author_pubkey.truncate(31),
            Unverified::SigningKey,
        ),
        (
            "signing key",
            |r| r.approval.author_pubkey = ActorKey::from_seed([7; 32]).public_key_bytes(),
            Unverified::PreSignature,
        ),
        (
            "body",
            |r| r.approval.body.p_i = 0.25,
            Unverified::Seal,
        ),
        ("act", |r| r.approval.body.seq = 1, Unverified::Body),
        (
            "pre-commitment",
            |r| flip(&mut r.attestation.pre_commitment),
            Unverified::PreSignature,
        ),
        (
            "pre-signature",
            |r| flip(&mut r.attestation.pre_signature),
            Unverified::PreSignature,
        ),
        (
            "content commitment",
            |r| flip(&mut r.payload_witness),
            Unverified::Seal,
        ),
        (
            "dependency commitment",
            |r| flip(&mut r.approval.dependency_commitment),
            Unverified::Seal,
        ),
        (
            "edition",
            |r| r.attestation.dependency_edition += 1,
            Unverified::Seal,
        ),
        (
            "frame version",
            |r| r.attestation.seal_version += 1,
            Unverified::Seal,
        ),
        (
            "approval",
            |r| flip(&mut r.approval.approval_signature),
            Unverified::Approval,
        ),
    ];
    for (what, tamper, expected) in cases {
        let mut changed = record.clone();
        tamper(&mut changed);
        assert_eq!(
            verify_from_record(&changed, ApprovalForm::CURRENT, &host_key),
            Err(expected),
            "{what}"
        );
    }
    let mut resealed = record.clone();
    flip(&mut resealed.attestation.host_seal);
    assert_eq!(
        verify_from_record(&resealed, ApprovalForm::CURRENT, &host_key),
        Err(Unverified::Seal)
    );
    let mut moved = record.clone();
    moved.legs[0].target = NodeId::Prof("someone-else".into());
    assert_eq!(verify_from_record(&moved, ApprovalForm::CURRENT, &host_key), Err(Unverified::Legs));
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

const UNDER_TEST: &str = "20261127120000_l1_standin_replay_floor.sql";

fn migrations() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../migrations")
}

/// Applies every migration whose file name `wanted` selects, in order, one
/// file to a transaction as sqlx applies them.
async fn apply_migrations(pool: &PgPool, wanted: impl Fn(&str) -> bool) {
    let mut files: Vec<PathBuf> = std::fs::read_dir(migrations())
        .expect("the migrations directory")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.extension().is_some_and(|e| e == "sql"))
        .filter(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(&wanted)
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

/// A proposal sealed by the host, as its device holds it.
async fn sealed_only(
    host: &StandIn,
    actor: &ActorKey,
    proposal: Proposal,
    nonce_seed: u8,
) -> (PreSigned, SealedAct) {
    let pre = PreSigned::sign_with_nonces(
        actor,
        proposal,
        run(nonce_seed, 32),
        run(nonce_seed.wrapping_add(100), 32),
    );
    let sealed = host.seal(pre.submission()).await.expect("seals");
    (pre, sealed)
}

fn registration(actor: &ActorKey) -> Proposal {
    Proposal {
        body: body(
            actor,
            0,
            Family::Registration,
            None,
            NodeId::Prof(actor.address()),
        ),
        payload: b"profile".to_vec(),
        deps: vec![],
    }
}

/// An Opinion of `actor` toward `toward`'s profile that declares a
/// dependency on `after`.
fn opinion_after(actor: &ActorKey, toward: &ActorKey, after: &PreSigned) -> Proposal {
    Proposal {
        body: body(
            actor,
            0,
            Family::Opinion,
            None,
            NodeId::Prof(toward.address()),
        ),
        payload: vec![],
        deps: vec![after.act_id()],
    }
}

/// The approval a device formed before the approval covered the act
/// alone: over the encoded verified act and its host seal.
fn sealed_act_approval(actor: &ActorKey, sealed: &SealedAct) -> Vec<u8> {
    crypto::sign_digest(
        &SigningKey::from_bytes(&actor.seed()),
        &approval_digest(
            ApprovalForm::ActAndSeal,
            &sealed.act.frame(),
            &sealed.host_seal,
        ),
    )
}

/// Approves a sealed act as the stand-in did before the migration: the
/// witness over the verified act and its seal, stored with the act.
async fn approve_before(pool: &PgPool, actor: &ActorKey, pre: &PreSigned, sealed: &SealedAct) {
    sqlx::query(
        "UPDATE l1_acts SET status = 'approved', approval_signature = $2, approved_at = NOW()
          WHERE act_id = $1 AND status = 'sealed'",
    )
    .bind(pre.act_id().to_string())
    .bind(sealed_act_approval(actor, sealed))
    .execute(pool)
    .await
    .expect("approved in form 1");
}

fn published(package: &EpochPackage) -> Vec<String> {
    let mut ids: Vec<String> = package.records.iter().map(|r| r.act_id.to_string()).collect();
    ids.sort();
    ids
}

fn ids(acts: &[&PreSigned]) -> Vec<String> {
    let mut ids: Vec<String> = acts.iter().map(|a| a.act_id().to_string()).collect();
    ids.sort();
    ids
}

/// Asserts every record of `package` verifies in the form the package
/// states and in no other.
fn verifies_in_its_form_only(package: &EpochPackage, host_key: &[u8]) {
    let other = match package.closure.approval_form {
        ApprovalForm::Act => ApprovalForm::ActAndSeal,
        ApprovalForm::ActAndSeal => ApprovalForm::Act,
    };
    for record in &package.records {
        assert_eq!(
            verify_from_record(record, package.closure.approval_form, host_key),
            Ok(()),
            "epoch {}: {}",
            package.epoch,
            record.act_id
        );
        assert_eq!(
            verify_from_record(record, other, host_key),
            Err(Unverified::Approval),
            "epoch {}: {}",
            package.epoch,
            record.act_id
        );
    }
}

/// A populated stand-in migrates, no approved act loses its approval, and
/// every epoch has exactly one approval form. Before the migration the
/// world holds a closed epoch that accepted an act approved over the
/// verified act and its seal; an act approved that way that no epoch has
/// accepted yet (bob); one approved that way whose declared dependency is
/// still only sealed (dave, after carol); and that sealed act. After it the
/// closed epoch states form 1 and still verifies in it. Bob lands in an
/// epoch of form 1 of his own, while carol and erin — approved in form 2
/// after the migration, erin depending on bob — wait; dave's form-1 attempt
/// orders nothing while carol is out of history, so the next epoch is of
/// form 2 and lands carol and erin, erin after bob; dave then lands in an
/// epoch of form 1, and the close after that is of form 2 again. Every
/// record verifies in its own epoch's form and in no other, an act past
/// approval holds its witness for good, and no close can leave its form
/// unstated.
///
/// A populated stand-in migrates with one approval form per epoch; acts approved in the old form keep their approval and land in old-form epochs.
/// ´claim:standin:a-populated-world-migrates-with-one-approval-form-per-epoch´
#[sqlx::test(migrations = false)]
async fn a_populated_world_migrates_with_one_approval_form_per_epoch(pool: PgPool) {
    apply_migrations(&pool, |name| name < UNDER_TEST).await;
    let host = standin(pool.clone());
    let alice = funded_actor(&host).await;
    let bob = funded_actor(&host).await;
    let carol = funded_actor(&host).await;
    let dave = funded_actor(&host).await;
    let erin = funded_actor(&host).await;
    let (accepted, accepted_sealed) = sealed_only(&host, &alice, registration(&alice), 21).await;
    let (bob_act, bob_sealed) = sealed_only(&host, &bob, registration(&bob), 23).await;
    let (carol_act, _) = sealed_only(&host, &carol, registration(&carol), 25).await;
    let (dave_act, dave_sealed) =
        sealed_only(&host, &dave, opinion_after(&dave, &carol, &carol_act), 27).await;

    sqlx::query(
        "INSERT INTO l1_epochs (epoch, act_count, theta_charged_micro, closure_cause,
                                marker_policy, marker_edition, target_acts, min_duration_secs)
         VALUES (1, 1, $1, 'duration', 'marker', 1, 10000, 0)",
    )
    .bind(THETA)
    .execute(&pool)
    .await
    .expect("the closed epoch, as it stood");
    approve_before(&pool, &alice, &accepted, &accepted_sealed).await;
    sqlx::query(
        "UPDATE l1_acts SET status = 'accepted', epoch = 1, act_time = 1, position = 1,
                content_salt = NULL
          WHERE act_id = $1",
    )
    .bind(accepted.act_id().to_string())
    .execute(&pool)
    .await
    .expect("accepted in epoch 1");
    sqlx::query(
        "INSERT INTO l1_act_legs (act_id, leg, source, target, p_d, p_i, tau)
         VALUES ($1, 'binary', $2, $3, 1, 1, 0)",
    )
    .bind(accepted.act_id().to_string())
    .bind(accepted.proposal.body.source().to_string())
    .bind(accepted.proposal.body.target.to_string())
    .execute(&pool)
    .await
    .expect("its leg");
    approve_before(&pool, &bob, &bob_act, &bob_sealed).await;
    approve_before(&pool, &dave, &dave_act, &dave_sealed).await;

    apply_migrations(&pool, |name| name >= UNDER_TEST).await;

    let host = standin(pool.clone());
    let host_key = host.host_public_key().await.expect("host key");
    let closed = host.epochs_since(0).await.expect("the closed epoch");
    assert_eq!(closed.len(), 1);
    assert_eq!(closed[0].closure.approval_form, ApprovalForm::ActAndSeal);
    verifies_in_its_form_only(&closed[0], &host_key);

    let approved: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM l1_acts
          WHERE status = 'approved' AND approval_form = 1 AND approval_signature IS NOT NULL",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(approved, 2, "bob and dave keep their approval");

    let carol_stored = host
        .sealed_act(&carol_act.act_id())
        .await
        .expect("read")
        .and_then(|act| act.sealed)
        .expect("carol's sealed act is still served");
    let witness = carol_act
        .approve(&carol, &carol_stored, &host_key)
        .expect("approves");
    host.approve(witness).await.expect("taken in form 2");
    let (erin_act, _, _) = land(&host, &erin, opinion_after(&erin, &bob, &bob_act), 29).await;

    let mut epochs = Vec::new();
    for _ in 0..4 {
        epochs.push(host.close_epoch().await.expect("closes"));
    }
    let forms: Vec<ApprovalForm> = epochs.iter().map(|p| p.closure.approval_form).collect();
    assert_eq!(
        forms,
        [
            ApprovalForm::ActAndSeal,
            ApprovalForm::Act,
            ApprovalForm::ActAndSeal,
            ApprovalForm::Act,
        ]
    );
    assert_eq!(published(&epochs[0]), ids(&[&bob_act]));
    assert_eq!(published(&epochs[1]), ids(&[&carol_act, &erin_act]));
    assert_eq!(published(&epochs[2]), ids(&[&dave_act]));
    assert!(epochs[3].records.is_empty());
    for package in &epochs {
        verifies_in_its_form_only(package, &host_key);
    }
    let read_back = host.epochs_since(0).await.expect("epochs");
    assert_eq!(read_back[0], closed[0]);
    assert_eq!(&read_back[1..], epochs.as_slice());

    let violated = sqlx::query("UPDATE l1_acts SET approval_signature = NULL WHERE act_id = $1")
        .bind(accepted.act_id().to_string())
        .execute(&pool)
        .await
        .expect_err("an accepted act keeps its witness");
    assert!(
        violated
            .to_string()
            .contains("l1_acts_approved_holds_witness"),
        "{violated}"
    );
    let unstated = sqlx::query(
        "INSERT INTO l1_epochs (epoch, act_count, theta_charged_micro, closure_cause,
                                marker_policy, marker_edition, target_acts, min_duration_secs)
         VALUES (6, 0, $1, 'duration', 'marker', 1, 10000, 0)",
    )
    .bind(THETA)
    .execute(&pool)
    .await
    .expect_err("a close states its form");
    assert!(unstated.to_string().contains("approval_form"), "{unstated}");
}
