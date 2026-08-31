//! ´mod:module:registers´
//!
//! The generators: label registers, the companion attestation register, and
//! the headline counts.
//!
//! One generator produces every generated register the disciplines call for,
//! and the check and the regeneration mode consume the same output
//! (´req:lint:register-generator´), (´[ARCH-rule:linter:register-freshness]´).
//! [`regenerate_all`] is that generator; [`crate::judge::freshness`] only
//! compares, and the separation is what stops the check from acquiring a
//! second one (´rem:lint:module-additions´).
//!
//! # Exact bytes, and no digest
//!
//! [`compare`] is `Vec<u8>` against `&[u8]`. There is no hash in this
//! module — not of a register, not of a file, not as an internal
//! optimization that could later persist. This is the linter's whole share
//! of the identity discipline, taken as its charter states it
//! (´dec:lint:no-digest´), (´[IDN-crit:identity:benefit]´): a digest would
//! buy nothing over comparing two byte strings that are both already in
//! memory, and would owe a walked adjudication it could not discharge.
//!
//! # What is generated, and what is spliced
//!
//! Two of the three are whole files. The headline counts are a generated
//! *region* inside an authored file, so [`RegisterScope::Region`] carries its
//! host and span and [`write_all`] splices rather than replaces — the one
//! place the generator edits a file it does not own end to end, and the
//! reason the registry document is not in `[carrier]` `generated_files`
//! (´dec:lint:one-generator´).

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use petgraph::stable_graph::NodeIndex;

use crate::adopt::{Adoption, Area, OwnerId, Profile, ProfileId};
use crate::diag::ByteSpan;
use crate::error::GenerateError;
use crate::frontend::Asset;
use crate::graph::{AssetNode, Corpus, EdgeW, NodeW, Registries, out_along};
use crate::judge::claims::{Form, Standing, standing};
use crate::judge::kinds::{HeadlineCounts, KindRegistry};
use crate::scan::Label;

/// The file name a per-owner label register carries.
///
/// The name and location are implementation-defined and this is the
/// implementation's choice, as `[profiles]` says in as many words: what the
/// calculus fixes is only that the place is a generated register of the
/// owner.
const LABEL_REGISTER: &str = "label-register.md";

/// Where one owner's label register sits, given that owner's tree.
///
/// One function so that the generator and the migration measurement cannot
/// disagree about where a register would be found.
///
/// ```
/// use cogra_linter::registers::register_path;
/// use std::path::Path;
///
/// assert_eq!(
///     register_path(Path::new("crates/api")),
///     Path::new("crates/api/label-register.md"),
/// );
/// ```
#[must_use]
pub fn register_path(owner_tree: &Path) -> PathBuf {
    owner_tree.join(LABEL_REGISTER)
}

/// The file name a per-owner claim matrix carries.
const CLAIM_MATRIX: &str = "claim-matrix.md";

/// Where one owner's claim matrix sits, given that owner's tree.
///
/// Beside its label register, and for the same reason: a register lies inside
/// the tree of the owner it presents, so its own occurrences fall under that
/// owner's partition rule.
///
/// ```
/// use cogra_linter::registers::matrix_path;
/// use std::path::Path;
///
/// assert_eq!(
///     matrix_path(Path::new("crates/api")),
///     Path::new("crates/api/claim-matrix.md"),
/// );
/// ```
#[must_use]
pub fn matrix_path(owner_tree: &Path) -> PathBuf {
    owner_tree.join(CLAIM_MATRIX)
}

/// A register as the generator produces it: a path and the exact bytes.
///
/// For a whole-file register the path is the file. For a
/// [`RegisterScope::Region`] it is the *host* — the authored file the region
/// sits in — and the bytes are the region's, never the host's.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Register {
    /// Where the register lives, relative to the corpus root.
    pub path: PathBuf,
    /// Exactly what it should contain.
    pub bytes: Vec<u8>,
    /// Which register it is.
    pub scope: RegisterScope,
}

/// Which of the disciplines' registers one [`Register`] is.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum RegisterScope {
    /// One per owner with covered assets, for one inventory profile.
    LabelRegister {
        /// The owner whose assets it presents.
        owner: OwnerId,
        /// The profile whose standard place it is.
        profile: ProfileId,
    },
    /// One per activated owner: the claims of that owner against the tests
    /// that carry them (`[claims]`).
    ClaimMatrix {
        /// The owner whose claims it presents.
        owner: OwnerId,
    },
    /// The companion attestation register
    /// (´[KND-req:kinds:attestation-register]´).
    Attestation,
    /// A generated region inside an authored file, not a whole file
    /// (´[KND-tab:kinds:headline-counts]´).
    Region {
        /// The authored file the region sits in.
        host: PathBuf,
        /// The bytes of that file the region occupies.
        span: ByteSpan,
    },
}

