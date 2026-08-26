//! The adoption data: the whole of `corpus-adoption.toml` as one immutable
//! value, loaded once, before anything else runs (´sig:lint:adoption-api´).
//!
//! Nothing about this corpus reaches the code by any other route: the
//! linter is generic and the configuration is the corpus's adoption. The
//! file is parsed by the `toml` crate through serde's derived
//! `Deserialize` (´dec:lint:toml-parsing´), and `toml::Spanned` is taken
//! wherever a defect wants to name the row it sits in.
//!
//! Thirteen sections: the seven data the calculus is parametric in, the
//! kind registry's own adoption data, the carrier, head recognition, the
//! banned-token sets, the enforcement partition, and the file's metadata.

use std::collections::BTreeMap;
use std::fmt;
use std::path::{Path, PathBuf};

use toml::Spanned;

use crate::diag::{ByteSpan, Enforcement, Location, Severity};
use crate::error::AdoptionError;
use crate::scan::Prefix;

/// An owner of the partition Ω, by the stable identifier the adoption data
/// uses for it everywhere.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
pub struct OwnerId(Box<str>);

/// A registered inventory profile's identifier.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
pub struct ProfileId(Box<str>);

/// A kind token: the first word of a label.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
pub struct Kind(Box<str>);

/// An area token: the second word of a label.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
pub struct Area(Box<str>);

/// A language, by the token the adoption data names it with.
///
/// A token and not a closed enum, because `[scanned-regions]` names
/// languages that have no frontend and never will have one here, and those
/// rows are adoption data like any other.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
pub struct Language(Box<str>);

macro_rules! token {
    ($name:ident, $what:literal) => {
        impl $name {
            #[doc = concat!("The ", $what, " named by `token`.")]
            #[must_use]
            pub fn new(token: &str) -> $name {
                $name(Box::from(token))
            }

            /// The token itself.
            #[must_use]
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(&self.0)
            }
        }
    };
}

token!(OwnerId, "owner");
token!(ProfileId, "profile");
token!(Kind, "kind");
token!(Area, "area");
token!(Language, "language");

/// A literal path prefix.
///
/// A prefix ending in `/` matches a tree; a prefix naming a file matches
/// that file; the empty prefix matches everything. There is no pattern
/// dialect (´sig:lint:adoption-api´), which is what keeps the no-regex
/// rule honest in configuration as well as on the analysis path.
///
/// ```
/// use cogra_linter::PathPrefix;
/// use std::path::Path;
///
/// let tree = PathPrefix::new("docs/");
/// assert!(tree.matches(Path::new("docs/README.md")));
/// assert!(!tree.matches(Path::new("docsfoo/README.md")));
///
/// let file = PathPrefix::new("Cargo.lock");
/// assert!(file.matches(Path::new("Cargo.lock")));
/// assert!(!file.matches(Path::new("crates/api/Cargo.lock")));
///
/// assert!(PathPrefix::new("").matches(Path::new("anything")));
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Deserialize)]
pub struct PathPrefix(Box<str>);

impl PathPrefix {
    /// The prefix spelled by `prefix`.
    #[must_use]
    pub fn new(prefix: &str) -> PathPrefix {
        PathPrefix(Box::from(prefix))
    }

    /// The prefix as written.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Whether `path`, taken relative to the corpus root, lies under this
    /// prefix.
    #[must_use]
    pub fn matches(&self, path: &Path) -> bool {
        self.matches_str(&relative_str(path))
    }

    fn matches_str(&self, path: &str) -> bool {
        if self.0.is_empty() {
            return true;
        }
        if self.0.ends_with('/') {
            return path.starts_with(&*self.0);
        }
        path == &*self.0
    }
}

impl fmt::Display for PathPrefix {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// A path as the adoption data spells paths: relative, `/`-separated.
///
/// The corpus is described in one spelling whatever filesystem carries it,
/// so a prefix written once matches on every platform.
#[must_use]
pub(crate) fn relative_str(path: &Path) -> String {
    let mut rendered = String::new();
    for component in path.components() {
        if let std::path::Component::Normal(part) = component {
            if !rendered.is_empty() {
                rendered.push('/');
            }
            rendered.push_str(&part.to_string_lossy());
        }
    }
    rendered
}

/// This corpus's adoption of the disciplines: the seven parametric data of
/// the calculus, the kind registry's adoption data, and the carrier.
#[derive(Clone, Debug)]
pub struct Adoption {
    /// When the file was drafted and ruled, and where its rationale lives.
    pub meta: Meta,
    /// What the corpus is: the exclusions Ω must be total against.
    pub carrier: Carrier,
    /// Σ: registered prefixes and the families that admit more.
    pub signature: Signature,
    /// Ω: the ordered path-prefix rules, first match wins.
    pub partition: Partition,
    /// Π: the registered family of inventory profiles.
    pub profiles: Profiles,
    /// K: the kinds intended for derivation only.
    pub reserved_kinds: ReservedKinds,
    /// The designated typed-data classes; empty in version 1.
    pub typed_data: TypedData,
    /// The citation-index designations; empty in version 1.
    pub citation_indexes: CitationIndexes,
    /// Which regions participate, per language.
    pub scanned_regions: ScannedRegions,
    /// The token classes that must not occur in carrier sources.
    pub banned_tokens: BannedTokens,
    /// The kind registry's adoption data.
    pub kinds: KindsAdoption,
    /// Which participating regions are heads, per format, and the
    /// case-exact matching rule (´dec:lint:head-recognition´).
    pub head_recognition: HeadRecognition,
    /// The failing set, as literal path prefixes
    /// (´dec:lint:enforcement-partition´).
    pub enforcement: EnforcementPartition,
    /// Every path the data configures, each with the row it sits in, so
    /// that a spelling check can be located (´sig:lint:adoption-api´).
    pub configured_paths: Vec<ConfiguredPath>,
}

/// One path the adoption data configures, with the row that writes it.
///
/// The rows are collected at load because that is the only moment the file's
/// own spans are in hand; what is *done* with them needs the corpus root and
/// therefore happens later (´conv:lint:owner-assignment´).
#[derive(Clone, Debug)]
pub struct ConfiguredPath {
    /// The prefix as the adoption data writes it.
    pub path: PathPrefix,
    /// The section that writes it, for a message that says where to look.
    pub section: &'static str,
    /// The row it sits in.
    pub at: Location,
}

impl Adoption {
    /// Load and validate.
    ///
    /// The one operation of the crate whose failure is an error and not a
    /// finding (´crit:lint:error-or-finding´).
    ///
    /// ```
    /// use cogra_linter::Adoption;
    /// use std::path::Path;
    ///
    /// # let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../corpus-adoption.toml");
    /// let adoption = Adoption::load(Path::new(path)).expect("ruled adoption data");
    ///
    /// assert_eq!(adoption.profiles.profiles.len(), 2);
    /// assert_eq!(adoption.profiles.effective_count, 1);
    /// assert_eq!(adoption.partition.rules.len(), 20);
    /// ```
    ///
    /// # Errors
    ///
    /// [`AdoptionError`] when the file cannot be read, is not well-formed
    /// TOML, or states an adoption that contradicts itself.
    pub fn load(path: &Path) -> Result<Adoption, AdoptionError> {
        let source = std::fs::read_to_string(path).map_err(|source| AdoptionError::Unreadable {
            path: path.to_path_buf(),
            source,
        })?;
        Adoption::from_str(&source, path)
    }

