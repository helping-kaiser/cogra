//! The stand-in owns the `l1_*` tables (CLAUDE.md "Code style"), and the
//! migration set is where that ownership has to hold longest: the tables
//! are dropped at the swap, but their migrations are not.
//!
//! An applied migration is never edited — sqlx records a checksum per
//! migration and a changed file fails the next run of every database that
//! already applied it — so a CoGra migration reading `l1_acts` is a
//! statement the replay path keeps forever, and the swap must leave the
//! table in the timeline for it. One such statement exists and is recorded
//! below; this test is what keeps it at one.
//!
//! The owned table set is read out of the stand-in's own migration rather
//! than restated here, so a table added there is covered without anyone
//! remembering to add it.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

/// The migration that creates the stand-in's tables — the only one allowed
/// to name them freely.
const OWNER: &str = "20260724000003_l1_standin.sql";

/// The one recorded exception, with the reason it cannot be removed.
///
/// `20260820000002_license_float_model.sql` backfills post and comment
/// license state out of `l1_acts`. It is applied on every existing
/// database, so editing it would break their migration runs; the constraint
/// it creates — `l1_acts` must exist wherever this migration replays — is
/// recorded in the close module's docs and inherited by the swap.
const RECORDED: &str = "20260820000002_license_float_model.sql";

fn migrations() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../migrations")
}

/// The `l1_*` tables the stand-in's own migration creates.
fn owned_tables() -> BTreeSet<String> {
    let text = std::fs::read_to_string(migrations().join(OWNER)).expect("the owning migration");
    let mut owned = BTreeSet::new();
    for line in text.lines() {
        let Some(rest) = line.trim().strip_prefix("CREATE TABLE ") else {
            continue;
        };
        let name = rest.split(['(', ' ']).next().unwrap_or_default().trim();
        if name.starts_with("l1_") {
            owned.insert(name.to_string());
        }
    }
    assert!(
        !owned.is_empty(),
        "the owning migration creates l1_* tables"
    );
    owned
}

/// Whether `haystack` names `table` as a whole word — `l1_acts` in
/// `l1_acts_status_idx` or `p.l1_node_id` is not a reference to the table.
fn names_table(haystack: &str, table: &str) -> bool {
    let bytes = haystack.as_bytes();
    let mut from = 0;
    while let Some(at) = haystack[from..].find(table) {
        let start = from + at;
        let end = start + table.len();
        let before_ok = start == 0 || !is_word(bytes[start - 1]);
        let after_ok = end == bytes.len() || !is_word(bytes[end]);
        if before_ok && after_ok {
            return true;
        }
        from = start + 1;
    }
    false
}

fn is_word(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'.'
}

/// No migration outside the stand-in's own reads or writes its tables, save
/// the one recorded case an applied checksum has frozen in place.
///
/// Only the stand-in's own migration names the l1_* tables, save one recorded case.
/// ´claim:standin:only-the-stand-ins-own-migration-names-its-tables´
#[test]
fn no_migration_outside_the_stand_in_reads_its_tables() {
    let owned = owned_tables();
    let mut offenders: Vec<String> = Vec::new();
    let mut recorded_still_reads = false;

    let mut files: Vec<PathBuf> = std::fs::read_dir(migrations())
        .expect("the migrations directory")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.extension().is_some_and(|e| e == "sql"))
        .collect();
    files.sort();

    for path in files {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        if name == OWNER {
            continue;
        }
        let text = std::fs::read_to_string(&path).expect("a readable migration");
        let named: Vec<&String> = owned
            .iter()
            .filter(|table| names_table(&text, table))
            .collect();
        if named.is_empty() {
            continue;
        }
        if name == RECORDED {
            recorded_still_reads = true;
            continue;
        }
        offenders.push(format!("{name} names {named:?}"));
    }

    assert!(
        offenders.is_empty(),
        "CoGra migrations must not touch the stand-in's tables — they are dropped at the swap: {offenders:?}"
    );
    assert!(
        recorded_still_reads,
        "the recorded exception {RECORDED} no longer reads the stand-in's tables; \
         delete the RECORDED constant and the note it points at rather than leaving a dead allowance"
    );
}
