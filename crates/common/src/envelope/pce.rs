//! ´mod:module:pce´
//!
//! The Peer Content Envelope (PCE v0.1.0) — the payload format every
//! content-bearing act carries through the seam. The normative spec is the
//! L1 team's draft (Peer Content Envelope v0.1.0; adopted for slice 2,
//! recorded in data-model.md "The payload envelope"): one deterministic
//! CBOR map in CDE form wrapped in self-describe tag 55799, an integer
//! keyspace, a four-axis version vector at key 0, a validated text body at
//! key 1, and an extension map at key 2 whose keys ≥ 100 belong to guilds.
//!
//!
//! Nothing here knows about CoGra: the guild map CoGra rides in is one
//! extension value among the many key 2 may carry.

use std::collections::BTreeMap;

use crate::envelope::EnvelopeError;
use crate::l1::encoding::{Decoder, Encoder};

/// The self-describe tag every envelope is wrapped in (PCE §1.1).
pub const MAGIC_TAG: u64 = 55799;
/// CoGra's guild key (data-model.md "CoGra's guild schema"): 0xC06A —
/// hexspeak "COGA", chosen away from the low numbers other guilds reach
/// for first. Any integer ≥ 100 would be equally valid.
pub const COGRA_GUILD_KEY: u64 = 49258;
/// The version vector CoGra produces (PCE §2.1): package, body,
/// extension-floor, and extension-ceiling axes, all at 1.
pub const VERSION_V1: [u64; 4] = [1, 1, 1, 1];
const KEY_VERSION: u64 = 0;
const KEY_BODY: u64 = 1;
const KEY_EXTENSIONS: u64 = 2;

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
