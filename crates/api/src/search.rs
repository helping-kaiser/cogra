//! ´mod:module:search´
//!
//! The one search matcher (api-spec.md "Search"): how a typed query
//! becomes a match request over the `search_index` projection.
//! `Query.search`, `Query.referenceCandidates` and `User.bookmarks(query:)`
//! all go through here — no surface grows a second matcher.
//!
//! What the matcher owns, stated once:
//!
//! - **Parsing.** The query is trimmed; a blank query matches nothing and
//!   is never an error; past [`MAX_QUERY_CHARS`] it is refused. Only a
//!   LEADING `@prefix` or `#prefix` is a cue — anywhere else those
//!   characters are text.
//! - **Plain text** matches a post's title and a person's handle and
//!   display name by word: full text under the `simple` configuration,
//!   every word required, the last as a prefix, so "Mod" finds "Genesis
//!   Moderator", "gen" finds @genesis, and "enesis" finds neither
//!   (PostgreSQL docs §12.3.2, prefix matching in `to_tsquery`). A
//!   handle's words are what the parser splits it into: `pixel_joiner`
//!   holds `pixel` and `joiner`. A person whose display name matches
//!   brings their posts, titled or not; a handle match brings only the
//!   person — `@` is the deliberate handle cue. A topic's name matches
//!   case-insensitively by substring: the index's trigram operator class
//!   serves `LIKE` (PostgreSQL docs, *pg_trgm*, "Index Support").
//! - **Cues** ([`cue`]). `@prefix` names every person whose handle starts
//!   with it; `#prefix` every topic whose name does. A bare cue lists the
//!   matches, then what they reach: a person's posts, comments and the
//!   topics they tagged their own content with; the posts and comments
//!   that carry a topic. A cue with text after it searches inside what
//!   its matches reach, as text matches above — a post's title, a
//!   comment's thread root's title, a topic's name — and never lists the
//!   matches themselves. A name that can never begin a handle or a topic
//!   names nothing.
//! - **Sections and tiers.** A result is people, then topics, then
//!   content. Inside a section a node whose matched field equals the text
//!   case-insensitively leads; then newest first, then id. The store folds
//!   both into one `tier` (`postgres_store::search`).
//! - **Kinds subtract.** A `kinds` filter drops sections and keeps the
//!   rest's semantics: without people, a person cue or a display-name
//!   match still lists the authored content.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::search::{MatchQuery, SECTIONS, ScopedQuery, SearchCursor};
use uuid::Uuid;

/// The longest query accepted, in Unicode scalar values: a full post
/// title (500), a separator and a cue of a full-length handle or tag,
/// with headroom. Longer is a malformed argument, not a miss.
pub const MAX_QUERY_CHARS: usize = 640;

/// A kind the plain-text matcher serves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexKind {
    User,
    Post,
    Hashtag,
}

impl IndexKind {
    /// Every kind the plain-text matcher serves.
    pub const ALL: [Self; 3] = [Self::User, Self::Post, Self::Hashtag];

    /// The `kind` the index row carries.
    pub fn as_store(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Post => "post",
            Self::Hashtag => "hashtag",
        }
    }
}

/// A kind a cue request serves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopedKind {
    User,
    Post,
    Comment,
    Hashtag,
}

impl ScopedKind {
    /// The kind as the cue statements name it.
    pub fn as_store(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Post => "post",
            Self::Comment => "comment",
            Self::Hashtag => "hashtag",
        }
    }
}

/// A leading cue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    /// `@prefix` — people by handle, and their work.
    Handle,
    /// `#prefix` — topics by name, and what carries them.
    Tag,
}

impl Scope {
    /// What a cue serves. Bare, its matches lead: people for `@`, topics
    /// for `#`. With text, only what they reach — a person's work takes
    /// in the topics they tagged it with; a topic's set is posts and
    /// comments.
    pub fn kinds(self, bare: bool) -> &'static [ScopedKind] {
        match (self, bare) {
            (Self::Handle, true) => &[
                ScopedKind::User,
                ScopedKind::Post,
                ScopedKind::Comment,
                ScopedKind::Hashtag,
            ],
            (Self::Handle, false) => &[ScopedKind::Post, ScopedKind::Comment, ScopedKind::Hashtag],
            (Self::Tag, true) => &[ScopedKind::Hashtag, ScopedKind::Post, ScopedKind::Comment],
            (Self::Tag, false) => &[ScopedKind::Post, ScopedKind::Comment],
        }
    }
}