    /// Load and validate `source`, blaming `origin` for what it says.
    ///
    /// # Errors
    ///
    /// [`AdoptionError`] when `source` is not well-formed TOML or states an
    /// adoption that contradicts itself.
    pub fn from_str(source: &str, origin: &Path) -> Result<Adoption, AdoptionError> {
        let raw: RawAdoption = toml::from_str(source).map_err(AdoptionError::Syntax)?;
        raw.validate(source, origin)
    }

    /// The registry document the classification relation is read out of
    /// (´[ARCH-dec:linter:registry-as-data]´).
    ///
    /// Read from `[kinds] registry`, the key that names it. The path is
    /// adoption data and nothing else: a compiled-in one would be this
    /// corpus reaching the code by another route, and a positional read of
    /// `[meta] discipline_docs` would name the registry by where it sits in
    /// a list (´req:lint:adoption-data-only´).
    ///
    /// ```
    /// # let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../corpus-adoption.toml");
    /// # let adoption = cogra_linter::Adoption::load(std::path::Path::new(path))
    /// #     .expect("ruled adoption data");
    /// assert_eq!(
    ///     adoption.registry_document(),
    ///     std::path::PathBuf::from("crates/cogra-linter/docs/environment-kinds.md"),
    /// );
    /// ```
    #[must_use]
    pub fn registry_document(&self) -> PathBuf {
        PathBuf::from(&*self.kinds.registry)
    }

    /// Every configured path is spelled the way the corpus root spells it.
    ///
    /// Matching is byte-exact everywhere in this crate — a prefix carries no
    /// pattern dialect and no case rule (´sig:lint:adoption-api´) — so a
    /// path written `Docs/` against a tree written `docs/` matches nothing
    /// whatever. On a case-insensitive filesystem that is invisible: the
    /// author sees the tree exactly where the prefix says it is, and the
    /// linter silently owns, excludes, or enforces nothing there. This is
    /// the check that makes the byte-exactness say so out loud, and it is
    /// why byte-exact matching can stay byte-exact.
    ///
    /// **Absence is not a misspelling.** A configured root that is simply
    /// not in the tree — a build output, a gitignored junction — passes
    /// here; whether its absence matters is the walk's question, answered by
    /// `carrier-unmatched-root` against the row's own `optional`. Only a
    /// path that *exists under another spelling* is reported.
    ///
    /// Comparison folds ASCII case and nothing else. That is the hazard the
    /// case-insensitive filesystems actually pose, and a Unicode folding
    /// would be a larger claim about names than the adoption data makes.
    ///
    /// # Errors
    ///
    /// [`AdoptionError::PathSpelling`], located at the row that writes the
    /// path, naming both spellings.
    pub fn verify_spellings(&self, root: &Path) -> Result<(), AdoptionError> {
        let mut listings: BTreeMap<PathBuf, Vec<String>> = BTreeMap::new();
        for configured in &self.configured_paths {
            if let Some(found) = misspelling(root, configured.path.as_str(), &mut listings) {
                return Err(AdoptionError::PathSpelling {
                    at: configured.at.clone(),
                    configured: format!("{} {}", configured.section, configured.path),
                    found,
                });
            }
        }
        Ok(())
    }
}

/// The on-disk spelling of `configured`, when the tree carries it under one
/// that differs.
///
/// The walk stops at the first component the tree does not carry at all,
/// which is the absence case and no finding of this check.
fn misspelling(
    root: &Path,
    configured: &str,
    listings: &mut BTreeMap<PathBuf, Vec<String>>,
) -> Option<String> {
    let mut here = root.to_path_buf();
    let mut spelled = String::new();
    let mut differs = false;
    for component in configured.split('/').filter(|one| !one.is_empty()) {
        let entries = listings
            .entry(here.clone())
            .or_insert_with(|| entry_names(&here));
        let exact = entries.iter().any(|name| name == component);
        let name = if exact {
            String::from(component)
        } else {
            let folded = entries
                .iter()
                .find(|name| name.eq_ignore_ascii_case(component))?;
            differs = true;
            folded.clone()
        };
        if !spelled.is_empty() {
            spelled.push('/');
        }
        spelled.push_str(&name);
        here.push(&name);
    }
    if configured.ends_with('/') {
        spelled.push('/');
    }
    differs.then_some(spelled)
}

/// The entry names one directory carries, or none where it cannot be read.
///
/// An unreadable directory is no evidence about a spelling, so it yields an
/// empty listing and the walk treats the path as absent.
fn entry_names(at: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(at) else {
        return Vec::new();
    };
    entries
        .filter_map(|one| one.ok())
        .map(|one| one.file_name().to_string_lossy().into_owned())
        .collect()
}

/// When the adoption was drafted and ruled, and where its rationale lives.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct Meta {
    /// The date the file was drafted.
    pub drafted: Box<str>,
    /// The date every value in it became a recorded decision.
    pub ruled: Box<str>,
    /// One line saying where the file stands.
    pub status: Box<str>,
    /// The document carrying the reasoning behind each value.
    pub rationale: Box<str>,
    /// The corpus root, relative to the file.
    pub corpus_root: Box<str>,
    /// The discipline documents this corpus adopts.
    pub discipline_docs: Vec<Box<str>>,
}

