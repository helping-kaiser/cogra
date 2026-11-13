//! The stand-in migration that moves its act table to the two-nonce
//! handshake ships with a fresh start of the dev world: no act formed
//! under the one-nonce handshake opens under the new formulas, so on a
//! database whose stand-in tables still hold a world it refuses before
//! changing anything. From zero it applies, and leaves no stand-in column
//! that is, or is documented as, any part of the content pair.
//!
//! **Budget: this suite runs in ≤ 10 s.** The refusal test replays the
//! migration set by hand up to the migration under test, the way sqlx
//! applies each: one file, one transaction.

use std::path::{Path, PathBuf};

use sqlx::PgPool;

const UNDER_TEST: &str = "20261113120000_l1_standin_two_nonce_handshake.sql";

fn migrations() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../migrations")
}

fn under_test() -> String {
    std::fs::read_to_string(migrations().join(UNDER_TEST)).expect("the migration under test")
}

/// Applies every migration that precedes the one under test, in order.
async fn migrate_to_just_before(pool: &PgPool) {
    let mut files: Vec<PathBuf> = std::fs::read_dir(migrations())
        .expect("the migrations directory")
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.extension().is_some_and(|e| e == "sql"))
        .filter(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n < UNDER_TEST)
        })
        .collect();
    files.sort();
    for path in files {
        let text = std::fs::read_to_string(&path).expect("a readable migration");
        let mut tx = pool.begin().await.expect("begin");
        sqlx::raw_sql(&text)
            .execute(&mut *tx)
            .await
            .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        tx.commit().await.expect("commit");
    }
}

/// The migration under test, in a transaction of its own as sqlx runs it;
/// rolled back on failure, as sqlx does.
async fn apply_under_test(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::raw_sql(&under_test()).execute(&mut *tx).await?;
    tx.commit().await
}

async fn column_exists(pool: &PgPool, column: &str) -> bool {
    sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'l1_acts' AND column_name = $1)",
    )
    .bind(column)
    .fetch_one(pool)
    .await
    .expect("catalog")
}

/// On a database whose `l1_acts` holds an act sealed under the one-nonce
/// handshake, the migration raises an exception naming the table and the
/// reset, and changes nothing: the row, the old columns and the nonce
/// digest function are all still there, and the new column is not. A row
/// in another stand-in table — the host key alone — is refused the same
/// way.
///
/// The two-nonce migration refuses a database whose stand-in tables hold a world, and changes nothing there.
/// ´claim:standin:the-two-nonce-migration-refuses-a-world-it-cannot-open´
#[sqlx::test(migrations = false)]
async fn the_migration_refuses_a_world_and_changes_nothing(pool: PgPool) {
    migrate_to_just_before(&pool).await;
    sqlx::query(
        "INSERT INTO l1_acts (
             act_id, author, seq, family, author_pubkey, target, p_d, p_i,
             asserted_parents, deps, payload, payload_len, nonce, pre_signature,
             pre_commitment, content_salt, deps_salt, content_commitment,
             deps_commitment, host_seal, status, nonce_digest)
         VALUES ('act:alice:0:registration', 'alice', 0, 'registration', '\\x01',
                 'prof:alice', 1, 1, '{}', '{}', '\\x70', 1, '\\x02', '\\x03',
                 '\\x04', '\\x05', '\\x06', '\\x07', '\\x08', '\\x09', 'sealed',
                 l1_nonce_digest('alice', '\\x02'))",
    )
    .execute(&pool)
    .await
    .expect("a one-nonce act, in the table as it was");

    let refused = apply_under_test(&pool)
        .await
        .expect_err("a world formed under the one-nonce handshake is refused");
    let message = refused.to_string();
    eprintln!("refusal over l1_acts: {message}");
    assert!(message.contains("one-nonce handshake") && message.contains("l1_acts"));
    if let sqlx::Error::Database(db) = &refused {
        eprintln!(
            "hint: {:?}",
            db.try_downcast_ref::<sqlx::postgres::PgDatabaseError>()
                .and_then(|e| e.hint())
        );
    }

    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM l1_acts")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(rows, 1);
    for kept in ["payload", "payload_len", "nonce", "nonce_digest"] {
        assert!(column_exists(&pool, kept).await, "{kept} is untouched");
    }
    assert!(!column_exists(&pool, "dependency_nonce").await);
    let digest_function: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'l1_nonce_digest')",
    )
    .fetch_one(&pool)
    .await
    .expect("catalog");
    assert!(digest_function);

    sqlx::query("DELETE FROM l1_acts")
        .execute(&pool)
        .await
        .expect("empties the acts");
    sqlx::query("INSERT INTO l1_host (singleton, signing_seed) VALUES (TRUE, '\\x00')")
        .execute(&pool)
        .await
        .expect("a host key alone");
    let refused = apply_under_test(&pool)
        .await
        .expect_err("the host key is a world too");
    eprintln!("refusal over l1_host: {refused}");
    assert!(refused.to_string().contains("l1_host"));
    assert!(column_exists(&pool, "payload").await);
}

