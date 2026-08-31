//! The reference report (´dec:lint:report-subcommand´).
//!
//! The report is a rendering over a completed run, so the fixtures are runs
//! over corpora small enough to state exactly: four sources, five mints, and
//! citations whose destinations are chosen so that every section of the output
//! has something in it and nothing more.
//!
//! The listings are pinned byte for byte, because a report's form is what a
//! reader and a script both consume and neither can be told it changed. What
//! is not pinned is the whole rendering: its first line and its owner section
//! count every owner of `[partition]`, which is adoption data and moves, so
//! those are asserted as facts about the fixture rather than as a transcript.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::report::{reverse, survey};
use cogra_linter::{Adoption, Label, Language, OwnerId, Run, SourceFile, check_sources, render};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// The owner every fixture source belongs to.
const OWNER: &str = "pkg.l1-standin";

fn rust(path: &str, body: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from(path),
        owner: OwnerId::new(OWNER),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from(body),
    }
}

fn label(text: &str) -> Label {
    Label::parse(text).unwrap_or_else(|why| panic!("{text} is well-formed: {why:?}"))
}

/// A corpus of five mints: one cited three times, one cited once, three cited
/// by nothing.
///
/// The citations are written from three sources so that a reverse lookup has
/// more than one line to order, and one of them sits beside the mint it cites
/// so that the mint's own source is not special.
fn surveyed() -> &'static Run {
    static CHECKED: OnceLock<Run> = OnceLock::new();
    CHECKED.get_or_init(|| {
        check_sources(
            adoption(),
            vec![
                rust(
                    "crates/l1-standin/src/lib.rs",
                    "//! ´dec:standin:hub´\n//!\n//! Its own source cites it: (´dec:standin:hub´).\n",
                ),
                rust(
                    "crates/l1-standin/src/one.rs",
                    "//! ´dec:standin:once´\n//!\n//! And (´dec:standin:hub´).\n",
                ),
                rust(
                    "crates/l1-standin/src/two.rs",
                    "//! ´dec:standin:alone´\n//!\n//! And (´dec:standin:hub´), (´dec:standin:once´).\n",
                ),
                rust(
                    "crates/l1-standin/src/three.rs",
                    "//! ´dec:standin:quiet´\n//!\n//! ´dec:standin:silent´\n",
                ),
            ],
        )
    })
}

/// One section of a rendered survey, named by the word its header opens with.
fn section(rendered: &str, header: &str) -> String {
    rendered
        .split("\n\n")
        .find(|block| block.starts_with(header))
        .unwrap_or_else(|| panic!("the {header} section is rendered: {rendered}"))
        .to_owned()
}

/// (´dec:lint:report-subcommand´): the counts are the graph's own — every
/// occurrence, and how many citations reached a mint.
///
/// The report's counts are the completed graph's own, reached by no second pass.
/// ´claim:report:the-counts-are-the-graphs-own´
#[test]
fn the_summary_counts_what_the_run_holds() {
    let found = survey(surveyed(), adoption(), 20);
    assert_eq!(found.sources, 4);
    assert_eq!(found.mints, 5);
    assert_eq!(found.citations, 4);
    assert_eq!(
        found.resolved, 4,
        "every citation of this corpus names a label its owner mints"
    );
    assert_eq!(found.orphaned, 3);
    assert_eq!(found.cited, 2);
}

/// (´dec:lint:report-subcommand´): an orphan is a mint nothing resolves to,
/// listed at its own mint and in label order, and it is not a finding.
///
/// An orphan is a mint nothing resolves to, listed at its own mint in label order.
/// ´claim:report:orphans-are-the-uncited-mints´
#[test]
fn the_orphans_are_the_mints_nothing_cites() {
    let found = survey(surveyed(), adoption(), 20);
    assert_eq!(
        section(&render::survey(&found), "orphan mints"),
        concat!(
            "orphan mints · 3 of 3 minted and cited by nothing\n",
            "  crates/l1-standin/src/two.rs:1:5: ´dec:standin:alone´ · pkg.l1-standin · 0 citations\n",
            "  crates/l1-standin/src/three.rs:1:5: ´dec:standin:quiet´ · pkg.l1-standin · 0 citations\n",
            "  crates/l1-standin/src/three.rs:3:5: ´dec:standin:silent´ · pkg.l1-standin · 0 citations",
        )
    );
}

