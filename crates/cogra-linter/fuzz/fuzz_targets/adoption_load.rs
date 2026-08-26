#![no_main]
//! `adoption_load` — arbitrary text into [`Adoption::from_str`], asserting no
//! panic and that success implies a total partition, per design.md
//! (´preview:lint:fuzz-plan´).
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
//!
//! # The `order` check
//!
//! `PartitionRule::order` documents itself as "the rule's position; first
//! match wins, in this order", and [`Partition::owner_for`] matches down the
//! stored array. The campaign found the two uncoupled — the loader never
//! read `order` at all, so data whose orders were shuffled or repeated
//! loaded clean and matched in an order its own document contradicted, with
//! no diagnostic — by flipping one integer of the ruled
//! `corpus-adoption.toml` from `order = 4` to `order = 8`.
//!
//! The loader now checks it and refuses the data with `RuleOrderMismatch`,
//! so this is no longer a finding held behind an environment gate but an
//! ordinary invariant of the target: on anything that loaded, the orders are
//! exactly `1..=n` in position order.

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

    for (index, rule) in rules.iter().enumerate() {
        let position = u32::try_from(index + 1).unwrap_or(u32::MAX);
        assert_eq!(
            rule.order, position,
            "a loaded rule's order must be its position, and the loader must refuse anything else"
        );
    }
});