/// How a committed register stands against what the generator produces.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Freshness {
    /// Byte-identical.
    Current,
    /// Differs, with the offset of the first differing byte.
    ///
    /// The offset and not a diff: a diff is a rendering concern, and
    /// [`crate::render`] has both byte strings (´dec:lint:no-digest´).
    Stale {
        /// Where the two first disagree.
        at: usize,
    },
    /// Never generated: no committed bytes exist to compare against
    /// (´req:lint:register-generator´).
    Staged,
}

/// Which owners a regeneration touches.
///
/// A scoped regeneration ignores unrelated owners' defects
/// (´[LBL-cav:labels:coexistence]´). The corpus-wide registers — the
/// companion attestation register and the generated regions — belong to no
/// owner, so an owner-scoped regeneration leaves them alone rather than
/// guessing which owner they fall to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Scope {
    /// Every register the generator produced.
    WholeCorpus,
    /// Only the registers of one owner: its label registers and its claim
    /// matrix.
    Owner(OwnerId),
}

impl Scope {
    /// Whether a regeneration under this scope writes `reg`.
    #[must_use]
    pub fn admits(&self, reg: &Register) -> bool {
        match (self, &reg.scope) {
            (Scope::WholeCorpus, _) => true,
            (Scope::Owner(wanted), RegisterScope::LabelRegister { owner, .. })
            | (Scope::Owner(wanted), RegisterScope::ClaimMatrix { owner }) => wanted == owner,
            (Scope::Owner(_), _) => false,
        }
    }
}

/// What a regeneration wrote.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Written {
    /// The files touched, in path order, each once however many registers
    /// landed in it.
    pub paths: Vec<PathBuf>,
}

/// Regenerate every register in memory.
///
/// Total: it reads the completed registries and writes nothing. Its result
/// is the only description of what a register should contain — the check
/// compares it against what is committed and the regeneration mode writes
/// it, so nothing generates a register twice by two routes
/// (´dec:lint:one-generator´).
///
/// `k` is `None` where the registry document would not parse
/// (´dec:lint:registry-bootstrap´), and the two registers derived from the
/// classification relation are then not produced: a register generated from
/// a relation the linter could not read would be a confident answer built on
/// a failure.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::graph::{Corpus, Registries};
/// use cogra_linter::registers::regenerate_all;
///
/// let none = regenerate_all(&Corpus::new(), &Registries::new(), &adoption, None);
/// assert!(none.is_empty(), "no relation read, so no register derived from one");
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn regenerate_all(
    g: &Corpus,
    r: &Registries,
    a: &Adoption,
    k: Option<&KindRegistry>,
) -> Vec<Register> {
    let mut out = label_registers(g, r, a);
    out.extend(claim_matrices(g, a));
    if let Some(k) = k {
        out.push(attestation(a, k));
        if let Some(span) = k.headline_region() {
            out.push(headline(a, k.headline_counts(), span));
        }
    }
    out.sort_by(|one, other| one.path.cmp(&other.path).then(one.bytes.cmp(&other.bytes)));
    out
}

/// Compare one register against what is committed.
///
/// `committed` is the bytes the run read, never a second read of the tree:
/// comparing against bytes the run did not lint would answer a question
/// nobody asked.
///
/// ```
/// use cogra_linter::registers::{Freshness, Register, RegisterScope, compare};
/// use std::path::PathBuf;
///
/// let reg = Register {
///     path: PathBuf::from("r.md"),
///     bytes: Vec::from("one\ntwo\n"),
///     scope: RegisterScope::Attestation,
/// };
/// assert_eq!(compare(&reg, Some(b"one\ntwo\n")), Freshness::Current);
/// assert_eq!(compare(&reg, Some(b"one\nTWO\n")), Freshness::Stale { at: 4 });
/// assert_eq!(compare(&reg, Some(b"one\n")), Freshness::Stale { at: 4 });
/// assert_eq!(compare(&reg, None), Freshness::Staged);
/// ```
#[must_use]
pub fn compare(reg: &Register, committed: Option<&[u8]>) -> Freshness {
    let Some(committed) = committed else {
        return Freshness::Staged;
    };
    match reg
        .bytes
        .iter()
        .zip(committed)
        .position(|(one, other)| one != other)
    {
        Some(at) => Freshness::Stale { at },
        None if reg.bytes.len() == committed.len() => Freshness::Current,
        None => Freshness::Stale {
            at: reg.bytes.len().min(committed.len()),
        },
    }
}