/// A query, parsed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Parsed<'a> {
    /// Nothing to match: an empty or all-blank query.
    Blank,
    /// No cue — the whole (trimmed) query is text.
    Unscoped(&'a str),
    /// A leading cue, the prefix it carries, and the text after it, if
    /// any.
    Scoped {
        scope: Scope,
        name: &'a str,
        remainder: Option<&'a str>,
    },
}

/// The query is longer than [`MAX_QUERY_CHARS`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct QueryTooLong;

/// Parses a raw query. The cap is counted on the trimmed query: padding
/// is not part of what was asked.
pub fn parse(raw: &str) -> Result<Parsed<'_>, QueryTooLong> {
    let query = raw.trim();
    if query.is_empty() {
        return Ok(Parsed::Blank);
    }
    if query.chars().count() > MAX_QUERY_CHARS {
        return Err(QueryTooLong);
    }
    let (scope, rest) = if let Some(rest) = query.strip_prefix('@') {
        (Scope::Handle, rest)
    } else if let Some(rest) = query.strip_prefix('#') {
        (Scope::Tag, rest)
    } else {
        return Ok(Parsed::Unscoped(query));
    };
    let (name, remainder) = match rest.split_once(char::is_whitespace) {
        Some((name, remainder)) => (name, Some(remainder.trim()).filter(|r| !r.is_empty())),
        None => (rest, None),
    };
    Ok(Parsed::Scoped {
        scope,
        name,
        remainder,
    })
}

/// The match request for plain `text` over `kinds`. `exclude_seen_by`
/// drops nodes on that account's seen-list; `keyed_users_only` serves
/// only people who front a Profile — the finder's narrowing.
pub fn unscoped(
    text: &str,
    kinds: &[IndexKind],
    exclude_seen_by: Option<Uuid>,
    keyed_users_only: bool,
) -> MatchQuery {
    MatchQuery {
        text: text.to_string(),
        like_body: like_body(text),
        title_query: title_query(text),
        kinds: kinds.iter().map(|k| k.as_store().to_string()).collect(),
        exclude_seen_by,
        keyed_users_only,
    }
}

/// What a cue's `name` names, as the store binds it. None when nothing
/// can match: a lone `@` or `#`, as a blank query matches nothing; an
/// `@` prefix carrying a character no handle holds (auth.md, the handle
/// charset); a `#` prefix the tag grammar refuses.
pub fn cue(scope: Scope, name: &str) -> Option<postgres_store::search::Scope> {
    if name.is_empty() {
        return None;
    }
    match scope {
        Scope::Handle => {
            let folded = name.to_lowercase();
            let admissible = folded.chars().count() <= crate::auth::HANDLE_MAX_CHARS
                && folded
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
            admissible.then(|| postgres_store::search::Scope::Authors {
                like_body: like_body(&folded),
                cue: folded,
            })
        }
        Scope::Tag => scoped_topic(name).map(|canonical| postgres_store::search::Scope::Topics {
            like_body: like_body(&canonical),
            cue: canonical,
        }),
    }
}

/// The cue request for `scope` with `remainder` after it (None for a bare
/// cue), over `kinds`. `pending_actor` is the viewer's address atom:
/// their own in-flight topic claims count, as on the tag page.
pub fn scoped(
    scope: postgres_store::search::Scope,
    remainder: Option<&str>,
    kinds: &[ScopedKind],
    exclude_seen_by: Option<Uuid>,
    pending_actor: Option<String>,
) -> ScopedQuery {
    ScopedQuery {
        scope,
        text: remainder.map(str::to_string),
        like_body: remainder.map(like_body).unwrap_or_default(),
        title_query: remainder.and_then(title_query),
        kinds: kinds.iter().map(|k| k.as_store().to_string()).collect(),
        exclude_seen_by,
        pending_actor,
    }
}

