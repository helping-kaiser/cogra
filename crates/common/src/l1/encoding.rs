//! Canonical serialization for seam objects.
//!
//! L1 declares serialization a deployment concern (layer1-interface.md
//! §8.2); this deployment uses a small deterministic subset of CBOR
//! (RFC 8949): definite lengths only, shortest-form integer heads,
//! IEEE 754 double-precision floats, field order fixed by the encoder.
//!
//! Maps and tags exist for the Peer Content Envelope (common::envelope);
//! key ordering there is the caller's obligation — the encoder writes
//! entries in call order, and the envelope feeds it from sorted
//! collections.
//!
//! Hand-rolled so determinism is by construction, not by library
//! configuration; golden tests pin the byte layout.

/// Deterministic CBOR writer over the subset the seam needs.
#[derive(Default)]
pub struct Encoder {
    out: Vec<u8>,
}

impl Encoder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn finish(self) -> Vec<u8> {
        self.out
    }

    fn head(&mut self, major: u8, value: u64) {
        let m = major << 5;
        match value {
            0..=23 => self.out.push(m | value as u8),
            24..=0xFF => {
                self.out.push(m | 24);
                self.out.push(value as u8);
            }
            0x100..=0xFFFF => {
                self.out.push(m | 25);
                self.out.extend_from_slice(&(value as u16).to_be_bytes());
            }
            0x1_0000..=0xFFFF_FFFF => {
                self.out.push(m | 26);
                self.out.extend_from_slice(&(value as u32).to_be_bytes());
            }
            _ => {
                self.out.push(m | 27);
                self.out.extend_from_slice(&value.to_be_bytes());
            }
        }
    }

    pub fn uint(&mut self, v: u64) -> &mut Self {
        self.head(0, v);
        self
    }

    pub fn bytes(&mut self, b: &[u8]) -> &mut Self {
        self.head(2, b.len() as u64);
        self.out.extend_from_slice(b);
        self
    }

    pub fn text(&mut self, s: &str) -> &mut Self {
        self.head(3, s.len() as u64);
        self.out.extend_from_slice(s.as_bytes());
        self
    }

    pub fn array(&mut self, len: u64) -> &mut Self {
        self.head(4, len);
        self
    }

    /// Definite-length map head; the caller writes `len` key/value pairs
    /// next, in bytewise-ascending key order (for uint keys: numeric
    /// order).
    pub fn map(&mut self, len: u64) -> &mut Self {
        self.head(5, len);
        self
    }

    /// A tag head (major type 6); the caller writes the tagged item next.
    pub fn tag(&mut self, value: u64) -> &mut Self {
        self.head(6, value);
        self
    }

    /// Doubles are always encoded in the 8-byte form — one representation
    /// per value, no shortest-float search.
    pub fn float(&mut self, v: f64) -> &mut Self {
        self.out.push(0xFB);
        self.out.extend_from_slice(&v.to_bits().to_be_bytes());
        self
    }

    pub fn null(&mut self) -> &mut Self {
        self.out.push(0xF6);
        self
    }
}

/// Decode failures over the subset.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DecodeError {
    #[error("unexpected end of input at byte {0}")]
    Truncated(usize),
    #[error("expected {expected} at byte {at}, found major type {found}")]
    WrongType {
        at: usize,
        expected: &'static str,
        found: u8,
    },
    #[error("unsupported head byte {0:#04x}")]
    Unsupported(u8),
    #[error("invalid UTF-8 in text item")]
    Utf8,
    #[error("{0} bytes of trailing input")]
    Trailing(usize),
}

/// Reader over the same deterministic subset the `Encoder` writes. Decoding
/// is lenient about head widths — the signing bases are always re-encoded
/// canonically from the decoded values, so wire-level canonicality is never
/// load-bearing.
pub struct Decoder<'a> {
    input: &'a [u8],
    pos: usize,
}

impl<'a> Decoder<'a> {
    pub fn new(input: &'a [u8]) -> Self {
        Self { input, pos: 0 }
    }

    fn byte(&mut self) -> Result<u8, DecodeError> {
        let b = *self
            .input
            .get(self.pos)
            .ok_or(DecodeError::Truncated(self.pos))?;
        self.pos += 1;
        Ok(b)
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], DecodeError> {
        let end = self
            .pos
            .checked_add(n)
            .filter(|&e| e <= self.input.len())
            .ok_or(DecodeError::Truncated(self.pos))?;
        let slice = &self.input[self.pos..end];
        self.pos = end;
        Ok(slice)
    }

    fn head(&mut self, major: u8, expected: &'static str) -> Result<u64, DecodeError> {
        let at = self.pos;
        let b = self.byte()?;
        if b >> 5 != major {
            return Err(DecodeError::WrongType {
                at,
                expected,
                found: b >> 5,
            });
        }
        match b & 0x1F {
            v @ 0..=23 => Ok(u64::from(v)),
            24 => Ok(u64::from(self.byte()?)),
            25 => Ok(u64::from(u16::from_be_bytes(
                self.take(2)?
                    .try_into()
                    .map_err(|_| DecodeError::Truncated(at))?,
            ))),
            26 => Ok(u64::from(u32::from_be_bytes(
                self.take(4)?
                    .try_into()
                    .map_err(|_| DecodeError::Truncated(at))?,
            ))),
            27 => Ok(u64::from_be_bytes(
                self.take(8)?
                    .try_into()
                    .map_err(|_| DecodeError::Truncated(at))?,
            )),
            _ => Err(DecodeError::Unsupported(b)),
        }
    }

    pub fn uint(&mut self) -> Result<u64, DecodeError> {
        self.head(0, "uint")
    }

