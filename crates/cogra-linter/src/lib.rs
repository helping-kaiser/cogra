//! The corpus linter: one binary that walks the corpus — Markdown prose and
//! compiled-platform source — and mechanically discharges the checkable
//! obligations of the four discipline documents.
//!
//! The phase artifacts live in this crate's docs folder: concept.md and
//! design.md, both ratified. The module map, the public API of every slice,
//! and the implementation gate are the design's; nothing here deviates from
//! it without being named in review first.
//!
//! # The run entry
//!
//! [`check`] is the whole check, and it lives here because the module map
//! puts it here (´model:lint:module-map´): the crate root holds the
//! re-exports and the run entry, and nothing else does.
//!
//! The staging is the calculus's own and the architecture's rule
//! (´[LBL-inv:labels:two-pass]´), (´[ARCH-rule:linter:two-pass]´). The
//! adoption data are loaded before anything else runs — by the caller, not
//! here, so that a run takes an [`Adoption`] and can never acquire a second
//! way of learning about this corpus (´req:lint:adoption-data-only´). Then
//! **pass 1** harvests: every carrier source is walked in path order,
//! pre-tokenized, parsed by the frontend its language names, scanned region
//! by region, and turned into nodes, with the minting registries completed
//! as it goes. Only then does **pass 2** resolve, adding the edges that are
//! judgments about completed registries — `Cites`, `ResolvesTo`,
//! `ValidatesAs`, and the `Derives` warrant of an effective profile — and
//! only then do the judgments run.
//!
//! Nothing in pass 2 depends on the order pass 1 visited anything. The
//! sources are sorted by path before the harvest whatever order they arrive
//! in, every registry lookup is by key, no `HashMap`'s iteration order
//! reaches a finding, and the whole list is sorted by the diagnostic order
//! before it is returned (´[ARCH-req:linter:determinism]´).
//!
//! # Findings against errors
//!
//! A run returns `Err` for exactly one thing: a corpus root that is not a
//! directory. An unreadable tree, a file that will not parse, an unpaired
//! backtick, a defective foreign owner — each is a fact about the corpus and
//! travels as a [`Diagnostic`] (´crit:lint:error-or-finding´).

pub mod adopt;
pub mod bans;
pub mod carrier;
pub mod diag;
pub mod error;
pub mod frontend;
pub mod frontend_md;
pub mod frontend_rust;
pub mod graph;
pub mod judge;
pub mod migrate;
pub mod pretokenize;
pub mod registers;
pub mod render;
pub mod scan;
pub mod timing;

pub use adopt::{
    Adoption, Area, BannedToken, BannedTokens, Carrier, Census, CitationIndexes, Classification,
    ConfiguredPath, EnforcementPartition, HeadForm, HeadMatching, HeadRecognition,
    HeadlessLanguages, Kind, KindEvidence, KindExtensions, KindGenerator, KindRegister,
    KindStatuses, KindsAdoption, Language, Meta, NameTransformation, OwnerId, Partition,
    PartitionRule, PathPrefix, Place, PrefixFamily, Profile, ProfileId, ProfileStatus, Profiles,
    ReservedKinds, ScannedLanguage, ScannedRegions, Signature, TypedData, UnscannedLanguages,
};
pub use bans::BanRule;
pub use carrier::{SourceFile, Walk, WalkOutcome};
pub use diag::{ByteSpan, Diagnostic, Enforcement, Location, Related, RuleId, Severity};
pub use error::{AdoptionError, GenerateError, RunError, WalkError};
pub use frontend::{Asset, Head, Parsed, Region, RegionKind, Table};
pub use frontend_rust::{CargoTarget, Censuses, Declaration};
pub use graph::{
    Corpus, EdgeW, NodeKind, NodeW, Registries, degree_along, edge_view, in_along, nodes_of,
    out_along, owner_of, owner_view, source_of,
};
pub use judge::kinds::{
    Attestation, Bound, Device, DeviceFamily, HeadVerdict, HeadlineCounts, KindRegistry, Reduced,
    Reduction,
};
pub use migrate::{Migration, Remaining, distances};
pub use pretokenize::{CommentForm, LexClass, Lexeme, LiteralForm, PreTokenized, pretokenize};
pub use registers::{
    Freshness, Register, RegisterScope, Scope, Written, compare, regenerate_all, write_all,
};
pub use scan::{
    DelimitedSpan, Delimiter, DelimiterFailure, Expectation, Label, LabelSyntax, NearMiss,
    NearMissKind, Occurrence, Prefix, RegionScan, Syntax, scan_code, scan_prose,
};
pub use timing::{Phase, Timing};

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use petgraph::stable_graph::NodeIndex;