/// Write, in the regeneration mode only, never from a check.
///
/// `root` is the corpus root every register's path is relative to. The
/// design's signature carries no root, and this one does, because every path
/// in the crate is corpus-relative: resolving them against the process's
/// working directory instead would make the outcome depend on where the
/// binary was invoked, which (´req:lint:determinism´) forbids.
///
/// A generated region is spliced into its host rather than replacing it, and
/// several regions in one host are spliced from the last to the first, so
/// that no splice moves a span not yet applied.
///
/// ```no_run
/// use cogra_linter::registers::{Scope, regenerate_all, write_all};
/// use std::path::Path;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let root = Path::new(".");
/// let adoption = cogra_linter::Adoption::load(&root.join("corpus-adoption.toml"))?;
/// let checked = cogra_linter::check(&adoption, root)?;
///
/// let regs = regenerate_all(
///     &checked.graph, &checked.registries, &adoption, checked.kinds.as_ref());
/// let written = write_all(&regs, &Scope::WholeCorpus, root)?;
///
/// println!("{} files written", written.paths.len());
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// [`GenerateError::Write`] when a register or its host cannot be read or
/// written, and [`GenerateError::MissingHostRegion`] when a region's span
/// lies outside the host it names — a host that has moved under the
/// generator, which is the one failure a splice cannot absorb.
pub fn write_all(regs: &[Register], scope: &Scope, root: &Path) -> Result<Written, GenerateError> {
    let admitted: Vec<&Register> = regs.iter().filter(|one| scope.admits(one)).collect();
    let mut touched: Vec<PathBuf> = Vec::new();
    let mut regions: BTreeMap<PathBuf, Vec<&Register>> = BTreeMap::new();

    for reg in admitted {
        match &reg.scope {
            RegisterScope::Region { host, .. } => {
                regions.entry(host.clone()).or_default().push(reg);
            }
            _ => {
                let at = root.join(&reg.path);
                if let Some(parent) = at.parent() {
                    fs::create_dir_all(parent).map_err(|source| GenerateError::Write {
                        path: reg.path.clone(),
                        source,
                    })?;
                }
                fs::write(&at, &reg.bytes).map_err(|source| GenerateError::Write {
                    path: reg.path.clone(),
                    source,
                })?;
                touched.push(reg.path.clone());
            }
        }
    }

    for (host, mut held) in regions {
        held.sort_by_key(|one| std::cmp::Reverse(span_of(one).map(|span| span.start)));
        let at = root.join(&host);
        let mut bytes = fs::read(&at).map_err(|source| GenerateError::Write {
            path: host.clone(),
            source,
        })?;
        for reg in held {
            let Some(span) = span_of(reg) else {
                return Err(GenerateError::MissingHostRegion { path: host.clone() });
            };
            if span.start > span.end || span.end > bytes.len() {
                return Err(GenerateError::MissingHostRegion { path: host.clone() });
            }
            bytes.splice(span.start..span.end, reg.bytes.iter().copied());
        }
        fs::write(&at, &bytes).map_err(|source| GenerateError::Write {
            path: host.clone(),
            source,
        })?;
        touched.push(host);
    }

    touched.sort();
    touched.dedup();
    Ok(Written { paths: touched })
}

/// What is committed where a register sits, and the file offset that span
/// begins at.
///
/// A whole-file register is compared against the whole file; a generated
/// region against exactly its host's span, whose start is the second half of
/// the answer so that an offset can be reported in the host's own
/// coordinates. `None` means nothing is committed there, which is
/// [`Freshness::Staged`] and never staleness.
///
/// `sources` is what the run read, never a second read of the tree: two
/// reads could disagree, and the freshness answer would then be about a file
/// nobody linted.
#[must_use]
pub fn committed<'s>(
    reg: &Register,
    sources: &'s BTreeMap<PathBuf, Vec<u8>>,
) -> (Option<&'s [u8]>, usize) {
    match &reg.scope {
        RegisterScope::Region { host, span } => (
            sources
                .get(host)
                .and_then(|bytes| bytes.get(span.start..span.end)),
            span.start,
        ),
        _ => (sources.get(&reg.path).map(Vec::as_slice), 0),
    }
}

