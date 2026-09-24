//! The cogra-lint binary: argument parsing, exit codes, and the timing
//! report (´model:lint:module-map´).
//!
//! Five modes, and the split between them is what makes each safe: a check
//! that writes nothing, an explicit mode that regenerates in place
//! (´[ARCH-rule:linter:register-freshness]´), a measurement that judges
//! nothing (´dec:lint:migrations-subcommand´), a sweep that writes one
//! profile's labels where its assets are (´dec:lint:fix-subcommand´), and a
//! report that describes the reference graph (´dec:lint:report-subcommand´).
//!
//! # Exit codes
//!
//! `0` is a clean corpus, `1` is findings on the failing set
//! (´dec:lint:enforcement-partition´), and `2` is the linter's own failure —
//! a malformed adoption file, an unusable root, a write that failed, a
//! precondition the sweep or the regeneration could not establish
//! (´dec:lint:fix-precondition´), (´dec:lint:regenerate-precondition´). That
//! findings and crashes are different codes is what lets a CI lane tell "the
//! corpus is wrong" from "the linter is broken", and the concept names that
//! distinction as a consumer requirement (´sig:lint:consumers´).
//!
//! Only the check reports a verdict, so only the check reaches `1`. The other
//! four exit `0` on any corpus they could read and `2` where they could not
//! read it or could not proceed — a refusal to run is not a finding about the
//! corpus, and a mode that graded its own listing would be inventing a
//! judgment the disciplines do not make.
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
use cogra_linter::{
    Adoption, Diagnostic, Label, OwnerId, Phase, ProfileId, Run, carrier, fix, migrate, render,
    report,
};

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

/// The five modes.
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
        /// Generate one registered profile's label registers from its own
        /// census, staged or in force.
        #[arg(long)]
        profile: Option<String>,
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
    /// Write one profile's derived labels at the standard place its covered
    /// assets themselves are.
    Fix {
        /// The profile to sweep.
        #[arg(long)]
        profile: String,
        /// Report what would be written and write nothing.
        #[arg(long)]
        dry_run: bool,
        /// Sweep even where a source it would rewrite carries uncommitted
        /// work.
        #[arg(long)]
        allow_dirty: bool,
    },
    /// Report the reference graph. Judges nothing and writes nothing.
    Report {
        /// Answer for one label instead: where it is minted, and every
        /// citation that reaches it.
        #[arg(long)]
        label: Option<String>,
        /// How many entries to name in each listing.
        #[arg(long, default_value_t = LISTED)]
        top: usize,
    },
}

