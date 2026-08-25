//! Exact byte comparison of every generated register.
//!
//! The generator is [`crate::registers::regenerate_all`] and this module is
//! only its mirror: it produces every register in memory and compares each
//! against what is committed, byte for byte
//! (´[ARCH-rule:linter:register-freshness]´). Producing and comparing are
//! kept apart on purpose — one generator serving both the check and the
//! regeneration mode is what (´req:lint:register-generator´) means, and a
//! comparison that knew how to build a register would be the second one
//! (´rem:lint:module-additions´).
//!
//! # Two departures from the ruled signature, both named
//!
//! (´sig:lint:judgment-api´) writes this judgment `registers(g, a, root)`.
//! It takes two further arguments here and no root.
//!
//! The registries and the kind registry are taken because the one generator
//! takes them: a freshness check that could not hand `regenerate_all` its
//! own ruled inputs would have to build the registers a second way, which is
//! the thing (´dec:lint:one-generator´) exists to forbid.
//!
//! The committed bytes are taken as the run read them rather than re-read
//! from a root, because the run already holds every carrier source and
//! reading the tree twice would compare against bytes the run did not lint —
//! a register could be reported current against a file that changed between
//! the two reads. It also lets a fixture corpus with no root on disk be
//! checked at all, which is what [`crate::check_sources`] is for.
//!
//! Those arguments are why the judgment is called from the run rather than
//! from [`super::judge_all`], whose ruled signature carries neither.

use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::adopt::Adoption;
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::graph::{Corpus, Registries};
use crate::judge::kinds::KindRegistry;
use crate::registers::{Freshness, Register, committed, compare, regenerate_all};

/// A committed register differs from what the generator produces.
pub const STALE: RuleId = RuleId::new("register-stale");

/// A register the generator produces has never been committed.
pub const STAGED: RuleId = RuleId::new("register-staged");

/// Every rule this module can report.
pub const RULES: [RuleId; 2] = [STAGED, STALE];

/// Compare every generated register against what is committed.
///
/// `sources` maps each carrier path to its bytes, as the harvest read them.
/// A register whose path is absent has never been generated and is reported
/// staged rather than stale: there are no committed bytes to differ from,
/// and saying "out of date" of a file that does not exist would name the
/// wrong repair (´req:lint:register-generator´).
///
/// A generated region is compared against exactly its host's span, and its
/// offset is reported in the host's own coordinates, because that is where a
/// reader has to look.
///
/// ```
/// use cogra_linter::graph::{Corpus, Registries};
/// use cogra_linter::judge::freshness;
/// use std::collections::BTreeMap;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
///
/// let found = freshness::registers(
///     &Corpus::new(), &Registries::new(), &adoption, None, &BTreeMap::new());
/// assert!(found.is_empty(), "no register generated, so none to compare");
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn registers(
    g: &Corpus,
    r: &Registries,
    a: &Adoption,
    kinds: Option<&KindRegistry>,
    sources: &BTreeMap<PathBuf, Vec<u8>>,
) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    for reg in regenerate_all(g, r, a, kinds) {
        let (held, base) = committed(&reg, sources);
        match compare(&reg, held) {
            Freshness::Current => {}
            Freshness::Stale { at } => found.push(stale(&reg, base + at)),
            Freshness::Staged => found.push(staged(&reg)),
        }
    }
    found
}

/// A register whose committed bytes differ, located at the first difference.
fn stale(reg: &Register, at: usize) -> Diagnostic {
    Diagnostic {
        rule: STALE,
        severity: Severity::Error,
        enforcement: Enforcement::Advisory,
        primary: Location::new(reg.path.clone(), ByteSpan::new(at, at), 0, 0),
        related: Vec::new(),
        message: String::from(
            "this generated register differs from what the generator produces here, and regeneration is its only repair",
        ),
    }
}

/// A register that has never been generated.
fn staged(reg: &Register) -> Diagnostic {
    Diagnostic {
        rule: STAGED,
        severity: Severity::Warning,
        enforcement: Enforcement::Advisory,
        primary: Location::new(reg.path.clone(), ByteSpan::new(0, 0), 0, 0),
        related: Vec::new(),
        message: String::from(
            "this register has never been generated, so no committed bytes exist to compare against",
        ),
    }
}
