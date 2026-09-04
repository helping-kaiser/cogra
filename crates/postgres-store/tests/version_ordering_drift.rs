//! The rule that decides which version row *is* the content, checked
//! everywhere it is written down.
//!
//! sqlx's macros take a string literal and nothing that expands to one —
//! `concat!` is rejected at macro-expansion time — so the ordering cannot
//! be a shared `const` spliced into the queries. It is therefore copied,
//! sixteen times across three modules, and re-encoded again in the seven
//! indexes that serve it. A miss in any one of them serves a different
//! version, silently and only for that query.
//!
//! What can be shared is the check. This test needs no database: it reads
//! the crate's own sources and the migration that declares the indexes.

use std::fs;
use std::path::{Path, PathBuf};

/// The ordering as the version tables carrying a pending mark write it.
const WITH_PENDING: &str = "pending DESC, \
    landed_epoch DESC NULLS LAST, \
    act_time DESC NULLS LAST, \
    position DESC NULLS LAST, \
    created_at DESC, version_id DESC";

/// The same rule on a table with no pending mark: an unlanded edit needs
/// a flag of its own, and profile and parameter versions have none.
const WITHOUT_PENDING: &str = "landed_epoch DESC NULLS LAST, \
    act_time DESC NULLS LAST, \
    position DESC NULLS LAST, \
    created_at DESC, version_id DESC";

/// The key the whole rule turns on. Every occurrence of it must be part
/// of one of the two orderings above — that is the whole check.
const KEY: &str = "landed_epoch DESC NULLS LAST";

/// `);` closes an index definition; the migration writes no other
/// parenthesised list inside one.
const INDEX_END: &str = ");";

fn crate_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Collapses every whitespace run to one space, so a query's indentation
/// and an index's column alignment compare as the same text.
fn flatten(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A with-pending ordering contains a without-pending one, so the short
/// form is only what the long form did not already claim.
fn short_form_count(flat: &str, full: usize) -> usize {
    flat.matches(WITHOUT_PENDING).count() - full
}

fn read_flat(path: &Path) -> String {
    flatten(&fs::read_to_string(path).unwrap_or_else(|e| panic!("{}: {e}", path.display())))
}

/// Every place the crate orders version rows uses one of the two forms of
/// the rule, and no third form has appeared.
///
/// Every version ordering in the crate is one of the rule's two forms.
/// ´claim:content:the-version-ordering-is-written-one-way´
#[test]
fn the_version_ordering_never_drifts_in_the_crate() {
    let src = crate_dir().join("src");
    let mut total = 0;
    for entry in fs::read_dir(&src).expect("src is readable") {
        let path = entry.expect("entry").path();
        if path.extension().is_none_or(|e| e != "rs") {
            continue;
        }
        let flat = read_flat(&path);
        let key = flat.matches(KEY).count();
        let full = flat.matches(WITH_PENDING).count();
        let short = short_form_count(&flat, full);
        assert_eq!(
            key,
            full + short,
            "{}: {key} version orderings, {full} with the pending key and \
             {short} without — the rest are a third form",
            path.display()
        );
        total += key;
    }
    assert!(total > 0, "the ordering vanished from the crate");
}

/// The indexes that serve the rule encode it again. Each `*_current_idx`
/// carries the same key sequence the queries order by.
///
/// The current-version indexes order versions the way the queries do.
/// ´claim:content:the-indexes-carry-the-version-ordering-rule´
#[test]
fn the_current_version_indexes_carry_the_same_rule() {
    let migration = crate_dir().join("../../migrations/20260821000002_l1_ordered_versions.sql");
    let flat = read_flat(&migration);
    let definitions: Vec<&str> = flat
        .match_indices("_current_idx ON")
        .map(|(i, _)| {
            let rest = &flat[i..];
            &rest[..rest
                .find(INDEX_END)
                .map_or(rest.len(), |e| e + INDEX_END.len())]
        })
        .collect();
    assert_eq!(definitions.len(), 7, "seven version tables carry the rule");
    for definition in definitions {
        assert!(
            definition.contains(WITHOUT_PENDING),
            "an index orders versions differently from the queries: {definition}"
        );
    }
}