/// (´dec:lint:report-subcommand´): the hubs are the cited labels by count,
/// most first, and the header carries the whole count whatever the cut.
///
/// The hubs are the cited labels ranked by count, most first.
/// ´claim:report:hubs-rank-by-citations´
#[test]
fn the_hubs_are_the_cited_labels_most_first() {
    let found = survey(surveyed(), adoption(), 20);
    assert_eq!(
        section(&render::survey(&found), "hub labels"),
        concat!(
            "hub labels · 2 of 2 cited\n",
            "  crates/l1-standin/src/lib.rs:1:5: ´dec:standin:hub´ · pkg.l1-standin · 3 citations\n",
            "  crates/l1-standin/src/one.rs:1:5: ´dec:standin:once´ · pkg.l1-standin · 1 citations",
        )
    );
}

/// (´dec:lint:report-subcommand´): the cut bounds each listing and neither
/// header understates what the corpus holds.
///
/// A cut listing still names the whole count it is the head of.
/// ´claim:report:a-cut-listing-names-its-whole-count´
#[test]
fn a_cut_listing_still_names_its_whole_count() {
    let found = survey(surveyed(), adoption(), 1);
    assert_eq!(found.orphans.len(), 1);
    assert_eq!(found.orphaned, 3);
    assert_eq!(found.hubs.len(), 1);
    assert_eq!(found.cited, 2);
    let rendered = render::survey(&found);
    assert!(rendered.contains("orphan mints · 1 of 3"), "{rendered}");
    assert!(rendered.contains("hub labels · 1 of 2"), "{rendered}");

    let none = survey(surveyed(), adoption(), 0);
    assert!(none.orphans.is_empty() && none.hubs.is_empty());
    assert!(render::survey(&none).contains("hub labels · 0 of 2"));
}

/// (´dec:lint:report-subcommand´): the per-owner row counts what an owner
/// mints, what its own sources cite, and what reaches it.
///
/// An owner's row counts what it mints, what its sources cite, and what reaches it.
/// ´claim:report:an-owner-row-counts-three-things´
#[test]
fn each_owner_is_tallied_by_what_it_mints_and_what_it_cites() {
    let found = survey(surveyed(), adoption(), 20);
    let mine = found
        .tally
        .iter()
        .find(|one| one.owner.as_str() == OWNER)
        .expect("the fixture owner is tallied");
    assert_eq!(mine.mints, 5);
    assert_eq!(mine.writes, 4);
    assert_eq!(mine.cited, 4, "one owner, so every citation lands at home");

    assert_eq!(
        found.tally.len(),
        found.owners,
        "every owner of the partition has a row, whether it wrote anything or not"
    );
    let mut ordered: Vec<&str> = found.tally.iter().map(|one| one.owner.as_str()).collect();
    let unsorted = ordered.clone();
    ordered.sort_unstable();
    assert_eq!(ordered, unsorted, "in owner order, never a map's own");
}

/// (´dec:lint:report-subcommand´): the reverse lookup answers where a label is
/// minted and every citation that reaches it, in the located form.
///
/// A reverse lookup answers where a label is minted and every citation reaching it.
/// ´claim:report:a-reverse-lookup-names-mint-and-citations´
#[test]
fn a_reverse_lookup_names_the_mint_and_every_citation() {
    let one = label("dec:standin:hub");
    assert_eq!(
        render::reverse(&one, &reverse(surveyed(), &one)),
        concat!(
            "´dec:standin:hub´ · owner pkg.l1-standin · 1 mints · 3 citations\n",
            "  minted crates/l1-standin/src/lib.rs:1:5\n",
            "  cited  crates/l1-standin/src/lib.rs:3:30\n",
            "  cited  crates/l1-standin/src/one.rs:3:9\n",
            "  cited  crates/l1-standin/src/two.rs:3:9\n",
        )
    );
}

/// (´dec:lint:report-subcommand´): a well-formed label no owner carries is an
/// empty answer and not a refusal — the corpus simply does not hold it.
///
/// A well-formed label no owner carries answers empty rather than refusing.
/// ´claim:report:an-uncarried-label-answers-empty´
#[test]
fn a_label_no_owner_carries_answers_empty() {
    let missing = label("dec:standin:never-written");
    assert!(reverse(surveyed(), &missing).is_empty());
    assert_eq!(
        render::reverse(&missing, &[]),
        "´dec:standin:never-written´ · no owner carries it\n"
    );
}

/// (´[ARCH-req:linter:determinism]´): two surveys of one run are one survey,
/// and neither is produced by iterating a registry.
///
/// Two surveys of one run are one survey.
/// ´claim:report:the-survey-is-deterministic´
#[test]
fn two_surveys_of_one_run_agree() {
    assert_eq!(survey(surveyed(), adoption(), 20), survey(surveyed(), adoption(), 20));
    let one = label("dec:standin:hub");
    assert_eq!(reverse(surveyed(), &one), reverse(surveyed(), &one));
}