/// What the corpus IS: the exclusions that fix Ω's domain.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct Carrier {
    /// Version-control internals, build outputs, dependency trees.
    pub exclude_trees: Vec<PathPrefix>,
    /// Committed generated files: in the carrier in full.
    pub generated_files: Vec<PathPrefix>,
    /// Third-party trees kept in-repo.
    pub vendored_trees: Vec<PathPrefix>,
    /// Single third-party sources kept in-repo.
    pub vendored_files: Vec<PathPrefix>,
}

impl Carrier {
    /// Whether `path` lies outside the carrier.
    #[must_use]
    pub fn excludes(&self, path: &Path) -> bool {
        let relative = relative_str(path);
        self.exclude_trees
            .iter()
            .chain(&self.vendored_trees)
            .chain(&self.vendored_files)
            .any(|prefix| prefix.matches_str(&relative))
    }

    /// Whether `path` is a committed generated file.
    #[must_use]
    pub fn is_generated(&self, path: &Path) -> bool {
        let relative = relative_str(path);
        self.generated_files
            .iter()
            .any(|prefix| prefix.matches_str(&relative))
    }
}

/// Σ: a partial map from registered prefixes to owners, closed under its
/// registered families.
#[derive(Clone, Debug)]
pub struct Signature {
    /// Hand-registered prefixes, prefix to owner.
    pub prefixes: BTreeMap<Prefix, OwnerId>,
    /// R-PKG′ and any later family: a closed derivation rule, not a list.
    pub families: Vec<PrefixFamily>,
}

impl Signature {
    /// Whether some prefix — hand-registered or derived by a family — names
    /// `owner`.
    #[must_use]
    pub fn registers(&self, owner: &OwnerId) -> bool {
        self.prefixes.values().any(|named| named == owner) || self.derived_prefix(owner).is_some()
    }

    /// The prefix a registered family derives for `owner`, if one does.
    ///
    /// The package family's rule R-PKG′ is executable and is executed here:
    /// uppercase the package's directory basename, delete every hyphen,
    /// then delete a leading `COGRA` when what remains is nonempty and
    /// unique among registered prefixes. Which owners are packages is read
    /// off the `pkg.` namespace the adoption data spells them in — the one
    /// place the family's "every unit the build system names as a package"
    /// becomes a decidable question about an owner identifier.
    ///
    /// The derived text passes through [`Prefix::parse`] like any other, so
    /// a family cannot admit a prefix the grammar refuses: a package whose
    /// name yields no well-formed PREFIX derives nothing, and its owner is
    /// then registered by a hand-written row or not at all.
    ///
    /// ```
    /// use cogra_linter::{Adoption, OwnerId, Prefix};
    /// # let source = std::fs::read_to_string(
    /// #     concat!(env!("CARGO_MANIFEST_DIR"), "/../../corpus-adoption.toml"),
    /// # ).expect("the corpus's own adoption data");
    /// # let adoption = Adoption::from_str(&source, std::path::Path::new("corpus-adoption.toml"))
    /// #     .expect("a ruled adoption");
    /// assert_eq!(
    ///     adoption.signature.derived_prefix(&OwnerId::new("pkg.cogra-interchange")),
    ///     Prefix::parse("INTERCHANGE"),
    /// );
    /// assert_eq!(
    ///     adoption.signature.derived_prefix(&OwnerId::new("doc.label-calculus")),
    ///     None,
    /// );
    /// ```
    #[must_use]
    pub fn derived_prefix(&self, owner: &OwnerId) -> Option<Prefix> {
        let package = self
            .families
            .iter()
            .find(|family| &*family.name == "package")?;
        if !package.registered {
            return None;
        }
        let basename = owner.as_str().strip_prefix("pkg.")?;
        if basename.is_empty() {
            return None;
        }
        let derived: String = basename
            .chars()
            .filter(|character| *character != '-')
            .flat_map(char::to_uppercase)
            .collect();
        let stripped = derived
            .strip_prefix("COGRA")
            .and_then(Prefix::parse)
            .filter(|shorter| !self.prefixes.contains_key(shorter));
        match stripped {
            Some(shorter) => Some(shorter),
            None => Prefix::parse(&derived),
        }
    }
}

/// One registered family of prefixes, admitting its members by a rule
/// rather than by a list.
#[derive(Clone, Debug)]
pub struct PrefixFamily {
    /// The family's key in the adoption data.
    pub name: Box<str>,
    /// Whether the family is registered in this corpus at all.
    pub registered: bool,
    /// The derivation rule, as the adoption data states it.
    pub rule: Option<Box<str>>,
    /// The rule's own identifier, for citation.
    pub rule_id: Option<Box<str>>,
    /// Which units the family covers.
    pub applies_to: Option<Box<str>>,
    /// Why an unregistered family is unregistered.
    pub reason: Option<Box<str>>,
}

/// Ω: the ordered path-prefix rules.
#[derive(Clone, Debug)]
pub struct Partition {
    /// Ordered, first match wins. The last rule's prefix is empty, which is
    /// what makes Ω total.
    pub rules: Vec<PartitionRule>,
}

