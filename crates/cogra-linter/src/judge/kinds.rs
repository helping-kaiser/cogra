//! Registry-as-data: the classification relation, presentation reduction,
//! and head validation.
//!
//! The effective relation C_A is read out of the registry document's own
//! Convention tables rather than transcribed into code or into the adoption
//! data (´[ARCH-dec:linter:registry-as-data]´), and so is the vocabulary
//! presentation reduction removes (´dec:lint:reduction-vocabulary´): the
//! registry defines the environments and the devices alike, and a corpus
//! that copied either would hold a second copy to drift.
//!
//! # What a table row is
//!
//! A table whose header row is `Environment | Kind` is a catalogue table; a
//! table whose header row is `Modifier | Kind` carries the emphasis and
//! status modifiers. Every other table of the document — the generated
//! headline counts above all — contributes nothing, which is what
//! (´[KND-sig:kinds:registry-data]´) demands of a generated presentation. A
//! row whose kind cell is an em dash is a device row and carries no pair; a
//! row whose name joins two names with an en dash is a declared hybrid
//! triple, and (´[KND-inf:kinds:hybrid]´) derives its row.
//!
//! # The division of labor in the vocabulary
//!
//! The device *families* are spelling rules, and a spelling rule is code:
//! no table row can say "strip a trailing star". What the rows carry is
//! which families the registry admits, so [`KindRegistry::reduce`] runs
//! exactly the routines the registry declares and an undeclared family is
//! not stripped. The *modifiers* are single names and are wholly data: the
//! twelve the registry carries reach `reduce` as strings it never spells
//! out.

use std::collections::{BTreeMap, BTreeSet, VecDeque};

use petgraph::stable_graph::NodeIndex;

use crate::adopt::{Adoption, Kind, KindExtensions};
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::frontend::{Parsed, Table};
use crate::graph::{Corpus, EdgeW, NodeKind, NodeW, nodes_of, out_along};
use crate::judge::at;

/// The document carries no catalogue table at all.
pub const NO_TABLES: RuleId = RuleId::new("registry-no-catalogue-table");

/// A table row that is not a name-and-kind pair.
pub const MALFORMED_ROW: RuleId = RuleId::new("registry-malformed-row");

/// A kind cell that is not a kind token.
pub const NOT_A_KIND: RuleId = RuleId::new("registry-kind-not-a-word");

/// A declared hybrid whose part is not a classified non-hybrid name.
pub const HYBRID_PART: RuleId = RuleId::new("registry-hybrid-part-uncatalogued");

/// A composed hybrid token that is otherwise assigned.
pub const HYBRID_COLLIDES: RuleId = RuleId::new("registry-hybrid-token-collides");

/// A declared hybrid whose row disagrees with the composition.
pub const HYBRID_MISMATCH: RuleId = RuleId::new("registry-hybrid-token-mismatch");

/// Every rule this module can report, for the diagnostic inventory.
pub const RULES: [RuleId; 8] = [
    HEAD_AMBIGUOUS,
    HEAD_UNCATALOGUED,
    HYBRID_COLLIDES,
    HYBRID_MISMATCH,
    HYBRID_PART,
    MALFORMED_ROW,
    NOT_A_KIND,
    NO_TABLES,
];

/// The header a catalogue table's name column carries.
const ENVIRONMENT: &str = "Environment";

/// The header a modifier table's name column carries.
const MODIFIER: &str = "Modifier";

/// The header both tables' kind column carries.
const KIND: &str = "Kind";

/// The em dash a device row carries where a kind would stand.
const NO_KIND: &str = "\u{2014}";

/// The status mark a borderline row carries, which is never a character of
/// the name (´[KND-judg:kinds:attestation]´).
const DAGGER: char = '\u{2020}';

/// The en dash that joins a hybrid's parts (´[KND-inf:kinds:hybrid]´).
const JOIN: char = '\u{2013}';

