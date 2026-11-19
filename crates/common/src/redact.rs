//! ´mod:module:redact´
//!
//! `Debug` forms for byte strings that must never reach a log: a nonce, a
//! payload. They show the length and never the bytes, the way the
//! handshake types' own `Debug` impls do.

use std::fmt;

/// A byte string's `Debug` form: `<n bytes>`, or `None` when absent.
pub struct ByteLen<'a>(pub Option<&'a [u8]>);

impl<'a> ByteLen<'a> {
    pub fn of(bytes: &'a [u8]) -> Self {
        Self(Some(bytes))
    }

    pub fn of_opt(bytes: &'a Option<Vec<u8>>) -> Self {
        Self(bytes.as_deref())
    }
}

impl fmt::Debug for ByteLen<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.0 {
            Some(bytes) => write!(f, "<{} bytes>", bytes.len()),
            None => f.write_str("None"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A byte string's redacted Debug form shows its length, or None when absent, and never a byte.
    /// ´claim:redact:a-redacted-byte-string-shows-only-its-length´
    #[test]
    fn a_redacted_byte_string_shows_only_its_length() {
        assert_eq!(format!("{:?}", ByteLen::of(&[0xc7; 32])), "<32 bytes>");
        assert_eq!(
            format!("{:?}", ByteLen::of_opt(&Some(b"hello".to_vec()))),
            "<5 bytes>"
        );
        assert_eq!(format!("{:?}", ByteLen::of_opt(&None)), "None");
    }
}