impl Partition {
    /// The owner of `path`, by first match.
    ///
    /// Returns an owner and never an `Option`: the last rule carries the
    /// empty prefix, checked when the adoption data loads, so totality is a
    /// property of the data and there is no unowned-source state to
    /// represent (´conv:lint:owner-assignment´).
    ///
    /// ```
    /// use cogra_linter::{Adoption, OwnerId};
    /// use std::path::Path;
    ///
    /// # let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../corpus-adoption.toml");
    /// # let adoption = Adoption::load(Path::new(path)).expect("ruled adoption data");
    /// let omega = &adoption.partition;
    ///
    /// // The document rules precede the package rule that would take them.
    /// assert_eq!(
    ///     omega.owner_for(Path::new("crates/cogra-linter/docs/label-calculus.md")),
    ///     OwnerId::new("doc.label-calculus"),
    /// );
    /// assert_eq!(
    ///     omega.owner_for(Path::new("crates/cogra-linter/src/adopt.rs")),
    ///     OwnerId::new("pkg.cogra-linter"),
    /// );
    /// // The last rule's empty prefix is what makes Ω total.
    /// assert_eq!(
    ///     omega.owner_for(Path::new("a/tree/nobody/foresaw.txt")),
    ///     OwnerId::new("tree.repo-root"),
    /// );
    /// ```
    ///
    /// # Panics
    ///
    /// Never, on an [`Adoption`] that loaded: a validated partition has a
    /// last rule, and that rule's empty prefix matches everything.
    #[must_use]
    pub fn owner_for(&self, path: &Path) -> OwnerId {
        let relative = relative_str(path);
        for rule in &self.rules {
            if rule.path.matches_str(&relative) {
                return rule.owner.clone();
            }
        }
        self.rules
            .last()
            .map_or_else(|| OwnerId::new(""), |rule| rule.owner.clone())
    }

    /// The rule that owns `path`, for a diagnostic that wants to name it.
    #[must_use]
    pub fn rule_for(&self, path: &Path) -> Option<&PartitionRule> {
        let relative = relative_str(path);
        self.rules
            .iter()
            .find(|rule| rule.path.matches_str(&relative))
    }
}

/// One rule of Ω.
#[derive(Clone, Debug)]
pub struct PartitionRule {
    /// The rule's position; first match wins, in this order.
    ///
    /// Checked at load, and equal to the rule's 1-based position in
    /// [`Partition::rules`] on any [`Adoption`] that loaded: matching walks
    /// the stored array, so the array is the order and this field is the
    /// document's claim about it. The two agreeing is what lets a reader
    /// cite a rule by its order and a diagnostic name one
    /// (´conv:lint:owner-assignment´).
    pub order: u32,
    /// The literal prefix the rule matches.
    pub path: PathPrefix,
    /// The owner it assigns.
    pub owner: OwnerId,
    /// A configured root whose absence is legal and silent — never an
    /// unreadable root, which stays a diagnostic.
    pub optional: bool,
}

/// Π: the registered family of inventory profiles.
#[derive(Clone, Debug)]
pub struct Profiles {
    /// Every registered profile, effective and staged alike.
    pub profiles: Vec<Profile>,
    /// How many of them are in Π today.
    pub effective_count: usize,
}

impl Profiles {
    /// The profiles in force.
    pub fn effective(&self) -> impl Iterator<Item = &Profile> {
        self.profiles
            .iter()
            .filter(|profile| profile.status == ProfileStatus::Effective)
    }
}

/// One inventory profile: the five data a profile fixes, plus its identity
/// and its standing.
#[derive(Clone, Debug)]
pub struct Profile {
    /// The profile's identifier.
    pub id: ProfileId,
    /// The kind it governs.
    pub kind: Kind,
    /// Whether it is in Π, or registered and waiting.
    pub status: ProfileStatus,
    /// Which assets it covers.
    pub census: Census,
    /// The rule the area derives from.
    pub classification: Classification,
    /// From the asset's bare identifier to the name segment.
    pub name_transformation: NameTransformation,
    /// Where the label is carried.
    pub standard_place: Place,
}

/// Whether a profile is in force, or registered and waiting on its
/// migration (´dec:lint:staged-profiles´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProfileStatus {
    /// In Π: its census is computed and its inventory judged.
    Effective,
    /// Registered, computing nothing, its kind reserved-but-ungoverned.
    Staged {
        /// The condition whose satisfaction admits it to Π.
        enters_when: Box<str>,
    },
}

/// Which assets a profile covers.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct Census {
    /// The language the recognizer reads.
    pub language: Language,
    /// The recognizer, as the adoption data states it.
    pub recognizer: Box<str>,
    /// The attribute paths a harness recognizes, where the census is by
    /// attribute.
    #[serde(default)]
    pub attributes: Vec<Box<str>>,
    /// The open rule that keeps a fourth harness from needing a code
    /// change.
    #[serde(default)]
    pub attribute_rule: Option<Box<str>>,
    /// What counts as one definition, where the census is by definition.
    #[serde(default)]
    pub definition_rule: Option<Box<str>>,
    /// What the census leaves out.
    #[serde(default)]
    pub exclude: Vec<Box<str>>,
}

/// The rule the area derives from.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct Classification {
    /// The rule, as the adoption data states it.
    pub rule: Box<str>,
    /// The areas it can produce, by the rule's own case names.
    pub areas: BTreeMap<Box<str>, Area>,
}

/// From the asset's bare identifier to the name segment.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct NameTransformation {
    /// The transformation, as the adoption data states it.
    pub rule: Box<str>,
    /// One worked case.
    #[serde(default)]
    pub example: Option<Box<str>>,
}

/// Where a profile's labels are carried.
#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
pub struct Place {
    /// The place itself: a header, a documentation comment, the owner's
    /// prose, or a generated register of the owner.
    pub place: Box<str>,
    /// Which register, where the place is a generated register.
    #[serde(default)]
    pub register: Option<Box<str>>,
    /// The form the label takes there.
    #[serde(default)]
    pub form: Option<Box<str>>,
}

