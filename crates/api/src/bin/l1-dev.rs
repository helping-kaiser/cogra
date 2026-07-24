//! l1-dev — the slice-0 hand-test driver (roadmap.md Slice 0: "submit a
//! signed record through the boundary, watch ingestion land it in the
//! mirror"). Plays the device until the Android client exists (slice 1):
//! generates actor keys, runs both signing steps of the admission
//! handshake, and drives the stand-in's dev-only surfaces (burn credit,
//! epoch close) plus mirror ingestion.
//!
//! Usage:
//!   l1-dev keygen
//!   l1-dev burn <address> <micro>
//!   l1-dev submit <seed-hex> <family> <target> [middle] [p_d] [p_i] [payload]
//!   l1-dev close
//!   l1-dev ingest
//!   l1-dev rebuild
//!   l1-dev balance <address>
//!   l1-dev status

use anyhow::{Context, bail};
use api::l1::StandInBoundary;
use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::NodeId;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::mirror;

use api::ingest::DEFAULT_GC_AFTER_EPOCHS as GC_AFTER_EPOCHS;

async fn connect() -> anyhow::Result<(postgres_store::PgPool, StandIn)> {
    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL must be set (see .env.example)")?;
    let pool = postgres_store::connect(&database_url).await?;
    postgres_store::run_migrations(&pool).await?;
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    Ok((pool, standin))
}

fn parse_seed(hex_seed: &str) -> anyhow::Result<ActorKey> {
    let bytes = hex::decode(hex_seed).context("seed must be hex")?;
    let seed: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| anyhow::anyhow!("seed must be 32 bytes of hex"))?;
    Ok(ActorKey::from_seed(seed))
}

/// What the operator asked to submit; `seq` is probed at submit time.
struct SubmitArgs {
    family: Family,
    target: NodeId,
    middle: Option<NodeId>,
    p_d: f64,
    p_i: f64,
    payload: Vec<u8>,
}

/// The author's next unused sequence value is found by probing: the dev
/// tool counts upward from 0 until seal accepts. Good enough for a hand
/// tool.
async fn submit(standin: &StandIn, actor: &ActorKey, args: SubmitArgs) -> anyhow::Result<()> {
    let host_key = standin.host_public_key().await?;
    for seq in 0..u16::MAX as u64 {
        let proposal = Proposal {
            body: StructuralBody {
                author: actor.address(),
                seq,
                family: args.family,
                middle: args.middle.clone(),
                target: args.target.clone(),
                p_d: args.p_d,
                p_i: args.p_i,
                settlement_ref: None,
                license: None,
                asserted_parents: vec![],
            },
            payload: args.payload.clone(),
            deps: vec![],
        };
        let act_id = proposal.body.act_id();
        let pre = actor.pre_sign(proposal);
        match standin.seal(pre.clone()).await {
            Ok(sealed) => {
                let witness = actor
                    .approve(&pre, &sealed, &host_key)
                    .map_err(|e| anyhow::anyhow!("client-side approval failed: {e}"))?;
                standin.approve(witness).await?;
                println!("approved: {act_id}");
                return Ok(());
            }
            Err(l1_standin::StandInError::Conflict(_)) => continue, // seq taken
            Err(e) => bail!("seal rejected: {e}"),
        }
    }
    bail!("no free sequence value found")
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // .env first, so plain `cargo run` matches the make targets; real
    // environment variables win over file values (dotenvy never overrides).
    dotenvy::dotenv().ok();
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("help");
    match cmd {
        "keygen" => {
            let key = ActorKey::generate();
            println!("seed    : {}", hex::encode(key.seed()));
            println!("address : {}", key.address());
        }
        "burn" => {
            let (_, standin) = connect().await?;
            let address = args.get(1).context("usage: burn <address> <micro>")?;
            let micro: i64 = args
                .get(2)
                .context("usage: burn <address> <micro>")?
                .parse()?;
            standin.credit_burn(address, micro).await?;
            println!("credited {micro} micro to {address}");
        }
        "submit" => {
            let (_, standin) = connect().await?;
            let key = parse_seed(args.get(1).context(
                "usage: submit <seed-hex> <family> <target> [middle] [p_d] [p_i] [payload]",
            )?)?;
            let family =
                Family::parse(args.get(2).context("family required")?).context("unknown family")?;
            let target = NodeId::parse(args.get(3).context("target required")?)
                .map_err(|e| anyhow::anyhow!("target: {e}"))?;
            let middle = args
                .get(4)
                .filter(|s| !s.is_empty())
                .map(|m| NodeId::parse(m).map_err(|e| anyhow::anyhow!("middle: {e}")))
                .transpose()?;
            let p_d: f64 = args.get(5).map(|s| s.parse()).transpose()?.unwrap_or(1.0);
            let p_i: f64 = args.get(6).map(|s| s.parse()).transpose()?.unwrap_or(1.0);
            let payload = args
                .get(7)
                .map(|s| s.as_bytes().to_vec())
                .unwrap_or_default();
            submit(
                &standin,
                &key,
                SubmitArgs {
                    family,
                    target,
                    middle,
                    p_d,
                    p_i,
                    payload,
                },
            )
            .await?;
        }
        "close" => {
            let (_, standin) = connect().await?;
            match standin.close_epoch().await? {
                Some(package) => println!(
                    "epoch {} closed with {} record(s)",
                    package.epoch,
                    package.records.len()
                ),
                None => println!("nothing orderable — no epoch closed"),
            }
        }
        "ingest" => {
            let (pool, standin) = connect().await?;
            let outcome =
                api::ingest::ingest_pending(&StandInBoundary(standin), &pool, GC_AFTER_EPOCHS)
                    .await?;
            println!(
                "{} epoch(s) ingested; mirror cursor at {}",
                outcome.epochs,
                mirror::last_ingested_epoch(&pool).await?
            );
        }
        "rebuild" => {
            let (pool, standin) = connect().await?;
            mirror::reset(&pool).await?;
            let outcome =
                api::ingest::ingest_pending(&StandInBoundary(standin), &pool, GC_AFTER_EPOCHS)
                    .await?;
            println!(
                "mirror rebuilt from the published sequence: {} epoch(s)",
                outcome.epochs
            );
        }
        "balance" => {
            let (_, standin) = connect().await?;
            let address = args.get(1).context("usage: balance <address>")?;
            let b = standin.balance(address).await?;
            println!(
                "B_i {:.6}  b_i {:.6}  N_i {}",
                b.burned_total, b.balance, b.action_count
            );
        }
        "status" => {
            let (pool, _) = connect().await?;
            let cursor = mirror::last_ingested_epoch(&pool).await?;
            println!("mirror cursor: epoch {cursor}");
            for epoch in 0..=cursor {
                let ids = mirror::record_ids_in_epoch(&pool, epoch).await?;
                println!("  epoch {epoch}: {} record(s)", ids.len());
                for id in ids {
                    println!("    {id}");
                }
            }
        }
        _ => {
            println!(
                "l1-dev — slice-0 hand-test driver\n\
                 commands: keygen | burn | submit | close | ingest | rebuild | balance | status"
            );
        }
    }
    Ok(())
}