/// The canonical topic a `#` cue names: the name exactly as the tag
/// grammar canonicalizes it (hashtag.md §2), the cue being its one
/// sigil — so `##salt` names nothing. None for a name no topic can carry.
pub fn scoped_topic(name: &str) -> Option<String> {
    common::hashtag::canonicalize(&format!("#{name}")).ok()
}

/// `text` as the body of a `LIKE` pattern matching itself literally:
/// `\`, `%` and `_` escaped with the default escape character.
fn like_body(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        if matches!(c, '\\' | '%' | '_') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// The words of `text` as a `to_tsquery` expression: every word
/// required, the last matched as a prefix — the one word query titles,
/// handles and display names match. A word is a maximal run of
/// alphanumeric characters, so every word is a single quoted lexeme with
/// nothing in it the query syntax could read as an operator. None when
/// `text` carries no word.
fn title_query(text: &str) -> Option<String> {
    let words: Vec<&str> = text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();
    let (last, init) = words.split_last()?;
    let mut parts: Vec<String> = init.iter().map(|w| format!("'{w}'")).collect();
    parts.push(format!("'{last}':*"));
    Some(parts.join(" & "))
}

/// Whether `tier` is one the matcher issues: two per section.
pub fn tier_ok(tier: i32) -> bool {
    (0..2 * SECTIONS).contains(&tier)
}

/// A cursor as the wire carries it: opaque per the Relay spec.
pub fn encode_cursor(cursor: SearchCursor) -> String {
    B64.encode(format!(
        "search:{}:{}:{}",
        cursor.tier,
        cursor.created_at.timestamp_micros(),
        cursor.node_id
    ))
}

/// A wire cursor back to its position; None for anything this matcher
/// did not issue.
pub fn decode_cursor(cursor: &str) -> Option<SearchCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("search"), Some(tier), Some(micros), Some(id), None) = (
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
    ) else {
        return None;
    };
    let tier: i32 = tier.parse().ok()?;
    if !tier_ok(tier) {
        return None;
    }
    Some(SearchCursor {
        tier,
        created_at: chrono::DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        node_id: Uuid::parse_str(id).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use postgres_store::search::Scope as Named;

    /// An empty or all-blank query parses as blank: nothing to match, nothing to refuse.
    /// ´claim:search:a-blank-query-is-blank´
    #[test]
    fn a_blank_query_parses_as_blank() {
        assert_eq!(parse(""), Ok(Parsed::Blank));
        assert_eq!(parse(" \t\n "), Ok(Parsed::Blank));
    }

    /// The length cap counts Unicode scalar values of the trimmed query, so padding never trips it.
    /// ´claim:search:the-cap-counts-scalars-of-the-trimmed-query´
    #[test]
    fn the_cap_counts_scalars_of_the_trimmed_query() {
        let at_cap = "é".repeat(MAX_QUERY_CHARS);
        assert!(parse(&format!("  {at_cap}  ")).is_ok());
        assert_eq!(parse(&format!("{at_cap}é")), Err(QueryTooLong));
    }

    /// Only a leading @prefix or #prefix is a cue; anywhere else those characters are text.
    /// ´claim:search:only-a-leading-operator-scopes´
    #[test]
    fn only_a_leading_operator_scopes() {
        assert_eq!(parse("salt @sol"), Ok(Parsed::Unscoped("salt @sol")));
        assert_eq!(parse("a #tag"), Ok(Parsed::Unscoped("a #tag")));
        assert_eq!(
            parse("  @sol  salt maps "),
            Ok(Parsed::Scoped {
                scope: Scope::Handle,
                name: "sol",
                remainder: Some("salt maps"),
            })
        );
        assert_eq!(
            parse("#saltmaps"),
            Ok(Parsed::Scoped {
                scope: Scope::Tag,
                name: "saltmaps",
                remainder: None,
            })
        );
    }

    /// A lone cue names nothing; an @ cue folds its prefix and names nothing once it holds a character no handle can.
    /// ´claim:search:a-lone-operator-looks-up-nothing´
    #[test]
    fn a_lone_cue_names_nothing() {
        assert_eq!(cue(Scope::Handle, ""), None);
        assert_eq!(cue(Scope::Tag, ""), None);
        assert_eq!(
            cue(Scope::Handle, "So_L"),
            Some(Named::Authors {
                cue: "so_l".to_string(),
                like_body: r"so\_l".to_string(),
            })
        );
        assert_eq!(cue(Scope::Handle, "sol!"), None);
        assert_eq!(cue(Scope::Handle, &"a".repeat(31)), None);
    }

    /// A bare cue leads with its matches; with text it serves only what they reach.
    /// ´claim:search:a-bare-cue-leads-with-its-matches´
    #[test]
    fn a_bare_cue_leads_with_its_matches() {
        assert!(Scope::Handle.kinds(true).contains(&ScopedKind::User));
        assert!(!Scope::Handle.kinds(false).contains(&ScopedKind::User));
        assert!(Scope::Tag.kinds(true).contains(&ScopedKind::Hashtag));
        assert!(!Scope::Tag.kinds(false).contains(&ScopedKind::Hashtag));
        let request = scoped(
            Named::Topics {
                cue: "salt".to_string(),
                like_body: "salt".to_string(),
            },
            None,
            Scope::Tag.kinds(true),
            None,
            None,
        );
        assert_eq!(request.text, None);
        assert_eq!(request.title_query, None);
        assert_eq!(request.kinds, vec!["hashtag", "post", "comment"]);
    }

    /// A topic cue names a topic prefix by the tag grammar with the cue as its one sigil, so a second sigil names nothing.
    /// ´claim:search:a-tag-scope-names-a-canonical-topic´
    #[test]
    fn a_tag_scope_names_a_canonical_topic() {
        assert_eq!(scoped_topic("SaltMaps").as_deref(), Some("saltmaps"));
        assert_eq!(scoped_topic("#saltmaps"), None);
        assert_eq!(scoped_topic("salt:maps"), None);
        assert_eq!(scoped_topic(""), None);
        assert_eq!(
            cue(Scope::Tag, "Salt"),
            Some(Named::Topics {
                cue: "salt".to_string(),
                like_body: "salt".to_string(),
            })
        );
    }

    /// The pattern metacharacters a query carries match themselves, never as wildcards.
    /// ´claim:search:like-metacharacters-match-literally´
    #[test]
    fn like_metacharacters_match_literally() {
        assert_eq!(like_body(r"50%_off\"), r"50\%\_off\\");
    }

    /// A word query requires every typed word and reads the last one as a prefix, so a title or a display name refines as it is typed.
    /// ´claim:search:the-last-title-word-is-a-prefix´
    #[test]
    fn the_last_title_word_is_a_prefix() {
        assert_eq!(
            title_query("Salt maps, of the co").as_deref(),
            Some("'Salt' & 'maps' & 'of' & 'the' & 'co':*")
        );
        assert_eq!(title_query("salt-ma").as_deref(), Some("'salt' & 'ma':*"));
        assert_eq!(title_query("!!! ..."), None);
        assert_eq!(title_query("it's").as_deref(), Some("'it' & 's':*"));
    }

    /// A search cursor decodes back to its position, every section's tiers included, and one this matcher did not issue decodes to nothing.
    /// ´claim:search:a-search-cursor-round-trips´
    #[test]
    fn a_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        for tier in 0..2 * SECTIONS {
            let cursor = SearchCursor {
                tier,
                created_at: chrono::DateTime::from_timestamp_micros(1_791_354_394_123_456)
                    .expect("instant"),
                node_id: Uuid::new_v4(),
            };
            assert_eq!(decode_cursor(&encode_cursor(cursor)), Some(cursor));
        }
        for foreign in [
            "not base64!",
            &B64.encode("search:6:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("search:-1:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("1:2:3"),
            &B64.encode("search:0:0:not-a-uuid"),
            &B64.encode("search:0:0:00000000-0000-0000-0000-000000000000:extra"),
        ] {
            assert_eq!(decode_cursor(foreign), None, "{foreign}");
        }
    }
}