use crate::graph::{
    AssetNode, CitationNode, HeadNode, LabelNode, MintNode, OwnerNode, PairNode, PairOrigin,
    PresentedSet, ProfileNode, RegionNode, SourceNode,
};
use crate::pretokenize::located;

/// A label-shaped span whose only defect is casing
/// (´[LBL-inv:labels:total-resolution]´).
pub const NEAR_MISS_CASE: RuleId = RuleId::new("label-near-miss-case");

/// A label-shaped span with whitespace inside its delimiters.
pub const NEAR_MISS_SPACING: RuleId = RuleId::new("label-near-miss-spacing");

/// A bracketed interior outside any parenthesis, or a malformed bracket
/// inside one.
pub const NEAR_MISS_BRACKET: RuleId = RuleId::new("label-near-miss-bracket");

/// A label-shaped backtick span in scanned code text, where the acute is the
/// label syntax.
///
/// How many the corpus carries is a measurement, and a measurement moves with
/// every commit: it is what a run reports, never what this comment says.
pub const NEAR_MISS_BACKTICK: RuleId = RuleId::new("label-backtick-in-code");

/// Several label-shaped spans inside one parenthesis, which is no citation
/// form at all.
pub const NEAR_MISS_SEVERAL: RuleId = RuleId::new("label-several-to-one-parenthesis");

/// An opening acute the region ends without closing: a hard failure bounded
/// by that region (´[LBL-judg:labels:participation]´).
pub const UNCLOSED_ACUTE: RuleId = RuleId::new("label-unclosed-acute");

/// Every rule the harvest itself can report.
pub const RULES: [RuleId; 6] = [
    NEAR_MISS_BACKTICK,
    NEAR_MISS_BRACKET,
    NEAR_MISS_CASE,
    NEAR_MISS_SEVERAL,
    NEAR_MISS_SPACING,
    UNCLOSED_ACUTE,
];

/// What one complete run produced.
///
/// The graph and the registries travel with the findings because the
/// register generator consumes exactly them — `regenerate_all(g, r, a, k)`
/// (´sig:lint:register-api´) — and a second harvest to reach them would be
/// two passes of pass 1.
#[derive(Debug)]
pub struct Run {
    /// Every finding, in the diagnostic order (´conv:lint:diagnostic-order´).
    pub findings: Vec<Diagnostic>,
    /// What each phase took (´req:lint:timing´).
    pub timing: Timing,
    /// The corpus graph, both passes complete.
    pub graph: Corpus,
    /// The registries the harvest completed.
    pub registries: Registries,
    /// The classification relation, or `None` where the registry document
    /// would not parse (´dec:lint:registry-bootstrap´).
    pub kinds: Option<KindRegistry>,
    /// Every carrier source's bytes, by path, as the harvest read them.
    pub sources: BTreeMap<PathBuf, Vec<u8>>,
}

impl Run {
    /// The findings inside the failing set (´dec:lint:enforcement-partition´).
    pub fn failing(&self) -> impl Iterator<Item = &Diagnostic> {
        self.findings
            .iter()
            .filter(|one| one.enforcement == Enforcement::Failing)
    }

    /// The findings outside it: reported, counted, and not fatal.
    pub fn advisory(&self) -> impl Iterator<Item = &Diagnostic> {
        self.findings
            .iter()
            .filter(|one| one.enforcement == Enforcement::Advisory)
    }

    /// Whether the failing set is clean, which is what the lane's exit code
    /// reads.
    #[must_use]
    pub fn is_clean(&self) -> bool {
        self.failing().next().is_none()
    }
}

