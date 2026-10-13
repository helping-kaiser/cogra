//! The release registry's store half (data-model.md "Application
//! registry"): an append-only table the operator's release CLI writes and
//! `appVersions` reads. Requires Postgres (`make up`).

use chrono::{DateTime, Utc};
use postgres_store::registry::{self, NewRelease, RegistryError};
use sqlx::PgPool;
use uuid::Uuid;

fn at(secs: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn release(component: &str, version: &str, notes: &[&str]) -> NewRelease {
    NewRelease {
        component: component.to_string(),
        version: version.to_string(),
        notes: notes.iter().map(|n| n.to_string()).collect(),
        patch_notes_url: format!("https://example.test/tag/v{version}"),
        released_by: Vec::new(),
        released_at: at(1),
    }
}

/// A publish adds exactly its row and leaves what stood before it
/// untouched, the notes kept in the order written and a credit list
/// stored as written.
///
/// Publishing a release appends one row and keeps every earlier one.
/// ´claim:registry:a-publish-appends-and-keeps-the-past´
#[sqlx::test(migrations = "../../migrations")]
async fn publishing_a_release_appends_a_row(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    registry::publish_release(&mut conn, &release("web", "0.1.0", &["First"]))
        .await
        .expect("first");
    let credited = Uuid::new_v4();
    let mut second = release("web", "0.1.1", &["Second", "Then this"]);
    second.released_by = vec![credited];
    second.released_at = at(2);
    registry::publish_release(&mut conn, &second)
        .await
        .expect("second");

    let rows = registry::list_releases(&pool, Some("web"), None, false, 10)
        .await
        .expect("list");
    let versions: Vec<&str> = rows.iter().map(|r| r.version.as_str()).collect();
    assert_eq!(versions, ["0.1.1", "0.1.0"]);
    assert_eq!(rows[0].notes, ["Second", "Then this"]);
    assert_eq!(rows[0].released_by, Some(vec![credited]));
    assert_eq!(rows[1].released_by, None, "nobody credited stores NULL");
    assert_eq!(
        registry::count_releases(&pool, None).await.expect("count"),
        2
    );
}

/// The primary key is the append-only guard: a second row for a version
/// the component already has is refused by name, and the first row stays
/// as it was published.
///
/// A component's version is published once; a second publish is refused as already published.
/// ´claim:registry:a-published-version-is-never-rewritten´
#[sqlx::test(migrations = "../../migrations")]
async fn a_duplicate_component_version_is_already_published(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    registry::publish_release(&mut conn, &release("android", "0.1.0", &["Original"]))
        .await
        .expect("first");

    let refused =
        registry::publish_release(&mut conn, &release("android", "0.1.0", &["Rewritten"])).await;
    assert!(
        matches!(
            &refused,
            Err(RegistryError::AlreadyPublished { component, version })
                if component == "android" && version == "0.1.0"
        ),
        "{refused:?}"
    );
    registry::publish_release(&mut conn, &release("web", "0.1.0", &["Same release"]))
        .await
        .expect("another component's row under the same version");

    let rows = registry::list_releases(&pool, Some("android"), None, false, 10)
        .await
        .expect("list");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].notes, ["Original"]);
}

/// The table's CHECK holds the law on its own, below any validation the
/// CLI does: a row without a note never lands.
///
/// A release without notes is refused by the registry itself.
/// ´claim:registry:a-release-carries-notes´
#[sqlx::test(migrations = "../../migrations")]
async fn a_release_without_notes_is_refused(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    let refused = registry::publish_release(&mut conn, &release("web", "0.1.0", &[])).await;
    assert!(
        matches!(&refused, Err(RegistryError::Store(sqlx::Error::Database(db)))
            if db.constraint() == Some("versions_notes_present")),
        "{refused:?}"
    );
    assert_eq!(
        registry::count_releases(&pool, None).await.expect("count"),
        0
    );
}
