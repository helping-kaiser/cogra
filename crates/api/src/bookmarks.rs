//! ´mod:module:bookmarks´
//!
//! The Saved list's API half (api-spec.md `User.bookmarks`,
//! `setBookmark`, `removeBookmark`): the keyset cursors over the list —
//! plain, and narrowed by a query through the one search matcher — and
//! the rule an Undo's restored time obeys.
//!
//! The store holds the laws that matter most — the primary key makes a
//! save once per node, and the registries decide what is saveable
//! (`postgres_store::bookmarks`). What lives here is what the wire adds:
//! an opaque cursor and the clock-skew allowance.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{DateTime, Duration, Utc};
use postgres_store::bookmarks::{BookmarkCursor, SavedMatchCursor};
use uuid::Uuid;

/// How far past the server's now a restored save time may stand: client
/// clocks drift, and an Undo passes back a time the server itself issued,
/// so a few seconds of skew is the only lateness an honest client shows.
pub const RESTORE_SKEW_SECS: i64 = 5;

/// Whether `at` is a save time a restore may carry: never later than now
/// past the skew allowance.
pub fn restore_time_ok(at: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    at <= now + Duration::seconds(RESTORE_SKEW_SECS)
}

/// A cursor as the wire carries it: opaque per the Relay spec.
pub fn encode_cursor(cursor: BookmarkCursor) -> String {
    B64.encode(format!(
        "saved:{}:{}",
        cursor.bookmarked_at.timestamp_micros(),
        cursor.content_id
    ))
}

/// A wire cursor back to its position; None for anything this list did
/// not issue.
pub fn decode_cursor(cursor: &str) -> Option<BookmarkCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("saved"), Some(micros), Some(id), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    Some(BookmarkCursor {
        bookmarked_at: DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        content_id: Uuid::parse_str(id).ok()?,
    })
}

/// A narrowed list's cursor as the wire carries it. Its own prefix keeps
/// it from ever passing for a plain list's: a page narrowed by a query
/// and one that is not are two orders.
pub fn encode_match_cursor(cursor: SavedMatchCursor) -> String {
    B64.encode(format!(
        "savedq:{}:{}:{}",
        cursor.section,
        cursor.bookmarked_at.timestamp_micros(),
        cursor.content_id
    ))
}

/// A narrowed list's wire cursor back to its position; None for anything
/// a narrowed Saved read did not issue.
pub fn decode_match_cursor(cursor: &str) -> Option<SavedMatchCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("savedq"), Some(section), Some(micros), Some(id), None) = (
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
    Some(SavedMatchCursor {
        section,
        bookmarked_at: DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        content_id: Uuid::parse_str(id).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A narrowed Saved cursor decodes back to its position, and neither list's cursor passes for the other's.
    /// ´claim:bookmarks:a-narrowed-cursor-round-trips´
    #[test]
    fn a_narrowed_cursor_round_trips_and_the_lists_never_share_one() {
        let cursor = SavedMatchCursor {
            section: 2,
            bookmarked_at: DateTime::from_timestamp_micros(1_791_354_394_123_456).expect("instant"),
            content_id: Uuid::new_v4(),
        };
        assert_eq!(
            decode_match_cursor(&encode_match_cursor(cursor)),
            Some(cursor)
        );
        let plain = BookmarkCursor {
            bookmarked_at: cursor.bookmarked_at,
            content_id: cursor.content_id,
        };
        assert_eq!(decode_match_cursor(&encode_cursor(plain)), None);
        assert_eq!(decode_cursor(&encode_match_cursor(cursor)), None);
        for foreign in [
            &B64.encode("savedq:3:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("savedq:x:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("savedq:0:0:not-a-uuid"),
        ] {
            assert_eq!(decode_match_cursor(foreign), None, "{foreign}");
        }
    }

    /// A Saved cursor decodes back to its position, and one this list did not issue decodes to nothing.
    /// ´claim:bookmarks:a-saved-cursor-round-trips´
    #[test]
    fn a_saved_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        let cursor = BookmarkCursor {
            bookmarked_at: DateTime::from_timestamp_micros(1_791_354_394_123_456).expect("instant"),
            content_id: Uuid::new_v4(),
        };
        assert_eq!(decode_cursor(&encode_cursor(cursor)), Some(cursor));
        for foreign in [
            "not base64!",
            &B64.encode("history:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("saved:x:00000000-0000-0000-0000-000000000000"),
            &B64.encode("saved:0:not-a-uuid"),
            &B64.encode("saved:0:00000000-0000-0000-0000-000000000000:extra"),
        ] {
            assert_eq!(decode_cursor(foreign), None, "{foreign}");
        }
    }

    /// A restored save time may run the skew allowance past now and no further.
    /// ´claim:bookmarks:a-restore-time-allows-the-skew-and-no-more´
    #[test]
    fn a_restore_time_allows_the_skew_and_no_more() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).expect("instant");
        assert!(restore_time_ok(now - Duration::days(400), now));
        assert!(restore_time_ok(now, now));
        assert!(restore_time_ok(
            now + Duration::seconds(RESTORE_SKEW_SECS),
            now
        ));
        assert!(!restore_time_ok(
            now + Duration::seconds(RESTORE_SKEW_SECS) + Duration::microseconds(1),
            now
        ));
    }
}