/// The host span a region register carries, if it is one.
fn span_of(reg: &Register) -> Option<ByteSpan> {
    match reg.scope {
        RegisterScope::Region { span, .. } => Some(span),
        _ => None,
    }
}

/// The label one covered asset derives, under its profile's transformation.
///
/// The transformation both registered profiles record is one spelling rule —
/// the bare identifier, lowercased, with underscores replaced by hyphens —
/// and a spelling rule is code, exactly as the device families of
/// (´dec:lint:reduction-vocabulary´) are. `[profiles]` records the rule as
/// free text, so a profile whose rule differs from this one would need that
/// section to carry the rule as a value; the gap is named here rather than
/// hidden, as `[banned-tokens]`' missing class key is.
///
/// `None` where the transformed identifier is not a well-formed name — a
/// non-ASCII identifier, say. The asset then carries no derived label, which
/// is what the inventory judgment reports rather than what a generator
/// invents.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::registers::derived_label;
/// use cogra_linter::Area;
///
/// let profile = &adoption.profiles.profiles[0];
/// let label = derived_label(profile, "decode_roundtrip", &Area::new("integration"))
///     .ok_or("a well-formed name")?;
/// assert_eq!(label.as_str(), "test:integration:decode-roundtrip");
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn derived_label(profile: &Profile, identifier: &str, area: &Area) -> Option<Label> {
    let name: String = identifier
        .chars()
        .map(|one| if one == '_' { '-' } else { one })
        .flat_map(char::to_lowercase)
        .collect();
    Label::parse(&format!(
        "{}:{}:{name}",
        profile.kind.as_str(),
        area.as_str()
    ))
    .ok()
}

/// The per-owner label registers one profile's census yields.
///
/// The census reaches the generator as a value, from whichever run computed
/// it: the check's own harvest for a profile in force, and the measurement's
/// walk for the named regeneration of one still staged
/// (´dec:lint:staged-profiles´). Neither route builds a register's bytes —
/// both hand their rows to the one that does, which is what keeps a register
/// from being generated twice by two routes (´dec:lint:one-generator´).
///
/// Empty for a profile whose standard place is not a generated register: a
/// label carried at the definition itself is authored there, and generating
/// a file for it would put the label in a second place.
#[must_use]
pub fn label_registers_of(
    a: &Adoption,
    profile: &Profile,
    census: &BTreeMap<OwnerId, Vec<Asset>>,
) -> Vec<Register> {
    if profile.standard_place.register.is_none() {
        return Vec::new();
    }
    census
        .iter()
        .filter_map(|(owner, held)| {
            let rows = rows_of(
                profile,
                held.iter().map(|one| (one.identifier.as_str(), &one.area)),
            );
            label_register(a, profile, owner, rows)
        })
        .collect()
}

/// The per-owner label registers of every effective profile whose standard
/// place is a generated register.
///
/// One profile of this corpus has such a place, and these are its registers.
/// The module profile's standard place is the definition itself, so it
/// contributes none; a staged profile carries no `Covers` edges and
/// contributes none either (´dec:lint:staged-profiles´), which is what keeps
/// entering Π a matter of flipping fields rather than writing code.
fn label_registers(g: &Corpus, r: &Registries, a: &Adoption) -> Vec<Register> {
    let mut out = Vec::new();
    for profile in a.profiles.effective() {
        if profile.standard_place.register.is_none() {
            continue;
        }
        let Some(node) = profile_node(g, &profile.id) else {
            continue;
        };
        let covered: Vec<NodeIndex> = out_along(g, node, EdgeW::Covers).collect();
        let owners: BTreeMap<&OwnerId, NodeIndex> =
            r.owners.iter().map(|(id, at)| (id, *at)).collect();
        for (id, owner) in owners {
            let held: Vec<&AssetNode> = covered
                .iter()
                .filter(|asset| crate::graph::owner_of(g, **asset) == Some(owner))
                .filter_map(|asset| match g.node_weight(*asset) {
                    Some(NodeW::Asset(weight)) => Some(weight),
                    _ => None,
                })
                .collect();
            let rows = rows_of(
                profile,
                held.iter().map(|one| (&*one.identifier, &one.area)),
            );
            out.extend(label_register(a, profile, id, rows));
        }
    }
    out
}

