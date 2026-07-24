// Canonical serialization for seam objects. L1 declares serialization a
// deployment concern (layer1-interface.md §8.2,
// `rem:graph:authentication-realization-out-of-scope`); this deployment
// uses a small deterministic subset of CBOR (RFC 8949): definite lengths
// only, shortest-form integer heads, IEEE 754 double-precision floats,
// fixed field order fixed by the encoder — no maps, so no key-ordering
// ambiguity exists. Hand-rolled so determinism is by construction, not by
// library configuration; golden tests pin the byte layout.

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

    #[test]
    fn golden_float() {
        // 1.0 = 0x3FF0000000000000
        assert_eq!(
            enc(|e| {
                e.float(1.0);
            }),
            [0xFB, 0x3F, 0xF0, 0, 0, 0, 0, 0, 0]
        );
        // -0.0 keeps its sign bit — one representation per bit pattern.
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