    pub fn bytes(&mut self) -> Result<Vec<u8>, DecodeError> {
        let len = self.head(2, "bytes")?;
        Ok(self.take(len as usize)?.to_vec())
    }

    pub fn text(&mut self) -> Result<String, DecodeError> {
        let len = self.head(3, "text")?;
        let raw = self.take(len as usize)?;
        String::from_utf8(raw.to_vec()).map_err(|_| DecodeError::Utf8)
    }

    pub fn array(&mut self) -> Result<u64, DecodeError> {
        self.head(4, "array")
    }

    /// Definite-length map head; returns the pair count.
    pub fn map(&mut self) -> Result<u64, DecodeError> {
        self.head(5, "map")
    }

    /// A tag head; returns the tag value.
    pub fn tag(&mut self) -> Result<u64, DecodeError> {
        self.head(6, "tag")
    }

    /// Major type of the next item, without consuming it; None at end of
    /// input. The envelope's `any`-typed guild values dispatch on this.
    pub fn peek_major(&self) -> Option<u8> {
        self.input.get(self.pos).map(|b| b >> 5)
    }

    /// Byte offset of the next unread item (envelope Gate C2 re-encodes
    /// from decoded values and compares against the input span).
    pub fn position(&self) -> usize {
        self.pos
    }

    pub fn float(&mut self) -> Result<f64, DecodeError> {
        let at = self.pos;
        let b = self.byte()?;
        if b != 0xFB {
            return Err(DecodeError::WrongType {
                at,
                expected: "float",
                found: b >> 5,
            });
        }
        Ok(f64::from_bits(u64::from_be_bytes(
            self.take(8)?
                .try_into()
                .map_err(|_| DecodeError::Truncated(at))?,
        )))
    }

    /// A text item or the null sentinel.
    pub fn text_or_null(&mut self) -> Result<Option<String>, DecodeError> {
        if self.input.get(self.pos) == Some(&0xF6) {
            self.pos += 1;
            return Ok(None);
        }
        self.text().map(Some)
    }

    /// Asserts the input is fully consumed.
    pub fn finish(self) -> Result<(), DecodeError> {
        let rest = self.input.len() - self.pos;
        if rest == 0 {
            Ok(())
        } else {
            Err(DecodeError::Trailing(rest))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn enc(f: impl FnOnce(&mut Encoder)) -> Vec<u8> {
        let mut e = Encoder::new();
        f(&mut e);
        e.finish()
    }

    #[test]
    fn golden_uints() {
        assert_eq!(
            enc(|e| {
                e.uint(0);
            }),
            [0x00]
        );
        assert_eq!(
            enc(|e| {
                e.uint(23);
            }),
            [0x17]
        );
        assert_eq!(
            enc(|e| {
                e.uint(24);
            }),
            [0x18, 24]
        );
        assert_eq!(
            enc(|e| {
                e.uint(255);
            }),
            [0x18, 0xFF]
        );
        assert_eq!(
            enc(|e| {
                e.uint(256);
            }),
            [0x19, 0x01, 0x00]
        );
        assert_eq!(
            enc(|e| {
                e.uint(65_536);
            }),
            [0x1A, 0, 1, 0, 0]
        );
        assert_eq!(
            enc(|e| {
                e.uint(u64::from(u32::MAX) + 1);
            }),
            [0x1B, 0, 0, 0, 1, 0, 0, 0, 0]
        );
    }

    #[test]
    fn golden_text_bytes_array() {
        assert_eq!(
            enc(|e| {
                e.text("a");
            }),
            [0x61, b'a']
        );
        assert_eq!(
            enc(|e| {
                e.bytes(&[1, 2]);
            }),
            [0x42, 1, 2]
        );
        assert_eq!(
            enc(|e| {
                e.array(2).uint(1).uint(2);
            }),
            [0x82, 1, 2]
        );
        assert_eq!(
            enc(|e| {
                e.null();
            }),
            [0xF6]
        );
    }

    /// Tag 55799 is the envelope magic, written D9 D9F7 (RFC 8949 §3.4.6).
    #[test]
    fn golden_map_and_tag() {
        assert_eq!(
            enc(|e| {
                e.map(1).uint(0).text("x");
            }),
            [0xA1, 0x00, 0x61, b'x']
        );
        assert_eq!(
            enc(|e| {
                e.tag(55799);
            }),
            [0xD9, 0xD9, 0xF7]
        );
        let mut d = Decoder::new(&[0xD9, 0xD9, 0xF7, 0xA1, 0x00, 0x61, b'x']);
        assert_eq!(d.tag().expect("valid"), 55799);
        assert_eq!(d.map().expect("valid"), 1);
        assert_eq!(d.peek_major(), Some(0));
        assert_eq!(d.uint().expect("valid"), 0);
        assert_eq!(d.text().expect("valid"), "x");
        assert_eq!(d.peek_major(), None);
        d.finish().expect("valid");
    }

    /// The 8-byte form is written verbatim from the bit pattern, so -0.0
    /// keeps its sign bit: one encoding per bit pattern, no normalization.
    #[test]
    fn golden_float() {
        assert_eq!(
            enc(|e| {
                e.float(1.0);
            }),
            [0xFB, 0x3F, 0xF0, 0, 0, 0, 0, 0, 0]
        );
        assert_eq!(
            enc(|e| {
                e.float(-0.0);
            }),
            [0xFB, 0x80, 0, 0, 0, 0, 0, 0, 0]
        );
    }

    #[test]
    fn encoding_is_deterministic() {
        let a = enc(|e| {
            e.array(3).text("act:x:1:opinion").float(0.5).bytes(b"p");
        });
        let b = enc(|e| {
            e.array(3).text("act:x:1:opinion").float(0.5).bytes(b"p");
        });
        assert_eq!(a, b);
    }
}