/// The per-activated-owner claim matrices: each owner's claims against the
/// tests that carry them (`[claims]`).
///
/// An unactivated owner gets none. A file of no rows is not a view of an empty
/// relation but a register with nothing to present, and the owner's count
/// travels in `report` until its wave closes.
///
/// The standing of each test is read by [`crate::judge::claims::standing`] and
/// by nothing else here. One reader serves the judgment and the view, so a
/// matrix can never say something about a test that the check disagrees with.
fn claim_matrices(g: &Corpus, a: &Adoption) -> Vec<Register> {
    let Some(declared) = a.claims.as_ref() else {
        return Vec::new();
    };
    let Some(profile) = a
        .profiles
        .effective()
        .find(|profile| profile.id == declared.rides)
    else {
        return Vec::new();
    };
    let Some(node) = profile_node(g, &profile.id) else {
        return Vec::new();
    };
    let mut held: BTreeMap<OwnerId, BTreeMap<Label, MatrixRow>> = BTreeMap::new();
    for asset in out_along(g, node, EdgeW::Covers) {
        let Some(NodeW::Asset(weight)) = g.node_weight(asset) else {
            continue;
        };
        let Some(owner) = crate::graph::owner_of(g, asset).and_then(|at| owner_named(g, at)) else {
            continue;
        };
        if !declared.activation.admits(&owner) {
            continue;
        }
        let Standing::Claimed(line) = standing(&weight.documentation, &declared.kind) else {
            continue;
        };
        let Some(test) = derived_label(profile, &weight.identifier, &weight.area) else {
            continue;
        };
        let row = held.entry(owner).or_default().entry(line.label).or_default();
        row.tests.insert(test);
        if line.form == Form::Mint {
            row.statement = line.statement;
        }
    }
    held.into_iter()
        .map(|(owner, rows)| Register {
            path: matrix_path(&owner_root(a, &owner)),
            bytes: claim_matrix_bytes(&owner, profile, &rows),
            scope: RegisterScope::ClaimMatrix { owner },
        })
        .collect()
}

/// One row of a claim matrix: the statement, and the tests that carry it.
#[derive(Default)]
struct MatrixRow {
    /// The statement, from the test that mints the claim. Empty where no test
    /// of the owner mints it, which is a citation resolving nowhere and
    /// (´[LBL-inv:labels:total-resolution]´)'s finding rather than this
    /// generator's to invent around.
    statement: String,
    /// Every test that mints or cites the claim, ordered bytewise.
    tests: BTreeSet<Label>,
}

/// One owner's claim matrix: one row per claim, ordered bytewise by claim
/// label.
///
/// Every occurrence in it is a citation, and that is the whole design: a row
/// naming a test that was renamed or deleted dangles and fails resolution,
/// while no row mints anything — the claim's mint is at the test, and a second
/// bare occurrence would be (´[LBL-inv:labels:unique-mint]´)'s business. The
/// Title alone mints, as every titled source of the carrier does
/// (´dec:lint:title-head´).
fn claim_matrix_bytes(
    owner: &OwnerId,
    profile: &Profile,
    rows: &BTreeMap<Label, MatrixRow>,
) -> Vec<u8> {
    let mut out = String::new();
    let _ = writeln!(out, "# Claim matrix \u{b7} `{CLAIM_MATRIX_MINT}`\n");
    out.push_str(GENERATED);
    let _ = write!(
        out,
        "\nOwner {}, profile {}: one row per claim, ordered bytewise by claim\nlabel. Every occurrence is a citation; the tests of a row are the test\nthat mints the claim and every test that cites it.\n\n",
        owner.as_str(),
        profile.id.as_str()
    );
    let table: Vec<Vec<String>> = rows
        .iter()
        .map(|(label, row)| {
            vec![
                format!("(`{}`)", label.as_str()),
                cell(&row.statement),
                row.tests
                    .iter()
                    .map(|test| format!("(`{}`)", test.as_str()))
                    .collect::<Vec<String>>()
                    .join(" "),
            ]
        })
        .collect();
    out.push_str(&markdown_table(&["Claim", "Statement", "Tests"], &table));
    out.into_bytes()
}

/// One statement, as a table cell.
///
/// A pipe is the table's own delimiter, so a statement carrying one is escaped
/// rather than allowed to end its cell early. Nothing else is escaped, because
/// nothing else in a statement is the format's: a backtick is refused at the
/// test by (´dec:lint:claim-standing´) rather than escaped here, since escaping
/// it would hide from the author that the matrix reads their line as prose.
fn cell(statement: &str) -> String {
    statement.replace('|', "\\|")
}

