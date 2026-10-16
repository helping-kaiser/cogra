//! ´mod:module:history´
//!
//! The seen-list's API half (api-spec.md `User.viewHistory`, `markSeen`;
//! feed-ranking.md §9.4): which kinds History serves, the batch rule a
//! `markSeen` call obeys, and the keyset cursors over the list — plain,
//! and narrowed by a query through the one search matcher.
//!
//! The store holds the law that matters most — the primary key makes the
//! list append-once, and the registries decide what is seeable
//! (`postgres_store::history`). What lives here is what the wire adds: a
//! batch cap, a batch's order, and an opaque cursor.

use std::collections::HashSet;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::history::{HistoryCursor, HistoryMatchCursor};
use uuid::Uuid;

/// The most ids one `markSeen` call carries: the page budget
/// (api-spec.md "Pagination"), so a flush never outgrows the page that
/// showed it.
pub const MAX_MARK_SEEN: usize = crate::schema::types::MAX_PAGE_SIZE as usize;

/// A kind History serves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HistoryKind {
    Post,
    Comment,
    User,
    Hashtag,
}

impl HistoryKind {
    /// Every kind History serves today; later slices widen the set.
    pub const ALL: [Self; 4] = [Self::Post, Self::Comment, Self::User, Self::Hashtag];

    /// The kind as the seen-list's `kind` column spells it.
    pub fn as_store(self) -> &'static str {
        match self {
            Self::Post => "post",
            Self::Comment => "comment",
            Self::User => "user",
            Self::Hashtag => "hashtag",
        }
    }
}

/// A batch's ids with each id kept at its first position: the first
/// time a thing was seen is the only seeing that counts, so a repeat
/// later in the same batch must not move it.
pub fn first_seeings(ids: &[Uuid]) -> Vec<Uuid> {
    let mut seen = HashSet::with_capacity(ids.len());
    ids.iter().copied().filter(|id| seen.insert(*id)).collect()
}

/// A cursor as the wire carries it: opaque per the Relay spec.
pub fn encode_cursor(cursor: HistoryCursor) -> String {
    B64.encode(format!(
        "history:{}:{}",
        cursor.first_seen_at.timestamp_micros(),
        cursor.content_id
    ))
}

/// A wire cursor back to its position; None for anything this list did
/// not issue.
pub fn decode_cursor(cursor: &str) -> Option<HistoryCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("history"), Some(micros), Some(id), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    Some(HistoryCursor {
        first_seen_at: chrono::DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        content_id: Uuid::parse_str(id).ok()?,
    })
}

/// A narrowed list's cursor as the wire carries it. Its own prefix keeps
/// it from ever passing for a plain list's: a page narrowed by a query
/// and one that is not are two orders.
pub fn encode_match_cursor(cursor: HistoryMatchCursor) -> String {
    B64.encode(format!(
        "historyq:{}:{}:{}",
        cursor.section,
        cursor.first_seen_at.timestamp_micros(),
        cursor.content_id
    ))
}

/// A narrowed list's wire cursor back to its position; None for anything
/// a narrowed History read did not issue.
pub fn decode_match_cursor(cursor: &str) -> Option<HistoryMatchCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("historyq"), Some(section), Some(micros), Some(id), None) = (
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
    ) else {
        return None;
    };
    let section: i32 = section.parse().ok()?;
    if !(0..postgres_store::search::SECTIONS).contains(&section) {
        return None;
    }
    Some(HistoryMatchCursor {
        section,
        first_seen_at: chrono::DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        content_id: Uuid::parse_str(id).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A repeat inside one batch keeps the id's first position, so a batch cannot move a thing it already holds.
    /// ´claim:history:a-batch-keeps-each-first-seeing´
    #[test]
    fn a_batch_keeps_each_first_seeing() {
        let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        assert_eq!(first_seeings(&[a, b, a, c, b]), vec![a, b, c]);
        assert_eq!(first_seeings(&[]), Vec::<Uuid>::new());
    }

    /// A history cursor decodes back to its position, and one this list did not issue decodes to nothing.
    /// ´claim:history:a-history-cursor-round-trips´
    #[test]
    fn a_history_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        let cursor = HistoryCursor {
            first_seen_at: chrono::DateTime::from_timestamp_micros(1_791_354_394_123_456)
                .expect("instant"),
            content_id: Uuid::new_v4(),
        };
        assert_eq!(decode_cursor(&encode_cursor(cursor)), Some(cursor));
        for foreign in [
            "not base64!",
            &B64.encode("search:0:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("history:x:00000000-0000-0000-0000-000000000000"),
            &B64.encode("history:0:not-a-uuid"),
            &B64.encode("history:0:00000000-0000-0000-0000-000000000000:extra"),
        ] {
            assert_eq!(decode_cursor(foreign), None, "{foreign}");
        }
    }

    /// A narrowed History cursor decodes back to its position, and neither list's cursor passes for the other's, nor for Saved's.
    /// ´claim:history:a-narrowed-cursor-round-trips´
    #[test]
    fn a_narrowed_history_cursor_round_trips_and_passes_for_no_other_lists() {
        let cursor = HistoryMatchCursor {
            section: 2,
            first_seen_at: chrono::DateTime::from_timestamp_micros(1_791_354_394_123_456)
                .expect("instant"),
            content_id: Uuid::new_v4(),
        };
        assert_eq!(
            decode_match_cursor(&encode_match_cursor(cursor)),
            Some(cursor)
        );
        let plain = HistoryCursor {
            first_seen_at: cursor.first_seen_at,
            content_id: cursor.content_id,
        };
        assert_eq!(decode_match_cursor(&encode_cursor(plain)), None);
        assert_eq!(decode_cursor(&encode_match_cursor(cursor)), None);
        for foreign in [
            &B64.encode("savedq:2:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("historyq:3:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("historyq:x:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("historyq:0:0:not-a-uuid"),
        ] {
            assert_eq!(decode_match_cursor(foreign), None, "{foreign}");
        }
    }
}
