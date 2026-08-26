#![no_main]
//! `decode_canonical` — the strongest single invariant the crate has:
//! the canonical decoder accepts nothing it cannot reproduce. Arbitrary
//! bytes go into the decoder; on success, re-encoding must reproduce the
//! input exactly (´preview:xchg:fuzz-plan´).
//!
//! Both levels are exercised: the envelope [`Document`] (key 0 label,
//! key 1 version, content) and the bare [`Value`] it wraps, since a
//! round-trip breach at either level is a decoder that admits a
//! non-canonical name.

use cogra_interchange::{Document, Value};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if let Ok(doc) = Document::from_canonical_bytes(data) {
        let re = doc.to_canonical_bytes();
        assert_eq!(
            re, data,
            "canonical decode must round-trip to identical bytes"
        );
    }

    if let Ok(value) = Value::from_canonical_bytes(data) {
        let re = value.to_canonical_bytes();
        assert_eq!(
            re, data,
            "canonical value decode must round-trip to identical bytes"
        );
    }
});
