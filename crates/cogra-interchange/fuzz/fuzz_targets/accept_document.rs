#![no_main]
//! `accept_document` — arbitrary bytes decoded against a fixed registry
//! state, asserting only that acceptance never panics and that a
//! [`Verdict`] is only ever reached through a successful decode
//! (´preview:xchg:fuzz-plan´). Rejection is itself a verdict,
//! so the interesting failure here would be a panic inside `accept`.
//!
//! The registry is built once and shared across iterations: it holds one
//! assigned coordinate (`com.example` major 1, minor 0) with a small
//! theory, mirroring the crate's doctest fixture.

use std::sync::OnceLock;

use cogra_interchange::{accept, Coordinate, Document, NamespaceLabel, Registry, Theory};
use libfuzzer_sys::fuzz_target;

fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let label = NamespaceLabel::parse("com.example").expect("a label");
        let theory =
            Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
                .expect("an assignable theory");
        let mut reg = Registry::new();
        reg.acquire(Coordinate::new(label, 1, 0), theory)
            .expect("the first minor of the major");
        reg
    })
}

fuzz_target!(|data: &[u8]| {
    let reg = registry();
    if let Ok(doc) = Document::from_canonical_bytes(data) {
        let _ = accept(reg, &doc);
    }
});
