//! ´mod:module:hidden´
//!
//! The hidden-actors list's API half (api-spec.md `User.hiddenActors`,
//! `hideActor`, `unhideActor`): the keyset cursor over the list and the rule
//! a restored moment obeys. The store holds the once-per-actor law and the
//! cascade (`postgres_store::hidden`); what lives here is what the wire adds.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::DateTime;
use postgres_store::hidden::HiddenCursor;
use uuid::Uuid;

/// A cursor as the wire carries it: opaque per the Relay spec.
pub fn encode_cursor(cursor: HiddenCursor) -> String {
    B64.encode(format!(
        "hidden:{}:{}",
        cursor.hidden_at.timestamp_micros(),
        cursor.actor_id
    ))
}

/// A wire cursor back to its position; None for anything this list did
/// not issue.
pub fn decode_cursor(cursor: &str) -> Option<HiddenCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let mut parts = text.split(':');
    let (Some("hidden"), Some(micros), Some(id), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    Some(HiddenCursor {
        hidden_at: DateTime::from_timestamp_micros(micros.parse().ok()?)?,
        actor_id: Uuid::parse_str(id).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A hidden-list cursor decodes back to its position, and one this list did not issue decodes to nothing.
    /// ´claim:hidden:a-hidden-cursor-round-trips´
    #[test]
    fn a_hidden_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        let cursor = HiddenCursor {
            hidden_at: DateTime::from_timestamp_micros(1_791_354_394_123_456).expect("instant"),
            actor_id: Uuid::new_v4(),
        };
        assert_eq!(decode_cursor(&encode_cursor(cursor)), Some(cursor));
        for foreign in [
            "not base64!",
            &B64.encode("saved:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("hidden:x:00000000-0000-0000-0000-000000000000"),
            &B64.encode("hidden:0:not-a-uuid"),
            &B64.encode("hidden:0:00000000-0000-0000-0000-000000000000:extra"),
        ] {
            assert_eq!(decode_cursor(foreign), None, "{foreign}");
        }
    }
}