/// Check one corpus root under one adoption.
///
/// The entry the acceptance suite and the command line both call. It loads
/// nothing: the adoption data reach it as a value, already validated.
///
/// ```no_run
/// use cogra_linter::{Adoption, check};
/// use std::path::Path;
///
/// let adoption = Adoption::load(Path::new("corpus-adoption.toml"))?;
/// let checked = check(&adoption, Path::new("."))?;
///
/// println!("{} findings in {}", checked.findings.len(), checked.timing);
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
///
/// The configured roots the walk reached nothing under are reported here and
/// not in [`check_sources`], because they are a fact about *this walk over
/// this root*: a caller handing over a source list of its own never claimed
/// to have traversed the corpus, and telling it that the trees it did not
/// supply are missing would be answering a question it did not ask
/// (´conv:lint:owner-assignment´).
///
/// The configured paths' *spellings* are checked here for the same reason
/// and one more: [`Adoption::load`] is handed the adoption file and never
/// the corpus root, so the check cannot run at load however much it belongs
/// to the data. This is the first place the two meet, and a misspelling
/// stops the run rather than travelling as a finding — a prefix that matches
/// nothing silently mis-owns, mis-excludes, or mis-enforces a whole tree,
/// which is the linter unable to do its job and not a fact about the corpus
/// (´crit:lint:error-or-finding´).
///
/// # Errors
///
/// [`RunError::Walk`] when `root` is not a directory, and
/// [`RunError::Adoption`] when a configured path is spelled otherwise than
/// the root spells it. Nothing else: a traversal failure inside a directory
/// that exists is a diagnostic beside a shorter source list, never an empty
/// carrier (´[LBL-cav:labels:coexistence]´).
pub fn check(a: &Adoption, root: &Path) -> Result<Run, RunError> {
    if !root.is_dir() {
        return Err(RunError::Walk(WalkError::NotADirectory {
            path: root.to_path_buf(),
        }));
    }
    a.verify_spellings(root)?;
    let walking = Instant::now();
    let (sources, failures) = match Walk::new(a, root).sources() {
        Ok(sources) => (sources, Vec::new()),
        Err(outcome) => (outcome.sources, outcome.failures),
    };
    let walked = walking.elapsed();
    let roots = crate::carrier::unmatched_roots(a, &sources);

    let mut run = check_sources(a, sources);
    run.timing.record(Phase::Harvest, walked);
    run.findings.extend(failures);
    run.findings.extend(roots);
    run.findings.sort();
    Ok(run)
}

/// Check sources already in hand.
///
/// The same run as [`check`] with the walk done elsewhere, which is what
/// makes the order-independence obligation of (´tab:lint:metatheorem-tests´)
/// statable: the sources are sorted by path here, so a shuffled traversal
/// order reaches an identical harvest rather than one that has to be sorted
/// back into shape afterwards.
#[must_use]
pub fn check_sources(a: &Adoption, mut sources: Vec<SourceFile>) -> Run {
    sources.sort_by(|one, other| one.path.cmp(&other.path));
    let mut timing = Timing::new();
    let mut harvest = Harvest::new(a);

    let harvesting = Instant::now();
    let mut pretokenizing = Duration::ZERO;
    for source in &sources {
        let lexing = Instant::now();
        let pre = pretokenize(source.language.as_ref(), &source.bytes);
        pretokenizing = pretokenizing.saturating_add(lexing.elapsed());
        harvest.source(source, &pre);
    }
    timing.record(Phase::Pretokenize, pretokenizing);
    timing.record(
        Phase::Harvest,
        harvesting.elapsed().saturating_sub(pretokenizing),
    );

    let kinds = timing.time(Phase::Resolve, || harvest.registry());
    timing.time(Phase::Resolve, || harvest.resolve(kinds.as_ref()));

    let held: BTreeMap<PathBuf, Vec<u8>> = sources
        .into_iter()
        .map(|one| (one.path, one.bytes))
        .collect();
    let mut findings = harvest.findings;
    timing.time(Phase::Judge, || {
        let mut judged = judge::judge_all(&harvest.g, &harvest.r, a, kinds.as_ref());
        judged.extend(judge::freshness::registers(
            &harvest.g,
            &harvest.r,
            a,
            kinds.as_ref(),
            &held,
        ));
        judge::stamp(&mut judged, &held, a);
        findings.extend(judged);
    });
    findings.sort();

    Run {
        findings,
        timing,
        graph: harvest.g,
        registries: harvest.r,
        kinds,
        sources: held,
    }
}

