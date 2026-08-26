#![no_main]
//! `pretokenize_rust` — the strongest single assertion the crate has, since
//! it is total on every input: arbitrary bytes into [`pretokenize`], and the
//! lexeme partition of (´inv:lint:lexeme-partition´) must hold whatever came
//! in (´preview:lint:fuzz-plan´, design.md).
//!
//! [`PreTokenized::partitions`] is the predicate the crate states once and
//! every fixture, the property obligation, and this target assert — ascending,
//! non-overlapping, no empty lexeme, and exactly `len` bytes covered — so the
//! target calls it rather than restating it and drifting from it.
//!
//! Three surfaces beyond the partition, each a place arbitrary bytes reach
//! arithmetic the fixtures only reach on well-formed input. `class_at` is a
//! binary search over the partition, run at every lexeme boundary and one past
//! the end. `comments` walks the classification. `stamped` turns byte offsets
//! into line and column numbers against the source, which is the unterminated
//! form's diagnostic path — the design names unterminated handling as one of
//! the two deferred hazards to look at first.
//!
//! Both language selections run: `Some(rust)` takes the Rust lexer, `None`
//! takes the whole-file fallback, and the partition is required of both.

use std::path::Path;

use cogra_linter::pretokenize::{PreTokenized, pretokenize};
use cogra_linter::{Enforcement, Language};
use libfuzzer_sys::fuzz_target;

fn check(pre: &PreTokenized, bytes: &[u8], which: &str) {
    assert!(
        pre.partitions(bytes.len()),
        "the lexeme partition must hold on every input ({which}): {:?}",
        pre.lexemes
    );

    for one in &pre.lexemes {
        assert!(
            one.span.end <= bytes.len(),
            "a lexeme must lie within the input ({which}): {:?}",
            one.span
        );
    }

    for one in &pre.lexemes {
        assert_eq!(
            pre.class_at(one.span.start),
            Some(one.class),
            "class_at must find the lexeme starting exactly there ({which})"
        );
    }
    let _ = pre.class_at(bytes.len());
    let _ = pre.class_at(usize::MAX);

    for (span, form) in pre.comments() {
        assert!(
            span.end <= bytes.len(),
            "a comment must lie within the input ({which}): {span:?} {form:?}"
        );
    }

    let stamped = pre.stamped(Path::new("fuzz.rs"), bytes, Enforcement::Failing);
    assert_eq!(
        stamped.len(),
        pre.unclassified.len(),
        "stamping must not add or drop a diagnostic ({which})"
    );
    for one in &stamped {
        assert!(
            one.primary.span.end <= bytes.len(),
            "a diagnostic must point within the input ({which}): {:?}",
            one.primary.span
        );
    }
}

fuzz_target!(|data: &[u8]| {
    let rust = Language::new("rust");
    check(&pretokenize(Some(&rust), data), data, "rust");
    check(&pretokenize(None, data), data, "none");
});