/// How many candidate spellings one reduction may visit.
///
/// Reduction is a search over spelling rules, and a search over arbitrary
/// text needs a bound to be total. The bound is far above what any real
/// head reaches — the corpus's deepest head carries one device — and it is
/// what lets the fuzz target of (´preview:lint:fuzz-plan´) assert
/// termination on arbitrary input.
const BUDGET: usize = 64;

/// How many devices one head may carry.
const DEPTH: usize = 4;

/// One family of presentation spellings the registry admits.
///
/// A family is a rule, not a name: what the registry's device rows carry is
/// which of these it admits, and an undeclared family strips nothing
/// (´dec:lint:reduction-vocabulary´).
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[non_exhaustive]
pub enum DeviceFamily {
    /// A name attached to an environment: `Theorem (Riemann–Roch)`.
    AttachedName,
    /// A container holding an environment: a Box, a Panel, a Callout. It
    /// holds an environment and is not one, so it changes no head's
    /// spelling.
    Containment,
    /// A continued environment: `Theorem, continued`.
    Continuation,
    /// A lettered main theorem: `Theorem A`.
    Lettering,
    /// A numbered environment: `Theorem 1.1`.
    Numbering,
    /// The expressly catalogued rows that override reduction. It strips
    /// nothing: an overriding row is an exact catalogue name, and
    /// [`HeadVerdict::Exact`] is tried before any reduction, so the
    /// behavior falls out of the ordering rather than out of a list.
    Overriding,
    /// A placed remark: a Footnote, an Endnote, a Marginal note. Placement
    /// is where a remark sits, not how its head is spelled, so it strips
    /// nothing.
    Placement,
    /// A restated environment: `Theorem 1.1, restated`.
    Restatement,
    /// A starred or unnumbered variant: `theorem*`.
    Starred,
    /// Iterated `sub-` prefixes: a subsection is a section, nested.
    SubPrefix,
}

/// The device rows of the registry, by the word their row opens with.
const FAMILIES: [(&str, DeviceFamily); 10] = [
    ("Containers", DeviceFamily::Containment),
    ("Continued", DeviceFamily::Continuation),
    ("Iterated", DeviceFamily::SubPrefix),
    ("Lettered", DeviceFamily::Lettering),
    ("Named", DeviceFamily::AttachedName),
    ("Numbered", DeviceFamily::Numbering),
    ("Overriding", DeviceFamily::Overriding),
    ("Placed", DeviceFamily::Placement),
    ("Restated", DeviceFamily::Restatement),
    ("Starred/unnumbered", DeviceFamily::Starred),
];

/// One device removed on the way to a base.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Device {
    /// A family of spellings the registry admits.
    Family(DeviceFamily),
    /// One emphasis or status modifier, by its own name.
    Modifier(Box<str>),
}

/// One route from a head to an exact catalogue name.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reduction {
    /// The exact catalogue name reached.
    pub base: Box<str>,
    /// The devices removed, in the order the routines ran.
    pub devices: Vec<Device>,
}

/// `base_A(h)`: what a head reduces to
/// (´[KND-def:kinds:presentation-reduction]´).
///
/// Usually one route, often none. Several routes reaching one name are one
/// base; several routes reaching different names carrying the declared kind
/// are what [`HeadVerdict::Ambiguous`] reports.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Reduced {
    /// The routes found, in the order the search met them.
    pub routes: Vec<Reduction>,
}

impl Reduced {
    /// The names reached, one per route and in the order the search met
    /// them.
    pub fn bases(&self) -> impl Iterator<Item = &str> {
        self.routes.iter().map(|route| &*route.base)
    }
}

/// The verdict of `C_A ⊢ h ✓ k` (´[KND-judg:kinds:head-validation]´).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HeadVerdict {
    /// An exact catalogue name carrying the declared kind.
    Exact,
    /// Reduced through exactly one base pair.
    Reduced {
        /// The name the head reduced to.
        base: Box<str>,
    },
    /// The head reduces to a name the relation does not carry with this
    /// kind. A head whose only defect is capitalization lands here, because
    /// matching is case-exact and folding case would widen N by a rule no
    /// row authorizes (´dec:lint:head-recognition´).
    Uncatalogued {
        /// The name the head reduced to, or the head itself where it
        /// reduced to nothing or to several names.
        base: Box<str>,
    },
    /// More than one base pair applies: the reduction is ambiguous.
    Ambiguous {
        /// The names reached, sorted.
        bases: Vec<Box<str>>,
    },
}

