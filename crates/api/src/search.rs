//! ´mod:module:search´
//!
//! The one search matcher (api-spec.md "Search"): how a typed query
//! becomes a match request over the `search_index` projection.
//! `Query.search` and `Query.referenceCandidates` both go through here,
//! and so will `User.viewHistory(query:)` — no surface grows a second
//! matcher.
//!
//! What the matcher owns, stated once:
//!
//! - **Parsing.** The query is trimmed; a blank query matches nothing and
//!   is never an error; past [`MAX_QUERY_CHARS`] it is refused. Only a
//!   LEADING `@handle` or `#tag` is a scope operator — anywhere else
//!   those characters are text.
//! - **Name-class fields** (a handle, a display name, a topic's name)
//!   match case-insensitively by substring, which takes in the prefix:
//!   the index's trigram operator class serves `LIKE` (PostgreSQL docs,
//!   *pg_trgm*, "Index Support").
//! - **Post titles** match by word: full text under the `simple`
//!   configuration, the last word as a prefix so a title refines as it is
//!   typed (PostgreSQL docs §12.3.2, prefix matching in `to_tsquery`).
//! - **Tiers.** A node whose indexed field equals the query
//!   case-insensitively is tier 0; any other match is tier 1. Order is
//!   tier, then newest first, then id.
//!
//! The scoped branch — what `@handle <text>` and `#tag <text>` serve —
//! is [`Parsed::Scoped`]'s to answer. It is not built yet (search-surface
//! B2); until it is, a scoped query reads empty.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::search::{MatchQuery, SearchCursor};
use uuid::Uuid;

/// The longest query accepted, in Unicode scalar values: a full post
/// title (500), a separator and a scope operator of a full-length handle
/// or tag, with headroom. Longer is a malformed argument, not a miss.
pub const MAX_QUERY_CHARS: usize = 640;

/// A kind the index serves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexKind {
    User,
    Post,
    Hashtag,
}

impl IndexKind {
    /// Every kind the unscoped matcher serves today.
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

/// A leading scope operator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    /// `@handle` — one person's work.
    Handle,
    /// `#tag` — inside a topic.
    Tag,
}

/// A query, parsed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Parsed<'a> {
    /// Nothing to match: an empty or all-blank query.
    Blank,
    /// No scope operator — the whole (trimmed) query is text.
    Unscoped(&'a str),
    /// A leading scope operator, the name it carries, and the text after
    /// it, if any.
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

/// The match request for unscoped `text` over `kinds`. `exclude_seen_by`
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
/// required, the last matched as a prefix. A word is a maximal run of
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
    if !(0..=1).contains(&tier) {
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

    /// Only a leading @handle or #tag scopes a query; anywhere else those characters are text.
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

    /// The pattern metacharacters a query carries match themselves, never as wildcards.
    /// ´claim:search:like-metacharacters-match-literally´
    #[test]
    fn like_metacharacters_match_literally() {
        assert_eq!(like_body(r"50%_off\"), r"50\%\_off\\");
    }

    /// A title query requires every typed word and reads the last one as a prefix, so a title refines as it is typed.
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

    /// A search cursor decodes back to its position, and one this matcher did not issue decodes to nothing.
    /// ´claim:search:a-search-cursor-round-trips´
    #[test]
    fn a_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        let cursor = SearchCursor {
            tier: 1,
            created_at: chrono::DateTime::from_timestamp_micros(1_791_354_394_123_456)
                .expect("instant"),
            node_id: Uuid::new_v4(),
        };
        assert_eq!(decode_cursor(&encode_cursor(cursor)), Some(cursor));
        for foreign in [
            "not base64!",
            &B64.encode("search:2:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("1:2:3"),
            &B64.encode("search:0:0:not-a-uuid"),
            &B64.encode("search:0:0:00000000-0000-0000-0000-000000000000:extra"),
        ] {
            assert_eq!(decode_cursor(foreign), None, "{foreign}");
        }
    }
}