/// The Title mint every per-owner claim matrix carries.
const CLAIM_MATRIX_MINT: &str = "reg:registers:claim-matrix";

/// The owner a node names.
fn owner_named(g: &Corpus, owner: NodeIndex) -> Option<OwnerId> {
    match g.node_weight(owner) {
        Some(NodeW::Owner(weight)) => Some(weight.id.clone()),
        _ => None,
    }
}

/// The rows one owner's covered assets contribute, ordered bytewise by label.
///
/// An asset whose transformed identifier is no well-formed name contributes
/// none: it derives no label, and a generator that invented one would put a
/// label in the register the inventory judgment could not find at the asset.
fn rows_of<'i>(
    profile: &Profile,
    assets: impl Iterator<Item = (&'i str, &'i Area)>,
) -> Vec<(Label, String)> {
    let mut rows: Vec<(Label, String)> = assets
        .filter_map(|(identifier, area)| {
            derived_label(profile, identifier, area).map(|label| (label, identifier.to_owned()))
        })
        .collect();
    rows.sort();
    rows.dedup();
    rows
}

/// One owner's label register, or nothing where that owner covers no asset.
///
/// The one place a label register's bytes are produced, whichever run
/// supplied the rows (´dec:lint:one-generator´).
fn label_register(
    a: &Adoption,
    profile: &Profile,
    owner: &OwnerId,
    rows: Vec<(Label, String)>,
) -> Option<Register> {
    if rows.is_empty() {
        return None;
    }
    Some(Register {
        path: register_path(&owner_root(a, owner)),
        bytes: label_register_bytes(owner, profile, &rows),
        scope: RegisterScope::LabelRegister {
            owner: owner.clone(),
            profile: profile.id.clone(),
        },
    })
}

/// The tree an owner's own registers live in.
///
/// The first partition rule naming the owner with a tree prefix, which is
/// the owner's root by Ω's own first-match reading: a register lies inside
/// the tree of the owner it presents, so it falls under that owner's rule
/// (´[LBL-inv:labels:generated-compliance]´), `[profiles]`. An owner Ω gives
/// only file rules — a single document — has no tree, and its register would
/// have nowhere to live; it also has no covered assets, so the case does not
/// arise and is not invented around.
///
/// Public because the migration measurement asks the same question — where
/// an owner's register would sit — and asking it twice is how two answers
/// come to differ (´dec:lint:migrations-subcommand´).
#[must_use]
pub fn owner_root(a: &Adoption, owner: &OwnerId) -> PathBuf {
    a.partition
        .rules
        .iter()
        .find(|rule| rule.owner == *owner && rule.path.as_str().ends_with('/'))
        .map_or_else(PathBuf::new, |rule| {
            PathBuf::from(rule.path.as_str().trim_end_matches('/'))
        })
}

/// The profile node one registered profile carries.
fn profile_node(g: &Corpus, id: &ProfileId) -> Option<NodeIndex> {
    crate::graph::nodes_of(g, crate::graph::NodeKind::Profile).find(
        |node| matches!(g.node_weight(*node), Some(NodeW::Profile(weight)) if weight.id == *id),
    )
}

/// One owner's label register: one row per covered asset, ordered bytewise
/// by label, each label in the Markdown mint form `[profiles]` fixes.
///
/// The title carries the register's own mint, as every titled source of the
/// carrier does (´dec:lint:title-head´). It is an authorship a generator
/// transcribes and is that choice still
/// (´[LBL-inv:labels:generated-compliance]´): the name is the same in every
/// owner, and ownership is what keeps the mints apart
/// (´[LBL-cav:labels:coexistence]´).
fn label_register_bytes(owner: &OwnerId, profile: &Profile, rows: &[(Label, String)]) -> Vec<u8> {
    let mut out = String::new();
    let _ = writeln!(out, "# Label register \u{b7} `{LABEL_REGISTER_MINT}`\n");
    out.push_str(GENERATED);
    let _ = write!(
        out,
        "\nOwner {}, profile {}: one row per covered asset, ordered bytewise by\nlabel.\n\n",
        owner.as_str(),
        profile.id.as_str()
    );
    let table: Vec<Vec<String>> = rows
        .iter()
        .map(|(label, identifier)| vec![format!("`{}`", label.as_str()), identifier.clone()])
        .collect();
    out.push_str(&markdown_table(&["Label", "Asset"], &table));
    out.into_bytes()
}

/// The Title mint every per-owner label register carries.
const LABEL_REGISTER_MINT: &str = "reg:registers:label-register";