/// K: the kinds intended for derivation only.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct ReservedKinds {
    /// Where the set comes from.
    pub source: Box<str>,
    /// How many kinds it holds.
    pub count: usize,
    /// Reserved and governed by a registered profile.
    pub governed: Vec<Kind>,
    /// Reserved and governed by none: neither warrant rule admits them.
    pub reserved_ungoverned: Vec<Kind>,
}

impl ReservedKinds {
    /// Whether `kind` lies in K.
    #[must_use]
    pub fn contains(&self, kind: &Kind) -> bool {
        self.governed.contains(kind) || self.reserved_ungoverned.contains(kind)
    }

    /// Every kind of K, governed and ungoverned alike.
    pub fn kinds(&self) -> impl Iterator<Item = &Kind> {
        self.governed.iter().chain(&self.reserved_ungoverned)
    }
}

/// The designated classes of typed-data strings that cite synthetically.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct TypedData {
    /// The designated classes. Empty in version 1.
    pub classes: Vec<Box<str>>,
    /// Whether emptiness here is the recorded state.
    #[serde(default)]
    pub empty_in_v1: bool,
    /// What emptiness means, since it is staging and not a settled
    /// judgment.
    #[serde(default)]
    pub status: Option<Box<str>>,
    /// Why the set is empty.
    #[serde(default)]
    pub reason: Option<Box<str>>,
    /// What would reopen the section.
    #[serde(default)]
    pub revisit_when: Option<Box<str>>,
}

/// The documents designated as maintaining a committed citation index.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct CitationIndexes {
    /// The designations. Empty in version 1.
    pub designations: Vec<Box<str>>,
    /// Whether emptiness here is the recorded state.
    #[serde(default)]
    pub empty_in_v1: bool,
    /// Why nothing is designated.
    #[serde(default)]
    pub reason: Option<Box<str>>,
}

/// Which regions participate, per language.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct ScannedRegions {
    /// The languages with a frontend.
    #[serde(rename = "language", default)]
    pub languages: Vec<ScannedLanguage>,
    /// The languages present in the corpus with no frontend, listed so
    /// their absence is a decision rather than an oversight.
    #[serde(default)]
    pub none: Vec<UnscannedLanguages>,
}

impl ScannedRegions {
    /// The language a file extension names, where a frontend reads it.
    ///
    /// `None` covers both halves of the design's reason for the option: a
    /// language listed with no frontend, and everything else. Such files
    /// stay in the carrier and stay owned, carrying no occurrences.
    #[must_use]
    pub fn language_of(&self, path: &Path) -> Option<Language> {
        let name = path.file_name()?.to_string_lossy().into_owned();
        self.languages
            .iter()
            .find(|entry| {
                entry
                    .extensions
                    .iter()
                    .any(|extension| name.len() > extension.len() && name.ends_with(&**extension))
            })
            .map(|entry| entry.language.clone())
    }
}

/// One language with a frontend, and which of its regions participate.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct ScannedLanguage {
    /// The language.
    pub language: Language,
    /// The extensions that name it.
    pub extensions: Vec<Box<str>>,
    /// The parser that reads it.
    pub frontend: Box<str>,
    /// The slice its frontend lands in.
    pub slice: u32,
    /// The regions that participate.
    pub scanned: Vec<Box<str>>,
    /// The regions that do not.
    pub not_scanned: Vec<Box<str>>,
    /// What one region is.
    pub region_unit: Box<str>,
    /// What must hold before the frontend is wired.
    #[serde(default)]
    pub precondition: Option<Box<str>>,
}

/// The languages present with no frontend, hence with no scanned regions.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct UnscannedLanguages {
    /// The languages.
    pub languages: Vec<Language>,
    /// The extensions that name them.
    pub extensions: Vec<Box<str>>,
    /// Why no frontend reads them.
    pub reason: Box<str>,
}

/// The token classes that must not occur in carrier sources.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct BannedTokens {
    /// The ruled classes.
    #[serde(rename = "rule", default)]
    pub rules: Vec<BannedToken>,
}

/// One banned token class, as `[banned-tokens]` states it.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct BannedToken {
    /// The rule's identifier.
    pub id: Box<str>,
    /// The language it governs.
    pub language: Language,
    /// The lexeme class this rule forbids, named in the pre-tokenizer's own
    /// vocabulary ([`crate::pretokenize::CommentForm::token`],
    /// [`crate::pretokenize::LiteralForm::token`]).
    ///
    /// The machine-readable half of the row: [`crate::bans::BanRule::read`]
    /// resolves it against the classes the lexer decides, and a name no
    /// lexer decides leaves the row unreadable rather than silently
    /// harmless (´sig:lint:bans-api´).
    pub class: Box<str>,
    /// The same class in the words of the adoption data, illustration
    /// included. Read by no code; it is what a diagnostic quotes back.
    pub token: Box<str>,
    /// How grave an occurrence is.
    pub severity: Severity,
    /// Whether the rule is ruled or proposed.
    pub status: Box<str>,
    /// Which decision put it here.
    pub source: Box<str>,
}

/// The kind registry's adoption data.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct KindsAdoption {
    /// The named acceptee, who owns the five data below.
    pub acceptee: Box<str>,
    /// The registry document the classification relation is read out of
    /// (´[ARCH-dec:linter:registry-as-data]´), as the corpus spells the
    /// path.
    pub registry: Box<str>,
    /// X_A: the local extension set.
    pub extensions: KindExtensions,
    /// E_A: the evidence base.
    pub evidence: KindEvidence,
    /// σ_A: the status map.
    pub statuses: KindStatuses,
    /// G_A: the register generator.
    pub generator: KindGenerator,
    /// The companion attestation register.
    pub register: KindRegister,
}

/// X_A: the acceptee's local extensions to the classification relation.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct KindExtensions {
    /// Extension rows. Empty in version 1.
    pub rows: Vec<Box<str>>,
    /// Local hybrids. Empty in version 1.
    pub hybrids: Vec<Box<str>>,
    /// Whether emptiness here is the recorded state.
    #[serde(default)]
    pub empty_in_v1: bool,
    /// Why the set is empty.
    #[serde(default)]
    pub reason: Option<Box<str>>,
    /// What would reopen the section.
    #[serde(default)]
    pub revisit_when: Option<Box<str>>,
}

