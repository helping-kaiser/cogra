//! Instance-bootstrap orchestration — the both-stores genesis gate, lifted out
//! of the `bootstrap` binary so it is integration-testable.
//!
//! An instance is "bootstrapped" only when **both** stores carry their genesis
//! writes: the graph `:Network` singleton *and* the Postgres genesis `users`
//! row. The bootstrap commits the graph first, then Postgres
//! ([architecture.md "Partial-failure handling"](../../../docs/implementation/architecture.md)),
//! so the one reachable partial state is graph-committed / Postgres-empty. This
//! gate detects it and completes the Postgres half on a re-run, reusing the
//! genesis identity already committed to the graph (the graph `:User` node and
//! the Postgres `users` row share one id — the cross-store join key), instead
//! of minting a second genesis User.

use chrono::{Duration, Utc};
use common::hashtag::hashtag_uuid;
use common::wallet::placeholder_address;
use graph_engine::Graph;
use graph_engine::genesis::{GenesisInput, bootstrap, genesis_identity, is_bootstrapped};
use postgres_store::PgPool;
use postgres_store::genesis::{
    genesis_invitation_id, genesis_present, insert_genesis_invitation, insert_genesis_profile,
    insert_genesis_user,
};
use uuid::Uuid;

use crate::auth::policy::INVITE_EDGE_DEFAULT;

/// The genesis content supplied at run time. Identity ids are minted inside
/// [`run`] (fresh path) or read back from the graph (repair path); only the
/// display content and durations are passed in.
pub struct GenesisContent {
    pub username: String,
    pub email: String,
    pub hashtag_name: String,
    pub guidelines_hash: String,
    pub invite_ttl_days: i64,
}

/// Which path [`run`] took, with the bits the caller prints.
#[derive(Debug)]
pub enum BootstrapOutcome {
    /// Empty instance: both stores' genesis writes committed.
    Fresh {
        network_id: Uuid,
        user_id: Uuid,
        username: String,
        invite_link: Uuid,
    },
    /// Graph was committed but Postgres was empty: the Postgres half was
    /// completed against the existing graph identity.
    Repaired {
        user_id: Uuid,
        username: String,
        invite_link: Uuid,
    },
    /// Both stores already carried their genesis writes: nothing written, the
    /// existing invite link re-surfaced.
    AlreadyComplete { user_id: Uuid, invite_link: Uuid },
}

/// Runs the both-stores genesis gate. `password_hash` is evaluated lazily — only
/// the fresh and repair paths need it, so a re-run of a healthy instance never
/// requires the genesis password to be re-supplied.
pub async fn run(
    pool: &PgPool,
    graph: &Graph,
    content: &GenesisContent,
    password_hash: impl FnOnce() -> anyhow::Result<String>,
) -> anyhow::Result<BootstrapOutcome> {
    if !is_bootstrapped(graph).await? {
        return fresh(pool, graph, content, password_hash).await;
    }

    // The :Network singleton exists; resolve the genesis User it points at.
    let identity = genesis_identity(graph).await?.ok_or_else(|| {
        anyhow::anyhow!("graph reads bootstrapped but the genesis pointer vanished")
    })?;

    if genesis_present(pool, identity.user_id).await? {
        let invite_link = genesis_invitation_id(pool, identity.user_id)
            .await?
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "genesis User {} is present but owns no invite link; manual recovery needed",
                    identity.user_id
                )
            })?;
        return Ok(BootstrapOutcome::AlreadyComplete {
            user_id: identity.user_id,
            invite_link,
        });
    }

    // Partial failure: graph committed, Postgres empty. The graph's committed
    // username is authoritative — writing a different one would desync the
    // stores, so an explicit conflicting handle aborts rather than diverge.
    if content.username != identity.username {
        anyhow::bail!(
            "the committed genesis User is '{}', but GENESIS_USERNAME is '{}'; \
             re-run with GENESIS_USERNAME='{}' (or unset it) to complete the Postgres half",
            identity.username,
            content.username,
            identity.username,
        );
    }

    let password_hash = password_hash()?;
    let invite_link = write_postgres_half(
        pool,
        identity.user_id,
        &identity.username,
        &content.email,
        &password_hash,
        content.invite_ttl_days,
    )
    .await?;
    Ok(BootstrapOutcome::Repaired {
        user_id: identity.user_id,
        username: identity.username,
        invite_link,
    })
}

/// The empty-instance path: mint identity ids, write the graph genesis nodes
/// and the Postgres genesis rows across one dual-store transaction, graph
/// committed first (idempotent via `MERGE`) then Postgres.
async fn fresh(
    pool: &PgPool,
    graph: &Graph,
    content: &GenesisContent,
    password_hash: impl FnOnce() -> anyhow::Result<String>,
) -> anyhow::Result<BootstrapOutcome> {
    let password_hash = password_hash()?;
    let network_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();
    let wallet_address = placeholder_address(wallet_id);
    let hashtag_id = hashtag_uuid(&content.hashtag_name);

    let mut gtx = graph.start_txn().await?;
    bootstrap(
        &mut gtx,
        &GenesisInput {
            network_id,
            user_id,
            username: content.username.clone(),
            wallet_id,
            wallet_address,
            hashtag_id,
            hashtag_name: content.hashtag_name.clone(),
            guidelines_hash: content.guidelines_hash.clone(),
        },
    )
    .await?;

    let invite_link = {
        let mut ptx = pool.begin().await?;
        insert_genesis_user(
            &mut ptx,
            user_id,
            &content.username,
            &content.email,
            &password_hash,
        )
        .await?;
        insert_genesis_profile(&mut ptx, user_id, &content.username).await?;
        let invite_link = insert_genesis_invitation(
            &mut ptx,
            user_id,
            INVITE_EDGE_DEFAULT,
            INVITE_EDGE_DEFAULT,
            Utc::now() + Duration::days(content.invite_ttl_days),
        )
        .await?;
        gtx.commit().await?;
        ptx.commit().await?;
        invite_link
    };

    Ok(BootstrapOutcome::Fresh {
        network_id,
        user_id,
        username: content.username.clone(),
        invite_link,
    })
}

/// Writes the three genesis Postgres rows in one transaction, reusing an
/// already-committed `user_id`. Used by the repair path; the fresh path inlines
/// the same writes alongside its graph transaction.
async fn write_postgres_half(
    pool: &PgPool,
    user_id: Uuid,
    username: &str,
    email: &str,
    password_hash: &str,
    invite_ttl_days: i64,
) -> anyhow::Result<Uuid> {
    let mut ptx = pool.begin().await?;
    insert_genesis_user(&mut ptx, user_id, username, email, password_hash).await?;
    insert_genesis_profile(&mut ptx, user_id, username).await?;
    let invite_link = insert_genesis_invitation(
        &mut ptx,
        user_id,
        INVITE_EDGE_DEFAULT,
        INVITE_EDGE_DEFAULT,
        Utc::now() + Duration::days(invite_ttl_days),
    )
    .await?;
    ptx.commit().await?;
    Ok(invite_link)
}
