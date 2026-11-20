//! The replay floor across the seam: the genesis acts — signed from the
//! custodied keys — verify from their published records alone, like any
//! client-signed act (l1-standin's `replay_floor` suite), and a mirror that
//! took its records in before the published record carried the floor is
//! filled by the next ingestion pass, from the published packages read back
//! through the seam (data-model.md "The record mirror").
//!
//! **Budget: this suite runs in ≤ 15 s.** Each test bootstraps a genesis
//! world into its own database.

use api::bootstrap::{GenesisInput, run};
use api::l1::{L1Boundary, StandInBoundary};
use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::crypto::{self, tags};
use common::l1::handshake::{PublishedRecord, approval_digest, seal_message};
use common::l1::identifier::NodeId;
use common::l1::proposal::{CONTENT_EDITION, DEPENDENCY_EDITION};
use l1_standin::{StandIn, StandInConfig};
use postgres_store::mirror;
use sqlx::PgPool;

fn input() -> GenesisInput {
    GenesisInput {
        handle: "operator".into(),
        display_name: "The Operator".into(),
        guidelines_version: "1".into(),
        guidelines_hash: "deadbeef".into(),
        burn_per_account_micro: 10_000_000,
    }
}

fn standin(pool: &PgPool) -> StandIn {
    StandIn::new(pool.clone(), StandInConfig::default())
}

/// Verifies one published record from its own fields and the published
/// host key — the author key binds to the author, the body is the record's
/// act and its legs the body's projection, and the pre-signature, the host
/// seal and the approval witness each verify — and names the first member
/// that does not.
fn verify_from_record(record: &PublishedRecord, host_key: &[u8]) -> Result<(), &'static str> {
    let auth = &record.authentication;
    let author_key =
        crypto::verifying_key_from_bytes(&auth.author_pubkey).ok_or("author key malformed")?;
    if crypto::address_of(&author_key) != record.author {
        return Err("author key is not the author's");
    }
    if auth.body.act_id() != record.act_id {
        return Err("body is another act");
    }
    let legs: Vec<(LegRole, NodeId, NodeId)> = record
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
    if legs != projected {
        return Err("legs are not the body's projection");
    }
    let pre_commitment: [u8; 32] = auth
        .pre_commitment
        .as_slice()
        .try_into()
        .map_err(|_| "pre-commitment is not a digest")?;
    if !crypto::verify_digest(&author_key, &pre_commitment, &auth.pre_signature) {
        return Err("pre-signature");
    }
    let verified_act = seal_message(&record.seal_frame());
    let host = crypto::verifying_key_from_bytes(host_key).ok_or("host key malformed")?;
    if !crypto::verify(&host, tags::HOST_SEAL, &verified_act, &auth.host_seal) {
        return Err("host seal");
    }
    if !crypto::verify_digest(
        &author_key,
        &approval_digest(&verified_act, &auth.host_seal),
        &auth.approval_signature,
    ) {
        return Err("approval witness");
    }
    Ok(())
}

/// Every genesis act — the Registrations, the endorsement Opinions, The
/// Charter with its payload and the role Tag with its two legs — is
/// published at the floor and verifies from its record alone, under the
/// formation editions the host seals with; the package binds the empty
/// set of verification-case declarations.
///
/// Every genesis act verifies from its published record alone, as a client-signed act does.
/// ´claim:bootstrap:every-genesis-act-verifies-from-its-published-record´
#[sqlx::test(migrations = "../../migrations")]
async fn every_genesis_act_verifies_from_its_published_record(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("bootstraps");
    let boundary = StandInBoundary(host);
    let host_key = boundary.host_public_key().await.expect("host key");
    let packages = boundary.epochs_since(0).await.expect("published");
    assert_eq!(packages.len(), 1);
    let genesis = &packages[0];
    assert_eq!(genesis.records.len(), 8);
    for record in &genesis.records {
        assert_eq!(
            verify_from_record(record, &host_key),
            Ok(()),
            "{}",
            record.act_id
        );
        assert_eq!(
            (
                record.authentication.content_edition,
                record.authentication.dependency_edition
            ),
            (CONTENT_EDITION, DEPENDENCY_EDITION)
        );
    }
    for family in [
        Family::Registration,
        Family::Opinion,
        Family::Publish,
        Family::Tag,
    ] {
        assert!(
            genesis.records.iter().any(|r| r.family == family),
            "the genesis publishes a {family}"
        );
    }
    assert!(
        genesis
            .records
            .iter()
            .any(|r| r.family == Family::Tag && r.legs.len() == 2),
        "a hyper-edge with both legs"
    );
    assert_eq!(genesis.closure.case_declarations, vec![]);
}