/// E_A: the evidence base, adopted by reference and owned first-hand.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct KindEvidence {
    /// The component taken by reference.
    pub adopted: Box<str>,
    /// The component held first-hand.
    pub owned: Vec<Box<str>>,
}

/// σ_A: the status map, which strengthens edition statuses and never
/// weakens one.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct KindStatuses {
    /// The rows the acceptee strengthens.
    pub strengthenings: Vec<Box<str>>,
    /// The edition's borderline rows.
    pub daggered: Vec<Box<str>>,
    /// The rows outside the relation, awaiting evidence.
    pub candidates: Vec<Box<str>>,
}

/// G_A: the generator of every generated register the disciplines call
/// for.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct KindGenerator {
    /// The generator itself.
    pub generator: Box<str>,
    /// What it produces.
    pub covers: Vec<Box<str>>,
}

/// The companion attestation register.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct KindRegister {
    /// Where it lives; the name and location are implementation-defined.
    pub standard_place: Box<str>,
    /// The total recorded ordering of its rows.
    pub ordering: Box<str>,
    /// What it presents.
    pub presents: Vec<Box<str>>,
    /// Whether it has ever been generated.
    pub state: Box<str>,
}

/// Which participating regions are heads (´dec:lint:head-recognition´).
#[derive(Clone, Debug, serde::Deserialize)]
pub struct HeadRecognition {
    /// The separator that closes every head before its mint.
    pub separator: Box<str>,
    /// How a head is matched against the catalogue.
    #[serde(rename = "match")]
    pub matching: HeadMatching,
    /// The head forms this corpus writes.
    #[serde(rename = "form", default)]
    pub forms: Vec<HeadForm>,
    /// The formats with no head form at all.
    #[serde(default)]
    pub none: Vec<HeadlessLanguages>,
}

/// How a head is matched against the catalogue.
#[derive(Copy, Clone, Debug, PartialEq, Eq, serde::Deserialize)]
pub enum HeadMatching {
    /// Case-exact, ruled: a head whose only defect is capitalization is a
    /// validation failure naming the catalogue spelling, never a silent
    /// pass.
    #[serde(rename = "case-exact")]
    CaseExact,
}

/// One head form of one format.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct HeadForm {
    /// The form's identifier.
    pub id: Box<str>,
    /// The format that carries it.
    pub language: Language,
    /// The shape, as the adoption data states it.
    pub shape: Box<str>,
    /// Which part of the shape is the head.
    pub head: Box<str>,
}

/// The formats that head no environment.
#[derive(Clone, Debug, serde::Deserialize)]
pub struct HeadlessLanguages {
    /// The languages.
    pub languages: Vec<Language>,
    /// Why they head nothing.
    pub reason: Box<str>,
}

/// The failing set and the advisory remainder
/// (´dec:lint:enforcement-partition´).
#[derive(Clone, Debug, serde::Deserialize)]
pub struct EnforcementPartition {
    /// What a finding outside every failing prefix is.
    pub default: Enforcement,
    /// The trees the lane fails on.
    pub failing: Vec<PathPrefix>,
}

impl EnforcementPartition {
    /// Whether a finding at `path` fails the lane.
    ///
    /// Enforcement is orthogonal to severity: an error is an error wherever
    /// it is found, and only the exit code differs.
    ///
    /// ```
    /// use cogra_linter::{Adoption, Enforcement};
    /// use std::path::Path;
    ///
    /// # let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../corpus-adoption.toml");
    /// # let adoption = Adoption::load(Path::new(path)).expect("ruled adoption data");
    /// let partition = &adoption.enforcement;
    ///
    /// assert_eq!(
    ///     partition.enforcement_for(Path::new("crates/cogra-linter/docs/design.md")),
    ///     Enforcement::Failing,
    /// );
    /// assert_eq!(
    ///     partition.enforcement_for(Path::new("docs/primitive/layers.md")),
    ///     Enforcement::Advisory,
    /// );
    /// ```
    #[must_use]
    pub fn enforcement_for(&self, path: &Path) -> Enforcement {
        let relative = relative_str(path);
        if self
            .failing
            .iter()
            .any(|prefix| prefix.matches_str(&relative))
        {
            Enforcement::Failing
        } else {
            self.default
        }
    }
}

#[derive(serde::Deserialize)]
struct RawAdoption {
    meta: Meta,
    carrier: RawCarrier,
    signature: RawSignature,
    partition: RawPartition,
    profiles: RawProfiles,
    #[serde(rename = "reserved-kinds")]
    reserved_kinds: ReservedKinds,
    #[serde(rename = "typed-data")]
    typed_data: TypedData,
    #[serde(rename = "citation-indexes")]
    citation_indexes: CitationIndexes,
    #[serde(rename = "scanned-regions")]
    scanned_regions: ScannedRegions,
    #[serde(rename = "banned-tokens")]
    banned_tokens: BannedTokens,
    kinds: RawKinds,
    #[serde(rename = "head-recognition")]
    head_recognition: HeadRecognition,
    enforcement: RawEnforcement,
}

/// `[carrier]`, with each prefix's row kept for the spelling check.
#[derive(serde::Deserialize)]
struct RawCarrier {
    exclude_trees: Vec<Spanned<PathPrefix>>,
    generated_files: Vec<Spanned<PathPrefix>>,
    vendored_trees: Vec<Spanned<PathPrefix>>,
    vendored_files: Vec<Spanned<PathPrefix>>,
}

/// `[enforcement]`, likewise.
#[derive(serde::Deserialize)]
struct RawEnforcement {
    default: Enforcement,
    failing: Vec<Spanned<PathPrefix>>,
}

/// `[kinds]`, whose `registry` key names a path like any other.
#[derive(serde::Deserialize)]
struct RawKinds {
    acceptee: Box<str>,
    registry: Spanned<Box<str>>,
    extensions: KindExtensions,
    evidence: KindEvidence,
    statuses: KindStatuses,
    generator: KindGenerator,
    register: KindRegister,
}