/// How many entries a report names per listing when it is not told.
///
/// A screenful. The number is a default and not a limit: `--top` takes any
/// count, `--top 0` is the report with its listings left empty, and every
/// listing carries its whole count in its own header whatever the cut.
const LISTED: usize = 20;

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
        Command::Regenerate {
            owner,
            profile: Some(profile),
            dry_run,
        } => named(&adoption, &cli.root, owner.as_deref(), profile, *dry_run),
        Command::Regenerate {
            owner,
            profile: None,
            dry_run,
        } => regenerate(&adoption, &cli.root, owner.as_deref(), *dry_run),
        Command::Migrations { profile } => migrations(&adoption, &cli.root, profile.as_deref()),
        Command::Fix {
            profile,
            dry_run,
            allow_dirty,
        } => fix(&adoption, &cli.root, profile, *dry_run, *allow_dirty),
        Command::Report { label, top } => report(&adoption, &cli.root, label.as_deref(), *top),
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
///
/// A write is refused while the adoption data disagrees with the tree, and
/// only then (´dec:lint:regenerate-precondition´): a dry run writes nothing
/// and is never refused.
fn regenerate(a: &Adoption, root: &Path, owner: Option<&str>, dry_run: bool) -> Result<u8> {
    let checked = cogra_linter::check(a, root)
        .with_context(|| format!("checking the corpus at {}", root.display()))?;
    if !dry_run {
        refuse_incoherent_write(&checked)?;
    }
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

/// Refuse a regeneration whose adoption data disagrees with the tree
/// (´dec:lint:regenerate-precondition´).
///
/// The disagreeing findings are the carrier module's: a configured root the
/// walk found nothing under, and a tree or file it could not read. Under any
/// of them the registers would be generated from a carrier the run could not
/// account for, and a writer that proceeded would record as current a
/// conclusion drawn from a question the corpus had not answered. Every other
/// finding leaves the write alone — a stale register above all, which is
/// what regeneration exists to repair.
///
/// Only the failing set counts: the enforcement partition decides what
/// fails, and an advisory finding that stopped a writer would be a warning
/// deciding an exit code. The findings go to stderr and stdout stays empty,
/// the refusal class of (´dec:lint:fix-precondition´).
///
/// The mechanism is adapted from the L1 author's linter
/// (`orchestration-linter-0.1.0-416b136`, source commit 416b136,
/// AGPL-3.0-only), whose writing modes refuse under a declaration that
/// disagrees with the tree and never under a label or projection finding.
/// The shape is re-derived rather than copied: there the guard is a separate
/// verification pass, here it is a filter over the run the regeneration
/// already made.
fn refuse_incoherent_write(checked: &Run) -> Result<()> {
    let disagreeing: Vec<&Diagnostic> = checked
        .failing()
        .filter(|one| carrier::RULES.contains(&one.rule))
        .collect();
    if disagreeing.is_empty() {
        return Ok(());
    }
    eprintln!("{}", render::report(&disagreeing));
    let (count, say) = match disagreeing.len() {
        1 => (String::from("1 finding"), "says"),
        many => (format!("{many} findings"), "say"),
    };
    anyhow::bail!(
        "{count} {say} the adoption data disagrees with the tree, so no register is written; \
         repair them first (`cogra-lint check` lists them), or pass --dry-run to see what would change"
    )
}

/// The named regeneration: one profile's label registers, generated from its
/// own census while it is still staged (´dec:lint:staged-profiles´).
///
/// It judges nothing. A profile whose entry condition names its own registers
/// cannot meet it out of a run that computes nothing for it, so this mode
/// computes that profile's census by the machinery the measurement uses,
/// emits, and exits. The whole-corpus regeneration does not sweep a staged
/// profile up: generating its registers is a step in a migration, taken
/// deliberately and by name.
///
/// The committed bytes come from this mode's own read of the target. There is
/// no check behind a named regeneration to have read them, and nothing here
/// feeds a judgment — the read decides what a dry run reports and nothing
/// else, so it cannot make a register current against a file nobody linted
/// (´dec:lint:no-digest´).
fn named(
    a: &Adoption,
    root: &Path,
    owner: Option<&str>,
    profile: &str,
    dry_run: bool,
) -> Result<u8> {
    let id = ProfileId::new(profile);
    let registered = a
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == id)
        .with_context(|| format!("{profile} is not a profile `[profiles]` registers"))?;

    let census = migrate::census(a, root, &id)
        .with_context(|| format!("the census of {profile} at {}", root.display()))?;
    let covered: usize = census.values().map(Vec::len).sum();
    let scope = owner.map_or(Scope::WholeCorpus, |one| Scope::Owner(OwnerId::new(one)));
    let regs: Vec<Register> = cogra_linter::label_registers_of(a, registered, &census)
        .into_iter()
        .filter(|reg| scope.admits(reg))
        .collect();

    println!(
        "profile {profile} · {covered} covered assets · {} registers",
        regs.len()
    );
    if registered.standard_place.register.is_none() {
        println!("  its standard place is the asset itself, so it has no register to generate");
    }
    for reg in &regs {
        let held = std::fs::read(root.join(&reg.path)).ok();
        println!(
            "{} · {} bytes",
            render::freshness(reg, &compare(reg, held.as_deref())),
            reg.bytes.len()
        );
    }
    if dry_run {
        println!("nothing written");
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
    let wanted = match profile {
        Some(name) => {
            let id = ProfileId::new(name);
            a.profiles
                .profiles
                .iter()
                .find(|one| one.id == id)
                .with_context(|| format!("{name} is not a profile `[profiles]` registers"))?;
            Some(id)
        }
        None => None,
    };
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

/// The sweep: one profile's derived labels, written where its covered assets
/// are (´dec:lint:fix-subcommand´).
///
/// Two refusals stand in front of it, and both are refusals to *run* rather
/// than verdicts about the corpus: a profile whose standard place is a
/// generated register, which the named regeneration writes and this mode
/// cannot, and a working tree carrying uncommitted work in the sources the
/// sweep would rewrite. Each exits `2` with nothing on stdout, because
/// nothing was examined and a report of no findings would say otherwise
/// (´dec:lint:fix-precondition´).
///
/// It reports no verdict of its own and so exits `0` on every corpus it could
/// sweep, exactly as the measurement does: what a covered asset missing its
/// label *means* is the inventory judgment's to say, and `check` says it.
fn fix(a: &Adoption, root: &Path, profile: &str, dry_run: bool, allow_dirty: bool) -> Result<u8> {
    let id = ProfileId::new(profile);
    let registered = a
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == id)
        .with_context(|| format!("{profile} is not a profile `[profiles]` registers"))?;
    if registered.standard_place.register.is_some() {
        anyhow::bail!(
            "{profile}'s standard place is a generated register, which nothing is swept into: \
             `cogra-lint regenerate --profile {profile}` writes it"
        );
    }

    let sweeping = Instant::now();
    let sweep = fix::sweep(a, root, &id)
        .with_context(|| format!("sweeping {profile} at {}", root.display()))?;
    let swept = sweeping.elapsed();

    if !dry_run && !allow_dirty {
        let touched = sweep.touches();
        let dirty = fix::modified(root, &touched).with_context(|| {
            format!(
                "the working tree state of the {} sources this sweep would rewrite",
                touched.len()
            )
        })?;
        if !dirty.is_empty() {
            for path in &dirty {
                eprintln!("cogra-lint:   {}", path.display());
            }
            anyhow::bail!(
                "{} of the {} sources this sweep would rewrite carry uncommitted work; \
                 commit them first, or pass --allow-dirty",
                dirty.len(),
                touched.len()
            );
        }
    }

    println!(
        "profile {profile} · {} labels to place · swept in {swept:?}",
        sweep.writes.len()
    );
    for one in &sweep.writes {
        println!("  {}", render::insertion(one));
    }
    if sweep.settled() {
        println!("every covered asset carries its label at its own standard place");
        return Ok(CLEAN);
    }
    if dry_run {
        println!("nothing written");
        return Ok(CLEAN);
    }

    let writing = Instant::now();
    let written = fix::apply(&sweep, root)?;
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

/// The report: the reference graph of one completed run
/// (´dec:lint:report-subcommand´).
///
/// It describes and decides nothing, so it exits `0` however long its listing
/// runs — a mint nobody cites is ordinary, and a status that graded it would
/// be inventing a judgment. The one thing it refuses is a `--label` that is
/// not a well-formed label: asking for the citations of a token no occurrence
/// could carry is a mistake in the question, and answering "none" would hide
/// it. The parse happens before the run, so the refusal costs no walk.
fn report(a: &Adoption, root: &Path, label: Option<&str>, top: usize) -> Result<u8> {
    let wanted = match label {
        Some(text) => Some(Label::parse(text).map_err(|why| {
            anyhow::anyhow!(
                "{text} is not a well-formed label: the parse stopped at byte {} wanting {:?}",
                why.at,
                why.expected
            )
        })?),
        None => None,
    };
    let checked = cogra_linter::check(a, root)
        .with_context(|| format!("reading the corpus at {}", root.display()))?;

    match &wanted {
        Some(one) => print!("{}", render::reverse(one, &report::reverse(&checked, one))),
        None => print!("{}", render::survey(&report::survey(&checked, a, top))),
    }
    println!("{}", render::timing(&checked.timing));
    Ok(CLEAN)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The corpus's own adoption data, the ruled fixture the crate's other
    /// tests already load rather than hand-write a partial one.
    fn adoption() -> Adoption {
        let source = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../corpus-adoption.toml"
        ))
        .expect("the corpus's own adoption data");
        Adoption::from_str(&source, Path::new("corpus-adoption.toml")).expect("a ruled adoption")
    }

    /// An id no `[profiles]` row registers, refused before either subcommand
    /// touches the corpus root — so a root that does not exist is fine here.
    const UNREGISTERED: &str = "not-a-real-profile";

    /// (´dec:lint:staged-profiles´): the named regeneration refuses an id
    /// `[profiles]` does not register.
    ///
    /// An unregistered profile name is refused by the command line rather than measured.
    /// ´claim:cli:an-unregistered-profile-is-refused´
    #[test]
    fn a_named_regeneration_refuses_an_unregistered_profile() {
        let root = Path::new("does-not-need-to-exist");
        let err = named(&adoption(), root, None, UNREGISTERED, true)
            .expect_err("the id is not in `[profiles]`");
        assert!(
            format!("{err:#}")
                .contains("not-a-real-profile is not a profile `[profiles]` registers"),
            "{err:#}"
        );
    }

    /// (´dec:lint:staged-profiles´): the migrations measurement refuses the
    /// same unregistered id through the same lookup, rather than reporting
    /// nothing to measure.
    ///
    /// (´claim:cli:an-unregistered-profile-is-refused´)
    #[test]
    fn a_migrations_measurement_refuses_an_unregistered_profile() {
        let root = Path::new("does-not-need-to-exist");
        let err = migrations(&adoption(), root, Some(UNREGISTERED))
            .expect_err("the id is not in `[profiles]`");
        assert!(
            format!("{err:#}")
                .contains("not-a-real-profile is not a profile `[profiles]` registers"),
            "{err:#}"
        );
    }

    /// A run over no sources, carrying exactly one finding of `rule`.
    fn run_with(rule: cogra_linter::RuleId, enforcement: cogra_linter::Enforcement) -> Run {
        let mut run = cogra_linter::check_sources(&adoption(), Vec::new());
        run.findings.clear();
        run.findings.push(Diagnostic {
            rule,
            severity: cogra_linter::Severity::Error,
            enforcement,
            primary: cogra_linter::Location::new(
                PathBuf::from("docs/"),
                cogra_linter::ByteSpan::new(0, 0),
                1,
                1,
            ),
            related: Vec::new(),
            message: String::from("a finding"),
        });
        run
    }

    /// (´dec:lint:regenerate-precondition´): every rule of the carrier module
    /// is a disagreement between the adoption data and the tree, and each one
    /// on the failing set refuses the write.
    ///
    /// A carrier the run could not account for refuses the regeneration's write.
    /// ´claim:cli:a-disagreeing-carrier-refuses-the-write´
    #[test]
    fn a_disagreeing_carrier_refuses_the_write() {
        for rule in carrier::RULES {
            let run = run_with(rule, cogra_linter::Enforcement::Failing);
            let err = refuse_incoherent_write(&run).expect_err("the carrier disagrees");
            assert!(
                format!("{err:#}").contains("disagrees with the tree"),
                "{rule}: {err:#}"
            );
        }
    }

    /// (´dec:lint:regenerate-precondition´): a stale register fails the check
    /// and is exactly what regeneration repairs, so it never refuses the write.
    ///
    /// A stale register leaves the regeneration's write alone.
    /// ´claim:cli:a-stale-register-does-not-refuse-the-write´
    #[test]
    fn a_stale_register_does_not_refuse_the_write() {
        let run = run_with(
            cogra_linter::judge::freshness::STALE,
            cogra_linter::Enforcement::Failing,
        );
        assert!(!run.is_clean(), "the stale register fails the check");
        assert!(refuse_incoherent_write(&run).is_ok());
    }

    /// (´dec:lint:regenerate-precondition´): only the failing set decides, so
    /// a disagreement outside it is reported by the check and refuses nothing.
    ///
    /// An advisory disagreement leaves the regeneration's write alone.
    /// ´claim:cli:an-advisory-disagreement-does-not-refuse´
    #[test]
    fn an_advisory_disagreement_does_not_refuse_the_write() {
        let run = run_with(carrier::UNMATCHED_ROOT, cogra_linter::Enforcement::Advisory);
        assert!(refuse_incoherent_write(&run).is_ok());
    }
}
