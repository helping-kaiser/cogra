//! ´mod:module:envelope´
//!
//! The Peer Content Envelope (PCE v0.1.0) — the payload format every
//! content-bearing act carries through the seam. The normative spec is the
//! L1 team's draft (Peer Content Envelope v0.1.0; adopted for slice 2,
//! recorded in data-model.md "The payload envelope"): one deterministic
//! CBOR map in CDE form wrapped in self-describe tag 55799, an integer
//! keyspace, a four-axis version vector at key 0, a validated text body at
//! key 1, and an extension map at key 2 whose keys ≥ 100 belong to guilds.
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
//! Inside the guild map, keys 2–6 ride Publish/Review payloads and keys
//! 7–12 the parallel-Registration profile payload, each family's reader
//! rejecting the other's keys. Two of those are declared but not built:
//! key 6 (provenance chain, platform-guidelines.md §5 plank 4) and key 10
//! (payout address, which arrives with the rail — ledger.md). Neither is
//! ever produced, and both are rejected on read until their slices define
//! them.
//!
//! Key 5 is the media manifest: an array of per-asset maps carrying the
//! digest of the bytes, the type they are to be read as, and the alt text
//! describing them, with array position carrying gallery order. It commits
//! what a reader needs to render honestly and nothing a server measured —
//! aspect ratio, size, and duration are derived, so they stay out of what
//! the author signs. The nested map runs the same reserved-key discipline
//! the outer envelope runs, so a v2 grows it additively.
//!
//! Keys 11 and 12 carry the profile's avatar and cover as that same
//! per-asset map, one deep. An avatar is a picture a reader is shown, so
//! it is witnessed like any other; and a profile payload being a delta
//! rather than complete state, each slot is three-valued — the empty array
//! is how an update says "cleared".

use std::collections::BTreeMap;

use uuid::Uuid;

use crate::l1::encoding::{DecodeError, Decoder, Encoder};

/// The self-describe tag every envelope is wrapped in (PCE §1.1).
pub const MAGIC_TAG: u64 = 55799;
/// CoGra's guild key (data-model.md "CoGra's guild schema"): 0xC06A —
/// hexspeak "COGA", chosen away from the low numbers other guilds reach
/// for first. Any integer ≥ 100 would be equally valid.
pub const COGRA_GUILD_KEY: u64 = 49258;
/// The version vector CoGra produces (PCE §2.1): package, body,
/// extension-floor, and extension-ceiling axes, all at 1.
pub const VERSION_V1: [u64; 4] = [1, 1, 1, 1];
/// CoGra's guild-map schema version (key 0 of the nested map).
pub const COGRA_SCHEMA_V1: u64 = 1;

const KEY_VERSION: u64 = 0;
const KEY_BODY: u64 = 1;
const KEY_EXTENSIONS: u64 = 2;

const COGRA_KEY_VERSION: u64 = 0;
const COGRA_KEY_NODE: u64 = 1;
const COGRA_KEY_TITLE: u64 = 2;
const COGRA_KEY_DESCRIPTION: u64 = 3;
const COGRA_KEY_BODY: u64 = 4;
const COGRA_KEY_MEDIA: u64 = 5;
const COGRA_KEY_DISPLAY_NAME: u64 = 7;

const ASSET_KEY_DIGEST: u64 = 0;
const ASSET_KEY_MIME: u64 = 1;
const ASSET_KEY_ALT_TEXT: u64 = 2;

