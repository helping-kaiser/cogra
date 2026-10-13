//! release — the operator's release-registry CLI (api::registry;
//! development.md "The release CLI"). Not a request path: it writes the
//! registry rows `appVersions` serves, and lists them.
//!
//! Usage:
//!
//! ```text
//! release publish --component android|web|backend|ios [--component …]
//!                 --version 0.1.3 --notes-file notes.txt
//!                 [--patch-notes-url URL] [--released-by UUID …]
//!                 [--released-at RFC3339]
//! release list [--component …]
//! ```
//!
//! Publish a component's row only once that component's artifact is live:
//! the web build serving, the Android build available on its store track.

use anyhow::{Context, bail};
use api::registry::{self, AppComponent, PublishInput};
use postgres_store::registry::ReleaseCursor;

const USAGE: &str = "usage:
  release publish --component <android|web|backend|ios> [--component …] \\
                  --version <version> --notes-file <path> \\
                  [--patch-notes-url <url>] [--released-by <uuid> …] [--released-at <rfc3339>]
  release list [--component <android|web|backend|ios>]";

fn component(name: &str) -> anyhow::Result<AppComponent> {
    AppComponent::from_store(name)
        .with_context(|| format!("unknown component {name:?}: android, web, backend or ios"))
}

/// The value after a flag, or the usage when the flag ends the line.
fn value(args: &mut impl Iterator<Item = String>, flag: &str) -> anyhow::Result<String> {
    args.next()
        .with_context(|| format!("{flag} needs a value\n{USAGE}"))
}

fn parse_publish(mut args: impl Iterator<Item = String>) -> anyhow::Result<PublishInput> {
    let mut input = PublishInput::default();
    let mut notes_file = None;
    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--component" => input.components.push(component(&value(&mut args, &flag)?)?),
            "--version" => input.version = value(&mut args, &flag)?,
            "--notes-file" => notes_file = Some(value(&mut args, &flag)?),
            "--patch-notes-url" => input.patch_notes_url = Some(value(&mut args, &flag)?),
            "--released-by" => input.released_by.push(
                value(&mut args, &flag)?
                    .parse()
                    .context("--released-by takes an actor UUID")?,
            ),
            "--released-at" => {
                let at = chrono::DateTime::parse_from_rfc3339(&value(&mut args, &flag)?)
                    .context("--released-at takes an RFC 3339 timestamp")?;
                input.released_at = Some(at.with_timezone(&chrono::Utc));
            }
            other => bail!("unknown argument {other:?}\n{USAGE}"),
        }
    }
    let path = notes_file.with_context(|| format!("--notes-file is required\n{USAGE}"))?;
    input.notes =
        std::fs::read_to_string(&path).with_context(|| format!("reading the notes file {path}"))?;
    Ok(input)
}

async fn list(pool: &postgres_store::PgPool, only: Option<AppComponent>) -> anyhow::Result<()> {
    let mut cursor: Option<ReleaseCursor> = None;
    loop {
        let page = postgres_store::registry::list_releases(
            pool,
            only.map(AppComponent::as_store),
            cursor.as_ref(),
            false,
            100,
        )
        .await?;
        let Some(last) = page.last() else {
            return Ok(());
        };
        cursor = Some(last.cursor());
        for release in &page {
            println!(
                "{} {} {} {}",
                release.released_at.to_rfc3339(),
                release.component,
                release.version,
                release.patch_notes_url
            );
            for note in &release.notes {
                println!("    {note}");
            }
        }
    }
}

/// `.env` is read first, with the same precedence the server uses
/// (main.rs); `DATABASE_URL` names the registry the rows land in.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let mut args = std::env::args().skip(1);
    let command = args.next().with_context(|| USAGE.to_string())?;

    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL must be set (see .env.example)")?;
    let pool = postgres_store::connect(&database_url)
        .await
        .context("connecting to PostgreSQL")?;
    postgres_store::run_migrations(&pool)
        .await
        .context("running Postgres migrations")?;

    match command.as_str() {
        "publish" => {
            for row in registry::run(&pool, parse_publish(args)?).await? {
                println!(
                    "Published {} {} at {} — {}",
                    row.component.as_store(),
                    row.version,
                    row.released_at.to_rfc3339(),
                    row.patch_notes_url
                );
            }
            Ok(())
        }
        "list" => {
            let only = match (args.next().as_deref(), args.next()) {
                (None, None) => None,
                (Some("--component"), Some(name)) => Some(component(&name)?),
                _ => bail!("{USAGE}"),
            };
            if args.next().is_some() {
                bail!("{USAGE}");
            }
            list(&pool, only).await
        }
        _ => bail!("{USAGE}"),
    }
}