/// From zero, every migration applies, and no column of any `l1_*` table
/// is named as, or documented as, the payload, its length, a nonce digest
/// or the content nonce; no stand-in function or index digests a nonce.
/// The one nonce the stand-in keeps is the dependency nonce.
///
/// After the two-nonce migration no stand-in column is, or is documented as, any part of the content pair or a nonce digest.
/// ´claim:standin:no-stand-in-column-is-the-content-pair´
#[sqlx::test(migrations = "../../migrations")]
async fn from_zero_no_stand_in_column_is_the_content_pair(pool: PgPool) {
    let columns: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT c.table_name::TEXT, c.column_name::TEXT,
                col_description(format('%I.%I', c.table_schema, c.table_name)::regclass,
                                c.ordinal_position::INT)
         FROM information_schema.columns c
         WHERE c.table_schema = current_schema() AND c.table_name LIKE 'l1\\_%'
         ORDER BY c.table_name, c.ordinal_position",
    )
    .fetch_all(&pool)
    .await
    .expect("catalog");
    let mut tables: Vec<(String, Vec<String>)> = Vec::new();
    for (table, column, comment) in &columns {
        match tables.last_mut() {
            Some((t, cols)) if t == table => cols.push(column.clone()),
            _ => tables.push((table.clone(), vec![column.clone()])),
        }
        let named = column.to_lowercase();
        assert!(
            !named.contains("payload")
                && !named.contains("nonce_digest")
                && !named.contains("content_nonce")
                && !named.contains("pre_digest")
                && named != "nonce",
            "{table}.{column}"
        );
        let documented = comment.as_deref().unwrap_or_default().to_lowercase();
        assert!(
            !documented.contains("payload")
                && !documented.contains("nonce digest")
                && !documented.contains("content nonce"),
            "{table}.{column}: {documented}"
        );
    }
    for (table, cols) in &tables {
        eprintln!("{table}: {}", cols.join(", "));
    }
    let nonce_columns: Vec<String> = columns
        .iter()
        .filter(|(_, c, _)| c.contains("nonce"))
        .map(|(t, c, _)| format!("{t}.{c}"))
        .collect();
    assert_eq!(nonce_columns, vec!["l1_acts.dependency_nonce".to_string()]);

    let table_comments: Vec<String> = sqlx::query_scalar(
        "SELECT COALESCE(obj_description(format('%I', table_name)::regclass, 'pg_class'), '')
         FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name LIKE 'l1\\_%'",
    )
    .fetch_all(&pool)
    .await
    .expect("catalog");
    assert!(
        table_comments
            .iter()
            .all(|c| !c.to_lowercase().contains("payload"))
    );

    let digesting: Vec<String> = sqlx::query_scalar(
        "SELECT proname::TEXT FROM pg_proc WHERE proname LIKE 'l1\\_%nonce%'
         UNION ALL
         SELECT indexname::TEXT FROM pg_indexes
          WHERE tablename LIKE 'l1\\_%' AND indexname LIKE '%nonce%'",
    )
    .fetch_all(&pool)
    .await
    .expect("catalog");
    assert!(digesting.is_empty(), "{digesting:?}");
}