/// The five counts of (´[KND-tab:kinds:headline-counts]´), derived from the
/// tables alone.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq)]
pub struct HeadlineCounts {
    /// Distinct exact catalogue names, the dagger normalized away.
    pub names: usize,
    /// Rows of C_A, the derived hybrid rows included and the device rows
    /// excluded.
    pub rows: usize,
    /// Distinct kind tokens.
    pub kinds: usize,
    /// Declared hybrid triples.
    pub declared_hybrids: usize,
    /// Device classes: the kind-less rows of the device-family table. The
    /// modifiers are single names rather than families of spellings
    /// (´[KND-conv:kinds:hybrids]´) and are counted by no headline row.
    pub device_classes: usize,
}

/// The effective classification relation C_A = C ∪ X_A
/// (´[KND-sig:kinds:registry-data]´).
#[derive(Clone, Debug, Default)]
pub struct KindRegistry {
    pairs: BTreeMap<Box<str>, BTreeSet<Kind>>,
    families: BTreeSet<DeviceFamily>,
    modifiers: BTreeSet<Box<str>>,
    unrecognized: Vec<Box<str>>,
    unapplied: Vec<Box<str>>,
    declared_hybrids: usize,
    device_classes: usize,
}

impl KindRegistry {
    /// Read C from the registry document's own Convention tables, derive
    /// the hybrid rows from the declared triples, and check their side
    /// conditions (´[KND-inf:kinds:hybrid]´).
    ///
    /// # Errors
    ///
    /// The located findings on the registry document itself. A defect here
    /// degrades kind validation corpus-wide, so it is reported and never
    /// swallowed: treating an unvalidatable head as valid would make a
    /// broken registry look like a clean corpus, which is the failure mode
    /// the bootstrap must not have (´dec:lint:registry-bootstrap´).
    pub fn from_markdown(
        doc: &Parsed,
        src: &str,
        a: &Adoption,
    ) -> Result<KindRegistry, Vec<Diagnostic>> {
        Reader::new(doc, src, a).read()
    }

    /// Add the acceptee's recorded extensions. Empty in version 1.
    ///
    /// `[kinds.extensions]` records its rows as free text and records them
    /// empty, so no spelling for one is fixed by any ratified document. A
    /// recorded row is therefore carried unapplied rather than guessed at,
    /// and [`KindRegistry::unapplied_extensions`] is where it shows.
    #[must_use]
    pub fn with_extensions(mut self, x: &KindExtensions) -> KindRegistry {
        self.unapplied.extend(x.rows.iter().cloned());
        self.unapplied.extend(x.hybrids.iter().cloned());
        self
    }

    /// The extension rows carried but not applied.
    #[must_use]
    pub fn unapplied_extensions(&self) -> &[Box<str>] {
        &self.unapplied
    }

    /// The device families the registry admits but this crate has no
    /// routine for, as their rows spell them.
    #[must_use]
    pub fn unrecognized_families(&self) -> &[Box<str>] {
        &self.unrecognized
    }

