//! Shared test support.

use cogra_interchange::DecodeError;

/// Decode a hexadecimal string.
///
/// A dozen lines rather than a development dependency: the crate's whole
/// point is that byte-exactness has no third party in it.
#[allow(dead_code)]
pub fn hex_to_bytes(hex: &str) -> Vec<u8> {
    assert!(hex.len() % 2 == 0, "hex string of odd length: {hex}");
    let digits: Vec<u8> = hex
        .bytes()
        .map(|b| match b {
            b'0'..=b'9' => b - b'0',
            b'a'..=b'f' => b - b'a' + 10,
            b'A'..=b'F' => b - b'A' + 10,
            _ => panic!("not a hexadecimal digit: {:?}", b as char),
        })
        .collect();
    digits
        .chunks(2)
        .map(|pair| (pair[0] << 4) | pair[1])
        .collect()
}

/// The name of the variant, for assertions that care which refusal it is
/// without caring where it points.
#[allow(dead_code)]
pub fn variant_name(error: &DecodeError) -> &'static str {
    match error {
        DecodeError::Truncated { .. } => "Truncated",
        DecodeError::TrailingBytes { .. } => "TrailingBytes",
        DecodeError::NonPreferredHead { .. } => "NonPreferredHead",
        DecodeError::IndefiniteLength { .. } => "IndefiniteLength",
        DecodeError::UnsortedMapKeys { .. } => "UnsortedMapKeys",
        DecodeError::DuplicateMapKey { .. } => "DuplicateMapKey",
        DecodeError::NonShortestFloat { .. } => "NonShortestFloat",
        DecodeError::IllFormed { .. } => "IllFormed",
        DecodeError::InvalidUtf8 { .. } => "InvalidUtf8",
        other => panic!("a variant this support module has not met: {other:?}"),
    }
}

/// The byte offset every refusal carries.
#[allow(dead_code)]
pub fn offset_of(error: &DecodeError) -> usize {
    match error {
        DecodeError::Truncated { offset }
        | DecodeError::TrailingBytes { offset, .. }
        | DecodeError::NonPreferredHead { offset }
        | DecodeError::IndefiniteLength { offset }
        | DecodeError::UnsortedMapKeys { offset }
        | DecodeError::DuplicateMapKey { offset }
        | DecodeError::NonShortestFloat { offset }
        | DecodeError::IllFormed { offset }
        | DecodeError::InvalidUtf8 { offset } => *offset,
        other => panic!("a variant this support module has not met: {other:?}"),
    }
}
