//! The rule that decides which version row *is* the content, checked
//! everywhere it is written down.
//!
//! sqlx's macros take a string literal and nothing that expands to one —
//! `concat!` is rejected at macro-expansion time — so the ordering cannot
//! be a shared `const` spliced into the queries. It is therefore copied,
//! twenty-two times across five modules, and re-encoded again in the seven
//! indexes that serve it. A miss in any one of them serves a different
//! version, silently and only for that query.
//!
//! What can be shared is the check. This test needs no database: it reads
//! the crate's own sources and the migrations that declare the indexes and
//! the search derivation. A merged migration is never edited (sqlx checks
//! its checksum), so the migrations are read for the definition in force —
//! the latest one to state it — not for every historical form.

use std::fs;
use std::path::{Path, PathBuf};

/// The ordering as the version tables carrying a pending mark write it:
/// the pending version first, then the newest landing by its key of
/// record `(epoch, position)` (layer1-interface.md §8.3).
const WITH_PENDING: &str = "pending DESC, \
    landed_epoch DESC NULLS LAST, \
    position DESC NULLS LAST, \
    created_at DESC, version_id DESC";

/// The same rule on a table with no pending mark: an unlanded edit needs
/// a flag of its own, and the tables whose rows are only ever promotions
/// or seeds have none.
const WITHOUT_PENDING: &str = "landed_epoch DESC NULLS LAST, \
    position DESC NULLS LAST, \
    created_at DESC, version_id DESC";

/// The seven version tables' current-version indexes.
const CURRENT_INDEXES: [&str; 7] = [
    "post_versions_current_idx",
    "comment_versions_current_idx",
    "actor_profile_versions_current_idx",
    "chat_versions_current_idx",
    "chat_message_versions_current_idx",
    "item_versions_current_idx",
    "network_parameter_versions_current_idx",
];

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

/// Every migration, flattened, in the order sqlx applies them — by file
/// name, whose leading timestamp is the version.
fn migrations_in_order() -> Vec<(PathBuf, String)> {
    let dir = crate_dir().join("../../migrations");
    let mut all: Vec<(PathBuf, String)> = fs::read_dir(&dir)
        .expect("migrations are readable")
        .map(|entry| {
            let path = entry.expect("entry").path();
            let flat = read_flat(&path);
            (path, flat)
        })
        .collect();
    all.sort_by(|a, b| a.0.cmp(&b.0));
    all
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

/// The derivation's own body in a flattened migration: from its
/// `CREATE ... FUNCTION` header to the dollar quote that closes it.
fn derivation_body(flat: &str) -> &str {
    let start = flat
        .find("FUNCTION search_index_rederive(")
        .expect("the migration defines the derivation");
    let rest = &flat[start..];
    let open = rest.find("$$").expect("the body opens") + 2;
    let close = rest[open..].find("$$").expect("the body closes") + open;
    &rest[..close]
}

/// The search index's derivation lives in migrations, not in the crate,
/// so the crate-wide check above cannot see it. The definition in force —
/// the latest migration to state it — orders both a post's and a
/// profile's versions with the pending key, once each and in no other
/// form: both tables carry a pending mark, and the index must find what
/// the reads show.
///
/// The search index's trigger derivation orders versions the way the reads do.
/// ´claim:content:the-search-derivation-carries-the-version-ordering-rule´
#[test]
fn the_search_index_derivation_orders_versions_the_same_way() {
    let (path, flat) = migrations_in_order()
        .into_iter()
        .rfind(|(_, flat)| flat.contains("FUNCTION search_index_rederive("))
        .expect("the derivation vanished from the migrations");
    let body = derivation_body(&flat);
    let key = body.matches(KEY).count();
    let full = body.matches(WITH_PENDING).count();
    assert_eq!(
        (key, full),
        (2, 2),
        "{}: the derivation in force orders posts and profiles with the pending key",
        path.display()
    );
}

/// The indexes that serve the rule encode it again. Each `*_current_idx`,
/// as the latest migration to create it defines it, carries the same key
/// sequence the queries order by.
///
/// The current-version indexes order versions the way the queries do.
/// ´claim:content:the-indexes-carry-the-version-ordering-rule´
#[test]
fn the_current_version_indexes_carry_the_same_rule() {
    let migrations = migrations_in_order();
    for index in CURRENT_INDEXES {
        let header = format!("CREATE INDEX {index} ON");
        let (path, definition) = migrations
            .iter()
            .filter_map(|(path, flat)| {
                let start = flat.rfind(&header)?;
                let rest = &flat[start..];
                let end = rest
                    .find(INDEX_END)
                    .map_or(rest.len(), |e| e + INDEX_END.len());
                Some((path, &rest[..end]))
            })
            .next_back()
            .unwrap_or_else(|| panic!("no migration creates {index}"));
        assert!(
            definition.contains(WITHOUT_PENDING),
            "{}: {index} orders versions differently from the queries: {definition}",
            path.display()
        );
        assert!(
            !definition.contains("act_time"),
            "{}: {index} still orders by act time: {definition}",
            path.display()
        );
    }
}

/// The display tables that carry a landed record's key of record.
const LANDING_TABLES: [&str; 9] = [
    "posts",
    "comments",
    "post_versions",
    "comment_versions",
    "actor_profile_versions",
    "chat_versions",
    "chat_message_versions",
    "item_versions",
    "network_parameter_versions",
];

/// Whether `table` carries an `act_time` column once every migration has
/// run: the migrations folded in order, statement by statement — a
/// `CREATE TABLE` declaring the column or an `ALTER TABLE` adding it sets
/// it, an `ALTER TABLE` dropping it clears it.
fn carries_act_time(migrations: &[(PathBuf, String)], table: &str) -> bool {
    let create = format!("CREATE TABLE {table} (");
    let alter = format!("ALTER TABLE {table} ");
    let mut carried = false;
    for (_, flat) in migrations {
        for statement in flat.split(';').map(str::trim) {
            if statement.contains(&create) {
                carried = statement.contains(" act_time ");
            } else if statement.contains(&alter) {
                if statement.contains("DROP COLUMN act_time")
                    || statement.contains("DROP COLUMN IF EXISTS act_time")
                {
                    carried = false;
                }
                if statement.contains("ADD COLUMN act_time")
                    || statement.contains("ADD COLUMN IF NOT EXISTS act_time")
                {
                    carried = true;
                }
            }
        }
    }
    carried
}

/// The key of record orders a display row, and the act time stays with
/// the published record (layer1-interface.md §8.3–§8.4): no display table
/// carries a copy of it, while the mirror's own tables keep theirs — the
/// second half proves the fold sees a column where one is declared.
///
/// No display table carries a landed record's act time; the mirror keeps it.
/// ´claim:content:no-display-table-carries-the-act-time´
#[test]
fn no_display_table_carries_the_act_time() {
    let migrations = migrations_in_order();
    for table in LANDING_TABLES {
        assert!(
            !carries_act_time(&migrations, table),
            "{table} carries an act_time column in the schema in force"
        );
    }
    for table in ["mirror_records", "mirror_record_legs"] {
        assert!(
            carries_act_time(&migrations, table),
            "{table} lost the act time the published record carries"
        );
    }
}