    /// The kinds an exact catalogue name carries; several, for a homonym.
    pub fn classify<'a>(&'a self, name: &str) -> impl Iterator<Item = &'a Kind> + 'a {
        self.pairs.get(name).into_iter().flatten()
    }

    /// `base_A(h)`: the exact catalogue name after device removal
    /// (´[KND-def:kinds:presentation-reduction]´).
    ///
    /// A head that is itself a catalogue name reduces to itself by removing
    /// nothing, and is expanded no further: reduction stops at a name.
    #[must_use]
    pub fn reduce(&self, head: &str) -> Reduced {
        let mut routes = Vec::new();
        if self.pairs.contains_key(head) {
            routes.push(Reduction {
                base: head.into(),
                devices: Vec::new(),
            });
            return Reduced { routes };
        }
        let mut seen: BTreeSet<String> = BTreeSet::new();
        seen.insert(head.to_owned());
        let mut queue: VecDeque<(String, Vec<Device>)> = VecDeque::new();
        queue.push_back((head.to_owned(), Vec::new()));
        let mut visited = 0;
        while let Some((candidate, devices)) = queue.pop_front() {
            visited += 1;
            if visited > BUDGET {
                break;
            }
            if devices.len() >= DEPTH {
                continue;
            }
            for (next, device) in self.successors(&candidate) {
                if !seen.insert(next.clone()) {
                    continue;
                }
                let mut path = devices.clone();
                path.push(device);
                if self.pairs.contains_key(next.as_str()) {
                    routes.push(Reduction {
                        base: next.as_str().into(),
                        devices: path,
                    });
                } else {
                    queue.push_back((next, path));
                }
            }
        }
        Reduced { routes }
    }

    /// `C_A ⊢ h ✓ k`, by an exact pair or one reduction through one base
    /// pair (´[KND-judg:kinds:head-validation]´).
    ///
    /// ```
    /// # fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    /// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
    /// # let adoption = cogra_linter::Adoption::from_str(
    /// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
    /// # let doc = "| Environment | Kind |\n| --- | --- |\n| Theorem | `thm` |\n\
    /// #            | Convention | `conv` |\n\n\
    /// #            | Modifier | Kind |\n| --- | --- |\n| Main | \u{2014} |\n";
    /// # let source = cogra_linter::SourceFile {
    /// #     path: std::path::PathBuf::from("r.md"),
    /// #     owner: cogra_linter::OwnerId::new("linter"),
    /// #     language: Some(cogra_linter::Language::new("markdown")),
    /// #     generated: false,
    /// #     bytes: Vec::from(doc),
    /// # };
    /// # let parsed = cogra_linter::frontend_md::parse(&source, &adoption)
    /// #     .map_err(|d| format!("{d:?}"))?;
    /// use cogra_linter::{HeadVerdict, Kind, KindRegistry};
    ///
    /// let registry = KindRegistry::from_markdown(&parsed, doc, &adoption)
    ///     .map_err(|d| format!("{d:?}"))?;
    /// assert_eq!(registry.validate("Convention", &Kind::new("conv")), HeadVerdict::Exact);
    /// assert!(matches!(
    ///     registry.validate("Main Theorem", &Kind::new("thm")),
    ///     HeadVerdict::Reduced { .. }
    /// ));
    /// assert!(matches!(
    ///     registry.validate("convention", &Kind::new("conv")),
    ///     HeadVerdict::Uncatalogued { .. }
    /// ));
    /// # Ok(())
    /// # }
    /// ```
    #[must_use]
    pub fn validate(&self, head: &str, declared: &Kind) -> HeadVerdict {
        if self.carries(head, declared) {
            return HeadVerdict::Exact;
        }
        if self.pairs.contains_key(head) {
            return HeadVerdict::Uncatalogued { base: head.into() };
        }
        let reduced = self.reduce(head);
        let mut matching = distinct(
            reduced
                .routes
                .iter()
                .filter(|route| self.carries(&route.base, declared))
                .map(|route| route.base.clone()),
        );
        match matching.len() {
            0 => {
                let mut bases = distinct(reduced.routes.iter().map(|route| route.base.clone()));
                let base = if bases.len() == 1 {
                    bases.remove(0)
                } else {
                    head.into()
                };
                HeadVerdict::Uncatalogued { base }
            }
            1 => HeadVerdict::Reduced {
                base: matching.remove(0),
            },
            _ => HeadVerdict::Ambiguous { bases: matching },
        }
    }

    /// `Hom(C_A)`, derived and never declared (´[KND-def:kinds:homonymy]´).
    pub fn homonyms(&self) -> impl Iterator<Item = (&str, &Kind)> {
        self.pairs
            .iter()
            .filter(|(_, kinds)| kinds.len() > 1)
            .flat_map(|(name, kinds)| kinds.iter().map(move |kind| (&**name, kind)))
    }

    /// The five counts of (´[KND-tab:kinds:headline-counts]´), derived from
    /// the tables alone.
    #[must_use]
    pub fn headline_counts(&self) -> HeadlineCounts {
        HeadlineCounts {
            names: self.pairs.len(),
            rows: self.pairs.values().map(BTreeSet::len).sum(),
            kinds: self
                .pairs
                .values()
                .flatten()
                .collect::<BTreeSet<&Kind>>()
                .len(),
            declared_hybrids: self.declared_hybrids,
            device_classes: self.device_classes,
        }
    }

    /// Whether the relation holds this exact pair.
    fn carries(&self, name: &str, kind: &Kind) -> bool {
        self.pairs
            .get(name)
            .is_some_and(|kinds| kinds.contains(kind))
    }

    /// Every spelling one device removal reaches from `head`.
    ///
    /// Each routine offers its result and that result with its first letter
    /// restored to upper case, under the same device: a head is written in
    /// sentence case, so removing a leading modifier from `Toy example`
    /// leaves a tail whose spelling has to be restored before it can be the
    /// catalogue's `Example`. Matching itself stays case-exact — what is
    /// case-corrected is the candidate the spelling rule produces, never
    /// the comparison.
    fn successors(&self, head: &str) -> Vec<(String, Device)> {
        let mut out = Vec::new();
        for family in &self.families {
            if let Some(next) = strip(*family, head) {
                offer(&mut out, next, &Device::Family(*family));
            }
        }
        for modifier in &self.modifiers {
            if let Some(next) = strip_modifier(head, modifier) {
                offer(&mut out, next, &Device::Modifier(modifier.clone()));
            }
        }
        out
    }
}