/// Pass 1's working state: the graph as it grows, and what pass 2 needs.
struct Harvest<'a> {
    a: &'a Adoption,
    g: Corpus,
    r: Registries,
    findings: Vec<Diagnostic>,
    profiles: BTreeMap<ProfileId, NodeIndex>,
    pairs: BTreeMap<(Box<str>, Kind), NodeIndex>,
    citations: Vec<NodeIndex>,
    heads: Vec<NodeIndex>,
    derivations: Vec<Derivation>,
    registry: Option<(Parsed, String)>,
}

/// One covered asset's derivation, queued for pass 2.
///
/// The label an asset derives is known the moment the census reports it; the
/// mint that carries it is not. A register-placed profile puts that mint in a
/// file of its own, harvested in path order like any other, so the warrant is
/// a fact about a completed minting registry exactly as resolution is
/// (´[ARCH-rule:linter:two-pass]´).
struct Derivation {
    /// The asset node the census produced.
    asset: NodeIndex,
    /// The owner that owns it, where the partition names one.
    owner: Option<NodeIndex>,
    /// The label the profile's name transformation derives from it.
    label: Label,
    /// The owner's register, where the profile's standard place is one.
    register: Option<PathBuf>,
    /// The source the asset sits in, which is where a comment-placed
    /// profile's standard place lies.
    source: PathBuf,
}

