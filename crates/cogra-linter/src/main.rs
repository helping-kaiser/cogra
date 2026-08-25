//! The cogra-lint binary: argument parsing, exit codes, and the timing
//! report (´model:lint:module-map´).
//!
//! Three modes, and the split between them is what makes each safe: a check
//! that writes nothing, an explicit mode that regenerates in place
//! (´[ARCH-rule:linter:register-freshness]´), and a measurement that judges
//! nothing (´dec:lint:migrations-subcommand´).
//!
//! # Exit codes
//!
//! `0` is a clean corpus, `1` is findings on the failing set
//! (´dec:lint:enforcement-partition´), and `2` is the linter's own failure —
//! a malformed adoption file, an unusable root, a write that failed. That
//! findings and crashes are different codes is what lets a CI lane tell "the
//! corpus is wrong" from "the linter is broken", and the concept names that
//! distinction as a consumer requirement (´sig:lint:consumers´).
//!
//! `anyhow` appears here and nowhere else in the crate, which is the
//! documented division: `thiserror` for a library's typed surface, `anyhow`
//! for a binary that only wants to print what went wrong and exit `2`
//! (´sig:lint:error-taxonomy´).

use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

use cogra_linter::registers::{Register, Scope, committed, compare, regenerate_all, write_all};
use cogra_linter::{Adoption, Diagnostic, OwnerId, Phase, ProfileId, migrate, render};

/// The corpus linter.
#[derive(Debug, Parser)]
#[command(name = "cogra-lint", version, about = "The cogra corpus linter")]
struct Cli {
    /// The corpus root. Defaults to the working directory.
    #[arg(long, default_value = ".", global = true)]
    root: PathBuf,
    /// The adoption data. Defaults to `<root>/corpus-adoption.toml`.
    #[arg(long, global = true)]
    adoption: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

/// The three modes.
#[derive(Debug, Subcommand)]
enum Command {
    /// Check the corpus. Writes nothing, ever.
    Check {
        /// Report advisory findings too. Off by default.
        #[arg(long)]
        advisory: bool,
    },
    /// Regenerate every generated register in place.
    Regenerate {
        /// Restrict to one owner.
        #[arg(long)]
        owner: Option<String>,
        /// Report what would change and write nothing.
        #[arg(long)]
        dry_run: bool,
    },
    /// Report how far each staged profile's migration still has to travel.
    Migrations {
        /// Restrict to one staged profile.
        #[arg(long)]
        profile: Option<String>,
    },
}

/// A clean corpus.
const CLEAN: u8 = 0;

/// Findings on the failing set.
const FINDINGS: u8 = 1;

/// The linter's own failure.
const BROKEN: u8 = 2;

fn main() -> ExitCode {
    match run() {
        Ok(code) => ExitCode::from(code),
        Err(problem) => {
            eprintln!("cogra-lint: {problem:#}");
            ExitCode::from(BROKEN)
        }
    }
}

/// One invocation, from arguments to exit code.
fn run() -> Result<u8> {
    let cli = Cli::parse();
    let at = cli
        .adoption
        .clone()
        .unwrap_or_else(|| cli.root.join("corpus-adoption.toml"));
    let adoption =
        Adoption::load(&at).with_context(|| format!("the adoption data at {}", at.display()))?;

    match &cli.command {
        Command::Check { advisory } => check(&adoption, &cli.root, *advisory),
        Command::Regenerate { owner, dry_run } => {
            regenerate(&adoption, &cli.root, owner.as_deref(), *dry_run)
        }
        Command::Migrations { profile } => migrations(&adoption, &cli.root, profile.as_deref()),
    }
}

/// The check: the findings on the failing set, the advisory half counted,
/// and the per-phase report (´req:lint:timing´).
fn check(a: &Adoption, root: &Path, advisory: bool) -> Result<u8> {
    let mut checked = cogra_linter::check(a, root)
        .with_context(|| format!("checking the corpus at {}", root.display()))?;

    let rendering = Instant::now();
    let listed: Vec<&Diagnostic> = if advisory {
        checked.findings.iter().collect()
    } else {
        checked.failing().collect()
    };
    let body = render::report(&listed);
    let summary = render::summary(&checked.findings, checked.sources.len());
    checked.timing.record(Phase::Render, rendering.elapsed());

    if !body.is_empty() {
        println!("{body}");
    }
    println!("{summary}");
    println!("{}", render::timing(&checked.timing));
    Ok(if checked.is_clean() { CLEAN } else { FINDINGS })
}

/// The regeneration mode: the one generator's output, reported and written.
fn regenerate(a: &Adoption, root: &Path, owner: Option<&str>, dry_run: bool) -> Result<u8> {
    let checked = cogra_linter::check(a, root)
        .with_context(|| format!("checking the corpus at {}", root.display()))?;
    let scope = owner.map_or(Scope::WholeCorpus, |one| Scope::Owner(OwnerId::new(one)));
    let regs: Vec<Register> = regenerate_all(
        &checked.graph,
        &checked.registries,
        a,
        checked.kinds.as_ref(),
    )
    .into_iter()
    .filter(|reg| scope.admits(reg))
    .collect();

    for reg in &regs {
        let (held, _) = committed(reg, &checked.sources);
        println!("{}", render::freshness(reg, &compare(reg, held)));
    }
    if dry_run {
        println!("{} registers, nothing written", regs.len());
        return Ok(CLEAN);
    }

    let writing = Instant::now();
    let written = write_all(&regs, &scope, root)?;
    println!(
        "{} files written in {:?}",
        written.paths.len(),
        writing.elapsed()
    );
    for path in &written.paths {
        println!("  {}", path.display());
    }
    Ok(CLEAN)
}

/// The measurement: what each staged profile's entry condition still wants.
///
/// It always exits `0` on a corpus it could read, because it reports no
/// verdict — a distance is a fact, and a fact is not a failure.
fn migrations(a: &Adoption, root: &Path, profile: Option<&str>) -> Result<u8> {
    let wanted = profile.map(ProfileId::new);
    let measuring = Instant::now();
    let found = migrate::distances(a, root, wanted.as_ref())
        .with_context(|| format!("measuring the migrations at {}", root.display()))?;
    let measured = measuring.elapsed();

    if found.is_empty() {
        println!("no staged profile to measure");
    }
    for one in &found {
        println!(
            "profile {} · kind {} · {} covered assets · {} remaining",
            one.profile.as_str(),
            one.kind.as_str(),
            one.covered,
            one.remaining.len()
        );
        println!("  enters when: {}", one.enters_when);
        for step in &one.remaining {
            println!(
                "  {}:{}:{}: {}",
                step.at.path.display(),
                step.at.line,
                step.at.column,
                step.note
            );
        }
    }
    println!("measured in {measured:?}");
    Ok(CLEAN)
}