/// Empties the replay-floor columns of every mirrored record — the state
/// the floor migration leaves a mirror that ingested before it.
async fn as_mirrored_before_the_floor(pool: &PgPool) {
    sqlx::query(
        "UPDATE mirror_records
            SET body = NULL, author_pubkey = NULL, pre_commitment = NULL, pre_signature = NULL,
                dependency_commitment = NULL, content_edition = NULL, dependency_edition = NULL,
                host_seal = NULL, approval_signature = NULL",
    )
    .execute(pool)
    .await
    .expect("empties the floor columns");
}

/// What the mirror holds of one record's floor, as the bytes and editions
/// it stored.
async fn mirrored_floor(
    pool: &PgPool,
    record_id: &str,
) -> (
    Option<Vec<u8>>,
    Option<Vec<u8>>,
    Option<Vec<u8>>,
    Option<i64>,
) {
    sqlx::query_as(
        "SELECT body, host_seal, approval_signature, content_edition
         FROM mirror_records WHERE record_id = $1",
    )
    .bind(record_id)
    .fetch_one(pool)
    .await
    .expect("mirrored")
}

/// A deployed API whose mirror ingested its epochs before the record
/// carried the floor holds the columns empty after the migration; the next
/// ingestion pass — with no new epoch to take in — fills every record from
/// the published package it re-reads through the seam, byte for byte, and
/// the pass after it finds nothing left to fill.
///
/// The next ingestion pass fills a mirror taken in before the floor from the published sequence, through the seam.
/// ´claim:ingest:the-next-pass-fills-the-mirrors-replay-floor´
#[sqlx::test(migrations = "../../migrations")]
async fn the_next_pass_fills_the_mirrors_replay_floor(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("bootstraps");
    let boundary = StandInBoundary(host);
    as_mirrored_before_the_floor(&pool).await;
    assert_eq!(
        mirror::first_epoch_without_floor(&pool)
            .await
            .expect("probe"),
        Some(1)
    );

    let outcome =
        api::ingest::ingest_pending(&boundary, &pool, api::ingest::DEFAULT_GC_AFTER_EPOCHS)
            .await
            .expect("ingests");
    assert_eq!(outcome.epochs, 0, "no new epoch arrived");
    assert_eq!(
        mirror::first_epoch_without_floor(&pool)
            .await
            .expect("probe"),
        None
    );
    let published = boundary.epochs_since(0).await.expect("published");
    for record in &published[0].records {
        let auth = &record.authentication;
        assert_eq!(
            mirrored_floor(&pool, &record.act_id.to_string()).await,
            (
                Some(auth.body.canonical_bytes()),
                Some(auth.host_seal.clone()),
                Some(auth.approval_signature.clone()),
                Some(auth.content_edition as i64),
            ),
            "{}",
            record.act_id
        );
    }

    api::ingest::ingest_pending(&boundary, &pool, api::ingest::DEFAULT_GC_AFTER_EPOCHS)
        .await
        .expect("ingests again");
    assert_eq!(
        mirror::first_epoch_without_floor(&pool)
            .await
            .expect("probe"),
        None
    );
}