/// The Title mint the companion attestation register carries.
const ATTESTATION_MINT: &str = "reg:registers:attestation-register";

/// The line every generated register opens with, so that a reader who opens
/// one is told what it is before anything else.
const GENERATED: &str = "Generated by the corpus linter's regeneration mode, and maintained only by\nregeneration: this file is compared byte for byte on every run, and a hand\nedit is a finding rather than a change.\n";

/// The companion attestation register `Ê_A = G_A(E_A, σ_A)`
/// (´[KND-req:kinds:attestation-register]´).
///
/// The rows are ordered by name, then kind, then source, then locator, then
/// the record sequence number — the total recorded ordering, whose first two
/// keys decide every pair of this corpus because the evidence base is
/// adopted whole and by reference, so every base row shares one source and
/// one locator. The sequence number is printed rather than implied, which is
/// what makes the ordering a reader can check against the file.
fn attestation(a: &Adoption, k: &KindRegistry) -> Register {
    let locator = a.registry_document();
    let mut out = String::new();
    let _ = writeln!(
        out,
        "# Companion attestation register \u{b7} `{ATTESTATION_MINT}`\n"
    );
    out.push_str(GENERATED);
    let _ = write!(
        out,
        "\nAcceptee: {}.\n\nEvidence base, adopted component:\n{}\n\nEvidence base, owned records: {}, one per row of the local extension set.\nA row sourced `adopted` carries the adopted component's own source and\nlocator; a row sourced `owned` carries its record's. No status is\nstrengthened, so the status map is the edition's unchanged.\n\n## Evidence and status\n\n",
        a.kinds.acceptee,
        a.kinds.evidence.adopted,
        a.kinds.evidence.owned.len(),
    );

    let rows: Vec<Vec<String>> = k
        .rows()
        .enumerate()
        .map(|(at, (name, kind, status))| {
            let (source, where_) = if k.is_local(name, kind) {
                let record = a
                    .kinds
                    .evidence
                    .owned
                    .iter()
                    .find(|record| &*record.name == name && &record.kind == kind);
                let where_ = record.map_or_else(
                    || String::from(&*a.kinds.evidence.recorded_in),
                    |record| record.locator.to_string(),
                );
                (OWNED, where_)
            } else {
                (ADOPTED, locator.display().to_string())
            };
            vec![
                name.to_owned(),
                format!("`{}`", kind.as_str()),
                String::from(status.token()),
                String::from(source),
                where_,
                (at + 1).to_string(),
            ]
        })
        .collect();
    let _ = write!(
        out,
        "{} rows of the effective relation, each with the status the edition\nrecords for it.\n\n",
        rows.len()
    );
    out.push_str(&markdown_table(
        &["Name", "Kind", "Status", "Source", "Locator", "Record"],
        &rows,
    ));

    out.push_str("\n## Candidates\n\n");
    if a.kinds.statuses.candidates.is_empty() {
        out.push_str("None recorded.\n");
    } else {
        out.push_str(
            "Recorded candidates retain evidence without entering the effective\nrelation, and carry no row above.\n\n",
        );
        for one in &a.kinds.statuses.candidates {
            let _ = writeln!(out, "- {one}");
        }
    }

    let homonyms: Vec<Vec<String>> = k
        .homonyms()
        .map(|(name, kind)| vec![name.to_owned(), format!("`{}`", kind.as_str())])
        .collect();
    let _ = write!(
        out,
        "\n## Homonyms\n\nThe {} pairs whose name carries more than one kind, derived from the same\nrelation and declared nowhere. For a name here, the kind token at the label\nis what says which catalogued sense is meant.\n\n",
        homonyms.len()
    );
    out.push_str(&markdown_table(&["Name", "Kind"], &homonyms));

    Register {
        path: PathBuf::from(&*a.kinds.register.standard_place),
        bytes: out.into_bytes(),
        scope: RegisterScope::Attestation,
    }
}

/// What a base row's source cell says: the adopted component of the evidence
/// base, which the register's own preamble spells out in full.
const ADOPTED: &str = "adopted";

/// What an extension row's source cell says: the owned component, held
/// first-hand by the acceptee (´[KND-sig:kinds:acceptee]´).
const OWNED: &str = "owned";

