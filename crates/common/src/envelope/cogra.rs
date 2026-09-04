//! ´mod:module:cogra´
//!
//! CoGra's fields ride guild key 49258 (0xC06A) as a nested integer-keyed
//! map (data-model.md "CoGra's guild schema"). CoGra currently produces
//! only empty-body envelopes, so the spec's §3 text pipeline (Unicode
//! normalization and counting for non-empty bodies) is deliberately not
//! implemented — it arrives if CoGra ever emits a non-empty key-1 body.
//! Everything else is enforced: the magic, Gate P's key-set rule, CDE
//! canonicality (decode re-encodes and compares), the §4.4 empty-value
//! rules, and the reserved-range rejection.
//!
//!
//! Inside the guild map, keys 2–6 and 13–14 ride Publish/Review payloads
//! and keys 7–11 the parallel-Registration profile payload, each family's
//! reader rejecting the other's keys. Two of those are declared but not built:
//! key 6 (provenance chain, platform-guidelines.md §5 plank 4) and key 10
//! (payout address, which arrives with the rail — ledger.md). Neither is
//! ever produced, and both are rejected on read until their slices define
//! them. Key 12 is retired and never reallocated: a profile carries one
//! image, so the slot it held has no successor to inherit its number.
//!
//!
//! Keys 13 and 14 carry the author's own sensitive mark and its optional
//! public reason. They are witnessed rather than Postgres-side because a
//! self-mark is the author's statement about their own content: a reader
//! can check the veil they are shown against the record, and a mirror
//! rebuilt from L1 restores it with the body it belongs to.

use std::collections::BTreeMap;

use uuid::Uuid;

use crate::envelope::EnvelopeError;
use crate::envelope::media::MediaAsset;
use crate::envelope::pce::{COGRA_GUILD_KEY, Envelope, VERSION_V1, Value};

/// CoGra's guild-map schema version (key 0 of the nested map).
pub const COGRA_SCHEMA_V1: u64 = 1;

pub(super) const COGRA_KEY_VERSION: u64 = 0;
pub(super) const COGRA_KEY_NODE: u64 = 1;
pub(super) const COGRA_KEY_TITLE: u64 = 2;
pub(super) const COGRA_KEY_DESCRIPTION: u64 = 3;
pub(super) const COGRA_KEY_BODY: u64 = 4;
pub(super) const COGRA_KEY_MEDIA: u64 = 5;
pub(super) const COGRA_KEY_DISPLAY_NAME: u64 = 7;
pub(super) const COGRA_KEY_BIO: u64 = 8;
pub(super) const COGRA_KEY_WEBSITE_URL: u64 = 9;
pub(super) const COGRA_KEY_AVATAR: u64 = 11;
/// Key 12 held the profile cover and is **retired**: the profile carries
/// one image. It is not returned to the unallocated pool — a number that
/// once meant something is never given a second meaning, so a payload
/// carrying it is refused as an unknown profile field rather than read as
/// whatever key 12 might mean next.
pub(super) const COGRA_KEY_RETIRED_COVER: u64 = 12;
/// The author's own sensitive mark, carried as `1` and omitted when
/// unmarked — the veil the author asked for rides the witnessed payload
/// so a reader can check it against the record, the same reason alt text
/// does. Complete-state like every content key: an edit that omits it is
/// an unmarked post.
pub(super) const COGRA_KEY_SENSITIVE: u64 = 13;
/// The optional public reason shown on the veil (design/readme.md §13).
/// Valid only alongside key 13.
pub(super) const COGRA_KEY_SENSITIVE_REASON: u64 = 14;
/// The only value key 13 ever carries. A mark is presence, not a
/// boolean: one state has one encoding, so two payloads cannot disagree
/// about the same unmarked post.
pub(super) const COGRA_SENSITIVE_SET: u64 = 1;

/// The manifest under guild key 5, as the content family reads it. An
/// absent key and an empty manifest are the same state and only the
/// absent form is legal — PCE §4.4's rule that an optional field's empty
/// value is omitted rather than carried in band, applied inside the guild
/// map so one gallery has exactly one encoding.
fn guild_media(cogra: &BTreeMap<u64, Value>) -> Result<Vec<MediaAsset>, EnvelopeError> {
    match cogra.get(&COGRA_KEY_MEDIA) {
        None => Ok(Vec::new()),
        Some(Value::Array(items)) if items.is_empty() => {
            Err(EnvelopeError::Guild("empty media manifest must be omitted"))
        }
        Some(Value::Array(items)) => items.iter().map(MediaAsset::decode).collect(),
        Some(_) => Err(EnvelopeError::Guild("media manifest must be an array")),
    }
}

