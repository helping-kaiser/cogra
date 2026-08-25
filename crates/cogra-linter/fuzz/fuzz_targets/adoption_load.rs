#![no_main]
//! `adoption_load` — arbitrary text into [`Adoption::from_str`], asserting no
//! panic and that success implies a total partition
//! (`preview:lint:fuzz-plan`, design.md).
//!
//! # Why totality is the assertion
//!
//! Ω is total by construction of the data, not of the code: the last rule
//! carries the empty prefix, and the loader is what checks it, so
//! [`Partition::owner_for`] returns an owner and never an `Option` and there
//! is no unowned-source state to represent (´conv:lint:owner-assignment´).
//! Every later phase leans on that. A loader that accepted data whose last
//! prefix is non-empty would hand the rest of the crate a partial function it
//! believes is total, so the check is run two ways here — structurally on the
//! rules, and operationally by asking for the owner of paths chosen to fall
//! outside every plausible prefix.
//!
//! The probe paths deliberately include the empty path, a bare name, a deep
//! path, an absolute one, and one with non-ASCII and parent components, since
//! prefix matching is where a path that normalises differently would escape
//! the last rule.

use std::path::{Path, PathBuf};

use cogra_linter::Adoption;
use libfuzzer_sys::fuzz_target;

const PROBES: [&str; 8] = [
    "",
    "x",
    "docs/README.md",
    "crates/cogra-linter/src/lib.rs",
    "/absolute/elsewhere",
    "../outside",
    "ünïcode/pläce.md",
    "a/very/deep/path/that/no/prefix/should/claim/at/all.txt",
];

fuzz_target!(|data: &[u8]| {
    let Ok(text) = std::str::from_utf8(data) else {
        return;
    };

    let Ok(adoption) = Adoption::from_str(text, Path::new("corpus-adoption.toml")) else {
        return;
    };

    let rules = &adoption.partition.rules;
    assert!(
        !rules.is_empty(),
        "a loaded adoption must carry at least the catch-all rule"
    );
    assert!(
        rules
            .last()
            .is_some_and(|last| last.path.as_str().is_empty()),
        "the last rule's prefix must be empty, which is what makes the partition total: {:?}",
        rules.iter().map(|r| r.path.as_str()).collect::<Vec<_>>()
    );

    for probe in PROBES {
        let owner = adoption.partition.owner_for(&PathBuf::from(probe));
        assert!(
            !owner.as_str().is_empty(),
            "every path must have a non-empty owner, {probe:?} did not"
        );
    }

    assert!(
        rules.windows(2).all(|w| w[0].order <= w[1].order),
        "the rules must be held in their own order"
    );
});
