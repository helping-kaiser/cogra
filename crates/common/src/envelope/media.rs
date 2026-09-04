//! ´mod:module:media´
//!
//! Key 5 is the media manifest: an array of per-asset maps carrying the
//! digest of the bytes, the type they are to be read as, and the alt text
//! describing them, with array position carrying gallery order. It commits
//! what a reader needs to render honestly and nothing a server measured —
//! aspect ratio, size, and duration are derived, so they stay out of what
//! the author signs. The nested map runs the same reserved-key discipline
//! the outer envelope runs, so a v2 grows it additively.
//!
//! Key 11 carries the profile's avatar as that same per-asset map, one
//! deep. An avatar is a picture a reader is shown, so it is witnessed like
//! any other; and a profile payload being a delta rather than complete
//! state, the slot is three-valued — the empty array is how an update says
//! "cleared".
//!

use std::collections::BTreeMap;

use crate::envelope::EnvelopeError;
use crate::envelope::pce::Value;

pub(super) const ASSET_KEY_DIGEST: u64 = 0;
pub(super) const ASSET_KEY_MIME: u64 = 1;
pub(super) const ASSET_KEY_ALT_TEXT: u64 = 2;

/// SHA-256, the algorithm the manifest's digests are (data-model.md
/// `media_attachments`). The length is the only place the choice appears
/// on the wire — no algorithm tag rides the envelope — so changing it is a
/// guild schema-version bump, not a silent reinterpretation.
pub const MEDIA_DIGEST_LEN: usize = 32;

/// One asset in the media manifest (guild key 5).
///
/// The three fields are what a reader needs to render the asset honestly:
/// which bytes (`digest`), what to read them as (`mime`), and what the
/// picture is of (`alt_text`). Alt text rides here rather than staying
/// Postgres-side because it is what a blind reader *reads* — leaving it
/// unwitnessed while the body is witnessed would make the accessible
/// rendering the only one a reader cannot check against the record.
///
/// Everything a server measured — aspect ratio, byte size, duration —
/// stays out: the author signs what they wrote, never a measurement.
/// Gallery order is the array position, so no index rides that could
/// disagree with the order it is stored in.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaAsset {
    pub digest: [u8; MEDIA_DIGEST_LEN],
    pub mime: String,
    pub alt_text: Option<String>,
}

impl MediaAsset {
    pub(super) fn encode(&self) -> Value {
        let mut map = BTreeMap::new();
        map.insert(ASSET_KEY_DIGEST, Value::Bytes(self.digest.to_vec()));
        map.insert(ASSET_KEY_MIME, Value::Text(self.mime.clone()));
        if let Some(alt_text) = &self.alt_text {
            map.insert(ASSET_KEY_ALT_TEXT, Value::Text(alt_text.clone()));
        }
        Value::Map(map)
    }

    /// One entry's admission. Unknown keys are refused rather than
    /// ignored — the same reserved-key discipline the outer envelope
    /// runs, so a v2 field cannot be silently dropped by a v1 reader
    /// that would then render an asset it did not fully understand.
    pub(super) fn decode(value: &Value) -> Result<Self, EnvelopeError> {
        let Value::Map(map) = value else {
            return Err(EnvelopeError::Guild("media entry must be a map"));
        };
        for key in map.keys() {
            if *key > ASSET_KEY_ALT_TEXT {
                return Err(EnvelopeError::Guild("unknown media entry field"));
            }
        }
        let Some(Value::Bytes(digest)) = map.get(&ASSET_KEY_DIGEST) else {
            return Err(EnvelopeError::Guild("missing media digest"));
        };
        let digest: [u8; MEDIA_DIGEST_LEN] = digest
            .as_slice()
            .try_into()
            .map_err(|_| EnvelopeError::Guild("media digest must be 32 bytes"))?;
        let mime = match map.get(&ASSET_KEY_MIME) {
            Some(Value::Text(mime)) if !mime.is_empty() => mime.clone(),
            Some(Value::Text(_)) => {
                return Err(EnvelopeError::Guild("media mime must not be empty"));
            }
            _ => return Err(EnvelopeError::Guild("missing media mime")),
        };
        let alt_text = match map.get(&ASSET_KEY_ALT_TEXT) {
            None => None,
            Some(Value::Text(alt)) if !alt.is_empty() => Some(alt.clone()),
            Some(Value::Text(_)) => {
                return Err(EnvelopeError::Guild("empty media alt text must be omitted"));
            }
            Some(_) => return Err(EnvelopeError::Guild("media alt text must be text")),
        };
        Ok(Self {
            digest,
            mime,
            alt_text,
        })
    }
}