#[derive(serde::Deserialize)]
struct RawSignature {
    #[serde(default)]
    families: BTreeMap<Box<str>, RawFamily>,
    #[serde(rename = "prefix", default)]
    prefixes: Vec<RawPrefixRow>,
}

#[derive(serde::Deserialize)]
struct RawFamily {
    #[serde(default = "registered_by_default")]
    registered: bool,
    rule: Option<Box<str>>,
    rule_id: Option<Box<str>>,
    applies_to: Option<Box<str>>,
    reason: Option<Box<str>>,
}

fn registered_by_default() -> bool {
    true
}

/// A registration as the file writes it: the prefix arrives as text and
/// becomes a [`Prefix`] only by the grammar's own parse, so the adoption
/// data cannot register a prefix no citation could ever name.
#[derive(serde::Deserialize)]
struct RawPrefixRow {
    prefix: Spanned<Box<str>>,
    owner: OwnerId,
}

#[derive(serde::Deserialize)]
struct RawPartition {
    #[serde(rename = "rule", default)]
    rules: Vec<RawPartitionRule>,
}

#[derive(serde::Deserialize)]
struct RawPartitionRule {
    order: Spanned<u32>,
    path: Spanned<PathPrefix>,
    owner: Spanned<OwnerId>,
    #[serde(default)]
    optional: bool,
}

#[derive(serde::Deserialize)]
struct RawProfiles {
    effective: Spanned<usize>,
    #[serde(rename = "profile", default)]
    profiles: Vec<RawProfile>,
}

#[derive(serde::Deserialize)]
struct RawProfile {
    id: Spanned<ProfileId>,
    kind: Option<Spanned<Kind>>,
    status: Spanned<Box<str>>,
    enters_when: Option<Box<str>>,
    census: Option<Census>,
    classification: Option<Classification>,
    name_transformation: Option<NameTransformation>,
    standard_place: Option<Place>,
}

/// The row a `toml::Spanned` sits in, as a location the reader can open.
fn row<T>(spanned: &Spanned<T>, source: &str, origin: &Path) -> Location {
    let span = spanned.span();
    Location::in_source(
        origin.to_path_buf(),
        ByteSpan::new(span.start, span.end),
        source,
    )
}

impl RawAdoption {
    fn validate(self, source: &str, origin: &Path) -> Result<Adoption, AdoptionError> {
        let signature = self.signature.validate(source, origin)?;
        let mut configured = Vec::new();
        for rule in &self.partition.rules {
            keep(&mut configured, "[partition]", &rule.path, source, origin);
        }
        let partition = self.partition.validate(source, origin, &signature)?;
        let profiles = self
            .profiles
            .validate(source, origin, &self.reserved_kinds)?;
        for (section, prefixes) in [
            ("[carrier] exclude_trees", &self.carrier.exclude_trees),
            ("[carrier] generated_files", &self.carrier.generated_files),
            ("[carrier] vendored_trees", &self.carrier.vendored_trees),
            ("[carrier] vendored_files", &self.carrier.vendored_files),
            ("[enforcement] failing", &self.enforcement.failing),
        ] {
            for prefix in prefixes {
                keep(&mut configured, section, prefix, source, origin);
            }
        }
        configured.push(ConfiguredPath {
            path: PathPrefix::new(self.kinds.registry.as_ref()),
            section: "[kinds] registry",
            at: row(&self.kinds.registry, source, origin),
        });
        Ok(Adoption {
            meta: self.meta,
            carrier: Carrier {
                exclude_trees: inner(self.carrier.exclude_trees),
                generated_files: inner(self.carrier.generated_files),
                vendored_trees: inner(self.carrier.vendored_trees),
                vendored_files: inner(self.carrier.vendored_files),
            },
            signature,
            partition,
            profiles,
            reserved_kinds: self.reserved_kinds,
            typed_data: self.typed_data,
            citation_indexes: self.citation_indexes,
            scanned_regions: self.scanned_regions,
            banned_tokens: self.banned_tokens,
            kinds: KindsAdoption {
                acceptee: self.kinds.acceptee,
                registry: self.kinds.registry.into_inner(),
                extensions: self.kinds.extensions,
                evidence: self.kinds.evidence,
                statuses: self.kinds.statuses,
                generator: self.kinds.generator,
                register: self.kinds.register,
            },
            head_recognition: self.head_recognition,
            enforcement: EnforcementPartition {
                default: self.enforcement.default,
                failing: inner(self.enforcement.failing),
            },
            configured_paths: configured,
        })
    }
}

/// Record one configured prefix and the row it sits in. The empty prefix
/// configures no path — it is what makes Ω total — so it is not one.
fn keep(
    into: &mut Vec<ConfiguredPath>,
    section: &'static str,
    prefix: &Spanned<PathPrefix>,
    source: &str,
    origin: &Path,
) {
    if prefix.as_ref().as_str().is_empty() {
        return;
    }
    into.push(ConfiguredPath {
        path: prefix.as_ref().clone(),
        section,
        at: row(prefix, source, origin),
    });
}

fn inner(spanned: Vec<Spanned<PathPrefix>>) -> Vec<PathPrefix> {
    spanned.into_iter().map(Spanned::into_inner).collect()
}

impl RawSignature {
    fn validate(self, source: &str, origin: &Path) -> Result<Signature, AdoptionError> {
        let mut prefixes = BTreeMap::new();
        for row_data in &self.prefixes {
            let written = row_data.prefix.as_ref();
            let Some(prefix) = Prefix::parse(written) else {
                return Err(AdoptionError::MalformedPrefix {
                    at: row(&row_data.prefix, source, origin),
                    prefix: written.to_string(),
                });
            };
            if prefixes
                .insert(prefix.clone(), row_data.owner.clone())
                .is_some()
            {
                return Err(AdoptionError::DuplicatePrefix {
                    at: row(&row_data.prefix, source, origin),
                    prefix: prefix.to_string(),
                });
            }
        }
        let families = self
            .families
            .into_iter()
            .map(|(name, family)| PrefixFamily {
                name,
                registered: family.registered,
                rule: family.rule,
                rule_id: family.rule_id,
                applies_to: family.applies_to,
                reason: family.reason,
            })
            .collect();
        Ok(Signature { prefixes, families })
    }
}