/// SHA-256, the algorithm the manifest's digests are (data-model.md
/// `media_attachments`). The length is the only place the choice appears
/// on the wire — no algorithm tag rides the envelope — so changing it is a
/// guild schema-version bump, not a silent reinterpretation.
pub const MEDIA_DIGEST_LEN: usize = 32;
const COGRA_KEY_BIO: u64 = 8;
const COGRA_KEY_WEBSITE_URL: u64 = 9;
const COGRA_KEY_AVATAR: u64 = 11;
const COGRA_KEY_COVER: u64 = 12;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EnvelopeError {
    /// Gate M: the first three bytes are not the magic `D9 D9F7`.
    #[error("not a content envelope (missing magic tag)")]
    Magic,
    /// Gate M: the tagged item does not decode to the required shape.
    #[error("malformed envelope: {0}")]
    Decode(#[from] DecodeError),
    #[error("malformed envelope: {0}")]
    Shape(&'static str),
    /// Gate P: an unknown package version denies the whole envelope.
    #[error("unknown package version {0}")]
    UnknownPackage(u64),
    /// Gate P: a top-level key outside the package's allowed set.
    #[error("top-level key {0} is not allowed at package version 1")]
    TopLevelKey(u64),
    /// Gate C2: the bytes are not the canonical (CDE) serialization of
    /// their own content.
    #[error("non-canonical envelope encoding")]
    NonCanonical,
    /// §4.4: an optional field carried an in-band empty instead of being
    /// omitted; rejected, never repaired.
    #[error("empty value for optional key {0} must be omitted")]
    ForbiddenEmpty(u64),
    /// §4.2: a reserved key (4–99) with no allocation at (floor 1,
    /// ceiling 1).
    #[error("reserved extension key {0} is not allocated")]
    ReservedKey(u64),
    /// CoGra guild admission (our tightening per PCE §10).
    #[error("cogra guild schema: {0}")]
    Guild(&'static str),
}

/// One extension-map value. The spec types registered keys 0–3 and leaves
/// guild values as `any`; this subset carries what CoGra produces and
/// what the golden vectors exercise.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Uint(u64),
    Text(String),
    Bytes(Vec<u8>),
    Array(Vec<Value>),
    Map(BTreeMap<u64, Value>),
}

impl Value {
    fn encode(&self, e: &mut Encoder) {
        match self {
            Value::Uint(v) => {
                e.uint(*v);
            }
            Value::Text(s) => {
                e.text(s);
            }
            Value::Bytes(b) => {
                e.bytes(b);
            }
            Value::Array(items) => {
                e.array(items.len() as u64);
                for item in items {
                    item.encode(e);
                }
            }
            Value::Map(m) => {
                e.map(m.len() as u64);
                for (k, v) in m {
                    e.uint(*k);
                    v.encode(e);
                }
            }
        }
    }

    /// Neither container pre-allocates from the declared length: the count
    /// is attacker-controlled and the payload behind it is not, so a header
    /// claiming millions of entries would otherwise reserve the memory
    /// before the truncated body failed. Growth on real items bounds the
    /// allocation by the bytes actually present.
    fn decode(d: &mut Decoder) -> Result<Self, EnvelopeError> {
        match d.peek_major() {
            Some(0) => Ok(Value::Uint(d.uint()?)),
            Some(2) => Ok(Value::Bytes(d.bytes()?)),
            Some(3) => Ok(Value::Text(d.text()?)),
            Some(4) => {
                let len = d.array()?;
                let mut items = Vec::new();
                for _ in 0..len {
                    items.push(Value::decode(d)?);
                }
                Ok(Value::Array(items))
            }
            Some(5) => {
                let len = d.map()?;
                let mut m = BTreeMap::new();
                let mut last: Option<u64> = None;
                for _ in 0..len {
                    let k = d.uint()?;
                    if last.is_some_and(|l| k <= l) {
                        return Err(EnvelopeError::NonCanonical);
                    }
                    last = Some(k);
                    m.insert(k, Value::decode(d)?);
                }
                Ok(Value::Map(m))
            }
            _ => Err(EnvelopeError::Shape("unsupported extension value type")),
        }
    }
}

/// A decoded envelope: the version vector, the body, and the extension
/// map (empty when key 2 is absent — §4.4 forbids an in-band empty map).
#[derive(Debug, Clone, PartialEq)]
pub struct Envelope {
    pub version: [u64; 4],
    pub body: String,
    pub extensions: BTreeMap<u64, Value>,
}

impl Envelope {
    /// Serializes canonically (PCE §5): magic tag, definite lengths,
    /// ascending integer keys (the BTreeMap's iteration order).
    pub fn encode(&self) -> Vec<u8> {
        let mut e = Encoder::new();
        e.tag(MAGIC_TAG);
        e.map(if self.extensions.is_empty() { 2 } else { 3 });
        e.uint(KEY_VERSION);
        e.array(4);
        for axis in self.version {
            e.uint(axis);
        }
        e.uint(KEY_BODY);
        e.text(&self.body);
        if !self.extensions.is_empty() {
            e.uint(KEY_EXTENSIONS);
            e.map(self.extensions.len() as u64);
            for (k, v) in &self.extensions {
                e.uint(*k);
                v.encode(&mut e);
            }
        }
        e.finish()
    }

    /// Decodes and admission-checks one envelope: Gate M (magic, shape),
    /// Gate P (package version and key set), Gate C2/C3 (canonical form —
    /// verified by re-encoding), the §4.4 empty rules, and the §4.2
    /// reserved-range rule. The §3 text pipeline is not applied (see the
    /// module documentation).
    ///
    /// Gate P is fail-closed: this reader implements package 1 only, and a
    /// future package denies the whole envelope rather than any part of it.
    /// Gates C2 and C3 fall out of one move — canonical bytes are the fixed
    /// point of decode then encode, so anything non-preferred, unsorted,
    /// indefinite, or text-keyed fails to reproduce itself.
    pub fn decode(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        if bytes.len() < 3 || bytes[0..3] != [0xD9, 0xD9, 0xF7] {
            return Err(EnvelopeError::Magic);
        }
        let mut d = Decoder::new(bytes);
        let tag = d.tag()?;
        if tag != MAGIC_TAG {
            return Err(EnvelopeError::Magic);
        }
        let pairs = d.map()?;
        if !(2..=3).contains(&pairs) {
            return Err(EnvelopeError::Shape("top-level map must have 2–3 keys"));
        }
        if d.uint()? != KEY_VERSION {
            return Err(EnvelopeError::Shape("first key must be 0 (version)"));
        }
        if d.array()? != 4 {
            return Err(EnvelopeError::Shape("version vector must have 4 axes"));
        }
        let mut version = [0u64; 4];
        for axis in &mut version {
            *axis = d.uint()?;
        }
        if version[0] != 1 {
            return Err(EnvelopeError::UnknownPackage(version[0]));
        }
        if d.uint()? != KEY_BODY {
            return Err(EnvelopeError::Shape("second key must be 1 (body)"));
        }
        let body = d.text()?;
        let mut extensions = BTreeMap::new();
        if pairs == 3 {
            let key = d.uint()?;
            if key != KEY_EXTENSIONS {
                return Err(EnvelopeError::TopLevelKey(key));
            }
            let len = d.map()?;
            if len == 0 {
                return Err(EnvelopeError::ForbiddenEmpty(KEY_EXTENSIONS));
            }
            let mut last: Option<u64> = None;
            for _ in 0..len {
                let k = d.uint()?;
                if last.is_some_and(|l| k <= l) {
                    return Err(EnvelopeError::NonCanonical);
                }
                last = Some(k);
                let v = Value::decode(&mut d)?;
                if (4..100).contains(&k) {
                    return Err(EnvelopeError::ReservedKey(k));
                }
                if k < 4 {
                    let empty = match &v {
                        Value::Text(s) => s.is_empty(),
                        Value::Bytes(b) => b.is_empty(),
                        _ => false,
                    };
                    if empty {
                        return Err(EnvelopeError::ForbiddenEmpty(k));
                    }
                }
                extensions.insert(k, v);
            }
        }
        d.finish()?;
        let envelope = Envelope {
            version,
            body,
            extensions,
        };
        if envelope.encode() != bytes {
            return Err(EnvelopeError::NonCanonical);
        }
        Ok(envelope)
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
    fn encode(&self) -> Value {
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
    fn decode(value: &Value) -> Result<Self, EnvelopeError> {
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

/// One profile image slot — the avatar or the cover — under a profile
/// family key.
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
            if *key > COGRA_KEY_MEDIA {
                return Err(EnvelopeError::Guild("unknown cogra field"));
            }
        }
        Ok(Self {
            node: guild_node_id(cogra)?,
            title: guild_text_field(cogra, COGRA_KEY_TITLE)?,
            description: guild_text_field(cogra, COGRA_KEY_DESCRIPTION)?,
            body: guild_text_field(cogra, COGRA_KEY_BODY)?,
            media: guild_media(cogra)?,
        })
    }

    /// Decode + guild admission in one step — the read used at prepare
    /// (self-check of our own construction) and at confirm (promotion
    /// parses the staged payload back out).
    pub fn decode_payload(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        Self::from_envelope(&Envelope::decode(bytes)?)
    }
}

/// The profile payload a parallel Registration carries — guild keys 7–9
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
    /// The avatar slot, three-valued: None leaves it alone, `Some(None)`
    /// clears it back to the monogram, `Some(Some(asset))` replaces it.
    /// The asset rides here rather than staying Postgres-side because
    /// erasure removes an avatar's bytes and leaves its digest committed
    /// in the witnessed payload (erasure.md §2) — which is only true if
    /// the payload carries one.
    pub avatar: Option<Option<MediaAsset>>,
    /// The cover slot, same three values.
    pub cover: Option<Option<MediaAsset>>,
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
        if let Some(cover) = encode_profile_image(self.cover) {
            cogra.insert(COGRA_KEY_COVER, cover);
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
    /// keys — content keys, reserved keys, and the assigned-but-unbuilt
    /// payout key are rejected.
    pub fn from_envelope(envelope: &Envelope) -> Result<Self, EnvelopeError> {
        let cogra = cogra_guild_map(envelope)?;
        for key in cogra.keys() {
            let known = matches!(
                *key,
                COGRA_KEY_VERSION
                    | COGRA_KEY_NODE
                    | COGRA_KEY_DISPLAY_NAME
                    | COGRA_KEY_BIO
                    | COGRA_KEY_WEBSITE_URL
                    | COGRA_KEY_AVATAR
                    | COGRA_KEY_COVER
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
            cover: guild_profile_image(cogra, COGRA_KEY_COVER)?,
        })
    }

    /// Decode + guild admission in one step — the read used at prepare
    /// (self-check of our own construction) and at confirm (promotion
    /// parses the staged payload back out).
    pub fn decode_payload(bytes: &[u8]) -> Result<Self, EnvelopeError> {
        Self::from_envelope(&Envelope::decode(bytes)?)
    }
}

#[cfg(test)]
mod tests {
    //! The numbered `vector_*` tests are PCE §8.2's normative value vectors,
    //! pinned byte-identical. The `rejects_*` tests are §8.4's negative
    //! vectors, less the ones that live inside the §3 text pipeline. The
    //! rest cover CoGra's own guild schema — the content keys and the
    //! profile keys 7–9 alike.

    use super::*;

    fn hex(s: &str) -> Vec<u8> {
        let clean: String = s.chars().filter(|c| !c.is_whitespace()).collect();
        (0..clean.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&clean[i..i + 2], 16).expect("hex"))
            .collect()
    }

    fn envelope(body: &str, extensions: BTreeMap<u64, Value>) -> Envelope {
        Envelope {
            version: VERSION_V1,
            body: body.into(),
            extensions,
        }
    }

    #[test]
    fn vector_1_minimal_body() {
        let bytes = envelope("hello 🌍", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 6A 68656C6C6F20F09F8C8D")
        );
        assert_eq!(Envelope::decode(&bytes).expect("valid").body, "hello 🌍");
    }

    #[test]
    fn vector_2_body_and_link() {
        let mut ext = BTreeMap::new();
        ext.insert(0, Value::Text("https://example.com/img/sunset.jpg".into()));
        let bytes = envelope("sunset over Berlin", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101
                 01 72 73756E736574206F766572204265726C696E
                 02 A1 00 78 22 68747470733A2F2F6578616D706C652E636F6D2F696D672F73756E7365742E6A7067")
        );
        Envelope::decode(&bytes).expect("valid");
    }

    #[test]
    fn vector_3_usr_binary() {
        let mut ext = BTreeMap::new();
        ext.insert(3, Value::Bytes(vec![0xDE, 0xAD, 0xBE, 0xEF]));
        let bytes = envelope("tagged", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101 01 66 746167676564 02 A1 03 44 DEADBEEF")
        );
        Envelope::decode(&bytes).expect("valid");
    }

    #[test]
    fn vector_4_guild_key_round_trip() {
        let mut ext = BTreeMap::new();
        ext.insert(100, Value::Text("guild-data".into()));
        let bytes = envelope("test", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101 01 64 74657374 02 A1 18 64 6A 6775696C642D64617461")
        );
        let decoded = Envelope::decode(&bytes).expect("valid");
        assert_eq!(
            decoded.extensions.get(&100),
            Some(&Value::Text("guild-data".into()))
        );
        assert_eq!(decoded.encode(), bytes);
    }

    /// The vector pins the serialized form of the already-normalized body
    /// "café"; the §3 normalize transform that produces it is out of scope.
    #[test]
    fn vector_5_nfc_form() {
        let bytes = envelope("café", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 65 636166C3A9"));
    }

    #[test]
    fn vector_6_max_body() {
        let bytes = envelope(&"a".repeat(140), BTreeMap::new()).encode();
        let mut expected = hex("D9D9F7 A2 00 84 01010101 01 78 8C");
        expected.extend(std::iter::repeat_n(b'a', 140));
        assert_eq!(bytes, expected);
    }

    #[test]
    fn vector_7_multiple_extensions() {
        let mut ext = BTreeMap::new();
        ext.insert(0, Value::Text("https://example.com/img.jpg".into()));
        ext.insert(2, Value::Text("de".into()));
        ext.insert(3, Value::Bytes(vec![0xC0, 0xFF, 0xEE]));
        let bytes = envelope("sunset", ext).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A3 00 84 01010101 01 66 73756E736574
                 02 A3 00 78 1B 68747470733A2F2F6578616D706C652E636F6D2F696D672E6A7067
                 02 62 6465 03 43 C0FFEE")
        );
        Envelope::decode(&bytes).expect("valid");
    }

    #[test]
    fn vector_8_multi_byte_cluster() {
        let bytes = envelope("photographer 🇩🇪", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 75 70686F746F67726170686572 20 F09F87A9F09F87AA")
        );
        assert_eq!(bytes.len(), 33);
    }

    #[test]
    fn vector_9_whitespace_preservation() {
        let bytes = envelope("a  b\n\nc", BTreeMap::new()).encode();
        assert_eq!(
            bytes,
            hex("D9D9F7 A2 00 84 01010101 01 67 61 20 20 62 0A 0A 63")
        );
        assert_eq!(bytes.len(), 19);
    }

    #[test]
    fn vector_10_empty_body() {
        let bytes = envelope("", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 60"));
        assert_eq!(bytes.len(), 12);
        assert_eq!(Envelope::decode(&bytes).expect("valid").body, "");
    }

    /// The canonical bytes of the already-trimmed output "a\n\nb"; the §3
    /// transform that produces it is out of scope, its result is what is
    /// pinned.
    #[test]
    fn vector_16_per_line_trim_output() {
        let bytes = envelope("a\n\nb", BTreeMap::new()).encode();
        assert_eq!(bytes, hex("D9D9F7 A2 00 84 01010101 01 64 61 0A 0A 62"));
        assert_eq!(bytes.len(), 16);
    }

    #[test]
    fn rejects_missing_magic() {
        let mut bytes = envelope("", BTreeMap::new()).encode();
        bytes.drain(0..3);
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::Magic));
    }

    /// The bytes carry `{0: 1, 1: ""}`: the version must be an array of four
    /// uints, never a scalar.
    #[test]
    fn rejects_scalar_version() {
        let bytes = hex("D9D9F7 A2 00 01 01 60");
        assert!(matches!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Decode(_))
        ));
    }

    #[test]
    fn rejects_three_axis_vector() {
        let bytes = hex("D9D9F7 A2 00 83 010101 01 60");
        assert_eq!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Shape("version vector must have 4 axes"))
        );
    }

    /// The bytes carry `{0: [1,1,1,1], 1: "x", 7: 42}` — key 7 is outside
    /// the package's allowed top-level set.
    #[test]
    fn rejects_unknown_top_level_key() {
        let bytes = hex("D9D9F7 A3 00 84 01010101 01 61 78 07 18 2A");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::TopLevelKey(7)));
    }

    /// The bytes carry `{0: [1,1,1,1], 1: "x", 2: {5: h'00'}}` — extension
    /// key 5 falls in the reserved range with nothing allocated to it.
    #[test]
    fn rejects_unallocated_reserved_key() {
        let bytes = hex("D9D9F7 A3 00 84 01010101 01 61 78 02 A1 05 41 00");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::ReservedKey(5)));
    }

    /// Three in-band empties, each of which must have been an omission
    /// instead: an empty link at key 0, empty usr bytes at key 3, and the
    /// empty extension map, which must drop key 2 altogether.
    #[test]
    fn rejects_empty_registered_values_and_empty_map() {
        let empty_link = hex("D9D9F7 A3 00 84 01010101 01 60 02 A1 00 60");
        assert_eq!(
            Envelope::decode(&empty_link),
            Err(EnvelopeError::ForbiddenEmpty(0))
        );
        let empty_usr = hex("D9D9F7 A3 00 84 01010101 01 60 02 A1 03 40");
        assert_eq!(
            Envelope::decode(&empty_usr),
            Err(EnvelopeError::ForbiddenEmpty(3))
        );
        let empty_map = hex("D9D9F7 A3 00 84 01010101 01 60 02 A0");
        assert_eq!(
            Envelope::decode(&empty_map),
            Err(EnvelopeError::ForbiddenEmpty(2))
        );
    }

    /// Vector 15: a package axis of 2 denies the whole envelope, not merely
    /// the parts this reader does not understand.
    #[test]
    fn rejects_unknown_package_version() {
        let bytes = hex("D9D9F7 A2 00 84 02010101 01 62 6869");
        assert_eq!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::UnknownPackage(2))
        );
    }

    /// Vector 10's content with the body length in the two-byte form
    /// (`78 00` for text(0)): the decoder is lenient about head widths, so
    /// this parses and then fails Gate C2 on re-encoding.
    #[test]
    fn rejects_non_canonical_encoding() {
        let bytes = hex("D9D9F7 A2 00 84 01010101 01 78 00");
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::NonCanonical));
    }

    /// The extension map carries `{2: "de", 0: "https://e.com/"}` — keys in
    /// descending order, which no canonical encoding produces.
    #[test]
    fn rejects_unsorted_extension_keys() {
        let bytes = hex(
            "D9D9F7 A3 00 84 01010101 01 60 02 A2 02 62 6465 00 6E 68747470733A2F2F652E636F6D2F",
        );
        assert_eq!(Envelope::decode(&bytes), Err(EnvelopeError::NonCanonical));
    }

    #[test]
    fn rejects_trailing_bytes() {
        let mut bytes = envelope("", BTreeMap::new()).encode();
        bytes.push(0x00);
        assert!(matches!(
            Envelope::decode(&bytes),
            Err(EnvelopeError::Decode(DecodeError::Trailing(1)))
        ));
    }

    fn cogra(title: Option<&str>, description: Option<&str>, body: Option<&str>) -> CograContent {
        CograContent {
            node: Uuid::from_bytes([7; 16]),
            title: title.map(Into::into),
            description: description.map(Into::into),
            body: body.map(Into::into),
            media: Vec::new(),
        }
    }

    fn asset(fill: u8, mime: &str, alt_text: Option<&str>) -> MediaAsset {
        MediaAsset {
            digest: [fill; MEDIA_DIGEST_LEN],
            mime: mime.into(),
            alt_text: alt_text.map(Into::into),
        }
    }

    /// An envelope whose guild map carries the given key-5 value verbatim,
    /// for the shapes `MediaAsset` itself would never construct.
    fn with_media_value(media: Value) -> Vec<u8> {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        inner.insert(COGRA_KEY_MEDIA, media);
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        envelope("", ext).encode()
    }

    fn media_entry(pairs: Vec<(u64, Value)>) -> Value {
        Value::Map(pairs.into_iter().collect())
    }

    fn refuses_media(media: Value, message: &'static str) {
        assert_eq!(
            CograContent::decode_payload(&with_media_value(media)),
            Err(EnvelopeError::Guild(message))
        );
    }

    /// Presence survives the round trip in every shape it carries meaning:
    /// a full create, a create with only a body, an edit carrying one
    /// changed field, an edit clearing a field by present-and-empty, and a
    /// create whose empty body is itself a value (api-spec.md).
    #[test]
    fn cogra_round_trips_create_and_edit_shapes() {
        for content in [
            cogra(Some("Title"), Some("A description"), Some("The body")),
            cogra(None, None, Some("comment body")),
            cogra(Some("New title"), None, None),
            cogra(Some(""), None, None),
            cogra(None, None, Some("")),
        ] {
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograContent::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    /// Guild key 49258 is 0xC06A, which rides as the two-byte uint
    /// `19 C0 6A` — the needle searched for below.
    #[test]
    fn cogra_envelope_is_canonical_and_magic_prefixed() {
        let bytes = cogra(Some("t"), None, Some("b")).encode_payload();
        assert_eq!(&bytes[0..3], &[0xD9, 0xD9, 0xF7]);
        let needle = [0x19, 0xC0, 0x6A];
        assert!(bytes.windows(3).any(|w| w == needle));
        assert_eq!(Envelope::decode(&bytes).expect("valid").encode(), bytes);
    }

    #[test]
    fn cogra_rejects_wrong_schema_version() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(2));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        let bytes = envelope("", ext).encode();
        assert_eq!(
            CograContent::decode_payload(&bytes),
            Err(EnvelopeError::Guild("unsupported cogra schema version"))
        );
    }

    #[test]
    fn cogra_rejects_missing_or_short_node_id() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner.clone()));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("missing node id"))
        );
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 4]));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("node id must be 16 bytes"))
        );
    }

    #[test]
    fn cogra_rejects_nonempty_pce_body_and_foreign_guild_keys() {
        let content = cogra(None, None, Some("x"));
        let mut env = content.clone().into_envelope();
        env.body = "hi".into();
        assert_eq!(
            CograContent::from_envelope(&env),
            Err(EnvelopeError::Guild("key-1 body must be empty"))
        );
        let mut env = content.into_envelope();
        env.extensions.insert(100, Value::Text("other".into()));
        assert_eq!(
            CograContent::from_envelope(&env),
            Err(EnvelopeError::Guild("exactly one guild key expected"))
        );
    }

    /// Key 6 (provenance) is still declared and unbuilt, so it is still
    /// refused on read — allocating key 5 lifted the rejection for the
    /// manifest alone.
    #[test]
    fn cogra_rejects_the_unbuilt_provenance_key() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
        inner.insert(6, Value::Text("provenance".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograContent::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("unknown cogra field"))
        );
    }

    /// Every manifest shape that carries meaning: a lone asset, a gallery
    /// whose order is its array position, alt text present and absent on
    /// the same manifest, and a media post — an empty body beside a
    /// manifest, which is what the body XOR produces.
    #[test]
    fn manifest_round_trips_gallery_shapes() {
        let galleries = [
            vec![asset(1, "image/webp", Some("A sunset"))],
            vec![
                asset(1, "image/webp", Some("First")),
                asset(2, "image/webp", None),
                asset(3, "image/webp", Some("Third")),
            ],
        ];
        for media in galleries {
            let mut content = cogra(Some("Title"), Some("Words beside it"), None);
            content.media = media.clone();
            let bytes = content.clone().encode_payload();
            let decoded = CograContent::decode_payload(&bytes).expect("valid");
            assert_eq!(decoded, content);
            assert_eq!(decoded.media, media, "array position carries order");
        }
    }

    /// An absent manifest and an empty gallery are one state, and the
    /// encoder produces only the absent form — so key 5 never rides an
    /// envelope that has nothing to say with it.
    #[test]
    fn an_empty_gallery_omits_the_manifest_key() {
        let bytes = cogra(None, None, Some("text only")).encode_payload();
        let decoded = Envelope::decode(&bytes).expect("valid");
        let Some(Value::Map(guild)) = decoded.extensions.get(&COGRA_GUILD_KEY) else {
            panic!("the guild map");
        };
        assert!(!guild.contains_key(&COGRA_KEY_MEDIA));
        assert!(
            CograContent::decode_payload(&bytes)
                .expect("valid")
                .media
                .is_empty()
        );
    }

    #[test]
    fn manifest_rejects_an_in_band_empty_gallery() {
        refuses_media(
            Value::Array(Vec::new()),
            "empty media manifest must be omitted",
        );
    }

    #[test]
    fn manifest_rejects_a_non_array_value() {
        refuses_media(
            Value::Text("media".into()),
            "media manifest must be an array",
        );
        refuses_media(Value::Uint(5), "media manifest must be an array");
    }

    #[test]
    fn manifest_rejects_an_entry_that_is_not_a_map() {
        refuses_media(
            Value::Array(vec![Value::Bytes(vec![1; MEDIA_DIGEST_LEN])]),
            "media entry must be a map",
        );
    }

    /// The nested map runs the outer envelope's reserved-key discipline:
    /// a key a v1 reader does not know refuses the envelope rather than
    /// being dropped, so no reader renders an asset it half-understood.
    #[test]
    fn manifest_rejects_an_unallocated_entry_key() {
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (3, Value::Uint(1080)),
            ])]),
            "unknown media entry field",
        );
    }

    #[test]
    fn manifest_rejects_a_missing_or_mis_sized_digest() {
        refuses_media(
            Value::Array(vec![media_entry(vec![(
                ASSET_KEY_MIME,
                Value::Text("image/webp".into()),
            )])]),
            "missing media digest",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Text("not bytes".into())),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
            ])]),
            "missing media digest",
        );
        for length in [0, 16, 31, 33, 64] {
            refuses_media(
                Value::Array(vec![media_entry(vec![
                    (ASSET_KEY_DIGEST, Value::Bytes(vec![1; length])),
                    (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                ])]),
                "media digest must be 32 bytes",
            );
        }
    }

    #[test]
    fn manifest_rejects_a_missing_or_empty_mime() {
        refuses_media(
            Value::Array(vec![media_entry(vec![(
                ASSET_KEY_DIGEST,
                Value::Bytes(vec![1; MEDIA_DIGEST_LEN]),
            )])]),
            "missing media mime",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Uint(1)),
            ])]),
            "missing media mime",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text(String::new())),
            ])]),
            "media mime must not be empty",
        );
    }

    /// Absent alt text is the decorative case; a present-and-empty one
    /// would be a second encoding of it, so it is refused rather than
    /// folded — the same rule PCE §4.4 applies to its own optionals.
    #[test]
    fn manifest_rejects_alt_text_that_is_empty_or_not_text() {
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (ASSET_KEY_ALT_TEXT, Value::Text(String::new())),
            ])]),
            "empty media alt text must be omitted",
        );
        refuses_media(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (ASSET_KEY_ALT_TEXT, Value::Uint(7)),
            ])]),
            "media alt text must be text",
        );
    }

    /// A manifest is content-family only: the profile reader refuses it
    /// exactly as it refuses every other content key.
    #[test]
    fn profile_rejects_a_media_manifest() {
        assert_eq!(
            CograProfile::decode_payload(&with_media_value(Value::Array(vec![
                asset(1, "image/webp", None).encode()
            ]))),
            Err(EnvelopeError::Guild("unknown cogra profile field"))
        );
    }

    /// Two galleries differing only in order encode to different bytes,
    /// which is what makes position load-bearing rather than incidental.
    #[test]
    fn manifest_order_is_witnessed() {
        let mut forward = cogra(None, None, None);
        forward.media = vec![asset(1, "image/webp", None), asset(2, "image/webp", None)];
        let mut reversed = cogra(None, None, None);
        reversed.media = vec![asset(2, "image/webp", None), asset(1, "image/webp", None)];
        assert_ne!(forward.encode_payload(), reversed.encode_payload());
    }

    fn profile(
        display_name: Option<&str>,
        bio: Option<&str>,
        website_url: Option<&str>,
    ) -> CograProfile {
        CograProfile {
            node: Uuid::from_bytes([9; 16]),
            display_name: display_name.map(Into::into),
            bio: bio.map(Into::into),
            website_url: website_url.map(Into::into),
            avatar: None,
            cover: None,
        }
    }

    /// The three states an image slot carries, on both slots and in every
    /// combination that means something: untouched, replaced, and cleared.
    #[test]
    fn profile_round_trips_every_image_slot_state() {
        let cases = [
            (None, None),
            (Some(Some(asset(4, "image/webp", Some("Ada, smiling")))), None),
            (None, Some(Some(asset(5, "image/webp", None)))),
            (Some(None), Some(None)),
            (Some(None), Some(Some(asset(6, "image/webp", None)))),
        ];
        for (avatar, cover) in cases {
            let mut content = profile(None, None, None);
            content.avatar = avatar;
            content.cover = cover;
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograProfile::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    /// An untouched slot rides no key at all, so "leave the avatar alone"
    /// and "clear the avatar" cannot collide on the wire.
    #[test]
    fn an_untouched_image_slot_omits_its_key() {
        let bytes = profile(Some("Ada"), None, None).encode_payload();
        let decoded = Envelope::decode(&bytes).expect("valid");
        let Some(Value::Map(guild)) = decoded.extensions.get(&COGRA_GUILD_KEY) else {
            panic!("the guild map");
        };
        assert!(!guild.contains_key(&COGRA_KEY_AVATAR));
        assert!(!guild.contains_key(&COGRA_KEY_COVER));
    }

    fn refuses_profile_image(slot: Value, message: &'static str) {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(COGRA_KEY_AVATAR, slot);
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild(message))
        );
    }

    /// A slot holds one picture. Two would make "the avatar" ambiguous,
    /// and a bare map would be a second encoding of the one-asset case.
    #[test]
    fn profile_rejects_an_image_slot_that_is_not_one_asset() {
        refuses_profile_image(
            Value::Array(vec![
                asset(1, "image/webp", None).encode(),
                asset(2, "image/webp", None).encode(),
            ]),
            "a profile image is a single asset",
        );
        refuses_profile_image(
            asset(1, "image/webp", None).encode(),
            "a profile image must be an array",
        );
        refuses_profile_image(
            Value::Bytes(vec![1; MEDIA_DIGEST_LEN]),
            "a profile image must be an array",
        );
    }

    /// The entry inside a slot is the same admission a gallery entry gets:
    /// one reader, one rule, whichever key the asset arrived under.
    #[test]
    fn profile_image_entries_run_the_manifest_admission() {
        refuses_profile_image(
            Value::Array(vec![media_entry(vec![(
                ASSET_KEY_MIME,
                Value::Text("image/webp".into()),
            )])]),
            "missing media digest",
        );
        refuses_profile_image(
            Value::Array(vec![media_entry(vec![
                (ASSET_KEY_DIGEST, Value::Bytes(vec![1; MEDIA_DIGEST_LEN])),
                (ASSET_KEY_MIME, Value::Text("image/webp".into())),
                (3, Value::Uint(1)),
            ])]),
            "unknown media entry field",
        );
    }

    /// The content family refuses the profile's image keys the way the
    /// profile family refuses the content family's manifest.
    #[test]
    fn content_rejects_the_profile_image_keys() {
        for key in [COGRA_KEY_AVATAR, COGRA_KEY_COVER] {
            let mut inner = BTreeMap::new();
            inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
            inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![7; 16]));
            inner.insert(key, Value::Array(vec![asset(1, "image/webp", None).encode()]));
            let mut ext = BTreeMap::new();
            ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
            assert_eq!(
                CograContent::decode_payload(&envelope("", ext).encode()),
                Err(EnvelopeError::Guild("unknown cogra field"))
            );
        }
    }

    /// The same presence semantics as content: a full payload, an edit
    /// carrying one changed field, and an edit clearing bio and website by
    /// present-and-empty.
    #[test]
    fn profile_round_trips_edit_shapes() {
        for content in [
            profile(Some("Ada"), Some("Curious."), Some("https://ada.example")),
            profile(None, Some("New bio"), None),
            profile(None, Some(""), Some("")),
        ] {
            let bytes = content.clone().encode_payload();
            assert_eq!(
                CograProfile::decode_payload(&bytes).expect("valid"),
                content
            );
        }
    }

    #[test]
    fn profile_and_content_readers_reject_each_other() {
        let profile_bytes = profile(Some("Ada"), None, None).encode_payload();
        assert_eq!(
            CograContent::decode_payload(&profile_bytes),
            Err(EnvelopeError::Guild("unknown cogra field"))
        );
        let content_bytes = cogra(Some("Title"), None, Some("Body")).encode_payload();
        assert_eq!(
            CograProfile::decode_payload(&content_bytes),
            Err(EnvelopeError::Guild("unknown cogra profile field"))
        );
    }

    #[test]
    fn profile_rejects_assigned_but_unbuilt_payout_key() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(10, Value::Text("lq1qq…".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("unknown cogra profile field"))
        );
    }

    #[test]
    fn profile_rejects_missing_node_and_non_text_field() {
        let mut inner = BTreeMap::new();
        inner.insert(COGRA_KEY_VERSION, Value::Uint(1));
        inner.insert(COGRA_KEY_BIO, Value::Text("bio".into()));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner.clone()));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("missing node id"))
        );
        inner.insert(COGRA_KEY_NODE, Value::Bytes(vec![9; 16]));
        inner.insert(COGRA_KEY_BIO, Value::Uint(3));
        let mut ext = BTreeMap::new();
        ext.insert(COGRA_GUILD_KEY, Value::Map(inner));
        assert_eq!(
            CograProfile::decode_payload(&envelope("", ext).encode()),
            Err(EnvelopeError::Guild("text field with non-text value"))
        );
    }
}
