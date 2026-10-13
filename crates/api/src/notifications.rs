//! ´mod:module:notifications´
//!
//! The notification list's API half (api-spec.md `User.notifications`,
//! `User.hasUnreadNotifications`, `markNotificationsSeen`,
//! `markNotificationRead`): the keyset cursor over the list. The writers
//! and the read law live in the store (`postgres_store::notifications`).

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::notifications::NotificationCursor;
use uuid::Uuid;

/// A cursor as the wire carries it: opaque per the Relay spec.
pub fn encode_cursor(cursor: NotificationCursor) -> String {
    B64.encode(format!(
        "notifications:{}:{}",
        cursor.created_at.timestamp_micros(),
        cursor.id
    ))
}

/// A wire cursor back to its position; None for anything this list did
/// not issue.
pub fn decode_cursor(cursor: &str) -> Option<NotificationCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("notifications"), Some(micros), Some(id), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    Some(NotificationCursor {
        created_at: chrono::DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        id: Uuid::parse_str(id).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A notification cursor decodes back to its position, and one this list did not issue decodes to nothing.
    /// ´claim:notifications:a-notification-cursor-round-trips´
    #[test]
    fn a_notification_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        let cursor = NotificationCursor {
            created_at: chrono::DateTime::from_timestamp_micros(1_791_354_394_123_456)
                .expect("instant"),
            id: Uuid::new_v4(),
        };
        assert_eq!(decode_cursor(&encode_cursor(cursor)), Some(cursor));
        for foreign in [
            "garbage",
            &B64.encode("history:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("notifications:x:00000000-0000-0000-0000-000000000000"),
            &B64.encode("notifications:0:not-a-uuid"),
            &B64.encode("notifications:0:00000000-0000-0000-0000-000000000000:extra"),
        ] {
            assert_eq!(decode_cursor(foreign), None, "{foreign}");
        }
    }
}