fn offer(out: &mut Vec<(String, Device)>, next: String, device: &Device) {
    let capitalized = capitalize(&next);
    if capitalized != next {
        out.push((capitalized, device.clone()));
    }
    out.push((next, device.clone()));
}

fn distinct(names: impl Iterator<Item = Box<str>>) -> Vec<Box<str>> {
    let mut all: Vec<Box<str>> = names.collect();
    all.sort_unstable();
    all.dedup();
    all
}

fn capitalize(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// One device family's spelling rule.
fn strip(family: DeviceFamily, head: &str) -> Option<String> {
    match family {
        DeviceFamily::Numbering => strip_trailing_token(head, |token| {
            token.chars().any(|c| c.is_ascii_digit())
                && token.chars().all(|c| c.is_ascii_digit() || c == '.')
        }),
        DeviceFamily::Lettering => strip_trailing_token(head, |token| {
            token.len() == 1 && token.starts_with(|c: char| c.is_ascii_uppercase())
        }),
        DeviceFamily::Starred => trimmed(head.strip_suffix('*')?),
        DeviceFamily::Restatement => trimmed(head.strip_suffix(", restated")?),
        DeviceFamily::Continuation => trimmed(
            head.strip_suffix(", continued")
                .or_else(|| head.strip_suffix(" (continued)"))?,
        ),
        DeviceFamily::AttachedName => strip_trailing_parenthetical(head),
        DeviceFamily::SubPrefix => strip_sub_prefix(head),
        DeviceFamily::Containment | DeviceFamily::Placement | DeviceFamily::Overriding => None,
    }
}

fn trimmed(text: &str) -> Option<String> {
    let text = text.trim_end();
    (!text.is_empty()).then(|| text.to_owned())
}

fn strip_trailing_token(head: &str, wanted: impl Fn(&str) -> bool) -> Option<String> {
    let (rest, token) = head.rsplit_once(' ')?;
    if wanted(token) { trimmed(rest) } else { None }
}

/// Remove a trailing parenthesized group, matching from the end.
fn strip_trailing_parenthetical(head: &str) -> Option<String> {
    if !head.ends_with(')') {
        return None;
    }
    let mut depth = 0usize;
    for (at, c) in head.char_indices().rev() {
        if c == ')' {
            depth += 1;
        } else if c == '(' {
            depth -= 1;
            if depth == 0 {
                return trimmed(head.get(..at)?);
            }
        }
    }
    None
}

/// Remove one `sub` prefix. Iteration is the search's, not this routine's.
fn strip_sub_prefix(head: &str) -> Option<String> {
    let rest = head
        .strip_prefix("Sub")
        .or_else(|| head.strip_prefix("sub"))?;
    (!rest.is_empty()).then(|| rest.to_owned())
}

/// Remove one leading emphasis or status modifier.
fn strip_modifier(head: &str, modifier: &str) -> Option<String> {
    let rest = head.strip_prefix(modifier)?.strip_prefix(' ')?;
    (!rest.is_empty()).then(|| rest.to_owned())
}

/// What a table of the registry document is.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum Role {
    /// `Environment | Kind`: ordinary rows, hybrid rows, device families.
    Catalogue,
    /// `Modifier | Kind`: the emphasis and status modifiers.
    Modifiers,
    /// Anything else, the generated headline counts included.
    Other,
}