impl RawPartition {
    fn validate(
        self,
        source: &str,
        origin: &Path,
        signature: &Signature,
    ) -> Result<Partition, AdoptionError> {
        for (index, rule) in self.rules.iter().enumerate() {
            let owner = rule.owner.as_ref();
            if !signature.registers(owner) {
                return Err(AdoptionError::UnknownOwner {
                    at: row(&rule.owner, source, origin),
                    order: *rule.order.as_ref(),
                    owner: owner.to_string(),
                });
            }
            let position = u32::try_from(index + 1).unwrap_or(u32::MAX);
            let stated = *rule.order.as_ref();
            if stated != position {
                return Err(AdoptionError::RuleOrderMismatch {
                    at: row(&rule.order, source, origin),
                    order: stated,
                    position,
                });
            }
        }
        match self.rules.last() {
            Some(last) if last.path.as_ref().as_str().is_empty() => {}
            Some(last) => {
                return Err(AdoptionError::PartitionNotTotal {
                    at: row(&last.path, source, origin),
                });
            }
            None => {
                return Err(AdoptionError::PartitionNotTotal {
                    at: Location::in_source(origin.to_path_buf(), ByteSpan::new(0, 0), source),
                });
            }
        }
        let rules = self
            .rules
            .into_iter()
            .map(|rule| PartitionRule {
                order: rule.order.into_inner(),
                path: rule.path.into_inner(),
                owner: rule.owner.into_inner(),
                optional: rule.optional,
            })
            .collect();
        Ok(Partition { rules })
    }
}

impl RawProfiles {
    fn validate(
        self,
        source: &str,
        origin: &Path,
        reserved: &ReservedKinds,
    ) -> Result<Profiles, AdoptionError> {
        let mut profiles = Vec::with_capacity(self.profiles.len());
        for raw in self.profiles {
            profiles.push(raw.validate(source, origin, reserved)?);
        }
        let found = profiles
            .iter()
            .filter(|profile| profile.status == ProfileStatus::Effective)
            .count();
        let stated = *self.effective.as_ref();
        if stated != found {
            return Err(AdoptionError::EffectiveCountMismatch {
                at: row(&self.effective, source, origin),
                stated,
                found,
            });
        }
        Ok(Profiles {
            profiles,
            effective_count: found,
        })
    }
}

impl RawProfile {
    fn validate(
        self,
        source: &str,
        origin: &Path,
        reserved: &ReservedKinds,
    ) -> Result<Profile, AdoptionError> {
        let id = self.id.as_ref().clone();
        let id_text = id.to_string();
        let opens_at = row(&self.id, source, origin);
        let incomplete = |datum: &'static str| AdoptionError::ProfileIncomplete {
            at: opens_at.clone(),
            id: id_text.clone(),
            datum,
        };
        let status = match &*self.status.as_ref().clone() {
            "effective" => ProfileStatus::Effective,
            "staged" => ProfileStatus::Staged {
                enters_when: self
                    .enters_when
                    .clone()
                    .ok_or_else(|| incomplete("entry condition"))?,
            },
            _ => return Err(incomplete("status")),
        };
        let kind_spanned = self.kind.as_ref().ok_or_else(|| incomplete("kind"))?;
        let kind = kind_spanned.as_ref().clone();
        if !reserved.contains(&kind) {
            return Err(AdoptionError::UngovernedKindNotReserved {
                at: row(kind_spanned, source, origin),
                id: id.to_string(),
                kind: kind.to_string(),
            });
        }
        Ok(Profile {
            id,
            kind,
            status,
            census: self.census.ok_or_else(|| incomplete("census"))?,
            classification: self
                .classification
                .ok_or_else(|| incomplete("classification"))?,
            name_transformation: self
                .name_transformation
                .ok_or_else(|| incomplete("name transformation"))?,
            standard_place: self
                .standard_place
                .ok_or_else(|| incomplete("standard place"))?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tree_prefix_matches_its_tree_and_nothing_beside_it() {
        let prefix = PathPrefix::new("crates/api/");
        assert!(prefix.matches(Path::new("crates/api/src/lib.rs")));
        assert!(prefix.matches(Path::new("crates/api/Cargo.toml")));
        assert!(!prefix.matches(Path::new("crates/api-extra/Cargo.toml")));
        assert!(!prefix.matches(Path::new("crates/common/src/lib.rs")));
    }

    #[test]
    fn a_file_prefix_matches_that_file_alone() {
        let prefix = PathPrefix::new("docs/primitive/layer1-interface.md");
        assert!(prefix.matches(Path::new("docs/primitive/layer1-interface.md")));
        assert!(!prefix.matches(Path::new("docs/primitive/layer1-interface.md.bak")));
        assert!(!prefix.matches(Path::new("docs/primitive/")));
    }

    #[test]
    fn the_empty_prefix_matches_everything() {
        let prefix = PathPrefix::new("");
        assert!(prefix.matches(Path::new("README.md")));
        assert!(prefix.matches(Path::new("a/b/c/d.rs")));
    }

    #[test]
    fn a_prefix_carries_no_pattern_dialect() {
        let prefix = PathPrefix::new("docs/*.md");
        assert!(!prefix.matches(Path::new("docs/README.md")));
        assert!(prefix.matches(Path::new("docs/*.md")));
    }

    #[test]
    fn a_path_is_spelled_one_way_on_every_platform() {
        assert_eq!(relative_str(Path::new("crates/api/src")), "crates/api/src");
        assert_eq!(relative_str(Path::new("./crates/api")), "crates/api");
        assert_eq!(
            relative_str(&Path::new("crates").join("api").join("src")),
            "crates/api/src"
        );
    }
}