/// The profile's image slot — the avatar — under its profile family key.
///
/// A profile payload is a **delta**: a key that is absent leaves the field
/// as it stands, and a key present-and-empty clears it. The text fields
/// already run that rule with the empty string; a slot runs it with an
/// empty array, so all three states an update can mean have exactly one
/// encoding each — absent (untouched), `[]` (cleared), `[asset]` (set).
///
/// The content family's manifest refuses an in-band empty for the opposite
/// reason and it is not an inconsistency: a content act carries the
/// complete content state, so "no gallery" is the absent key and there is
/// no third state to distinguish.
///
/// An image slot carries a whole [`MediaAsset`] rather than a bare digest,
/// so the same reader that renders a gallery renders an avatar, and so an
/// avatar's alt text is witnessed like any other picture's.
fn encode_profile_image(slot: Option<Option<MediaAsset>>) -> Option<Value> {
    slot.map(|asset| Value::Array(asset.iter().map(MediaAsset::encode).collect()))
}

fn guild_profile_image(
    cogra: &BTreeMap<u64, Value>,
    key: u64,
) -> Result<Option<Option<MediaAsset>>, EnvelopeError> {
    match cogra.get(&key) {
        None => Ok(None),
        Some(Value::Array(items)) if items.is_empty() => Ok(Some(None)),
        Some(Value::Array(items)) if items.len() == 1 => {
            Ok(Some(Some(MediaAsset::decode(&items[0])?)))
        }
        Some(Value::Array(_)) => Err(EnvelopeError::Guild("a profile image is a single asset")),
        Some(_) => Err(EnvelopeError::Guild("a profile image must be an array")),
    }
}

/// The shared guild admission both CoGra payload families run first
/// (a tightening of the PCE gates, permitted by PCE §10): version
/// `[1,1,1,1]`, empty key-1 body, exactly the CoGra guild key, and
/// schema version 1. Returns the inner guild map.
fn cogra_guild_map(envelope: &Envelope) -> Result<&BTreeMap<u64, Value>, EnvelopeError> {
    if envelope.version != VERSION_V1 {
        return Err(EnvelopeError::Guild("unsupported version vector"));
    }
    if !envelope.body.is_empty() {
        return Err(EnvelopeError::Guild("key-1 body must be empty"));
    }
    if envelope.extensions.len() != 1 {
        return Err(EnvelopeError::Guild("exactly one guild key expected"));
    }
    let Some(Value::Map(cogra)) = envelope.extensions.get(&COGRA_GUILD_KEY) else {
        return Err(EnvelopeError::Guild("missing cogra guild map"));
    };
    match cogra.get(&COGRA_KEY_VERSION) {
        Some(Value::Uint(v)) if *v == COGRA_SCHEMA_V1 => {}
        _ => return Err(EnvelopeError::Guild("unsupported cogra schema version")),
    }
    Ok(cogra)
}

fn guild_node_id(cogra: &BTreeMap<u64, Value>) -> Result<Uuid, EnvelopeError> {
    match cogra.get(&COGRA_KEY_NODE) {
        Some(Value::Bytes(b)) => {
            Uuid::from_slice(b).map_err(|_| EnvelopeError::Guild("node id must be 16 bytes"))
        }
        _ => Err(EnvelopeError::Guild("missing node id")),
    }
}

fn guild_text_field(
    cogra: &BTreeMap<u64, Value>,
    key: u64,
) -> Result<Option<String>, EnvelopeError> {
    match cogra.get(&key) {
        None => Ok(None),
        Some(Value::Text(s)) => Ok(Some(s.clone())),
        Some(_) => Err(EnvelopeError::Guild("text field with non-text value")),
    }
}

/// The author's self-mark, read off keys 13 and 14.
///
/// A reason without the mark it explains is refused rather than dropped:
/// the payload would otherwise carry a warning no reader is ever shown,
/// and the author signed a state the graph does not hold.
fn guild_sensitive(cogra: &BTreeMap<u64, Value>) -> Result<Option<SensitiveMark>, EnvelopeError> {
    let reason = guild_text_field(cogra, COGRA_KEY_SENSITIVE_REASON)?;
    match cogra.get(&COGRA_KEY_SENSITIVE) {
        None if reason.is_some() => Err(EnvelopeError::Guild("sensitive reason without the mark")),
        None => Ok(None),
        Some(Value::Uint(v)) if *v == COGRA_SENSITIVE_SET => Ok(Some(SensitiveMark { reason })),
        Some(_) => Err(EnvelopeError::Guild(
            "sensitive mark with an unexpected value",
        )),
    }
}