fn role_of(table: &Table) -> Role {
    let headers: Vec<&str> = table.headers.iter().map(|cell| cell.trim()).collect();
    match headers.as_slice() {
        [ENVIRONMENT, KIND] => Role::Catalogue,
        [MODIFIER, KIND] => Role::Modifiers,
        _ => Role::Other,
    }
}

/// One declared hybrid triple, awaiting derivation.
struct Declared {
    name: Box<str>,
    token: Box<str>,
    at: ByteSpan,
}

/// The read of one registry document.
struct Reader<'a> {
    doc: &'a Parsed,
    src: &'a str,
    enforcement: Enforcement,
    findings: Vec<Diagnostic>,
    pairs: BTreeMap<Box<str>, BTreeSet<Kind>>,
    declared: Vec<Declared>,
    families: BTreeSet<DeviceFamily>,
    modifiers: BTreeSet<Box<str>>,
    unrecognized: Vec<Box<str>>,
    device_classes: usize,
    catalogues: usize,
}

impl<'a> Reader<'a> {
    fn new(doc: &'a Parsed, src: &'a str, a: &Adoption) -> Reader<'a> {
        Reader {
            doc,
            src,
            enforcement: a.enforcement.enforcement_for(&doc.path),
            findings: Vec::new(),
            pairs: BTreeMap::new(),
            declared: Vec::new(),
            families: BTreeSet::new(),
            modifiers: BTreeSet::new(),
            unrecognized: Vec::new(),
            device_classes: 0,
            catalogues: 0,
        }
    }

    fn read(mut self) -> Result<KindRegistry, Vec<Diagnostic>> {
        for table in &self.doc.tables {
            match role_of(table) {
                Role::Catalogue => self.catalogue(table),
                Role::Modifiers => self.modifiers(table),
                Role::Other => {}
            }
        }
        if self.catalogues == 0 {
            let finding = self.finding(
                NO_TABLES,
                ByteSpan::new(0, 0),
                "the document carries no Environment/Kind table, so no classification relation",
            );
            self.findings.push(finding);
        }
        self.hybrids();
        if self.findings.is_empty() {
            Ok(KindRegistry {
                pairs: self.pairs,
                families: self.families,
                modifiers: self.modifiers,
                unrecognized: self.unrecognized,
                unapplied: Vec::new(),
                declared_hybrids: self.declared.len(),
                device_classes: self.device_classes,
            })
        } else {
            self.findings.sort();
            Err(self.findings)
        }
    }

    fn catalogue(&mut self, table: &Table) {
        self.catalogues += 1;
        for row in &table.rows {
            let [name, kind] = row.as_slice() else {
                self.malformed(table, row);
                continue;
            };
            let name = catalogue_name(name);
            let kind = kind.trim();
            if name.is_empty() {
                self.malformed(table, row);
            } else if kind == NO_KIND {
                self.device(&name);
            } else if name.contains(JOIN) {
                self.hybrid(&name, kind, table);
            } else {
                self.pair(&name, kind, table);
            }
        }
    }

    fn modifiers(&mut self, table: &Table) {
        for row in &table.rows {
            let [name, kind] = row.as_slice() else {
                self.malformed(table, row);
                continue;
            };
            let name = catalogue_name(name);
            if name.is_empty() {
                self.malformed(table, row);
            } else if kind.trim() == NO_KIND {
                self.modifiers.insert(name.into());
            } else {
                let finding = self.finding(
                    NOT_A_KIND,
                    table.span,
                    &format!("the modifier row {name} carries a kind, and a modifier is a device"),
                );
                self.findings.push(finding);
            }
        }
    }

    /// A device row: no pair, and a family only where a routine exists.
    fn device(&mut self, row: &str) {
        self.device_classes += 1;
        let opener = row.split_whitespace().next().unwrap_or_default();
        match FAMILIES.iter().find(|(word, _)| *word == opener) {
            Some((_, family)) => {
                self.families.insert(*family);
            }
            None => self.unrecognized.push(row.into()),
        }
    }

    fn hybrid(&mut self, name: &str, kind: &str, table: &Table) {
        let Some(token) = kind_token(kind) else {
            self.not_a_kind(name, kind, table);
            return;
        };
        self.declared.push(Declared {
            name: name.into(),
            token: token.into(),
            at: table.span,
        });
    }

    fn pair(&mut self, name: &str, kind: &str, table: &Table) {
        let Some(token) = kind_token(kind) else {
            self.not_a_kind(name, kind, table);
            return;
        };
        self.pairs
            .entry(name.into())
            .or_default()
            .insert(Kind::new(token));
    }

    /// Derive the hybrid rows and check the side conditions
    /// (´[KND-inf:kinds:hybrid]´).
    ///
    /// The parts are looked up in the ordinary rows alone, which is what
    /// "the parts are non-hybrid names" means operationally: a part that is
    /// itself a declared hybrid is simply not there.
    fn hybrids(&mut self) {
        let assigned: BTreeSet<Kind> = self.pairs.values().flatten().cloned().collect();
        let mut composed: BTreeSet<Kind> = BTreeSet::new();
        let declared = std::mem::take(&mut self.declared);
        for one in &declared {
            let Some((left, right)) = one.name.split_once(JOIN) else {
                continue;
            };
            let (Some(first), Some(second)) = (self.part(left, one), self.part(right, one)) else {
                continue;
            };
            let token = Kind::new(&format!("{first}{second}"));
            if token.as_str() != &*one.token {
                let finding = self.finding(
                    HYBRID_MISMATCH,
                    one.at,
                    &format!(
                        "the hybrid {} composes {token} and its row carries {}",
                        one.name, one.token
                    ),
                );
                self.findings.push(finding);
                continue;
            }
            if assigned.contains(&token) || !composed.insert(token.clone()) {
                let finding = self.finding(
                    HYBRID_COLLIDES,
                    one.at,
                    &format!("the hybrid token {token} is otherwise assigned"),
                );
                self.findings.push(finding);
                continue;
            }
            self.pairs
                .entry(one.name.clone())
                .or_default()
                .insert(token);
        }
        self.declared = declared;
    }

    /// One part of a declared hybrid, which must carry exactly one kind.
    fn part(&mut self, name: &str, one: &Declared) -> Option<Kind> {
        let kinds = self.pairs.get(name);
        match kinds.map(|kinds| kinds.iter().collect::<Vec<&Kind>>()) {
            Some(kinds) if kinds.len() == 1 => kinds.first().map(|kind| (*kind).clone()),
            other => {
                let why = if other.is_none() {
                    "is not a classified non-hybrid name"
                } else {
                    "carries several kinds, so the composition is not determined"
                };
                let finding = self.finding(
                    HYBRID_PART,
                    one.at,
                    &format!("the part {name} of the hybrid {} {why}", one.name),
                );
                self.findings.push(finding);
                None
            }
        }
    }

    fn malformed(&mut self, table: &Table, row: &[String]) {
        let finding = self.finding(
            MALFORMED_ROW,
            table.span,
            &format!("the row {row:?} is not a name-and-kind pair"),
        );
        self.findings.push(finding);
    }

    fn not_a_kind(&mut self, name: &str, kind: &str, table: &Table) {
        let finding = self.finding(
            NOT_A_KIND,
            table.span,
            &format!("the kind cell {kind} of the row {name} is not a kind token"),
        );
        self.findings.push(finding);
    }

    fn finding(&self, rule: RuleId, at: ByteSpan, message: &str) -> Diagnostic {
        Diagnostic {
            rule,
            severity: Severity::Error,
            enforcement: self.enforcement,
            primary: Location::in_source(self.doc.path.clone(), at, self.src),
            related: Vec::new(),
            message: String::from(message),
        }
    }
}