/// The headline counts of the registry document, as the region they occupy.
///
/// Five rows derived from the tables alone, spliced into the span the
/// registry document's own generated table occupies: it is a generated
/// region inside an authored file, never a generated file
/// (´[KND-tab:kinds:headline-counts]´).
fn headline(a: &Adoption, counts: HeadlineCounts, span: ByteSpan) -> Register {
    let rows: Vec<Vec<String>> = [
        ("Names", counts.names),
        ("Rows", counts.rows),
        ("Kinds", counts.kinds),
        ("Declared hybrids", counts.declared_hybrids),
        ("Device classes", counts.device_classes),
    ]
    .into_iter()
    .map(|(measure, count)| vec![String::from(measure), count.to_string()])
    .collect();
    let host = a.registry_document();
    Register {
        path: host.clone(),
        bytes: markdown_table(&["Measure", "Count"], &rows).into_bytes(),
        scope: RegisterScope::Region { host, span },
    }
}

/// One Markdown table, its columns padded to their widest cell.
///
/// The padding is the corpus's own table style and it is deterministic:
/// column widths are a function of the cells, so two runs over one relation
/// produce one table (´[ARCH-req:linter:determinism]´).
fn markdown_table(headers: &[&str], rows: &[Vec<String>]) -> String {
    let mut widths: Vec<usize> = headers.iter().map(|one| one.chars().count()).collect();
    for row in rows {
        for (at, cell) in row.iter().enumerate() {
            if let Some(width) = widths.get_mut(at) {
                *width = (*width).max(cell.chars().count());
            }
        }
    }
    let mut out = String::new();
    out.push_str(&table_row(
        &headers
            .iter()
            .map(|one| (*one).to_owned())
            .collect::<Vec<String>>(),
        &widths,
    ));
    let rules: Vec<String> = widths.iter().map(|width| "-".repeat(*width)).collect();
    out.push_str(&table_row(&rules, &widths));
    for row in rows {
        out.push_str(&table_row(row, &widths));
    }
    out
}

/// One row of a padded table, closed by its newline.
fn table_row(cells: &[String], widths: &[usize]) -> String {
    let mut out = String::from("|");
    for (at, width) in widths.iter().enumerate() {
        let cell = cells.get(at).map_or("", String::as_str);
        let pad = width.saturating_sub(cell.chars().count());
        let _ = write!(out, " {cell}{} |", " ".repeat(pad));
    }
    out.push('\n');
    out
}

/// Every rule this module can report.
///
/// None: a generator produces bytes and never a finding, and what a
/// comparison of those bytes reports belongs to
/// [`crate::judge::freshness`] (´conv:lint:finding-or-error´).
pub const RULES: [crate::diag::RuleId; 0] = [];

#[cfg(test)]
mod tests {
    use super::*;

    /// A generated table pads every column to its widest cell.
    /// ´claim:tables:a-table-pads-to-its-widest-cell´
    #[test]
    fn a_table_pads_every_column_to_its_widest_cell() {
        let rows = vec![vec![String::from("Declared hybrids"), String::from("3")]];
        let table = markdown_table(&["Measure", "Count"], &rows);
        assert_eq!(
            table,
            "| Measure          | Count |\n| ---------------- | ----- |\n| Declared hybrids | 3     |\n"
        );
    }

    /// A short row pads rather than narrowing the table.
    /// ´claim:tables:a-short-row-pads´
    #[test]
    fn a_short_row_pads_rather_than_narrowing_the_table() {
        let rows = vec![vec![String::from("one")]];
        let table = markdown_table(&["a", "b"], &rows);
        assert_eq!(table, "| a   | b |\n| --- | - |\n| one |   |\n");
    }

    /// An owner scope admits that owner's own registers alone.
    /// ´claim:tables:an-owner-scope-admits-one-owner´
    #[test]
    fn an_owner_scope_admits_only_that_owners_label_registers() {
        let register = |scope: RegisterScope| Register {
            path: PathBuf::from("x.md"),
            bytes: Vec::new(),
            scope,
        };
        let mine = register(RegisterScope::LabelRegister {
            owner: OwnerId::new("pkg.api"),
            profile: ProfileId::new("rust-test"),
        });
        let theirs = register(RegisterScope::LabelRegister {
            owner: OwnerId::new("pkg.common"),
            profile: ProfileId::new("rust-test"),
        });
        let scope = Scope::Owner(OwnerId::new("pkg.api"));
        assert!(scope.admits(&mine));
        assert!(!scope.admits(&theirs));
        assert!(!scope.admits(&register(RegisterScope::Attestation)));
        assert!(Scope::WholeCorpus.admits(&register(RegisterScope::Attestation)));
    }
}