impl<'a> Harvest<'a> {
    /// The owners and the profiles, before any source is read.
    ///
    /// Both are adoption data and neither depends on a file, so both are in
    /// the graph before the walk: a `Profile` node exists for a staged
    /// profile too, so that its kind's reservation is legible even though it
    /// carries no `Covers` edge (´dec:lint:staged-profiles´).
    fn new(a: &'a Adoption) -> Harvest<'a> {
        let mut harvest = Harvest {
            a,
            g: Corpus::new(),
            r: Registries::new(),
            findings: Vec::new(),
            profiles: BTreeMap::new(),
            pairs: BTreeMap::new(),
            citations: Vec::new(),
            heads: Vec::new(),
            derivations: Vec::new(),
            registry: None,
        };
        let mut ids: BTreeSet<OwnerId> = a
            .partition
            .rules
            .iter()
            .map(|rule| rule.owner.clone())
            .collect();
        ids.extend(a.signature.prefixes.values().cloned());
        for id in ids {
            let prefixes = prefixes_of(a, &id);
            let node = harvest.g.add_node(NodeW::Owner(OwnerNode {
                id: id.clone(),
                prefixes: prefixes.clone(),
            }));
            harvest.r.owners.insert(id, node);
            for prefix in prefixes {
                harvest.r.prefixes.insert(prefix, node);
            }
        }
        for profile in &a.profiles.profiles {
            let node = harvest.g.add_node(NodeW::Profile(ProfileNode {
                id: profile.id.clone(),
                kind: profile.kind.clone(),
                status: profile.status.clone(),
            }));
            harvest.profiles.insert(profile.id.clone(), node);
        }
        harvest
    }

    /// One source: its node, its regions, its occurrences, its heads, and
    /// its assets.
    fn source(&mut self, src: &SourceFile, pre: &PreTokenized) {
        let enforcement = self.a.enforcement.enforcement_for(&src.path);
        let owner = self.r.owners.get(&src.owner).copied();
        let source = self.g.add_node(NodeW::Source(SourceNode {
            path: src.path.clone(),
            language: src.language.clone(),
            generated: src.generated,
        }));
        if let Some(owner) = owner {
            self.g.add_edge(owner, source, EdgeW::Owns);
        }

        let parsed = match frontend::parse(src, pre, self.a) {
            Ok(parsed) => parsed,
            Err(refused) => {
                self.findings.extend(refused);
                self.findings
                    .extend(pre.stamped(&src.path, &src.bytes, enforcement));
                return;
            }
        };
        self.findings.extend(parsed.diagnostics.iter().cloned());
        self.findings
            .extend(bans::findings(&self.a.banned_tokens, src, pre, enforcement));

        let mut hosts: Vec<(NodeIndex, ByteSpan)> = Vec::new();
        for region in &parsed.regions {
            let presents = presented_by(self.a, region);
            let node = self.g.add_node(NodeW::Region(RegionNode {
                kind: region.kind,
                span: region.span(),
                participates: region.participates,
                generated: region.generated,
                presents: presents.clone(),
            }));
            self.g.add_edge(source, node, EdgeW::Contains);
            hosts.push((node, region.span()));
            if !region.participates {
                continue;
            }
            let scan = match region.syntax {
                Syntax::Prose => scan_prose(&region.text, 0, &region.spans),
                Syntax::Code => scan_code(&region.text, 0),
            };
            self.occurrences(owner, node, region, &scan, presents.as_ref());
            self.warnings(src, region, &scan, enforcement);
        }

        for head in &parsed.heads {
            let host = hosts
                .iter()
                .find(|(_, span)| span.start <= head.span.start && head.span.end <= span.end)
                .map_or(source, |(node, _)| *node);
            let node = self.g.add_node(NodeW::Head(HeadNode {
                text: Box::from(head.text.as_str()),
                declared: head.declared.clone(),
                span: head.span,
            }));
            self.g.add_edge(host, node, EdgeW::Contains);
            self.heads.push(node);
        }

        self.assets(src, owner, &parsed);

        if src.path == self.a.registry_document() {
            self.registry = Some((parsed, String::from_utf8_lossy(&src.bytes).into_owned()));
        }
    }

    /// One region's occurrences, as nodes and registry entries.
    ///
    /// A region participates in nothing it presents, so an occurrence the
    /// region's own presented set holds is dropped before any registry sees
    /// it — the one exclusion that keeps
    /// (´[LBL-metathm:labels:no-self-support]´) a theorem
    /// (´[LBL-inv:labels:generated-compliance]´).
    fn occurrences(
        &mut self,
        owner: Option<NodeIndex>,
        region_node: NodeIndex,
        region: &Region,
        scan: &RegionScan,
        presents: Option<&PresentedSet>,
    ) {
        for occurrence in &scan.occurrences {
            let span = region.locate(occurrence.span());
            if presents_it(self.a, presents, occurrence) {
                continue;
            }
            match occurrence {
                Occurrence::Mint { label, .. } => {
                    let mint = self.g.add_node(NodeW::Mint(MintNode {
                        label: label.clone(),
                        span,
                        syntax: region.syntax,
                    }));
                    self.g.add_edge(region_node, mint, EdgeW::Contains);
                    if let Some(owner) = owner {
                        let carried = self.label_node(owner, label);
                        self.g.add_edge(mint, carried, EdgeW::Mints);
                        self.r.record_mint(owner, label.clone(), mint, carried);
                    }
                }
                Occurrence::SameOwner { label, .. } => {
                    self.citation(region_node, region, label, None, span);
                    if let Some(owner) = owner {
                        self.label_node(owner, label);
                    }
                }
                Occurrence::Imported { prefix, label, .. } => {
                    self.citation(region_node, region, label, Some(prefix.clone()), span);
                    if let Some(cited) = self.r.prefixes.get(prefix).copied() {
                        self.label_node(cited, label);
                    }
                }
            }
        }
    }

    /// One citation node, wired to its region and queued for pass 2.
    fn citation(
        &mut self,
        region_node: NodeIndex,
        region: &Region,
        label: &Label,
        prefix: Option<Prefix>,
        span: ByteSpan,
    ) {
        let node = self.g.add_node(NodeW::Citation(CitationNode {
            label: label.clone(),
            prefix,
            span,
            syntax: region.syntax,
        }));
        self.g.add_edge(region_node, node, EdgeW::Contains);
        self.citations.push(node);
    }

    /// An owner's node for one label, created once whether it is minted,
    /// cited into, or both (´sig:lint:index-maps´).
    fn label_node(&mut self, owner: NodeIndex, label: &Label) -> NodeIndex {
        if let Some(found) = self.r.labels.get(&(owner, label.clone())) {
            return *found;
        }
        let node = self.g.add_node(NodeW::Label(LabelNode {
            label: label.clone(),
        }));
        self.g.add_edge(owner, node, EdgeW::Owns);
        self.r.record_label(owner, label.clone(), node);
        node
    }

    /// The covered assets of the effective profiles, and the derivation each
    /// one queues for pass 2.
    ///
    /// Empty in this corpus: both profiles are staged, so the frontends
    /// compute their censuses and report none of them
    /// (´dec:lint:staged-profiles´). The wiring is here so that entering Π
    /// flips two fields rather than writing code.
    ///
    /// An asset whose transformed identifier is no well-formed name queues
    /// nothing: it derives no label, which is what the inventory judgment
    /// reports rather than what the harvest invents.
    fn assets(&mut self, src: &SourceFile, owner: Option<NodeIndex>, parsed: &Parsed) {
        for asset in &parsed.assets {
            let node = self.g.add_node(NodeW::Asset(AssetNode {
                identifier: Box::from(asset.identifier.as_str()),
                area: asset.area.clone(),
                place: asset.place.clone(),
            }));
            if let Some(owner) = owner {
                self.g.add_edge(owner, node, EdgeW::Owns);
            }
            if let Some(profile) = self.profiles.get(&asset.profile).copied() {
                self.g.add_edge(profile, node, EdgeW::Covers);
            }
            let Some(profile) = self
                .a
                .profiles
                .profiles
                .iter()
                .find(|one| one.id == asset.profile)
            else {
                continue;
            };
            let Some(label) = registers::derived_label(profile, &asset.identifier, &asset.area)
            else {
                continue;
            };
            self.derivations.push(Derivation {
                asset: node,
                owner,
                label,
                register: profile
                    .standard_place
                    .register
                    .as_ref()
                    .map(|_| registers::register_path(&registers::owner_root(self.a, &src.owner))),
                source: src.path.clone(),
            });
        }
    }

    /// The derivation warrants: one `Derives` edge from each covered asset to
    /// the mint of its derived label at its profile's standard place, and the
    /// census side of the inventory bijection recorded beside them
    /// (´dec:lint:staged-profiles´).
    ///
    /// The edge runs to the *mint* and never to the label, because the
    /// derivation warrants a label at an occurrence: an occurrence at the
    /// standard place whose text differs from the derivation warrants
    /// nothing, and an edge into the label would have asserted the agreement
    /// the invariant exists to check (´sig:lint:edge-weights´).
    ///
    /// A label the owner mints more than once at the standard place takes an
    /// edge per mint rather than the registry's first, so that the degree the
    /// inventory reads is what the corpus actually carries.
    fn derive(&mut self) {
        for one in std::mem::take(&mut self.derivations) {
            let Some(owner) = one.owner else { continue };
            self.r
                .derived
                .entry((owner, one.label.clone()))
                .or_insert(one.asset);
            let Some(carried) = self.r.labels.get(&(owner, one.label.clone())).copied() else {
                continue;
            };
            let mut mints: Vec<NodeIndex> = in_along(&self.g, carried, EdgeW::Mints)
                .filter(|mint| at_standard_place(&self.g, *mint, &one))
                .collect();
            mints.sort_unstable();
            for mint in mints {
                self.g.add_edge(one.asset, mint, EdgeW::Derives);
            }
        }
    }

    /// The scanner's warnings, as located diagnostics.
    fn warnings(
        &mut self,
        src: &SourceFile,
        region: &Region,
        scan: &RegionScan,
        enforcement: Enforcement,
    ) {
        for miss in &scan.near_misses {
            let (rule, message) = near_miss(miss);
            self.findings.push(Diagnostic {
                rule,
                severity: Severity::Warning,
                enforcement,
                primary: located(&src.path, region.locate(miss.span), &src.bytes),
                related: Vec::new(),
                message,
            });
        }
        if let Some(failure) = scan.delimiter_failure {
            let at = region.locate(ByteSpan::new(failure.at, failure.at));
            let delimiter = match failure.delimiter {
                Delimiter::Acute => "acute",
                Delimiter::Backtick => "backtick",
            };
            self.findings.push(Diagnostic {
                rule: UNCLOSED_ACUTE,
                severity: Severity::Error,
                enforcement,
                primary: located(&src.path, at, &src.bytes),
                related: Vec::new(),
                message: format!(
                    "an opening {delimiter} declares an occurrence and the region ends without closing it"
                ),
            });
        }
    }

    /// The classification relation, read out of the registry document.
    ///
    /// A defect there degrades kind validation corpus-wide, so it is
    /// reported as located findings on that document and never swallowed;
    /// the label judgments then run normally and one diagnostic names the
    /// suppression (´dec:lint:registry-bootstrap´).
    fn registry(&mut self) -> Option<KindRegistry> {
        let (parsed, text) = self.registry.take()?;
        match KindRegistry::from_markdown(&parsed, &text, self.a) {
            Ok(registry) => Some(registry.with_extensions(&self.a.kinds.extensions)),
            Err(defects) => {
                self.findings.extend(defects);
                None
            }
        }
    }

    /// Pass 2: the edges that judge completed registries.
    ///
    /// Four rather than the ruled three: `Derives` joins `Cites`,
    /// `ResolvesTo`, and `ValidatesAs` because it is the same species of
    /// fact. A derived label's mint may sit in any source of its owner — the
    /// register of a register-placed profile is one — so the warrant can only
    /// be laid once every mint is registered (´dec:lint:staged-profiles´).
    fn resolve(&mut self, kinds: Option<&KindRegistry>) {
        self.derive();
        for citation in std::mem::take(&mut self.citations) {
            let Some(NodeW::Citation(weight)) = self.g.node_weight(citation) else {
                continue;
            };
            let (label, prefix) = (weight.label.clone(), weight.prefix.clone());
            let owner = owner_of(&self.g, citation);
            let cited = match prefix.as_ref() {
                Some(prefix) => self.r.prefixes.get(prefix).copied(),
                None => owner,
            };
            let Some(cited) = cited else { continue };
            self.g.add_edge(citation, cited, EdgeW::Cites);
            if prefix.is_some() && Some(cited) == owner {
                continue;
            }
            if !self.r.mints.contains_key(&(cited, label.clone())) {
                continue;
            }
            if let Some(carried) = self.r.labels.get(&(cited, label)).copied() {
                self.g.add_edge(citation, carried, EdgeW::ResolvesTo);
            }
        }
        let Some(kinds) = kinds else { return };
        for head in std::mem::take(&mut self.heads) {
            let Some(NodeW::Head(weight)) = self.g.node_weight(head) else {
                continue;
            };
            let (text, declared) = (weight.text.to_string(), weight.declared.clone());
            for name in validates_as(kinds, &text, &declared) {
                let pair = self.pair_node(&name, &declared);
                self.g.add_edge(head, pair, EdgeW::ValidatesAs);
            }
        }
    }

    /// One pair of the effective relation, created once per name and kind.
    fn pair_node(&mut self, name: &str, kind: &Kind) -> NodeIndex {
        let key = (Box::from(name), kind.clone());
        if let Some(found) = self.pairs.get(&key) {
            return *found;
        }
        let node = self.g.add_node(NodeW::Pair(PairNode {
            name: Box::from(name),
            kind: kind.clone(),
            origin: PairOrigin::Base,
        }));
        self.pairs.insert(key, node);
        node
    }
}

/// Which catalogue names a head validates as, one per `ValidatesAs` edge.
///
/// Zero names is a head that did not validate and two is an ambiguous
/// reduction, which is exactly what the degree check reads off the edges
/// (´[KND-judg:kinds:head-validation]´). Which *kind* of failure zero was —
/// the relation carrying no such pair, or the reduction stopping at one of
/// its bounds before asking — is the judgment's affair and not the edge's:
/// an edge that does not exist looks the same either way.
fn validates_as(k: &KindRegistry, head: &str, declared: &Kind) -> Vec<Box<str>> {
    match k.validate(head, declared) {
        HeadVerdict::Exact => vec![Box::from(head)],
        HeadVerdict::Reduced { base } => vec![base],
        HeadVerdict::Uncatalogued { .. } | HeadVerdict::Beyond { .. } => Vec::new(),
        HeadVerdict::Ambiguous { bases } => bases,
    }
}

/// Whether one mint lies at the standard place a derivation names.
///
/// `[profiles]` records the place as free text with one machine-readable
/// half — the register, where the place is one — so the question is answered
/// over that half and over the two places this corpus's profiles choose: the
/// owner's generated register, or the asset's own inner documentation
/// comment. A mint of a derived label anywhere else takes no edge, which is
/// what leaves it the inventory label away from its place that
/// (´[LBL-inv:labels:warrant-totality]´) reports.
///
/// For a comment-placed profile the source is checked and the comment's
/// position within it is not: that the comment opens the definition's own
/// body is a pairing this run does not make, exactly as the migration
/// measurement says of the same place (´dec:lint:migrations-subcommand´).
fn at_standard_place(g: &Corpus, mint: NodeIndex, derivation: &Derivation) -> bool {
    let Some(source) = source_of(g, mint) else {
        return false;
    };
    let Some(NodeW::Source(weight)) = g.node_weight(source) else {
        return false;
    };
    match &derivation.register {
        Some(register) => weight.path == *register,
        None => weight.path == derivation.source && inner_doc(g, mint),
    }
}

/// Whether a mint sits inside an inner documentation comment.
fn inner_doc(g: &Corpus, mint: NodeIndex) -> bool {
    in_along(g, mint, EdgeW::Contains).any(|region| {
        matches!(
            g.node_weight(region),
            Some(NodeW::Region(weight)) if matches!(
                weight.kind,
                RegionKind::Comment(CommentForm::LineInnerDoc | CommentForm::BlockInnerDoc)
            )
        )
    })
}

/// Every prefix Σ registers for one owner, hand-registered or derived.
fn prefixes_of(a: &Adoption, owner: &OwnerId) -> Vec<Prefix> {
    let mut found: Vec<Prefix> = a
        .signature
        .prefixes
        .iter()
        .filter(|(_, named)| *named == owner)
        .map(|(prefix, _)| prefix.clone())
        .collect();
    found.extend(a.signature.derived_prefix(owner));
    found.sort();
    found.dedup();
    found
}

/// What a generated region presents, and therefore may not feed.
///
/// `None` throughout this corpus, and by a fact of the adoption data rather
/// than by omission: `[citation-indexes]` designates nothing, and the label
/// registers of the one profile that would own a `LabelRegister` region are
/// not generated until slice 6 (´dec:lint:staged-profiles´).
///
/// The gap is named: a recorded designation is a free-text row of
/// `[citation-indexes] designations`, which carries no upstream owner a
/// [`PresentedSet::CitationIndex`] could be built from. Designating an index
/// needs that section to carry the owner as a value.
fn presented_by(_a: &Adoption, _region: &Region) -> Option<PresentedSet> {
    None
}

/// Whether a region's presented set holds this occurrence.
fn presents_it(a: &Adoption, presents: Option<&PresentedSet>, occurrence: &Occurrence) -> bool {
    match presents {
        None => false,
        Some(PresentedSet::LabelRegister { profile }) => a
            .profiles
            .profiles
            .iter()
            .find(|one| one.id == *profile)
            .is_some_and(|one| one.kind.as_str() == occurrence.label().kind()),
        Some(PresentedSet::CitationIndex { upstream }) => match occurrence {
            Occurrence::Imported { prefix, .. } => a
                .signature
                .prefixes
                .get(prefix)
                .is_some_and(|named| named == upstream),
            _ => false,
        },
    }
}

/// The rule and the message one near-miss reports under.
fn near_miss(miss: &NearMiss) -> (RuleId, String) {
    match &miss.why {
        NearMissKind::WrongCase { .. } => (
            NEAR_MISS_CASE,
            String::from("this span is label-shaped but for its casing, and labels are lower case"),
        ),
        NearMissKind::InteriorSpacing { .. } => (
            NEAR_MISS_SPACING,
            String::from(
                "this span holds whitespace inside its delimiters, where a label holds none",
            ),
        ),
        NearMissKind::MisplacedBracket => (
            NEAR_MISS_BRACKET,
            String::from(
                "a bracketed interior is the import form and belongs inside a parenthesis",
            ),
        ),
        NearMissKind::BacktickInCode => (
            NEAR_MISS_BACKTICK,
            String::from("in scanned code text the acute is the label syntax, not the backtick"),
        ),
        NearMissKind::SeveralToOneParenthesis { count } => (
            NEAR_MISS_SEVERAL,
            format!("{count} label-shaped spans share one parenthesis, which is no citation form"),
        ),
    }
}