/// CoGra's guild fields, as carried under `COGRA_GUILD_KEY`
/// (data-model.md "CoGra's guild schema"). Field presence is meaningful:
/// on a genesis act every supplied field is present; on an edit only the
/// changed fields ride, and a present-but-empty text clears the field
/// (post.md §4 — per-field newest-wins fold). `node` is the L2 UUID the
/// display row shares with the graph; the payload witness covering these
/// bytes is what proves that binding.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CograContent {
    pub node: Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub body: Option<String>,
    /// The gallery in order. Empty is the absent manifest: a content act
    /// carries the complete content state, so an edit that drops every
    /// asset omits key 5 and the winning record renders no gallery.
    pub media: Vec<MediaAsset>,
    /// The author's own sensitive mark, `None` when unmarked. Absent and
    /// present are the whole vocabulary — an edit that omits it unmarks,
    /// because a content act carries the complete content state.
    pub sensitive: Option<SensitiveMark>,
}

/// An author's self-mark: "this is sensitive, here is why". The reason is
/// optional and public — it is shown on the veil, so a reader decides
/// whether to look knowing what they would be looking at
/// (design/readme.md §13).
///
/// The mark is one bit and its reach is fixed: it veils the body — media,
/// words and description as one region — and leaves the title and topics
/// readable (moderation.md §1). There is no per-field choice to encode,
/// so nothing here names a field.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SensitiveMark {
    pub reason: Option<String>,
}

impl CograContent {
    /// Wraps the fields into a full envelope (empty PCE body — CoGra's
    /// key-1 policy this slice; data-model.md "The payload envelope").
    pub fn into_envelope(self) -> Envelope {
        let mut cogra = BTreeMap::new();
        cogra.insert(COGRA_KEY_VERSION, Value::Uint(COGRA_SCHEMA_V1));
        cogra.insert(COGRA_KEY_NODE, Value::Bytes(self.node.as_bytes().to_vec()));
        if let Some(title) = self.title {
            cogra.insert(COGRA_KEY_TITLE, Value::Text(title));
        }
        if let Some(description) = self.description {
            cogra.insert(COGRA_KEY_DESCRIPTION, Value::Text(description));
        }
        if let Some(body) = self.body {
            cogra.insert(COGRA_KEY_BODY, Value::Text(body));
        }
        if !self.media.is_empty() {
            let assets = self.media.iter().map(MediaAsset::encode).collect();
            cogra.insert(COGRA_KEY_MEDIA, Value::Array(assets));
        }
        if let Some(mark) = self.sensitive {
            cogra.insert(COGRA_KEY_SENSITIVE, Value::Uint(COGRA_SENSITIVE_SET));
            if let Some(reason) = mark.reason {
                cogra.insert(COGRA_KEY_SENSITIVE_REASON, Value::Text(reason));
            }
        }
        let mut extensions = BTreeMap::new();
        extensions.insert(COGRA_GUILD_KEY, Value::Map(cogra));
        Envelope {
            version: VERSION_V1,
            body: String::new(),
            extensions,
        }
    }

    /// Serialized payload bytes for the canonical proposal.
    pub fn encode_payload(self) -> Vec<u8> {
        self.into_envelope().encode()
    }

    /// The content family's guild admission over a decoded envelope: the
    /// shared checks (`cogra_guild_map`), a 16-byte node id, and only the
    /// content keys — the still-unbuilt provenance key and the profile
    /// keys are rejected.
    pub fn from_envelope(envelope: &Envelope) -> Result<Self, EnvelopeError> {
        let cogra = cogra_guild_map(envelope)?;
        for key in cogra.keys() {
            if !matches!(
                *key,
                COGRA_KEY_VERSION
                    | COGRA_KEY_NODE
                    | COGRA_KEY_TITLE
                    | COGRA_KEY_DESCRIPTION
                    | COGRA_KEY_BODY
                    | COGRA_KEY_MEDIA
                    | COGRA_KEY_SENSITIVE
                    | COGRA_KEY_SENSITIVE_REASON
            ) {
                return Err(EnvelopeError::Guild("unknown cogra field"));
            }
        }
        Ok(Self {
            node: guild_node_id(cogra)?,
            title: guild_text_field(cogra, COGRA_KEY_TITLE)?,
            description: guild_text_field(cogra, COGRA_KEY_DESCRIPTION)?,
            body: guild_text_field(cogra, COGRA_KEY_BODY)?,
            media: guild_media(cogra)?,
            sensitive: guild_sensitive(cogra)?,
        })
    }

