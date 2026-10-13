//! ´mod:module:registry´
//!
//! The release registry's API half (api-spec.md "Application versions"):
//! the platform components, the wire cursor over the registry's order, and
//! the operator's publish step behind `bin/release.rs`.
//!
//! A release row is written by the operator, never by a request: there is
//! no operator role on the public endpoint, and no drawn surface writes a
//! release. The CLI is the house shape for operator writes, like the
//! bootstrap. A component's row is published only once that component's
//! artifact is live — the web build serving, the Android build available
//! on its store track — because a row is what tells a running client that
//! a newer version exists, and Update now must lead somewhere that has it
//! (development.md "The release CLI").

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{DateTime, Utc};
use postgres_store::PgPool;
use postgres_store::registry::{self, NewRelease, RegistryError, ReleaseCursor};
use uuid::Uuid;

/// The public releases page; a release's own page is its tag under it.
pub const RELEASES_URL: &str = "https://github.com/helping-kaiser/cogra/releases";

/// A platform component with releases in the application registry.
#[derive(async_graphql::Enum, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum AppComponent {
    Backend,
    Ios,
    Android,
    Web,
}

impl AppComponent {
    /// The component as the registry's `component` column spells it.
    pub fn as_store(self) -> &'static str {
        match self {
            Self::Backend => "backend",
            Self::Ios => "ios",
            Self::Android => "android",
            Self::Web => "web",
        }
    }

    /// The component a store spelling names; None for anything else.
    pub fn from_store(name: &str) -> Option<Self> {
        match name {
            "backend" => Some(Self::Backend),
            "ios" => Some(Self::Ios),
            "android" => Some(Self::Android),
            "web" => Some(Self::Web),
            _ => None,
        }
    }
}

/// The release page a version's card opens: its tag under
/// [`RELEASES_URL`].
pub fn release_page(version: &str) -> String {
    format!("{RELEASES_URL}/tag/v{version}")
}

/// A cursor as the wire carries it: opaque per the Relay spec. The
/// version comes last because it is the one part that may itself hold a
/// colon.
pub fn encode_cursor(cursor: &ReleaseCursor) -> String {
    B64.encode(format!(
        "release:{}:{}:{}",
        cursor.released_at.timestamp_micros(),
        cursor.component,
        cursor.version
    ))
}

/// A wire cursor back to its position; None for anything this list did
/// not issue.
pub fn decode_cursor(cursor: &str) -> Option<ReleaseCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.splitn(4, ':');
    let (Some("release"), Some(micros), Some(component), Some(version)) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    Some(ReleaseCursor {
        released_at: DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        component: AppComponent::from_store(component)?.as_store().to_string(),
        version: version.to_string(),
    })
}

/// What the operator publishes: one release, on each named component.
#[derive(Debug, Clone, Default)]
pub struct PublishInput {
    pub components: Vec<AppComponent>,
    pub version: String,
    /// The notes file's text: one note per line.
    pub notes: String,
    /// The release's public page; [`release_page`] when absent.
    pub patch_notes_url: Option<String>,
    pub released_by: Vec<Uuid>,
    /// When the release went out; now when absent. Set only to backfill.
    pub released_at: Option<DateTime<Utc>>,
}

/// One row the publish wrote.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Published {
    pub component: AppComponent,
    pub version: String,
    pub patch_notes_url: String,
    pub released_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum PublishError {
    #[error("name at least one component")]
    NoComponent,
    #[error("the version is blank")]
    BlankVersion,
    #[error("the notes are empty: a release says what a reader can now do")]
    NoNotes,
    #[error("note line {line} is blank: every line of the notes file is one note")]
    BlankNote { line: usize },
    #[error("the release page URL is blank")]
    BlankPage,
    #[error(transparent)]
    Registry(#[from] RegistryError),
    #[error(transparent)]
    Store(#[from] sqlx::Error),
}

/// The notes a notes file holds: one per line, trimmed. A blank line is
/// refused rather than skipped — each line becomes its own paragraph on
/// the card, so a stray one is a typo the operator should see.
pub fn notes_from_text(text: &str) -> Result<Vec<String>, PublishError> {
    let notes: Vec<String> = text.lines().map(|line| line.trim().to_string()).collect();
    if notes.is_empty() {
        return Err(PublishError::NoNotes);
    }
    if let Some(blank) = notes.iter().position(String::is_empty) {
        return Err(PublishError::BlankNote { line: blank + 1 });
    }
    Ok(notes)
}

/// Publishes one release on every named component, in one transaction: a
/// component that already has this version refuses the whole publish and
/// writes nothing, so a retry after fixing the input starts clean.
pub async fn run(pool: &PgPool, input: PublishInput) -> Result<Vec<Published>, PublishError> {
    let mut components: Vec<AppComponent> = Vec::with_capacity(input.components.len());
    for component in input.components {
        if !components.contains(&component) {
            components.push(component);
        }
    }
    if components.is_empty() {
        return Err(PublishError::NoComponent);
    }
    let version = input.version.trim().to_string();
    if version.is_empty() {
        return Err(PublishError::BlankVersion);
    }
    let notes = notes_from_text(&input.notes)?;
    let patch_notes_url = match input.patch_notes_url {
        Some(url) if url.trim().is_empty() => return Err(PublishError::BlankPage),
        Some(url) => url.trim().to_string(),
        None => release_page(&version),
    };
    let released_at = input.released_at.unwrap_or_else(Utc::now);

    let mut tx = pool.begin().await?;
    let mut published = Vec::with_capacity(components.len());
    for component in components {
        registry::publish_release(
            &mut tx,
            &NewRelease {
                component: component.as_store().to_string(),
                version: version.clone(),
                notes: notes.clone(),
                patch_notes_url: patch_notes_url.clone(),
                released_by: input.released_by.clone(),
                released_at,
            },
        )
        .await?;
        published.push(Published {
            component,
            version: version.clone(),
            patch_notes_url: patch_notes_url.clone(),
            released_at,
        });
    }
    tx.commit().await?;
    Ok(published)
}