/// The exact catalogue name of a row: its name with the status mark
/// removed (´[KND-judg:kinds:attestation]´).
fn catalogue_name(cell: &str) -> String {
    cell.trim().trim_end_matches(DAGGER).trim_end().to_owned()
}

/// The kind token a kind cell carries, which the registry writes in a plain
/// code span.
fn kind_token(cell: &str) -> Option<&str> {
    let inner = cell
        .trim()
        .strip_prefix('`')
        .and_then(|rest| rest.strip_suffix('`'))
        .unwrap_or(cell)
        .trim();
    let word = !inner.is_empty()
        && inner
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit());
    word.then_some(inner)
}

/// A head the relation does not carry with its declared kind
/// (´[KND-judg:kinds:head-validation]´).
pub const HEAD_UNCATALOGUED: RuleId = RuleId::new("kind-head-uncatalogued");

/// A head whose presentation reduction reaches more than one base pair
/// (´[KND-judg:kinds:head-validation]´).
pub const HEAD_AMBIGUOUS: RuleId = RuleId::new("kind-head-ambiguous");

/// Every head validates as exactly one catalogued pair
/// (´[KND-judg:kinds:head-validation]´).
///
/// The query is the degree: out-degree one over `ValidatesAs` is a validated
/// head, zero is an uncatalogued pair, and two is an ambiguous reduction
/// (´tab:lint:judgment-implementation´). Making the pairs nodes rather than a
/// side table is what puts (´[KND-inv:kinds:catalogued-pairs]´) in the same
/// query language as every other invariant — an unrecorded pair is an edge
/// with no target.
///
/// The registry is consulted for the *words* of the finding and never for
/// the verdict: the edges the harvest laid down already carry it, and asking
/// twice is how a judgment and a resolution come to disagree. Matching is
/// case-exact, so a head whose only defect is capitalization lands here and
/// its message names the catalogue spelling (´dec:lint:head-recognition´).
#[must_use]
pub fn head_validation(g: &Corpus, k: &KindRegistry) -> Vec<Diagnostic> {
    let mut found = Vec::new();
    for head in nodes_of(g, NodeKind::Head) {
        let Some(NodeW::Head(weight)) = g.node_weight(head) else {
            continue;
        };
        let Some(at) = at(g, head) else { continue };
        let pairs: Vec<NodeIndex> = out_along(g, head, EdgeW::ValidatesAs).collect();
        let (rule, message) = match pairs.len() {
            1 => continue,
            0 => (
                HEAD_UNCATALOGUED,
                uncatalogued(k, &weight.text, &weight.declared),
            ),
            _ => (
                HEAD_AMBIGUOUS,
                format!(
                    "the head {} reduces through {} base pairs, and the reduction admits one",
                    weight.text,
                    pairs.len()
                ),
            ),
        };
        found.push(Diagnostic {
            rule,
            severity: Severity::Error,
            enforcement: Enforcement::Advisory,
            primary: at,
            related: Vec::new(),
            message,
        });
    }
    found
}

/// What an unvalidated head says, with the name it reduced to where the
/// reduction reached one.
fn uncatalogued(k: &KindRegistry, head: &str, declared: &Kind) -> String {
    match k.validate(head, declared) {
        HeadVerdict::Uncatalogued { base } if &*base != head => {
            format!(
                "the head {head} reduces to {base}, which the relation does not carry with the kind {declared}"
            )
        }
        _ => format!("the relation carries no pair of {head} with the kind {declared}"),
    }
}