    /// Decode + guild admission in one step — the read used at prepare
    /// (self-check of our own construction) and at confirm (promotion
    /// parses the staged payload back out).
    pub fn decode_payload(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        Self::from_envelope(&Envelope::decode(bytes)?)
    }
}

/// The profile payload a parallel Registration carries — guild keys 7–11
/// (data-model.md "CoGra's guild schema"; substrate.md §9, user.md §4).
/// Same presence semantics as content: a genesis-shaped payload carries
/// every supplied field, an edit only the changed ones, and a
/// present-but-empty text clears (the API refuses the display-name
/// clear before it ever reaches an envelope). `node` is the actor's
/// UUID — the key `actor_profile_versions` shares with the graph's
/// Profile node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CograProfile {
    pub node: Uuid,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub website_url: Option<String>,
    /// The avatar slot — the profile's one image — three-valued: None
    /// leaves it alone, `Some(None)` clears it back to the monogram,
    /// `Some(Some(asset))` replaces it. The asset rides here rather than
    /// staying Postgres-side because erasure removes an avatar's bytes and
    /// leaves its digest committed in the witnessed payload (erasure.md
    /// §2) — which is only true if the payload carries one.
    pub avatar: Option<Option<MediaAsset>>,
}

impl CograProfile {
    /// Wraps the fields into a full envelope (empty PCE body — CoGra's
    /// key-1 policy; data-model.md "The payload envelope").
    pub fn into_envelope(self) -> Envelope {
        let mut cogra = BTreeMap::new();
        cogra.insert(COGRA_KEY_VERSION, Value::Uint(COGRA_SCHEMA_V1));
        cogra.insert(COGRA_KEY_NODE, Value::Bytes(self.node.as_bytes().to_vec()));
        if let Some(display_name) = self.display_name {
            cogra.insert(COGRA_KEY_DISPLAY_NAME, Value::Text(display_name));
        }
        if let Some(bio) = self.bio {
            cogra.insert(COGRA_KEY_BIO, Value::Text(bio));
        }
        if let Some(website_url) = self.website_url {
            cogra.insert(COGRA_KEY_WEBSITE_URL, Value::Text(website_url));
        }
        if let Some(avatar) = encode_profile_image(self.avatar) {
            cogra.insert(COGRA_KEY_AVATAR, avatar);
        }
        let mut extensions = BTreeMap::new();
        extensions.insert(COGRA_GUILD_KEY, Value::Map(cogra));
        Envelope {
            version: VERSION_V1,
            body: String::new(),
            extensions,
        }
    }

    /// Serialized payload bytes for the canonical proposal.
    pub fn encode_payload(self) -> Vec<u8> {
        self.into_envelope().encode()
    }

    /// The profile family's guild admission: the shared checks
    /// (`cogra_guild_map`), a 16-byte node id, and only the profile
    /// keys — content keys, reserved keys, the assigned-but-unbuilt
    /// payout key, and the retired cover key are rejected.
    pub fn from_envelope(envelope: &Envelope) -> Result<Self, EnvelopeError> {
        let cogra = cogra_guild_map(envelope)?;
        for key in cogra.keys() {
            if *key == COGRA_KEY_RETIRED_COVER {
                return Err(EnvelopeError::Guild("retired cogra profile field"));
            }
            let known = matches!(
                *key,
                COGRA_KEY_VERSION
                    | COGRA_KEY_NODE
                    | COGRA_KEY_DISPLAY_NAME
                    | COGRA_KEY_BIO
                    | COGRA_KEY_WEBSITE_URL
                    | COGRA_KEY_AVATAR
            );
            if !known {
                return Err(EnvelopeError::Guild("unknown cogra profile field"));
            }
        }
        Ok(Self {
            node: guild_node_id(cogra)?,
            display_name: guild_text_field(cogra, COGRA_KEY_DISPLAY_NAME)?,
            bio: guild_text_field(cogra, COGRA_KEY_BIO)?,
            website_url: guild_text_field(cogra, COGRA_KEY_WEBSITE_URL)?,
            avatar: guild_profile_image(cogra, COGRA_KEY_AVATAR)?,
        })
    }

    /// Decode + guild admission in one step — the read used at prepare
    /// (self-check of our own construction) and at confirm (promotion
    /// parses the staged payload back out).
    pub fn decode_payload(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        Self::from_envelope(&Envelope::decode(bytes)?)
    }
}
