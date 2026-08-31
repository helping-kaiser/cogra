//! The judgments, clause by clause (´tab:lint:judgment-implementation´).
//!
//! Trace convention: every test's doc comment names the clause it discharges
//! and the shape it pins, which is what
//! (´conv:lint:gates-as-acceptance´) asks of a clause test — over this
//! corpus's ruled adoption data, consulting no third document.
//!
//! The graphs are built here rather than harvested, and deliberately: a
//! judgment's subject is the graph, and building one by hand is how a clause
//! whose domain the real corpus does not populate — an effective profile's
//! inventory, a generated region's occurrences — is exercised at all rather
//! than passing by absence.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use petgraph::stable_graph::NodeIndex;

use cogra_linter::frontend::RegionKind;
use cogra_linter::graph::{
    AssetNode, CitationNode, Corpus, EdgeW, HeadNode, LabelNode, MintNode, NodeW, OwnerNode,
    PairNode, PairOrigin, ProfileNode, RegionNode, Registries, SourceNode,
};
use cogra_linter::judge::{kinds, labels};
use cogra_linter::scan::{Label, Prefix, Syntax};
use cogra_linter::{
    Adoption, Area, ByteSpan, Diagnostic, Enforcement, Kind, KindRegistry, Language, OwnerId,
    Place, ProfileId, ProfileStatus, SourceFile, frontend_md, judge,
};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption_text() -> &'static str {
    static LOADED: OnceLock<String> = OnceLock::new();
    LOADED.get_or_init(|| {
        std::fs::read_to_string(root().join("corpus-adoption.toml"))
            .expect("the adoption data is readable")
    })
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::from_str(adoption_text(), Path::new("corpus-adoption.toml"))
            .expect("the adoption loads")
    })
}

/// The ruled adoption with the module profile put back where it entered from
/// (´dec:lint:staged-profiles´).
///
/// Both profiles are in force today, so a reserved-but-ungoverned inventory
/// kind is what the ruled data no longer supplies, and the staged arm of
/// warrant totality needs one. The module profile is the last one
/// `[profiles]` registers, so the last effective status in the file is its
/// own.
fn module_staged() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        let text = adoption_text().replace("effective = 2", "effective = 1");
        let mark = "status = \"effective\"";
        let at = text.rfind(mark).expect("the module profile is effective");
        let text = format!(
            "{}status = \"staged\"{}",
            &text[..at],
            &text[at + mark.len()..]
        );
        Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
            .expect("the condition the module profile entered on is recorded beside it")
    })
}

fn label(text: &str) -> Label {
    Label::parse(text).unwrap_or_else(|why| panic!("{text} is well-formed: {why:?}"))
}

/// A corpus graph built the way pass 1 builds one.
struct Build {
    g: Corpus,
    r: Registries,
}

impl Build {
    fn new() -> Build {
        Build {
            g: Corpus::new(),
            r: Registries::new(),
        }
    }

    fn owner(&mut self, id: &str, prefixes: &[&str]) -> NodeIndex {
        let prefixes: Vec<Prefix> = prefixes
            .iter()
            .map(|one| Prefix::parse(one).expect("a prefix-shaped prefix"))
            .collect();
        let node = self.g.add_node(NodeW::Owner(OwnerNode {
            id: OwnerId::new(id),
            prefixes: prefixes.clone(),
        }));
        self.r.owners.insert(OwnerId::new(id), node);
        for prefix in prefixes {
            self.r.prefixes.insert(prefix, node);
        }
        node
    }

    fn source(&mut self, owner: NodeIndex, path: &str) -> NodeIndex {
        let node = self.g.add_node(NodeW::Source(SourceNode {
            path: PathBuf::from(path),
            language: Some(Language::new("markdown")),
            generated: false,
        }));
        self.g.add_edge(owner, node, EdgeW::Owns);
        node
    }

    fn region(&mut self, source: NodeIndex, generated: bool) -> NodeIndex {
        let node = self.g.add_node(NodeW::Region(RegionNode {
            kind: RegionKind::Prose,
            span: ByteSpan::new(0, 400),
            participates: true,
            generated,
            presents: None,
        }));
        self.g.add_edge(source, node, EdgeW::Contains);
        node
    }

    fn label_node(&mut self, owner: NodeIndex, text: &str) -> NodeIndex {
        if let Some(found) = self.r.labels.get(&(owner, label(text))) {
            return *found;
        }
        let node = self
            .g
            .add_node(NodeW::Label(LabelNode { label: label(text) }));
        self.g.add_edge(owner, node, EdgeW::Owns);
        self.r.record_label(owner, label(text), node);
        node
    }

    fn mint(&mut self, owner: NodeIndex, region: NodeIndex, text: &str, at: usize) -> NodeIndex {
        let node = self.g.add_node(NodeW::Mint(MintNode {
            label: label(text),
            span: ByteSpan::new(at, at + text.len()),
            syntax: Syntax::Prose,
        }));
        self.g.add_edge(region, node, EdgeW::Contains);
        let carried = self.label_node(owner, text);
        self.g.add_edge(node, carried, EdgeW::Mints);
        self.r.record_mint(owner, label(text), node, carried);
        node
    }

    fn citation(
        &mut self,
        region: NodeIndex,
        text: &str,
        prefix: Option<&str>,
        at: usize,
    ) -> NodeIndex {
        let node = self.g.add_node(NodeW::Citation(CitationNode {
            label: label(text),
            prefix: prefix.map(|one| Prefix::parse(one).expect("a prefix-shaped prefix")),
            span: ByteSpan::new(at, at + text.len()),
            syntax: Syntax::Prose,
        }));
        self.g.add_edge(region, node, EdgeW::Contains);
        node
    }

    /// Pass 2 for one citation: the `Cites` edge always, the `ResolvesTo`
    /// edge exactly where the cited owner mints the label.
    fn resolve(&mut self, citation: NodeIndex, cited: NodeIndex, text: &str) {
        self.g.add_edge(citation, cited, EdgeW::Cites);
        if !self.r.mints.contains_key(&(cited, label(text))) {
            return;
        }
        if let Some(carried) = self.r.labels.get(&(cited, label(text))).copied() {
            self.g.add_edge(citation, carried, EdgeW::ResolvesTo);
        }
    }

    fn profile(&mut self, id: &str, kind: &str, status: ProfileStatus) -> NodeIndex {
        self.g.add_node(NodeW::Profile(ProfileNode {
            id: ProfileId::new(id),
            kind: Kind::new(kind),
            status,
        }))
    }

    fn asset(&mut self, owner: NodeIndex, profile: NodeIndex, identifier: &str) -> NodeIndex {
        let node = self.g.add_node(NodeW::Asset(AssetNode {
            identifier: Box::from(identifier),
            area: Area::new("unit"),
            place: Place {
                place: Box::from("the documentation comment"),
                register: None,
                form: None,
            },
            span: ByteSpan::new(0, 0),
            documentation: Vec::new(),
        }));
        self.g.add_edge(owner, node, EdgeW::Owns);
        self.g.add_edge(profile, node, EdgeW::Covers);
        node
    }

    fn derives(&mut self, asset: NodeIndex, mint: NodeIndex) {
        self.g.add_edge(asset, mint, EdgeW::Derives);
    }

    fn head(&mut self, region: NodeIndex, text: &str, declared: &str, at: usize) -> NodeIndex {
        let node = self.g.add_node(NodeW::Head(HeadNode {
            text: Box::from(text),
            declared: Kind::new(declared),
            span: ByteSpan::new(at, at + text.len()),
        }));
        self.g.add_edge(region, node, EdgeW::Contains);
        node
    }

    fn pair(&mut self, head: NodeIndex, name: &str, kind: &str) {
        let node = self.g.add_node(NodeW::Pair(PairNode {
            name: Box::from(name),
            kind: Kind::new(kind),
            origin: PairOrigin::Base,
        }));
        self.g.add_edge(head, node, EdgeW::ValidatesAs);
    }
}

/// One owner, one source, one region: the smallest thing with an owner.
fn one_owner() -> (Build, NodeIndex, NodeIndex) {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &["ONE"]);
    let source = build.source(owner, "one/doc.md");
    let region = build.region(source, false);
    (build, owner, region)
}

fn rules(found: &[Diagnostic]) -> Vec<&str> {
    found.iter().map(|one| one.rule.as_str()).collect()
}

/// (´[LBL-inv:labels:unique-mint]´): one mint per owner and label is the
/// clean case, and the judgment says so with an empty list.
///
/// One mint per owner and label is the clean case.
/// ´claim:judgments:one-mint-per-owner-is-clean´
#[test]
fn one_mint_per_owner_and_label_is_clean() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    build.mint(owner, region, "sig:one:beta", 40);
    assert!(labels::unique_mint(&build.g, &build.r).is_empty());
}

/// (´[LBL-inv:labels:unique-mint]´): a second bare occurrence is a
/// violation, reported with both locations — never a harmless repeat.
///
/// A second bare occurrence is a violation reported with both locations.
/// ´claim:judgments:a-second-mint-reports-both-locations´
#[test]
fn a_second_mint_reports_with_both_locations() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    build.mint(owner, region, "sig:one:alpha", 90);
    let found = labels::unique_mint(&build.g, &build.r);
    assert_eq!(rules(&found), vec!["label-duplicate-mint"]);
    assert_eq!(found[0].primary.span.start, 90, "the later mint is primary");
    assert_eq!(found[0].related.len(), 1);
    assert_eq!(
        found[0].related[0].at.span.start, 10,
        "the first is related"
    );
}

/// (´[LBL-inv:labels:unique-mint]´): a third mint is a second finding, and
/// both name the mint the registry kept.
///
/// A third mint is a second finding, both named against the mint the registry kept.
/// ´claim:judgments:a-third-mint-is-a-second-finding´
#[test]
fn a_third_mint_is_a_second_finding_against_the_first() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    build.mint(owner, region, "sig:one:alpha", 90);
    build.mint(owner, region, "sig:one:alpha", 150);
    let found = labels::unique_mint(&build.g, &build.r);
    assert_eq!(found.len(), 2);
    for one in &found {
        assert_eq!(one.related[0].at.span.start, 10);
    }
}

/// (´[LBL-cav:labels:coexistence]´): two owners minting one label text is
/// expressly not a collision, which is why a `Label` node exists once per
/// owner and never once per corpus.
///
/// Two owners minting one label text is no collision, ownership disambiguating.
/// ´claim:judgments:two-owners-may-share-a-label-text´
#[test]
fn two_owners_minting_one_label_text_is_no_collision() {
    let mut build = Build::new();
    let one = build.owner("pkg.one", &["ONE"]);
    let other = build.owner("pkg.other", &["OTH"]);
    let here = build.source(one, "one/doc.md");
    let there = build.source(other, "other/doc.md");
    let here = build.region(here, false);
    let there = build.region(there, false);
    build.mint(one, here, "sig:one:alpha", 10);
    build.mint(other, there, "sig:one:alpha", 10);
    assert!(labels::unique_mint(&build.g, &build.r).is_empty());
}

/// (´sig:lint:index-maps´): the registry decides which mint is first, and
/// the finding is written against that one however the graph is ordered.
///
/// The registry decides which mint is first, however the graph is ordered.
/// ´claim:judgments:the-registry-decides-the-first-mint´
#[test]
fn the_registry_decides_which_mint_is_first() {
    let (mut build, owner, region) = one_owner();
    let first = build.mint(owner, region, "sig:one:alpha", 10);
    build.mint(owner, region, "sig:one:alpha", 90);
    assert_eq!(
        build.r.mints.get(&(owner, label("sig:one:alpha"))).copied(),
        Some(first)
    );
    let found = labels::unique_mint(&build.g, &build.r);
    assert_eq!(found[0].related[0].at.span.start, 10);
}

/// (´[LBL-inv:labels:total-resolution]´): a same-owner citation with one
/// `ResolvesTo` edge is the clean case.
///
/// A same-owner citation with one resolution edge is the clean case.
/// ´claim:judgments:a-resolving-citation-is-clean´
#[test]
fn a_resolving_same_owner_citation_is_clean() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    let citation = build.citation(region, "sig:one:alpha", None, 60);
    build.resolve(citation, owner, "sig:one:alpha");
    assert!(labels::total_resolution(&build.g, &build.r).is_empty());
}

/// (´[LBL-inv:labels:total-resolution]´): a parenthesized span whose
/// interior is label-shaped but resolves nowhere fails, and never lapses
/// into text.
///
/// A parenthesized label-shaped span resolving nowhere fails and never lapses into text.
/// ´claim:judgments:an-unresolved-citation-fails´
#[test]
fn an_unresolved_same_owner_citation_fails() {
    let (mut build, owner, region) = one_owner();
    let citation = build.citation(region, "sig:one:missing", None, 60);
    build.resolve(citation, owner, "sig:one:missing");
    let found = labels::total_resolution(&build.g, &build.r);
    assert_eq!(rules(&found), vec!["label-unresolved-citation"]);
    assert!(found[0].message.contains("minted nowhere in the corpus"));
}

/// (´[LBL-gate:labels:implementation]´): an unresolved same-owner citation
/// whose label mints in another owner is reported with the import form
/// suggested.
///
/// An unresolved citation whose label mints elsewhere is reported with the import form suggested.
/// ´claim:judgments:the-import-form-is-suggested´
#[test]
fn an_unresolved_citation_whose_label_mints_elsewhere_suggests_the_import() {
    let mut build = Build::new();
    let one = build.owner("pkg.one", &["ONE"]);
    let other = build.owner("pkg.other", &["OTH"]);
    let here = build.source(one, "one/doc.md");
    let there = build.source(other, "other/doc.md");
    let here = build.region(here, false);
    let there = build.region(there, false);
    build.mint(other, there, "sig:one:alpha", 10);
    let citation = build.citation(here, "sig:one:alpha", None, 60);
    build.resolve(citation, one, "sig:one:alpha");
    let found = labels::total_resolution(&build.g, &build.r);
    assert_eq!(rules(&found), vec!["label-unresolved-citation"]);
    assert!(
        found[0].message.contains("OTH-sig:one:alpha"),
        "the import form is the suggestion: {}",
        found[0].message
    );
}

/// (´[LBL-inf:labels:imported-citation]´): an import into a registered owner
/// that mints the label is clean.
///
/// An import into a registered owner that mints the label is clean.
/// ´claim:judgments:a-resolving-import-is-clean´
#[test]
fn a_resolving_import_is_clean() {
    let mut build = Build::new();
    let one = build.owner("pkg.one", &["ONE"]);
    let other = build.owner("pkg.other", &["OTH"]);
    let here = build.source(one, "one/doc.md");
    let there = build.source(other, "other/doc.md");
    let here = build.region(here, false);
    let there = build.region(there, false);
    build.mint(other, there, "sig:other:alpha", 10);
    let citation = build.citation(here, "sig:other:alpha", Some("OTH"), 60);
    build.resolve(citation, other, "sig:other:alpha");
    assert!(labels::total_resolution(&build.g, &build.r).is_empty());
}

/// (´[LBL-inf:labels:imported-citation]´) side condition: an unregistered
/// prefix names no owner and leaves the citation with out-degree zero over
/// `Cites`, which is the whole detection.
///
/// An unregistered prefix names no owner, which is the whole detection.
/// ´claim:judgments:an-unregistered-prefix-names-no-owner´
#[test]
fn an_unregistered_prefix_is_out_degree_zero_over_cites() {
    let (mut build, _, region) = one_owner();
    build.citation(region, "sig:other:alpha", Some("NOPE"), 60);
    let found = labels::total_resolution(&build.g, &build.r);
    assert_eq!(rules(&found), vec!["label-unregistered-prefix"]);
    assert!(found[0].message.contains("NOPE"));
}

/// (´[LBL-inf:labels:imported-citation]´) side condition: a self-qualified
/// import is an edge back to the citing owner, and is underivable.
///
/// A self-qualified import is an edge back to the citing owner and is underivable.
/// ´claim:judgments:a-self-qualified-import-is-underivable´
#[test]
fn a_self_qualified_import_is_an_edge_back_to_the_citing_owner() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    let citation = build.citation(region, "sig:one:alpha", Some("ONE"), 60);
    build.resolve(citation, owner, "sig:one:alpha");
    let found = labels::total_resolution(&build.g, &build.r);
    assert_eq!(rules(&found), vec!["label-self-qualified-import"]);
}

/// (´[LBL-inf:labels:imported-citation]´): the self-qualification is caught
/// before resolution, so a self-qualified import that would have resolved is
/// still one finding and not two.
///
/// A self-qualified import that would have resolved is still one finding and not two.
/// ´claim:judgments:a-self-qualified-import-reports-once´
#[test]
fn a_self_qualified_import_reports_once() {
    let (mut build, owner, region) = one_owner();
    let citation = build.citation(region, "sig:one:absent", Some("ONE"), 60);
    build.resolve(citation, owner, "sig:one:absent");
    assert_eq!(labels::total_resolution(&build.g, &build.r).len(), 1);
}

/// (´[LBL-inv:labels:total-resolution]´): "exactly one" cuts both ways, and
/// a citation with two targets is a finding the harvest cannot produce and
/// the judgment still states.
///
/// A citation with two targets is a finding, exactly-one cutting both ways.
/// ´claim:judgments:two-targets-is-ambiguous´
#[test]
fn a_citation_resolving_twice_is_the_ambiguous_finding() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    let citation = build.citation(region, "sig:one:alpha", None, 60);
    build.resolve(citation, owner, "sig:one:alpha");
    let carried = build.label_node(owner, "sig:one:alpha");
    build.g.add_edge(citation, carried, EdgeW::ResolvesTo);
    assert_eq!(
        rules(&labels::total_resolution(&build.g, &build.r)),
        vec!["label-ambiguous-resolution"]
    );
}

/// (´sig:lint:index-maps´): a label an owner carries but does not mint
/// resolves nothing — `mints` is the existential premise, `labels` is not.
///
/// A label an owner carries but does not mint resolves nothing.
/// ´claim:judgments:a-carried-label-is-not-a-minted-one´
#[test]
fn a_carried_but_unminted_label_resolves_nothing() {
    let (mut build, owner, region) = one_owner();
    build.label_node(owner, "sig:one:carried");
    let citation = build.citation(region, "sig:one:carried", None, 60);
    build.resolve(citation, owner, "sig:one:carried");
    assert_eq!(
        rules(&labels::total_resolution(&build.g, &build.r)),
        vec!["label-unresolved-citation"]
    );
}

/// (´[LBL-inv:labels:warrant-totality]´): a kind outside K admits authorship
/// only, and the occurrence embodies it — no finding, no record owed.
///
/// A kind outside the reserved set admits authorship only, and the occurrence embodies it.
/// ´claim:judgments:an-authored-kind-owes-no-record´
#[test]
fn an_authored_kind_stands_on_its_own_occurrence() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    assert!(labels::warrant_totality(&build.g, &build.r, adoption()).is_empty());
}

/// (´[LBL-sig:labels:reserved-kinds]´), (´[LBL-inv:labels:warrant-totality]´):
/// a reserved kind no profile governs admits neither warrant, and its bare
/// occurrence is the hard failure.
///
/// A reserved kind no profile governs admits neither warrant, and its bare occurrence fails.
/// ´claim:judgments:an-ungoverned-reserved-kind-fails´
#[test]
fn a_reserved_kind_no_profile_governs_is_the_hard_failure() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "func:one:alpha", 10);
    let found = labels::warrant_totality(&build.g, &build.r, adoption());
    assert_eq!(rules(&found), vec!["label-kind-ungoverned"]);
}

/// (´[LBL-inv:labels:warrant-totality]´): a governed inventory kind away
/// from any standard place has no derivation behind it, which is the
/// incoming-`Derives` check reading zero.
///
/// A governed inventory kind away from any standard place has no derivation behind it.
/// ´claim:judgments:a-stray-inventory-mint-is-underived´
#[test]
fn a_governed_kind_with_no_derivation_is_the_missing_warrant() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "test:unit:alpha", 10);
    let found = labels::warrant_totality(&build.g, &build.r, adoption());
    assert_eq!(rules(&found), vec!["label-warrant-missing"]);
}

/// (´[LBL-inv:labels:warrant-totality]´): a governed inventory kind with its
/// derivation is clean.
///
/// A governed inventory kind with its derivation is clean.
/// ´claim:judgments:a-derived-inventory-mint-is-clean´
#[test]
fn a_governed_kind_with_its_derivation_is_clean() {
    let (mut build, owner, region) = one_owner();
    let mint = build.mint(owner, region, "test:unit:alpha", 10);
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    let asset = build.asset(owner, profile, "alpha");
    build.derives(asset, mint);
    assert!(labels::warrant_totality(&build.g, &build.r, adoption()).is_empty());
}

/// (´[LBL-inv:labels:warrant-totality]´): every kind admits at most one
/// warrant species, so a derivation behind a kind outside K is the mirror
/// failure — the two spaces are disjoint by construction.
///
/// A derivation behind an authored kind is the mirror failure, the two spaces being disjoint.
/// ´claim:judgments:the-two-warrant-spaces-are-disjoint´
#[test]
fn a_derivation_behind_an_authored_kind_is_the_species_failure() {
    let (mut build, owner, region) = one_owner();
    let mint = build.mint(owner, region, "sig:one:alpha", 10);
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    let asset = build.asset(owner, profile, "alpha");
    build.derives(asset, mint);
    let found = labels::warrant_totality(&build.g, &build.r, adoption());
    assert_eq!(rules(&found), vec!["label-warrant-species"]);
}

/// (´dec:lint:staged-profiles´): a staged profile governs nothing, so its
/// kind stays reserved-but-ungoverned and a bare occurrence of it is the
/// hard failure by that clause rather than by the missing derivation.
///
/// A staged profile governs nothing, so its kind fails as reserved-but-ungoverned.
/// ´claim:judgments:a-staged-kind-is-ungoverned´
#[test]
fn a_staged_profiles_kind_is_ungoverned_not_underived() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "mod:module:alpha", 10);
    let found = labels::warrant_totality(&build.g, &build.r, module_staged());
    assert_eq!(rules(&found), vec!["label-kind-ungoverned"]);
}

/// (´[LBL-inv:labels:warrant-totality]´): once the profile is in force the
/// same bare mint fails by the other arm — the kind is governed, so what the
/// mint lacks is its derivation.
///
/// Once the profile is in force the same bare mint fails for lacking its derivation instead.
/// ´claim:judgments:the-arm-changes-when-the-profile-enters´
#[test]
fn a_governed_kinds_bare_mint_is_underived_not_ungoverned() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "mod:module:alpha", 10);
    let found = labels::warrant_totality(&build.g, &build.r, adoption());
    assert_eq!(rules(&found), vec!["label-warrant-missing"]);
}

/// (´dec:lint:staged-profiles´): no inventory judgment runs over a staged
/// profile, whatever the graph holds beside it.
///
/// No inventory judgment runs over a staged profile, whatever the graph holds beside it.
/// ´claim:judgments:a-staged-profile-is-not-judged´
#[test]
fn a_staged_profile_is_judged_not_at_all() {
    let (mut build, owner, _) = one_owner();
    let profile = build.profile(
        "rust-test",
        "test",
        ProfileStatus::Staged {
            enters_when: Box::from("the first register generation lands"),
        },
    );
    build.asset(owner, profile, "alpha");
    assert!(labels::inventory(&build.g, &build.r).is_empty());
}

/// (´[LBL-inv:labels:inventory]´): every asset of the census carrying
/// exactly its label, and no label without an asset, is the clean case.
///
/// A bijection between census and carried labels is the clean case.
/// ´claim:judgments:a-bijection-is-clean´
#[test]
fn a_bijection_between_census_and_carried_labels_is_clean() {
    let (mut build, owner, region) = one_owner();
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    for (identifier, text, at) in [
        ("alpha", "test:unit:alpha", 10),
        ("beta", "test:unit:beta", 40),
    ] {
        let mint = build.mint(owner, region, text, at);
        let asset = build.asset(owner, profile, identifier);
        build.derives(asset, mint);
    }
    assert!(labels::inventory(&build.g, &build.r).is_empty());
}

/// (´[LBL-inv:labels:inventory]´): a covered asset carrying no label of its
/// profile's kind at the standard place.
///
/// An asset with no mint has no register row to point at, so it is located at
/// itself where the graph holds its source, and reported unlocated where it
/// does not — as here, the fixture building assets without one. Reported and
/// unlocated beats dropped (´sig:lint:node-weights´).
///
/// A covered asset carrying no label of its profile's kind fails.
/// ´claim:judgments:an-uncarried-asset-fails´
#[test]
fn a_covered_asset_carrying_no_label_fails() {
    let (mut build, owner, _) = one_owner();
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    build.asset(owner, profile, "alpha");
    let found = labels::inventory(&build.g, &build.r);
    assert_eq!(rules(&found), vec!["label-inventory-uncarried"]);
    assert_eq!(found[0].primary.path, PathBuf::new());
    assert!(found[0].message.contains("alpha"));
}

/// (´[LBL-inv:labels:inventory]´): "exactly one label of p's kind" refuses
/// two as firmly as none.
///
/// Exactly one label refuses two as firmly as none.
/// ´claim:judgments:two-labels-refuse-like-none´
#[test]
fn a_covered_asset_carrying_two_labels_fails() {
    let (mut build, owner, region) = one_owner();
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    let one = build.mint(owner, region, "test:unit:alpha", 10);
    let other = build.mint(owner, region, "test:unit:beta", 40);
    let asset = build.asset(owner, profile, "alpha");
    build.derives(asset, one);
    build.derives(asset, other);
    let inventory = labels::inventory(&build.g, &build.r);
    let found = rules(&inventory);
    assert!(found.contains(&"label-inventory-repeated"), "{found:?}");
}

/// (´[LBL-inv:labels:inventory]´): the derivation is injective, and a
/// collision is a naming defect of the assets — surfaced as such, naming
/// both.
///
/// A derivation collision is a naming defect of the assets, surfaced naming both.
/// ´claim:judgments:a-derivation-collision-names-both´
#[test]
fn two_assets_deriving_one_label_names_both() {
    let (mut build, owner, region) = one_owner();
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    let mint = build.mint(owner, region, "test:unit:alpha", 10);
    let one = build.asset(owner, profile, "alpha");
    let other = build.asset(owner, profile, "Alpha");
    build.derives(one, mint);
    build.derives(other, mint);
    let found = labels::inventory(&build.g, &build.r);
    let collision = found
        .iter()
        .find(|one| one.rule.as_str() == "label-inventory-collision")
        .expect("a collision is reported");
    assert_eq!(collision.related.len(), 1, "both assets are named");
    assert!(collision.related[0].note.contains("Alpha"));
}

/// (´[LBL-inv:labels:inventory]´): no label of p's kind occurs without a
/// covered asset — labels do not outlive what they name.
///
/// No label of a profile's kind occurs without a covered asset.
/// ´claim:judgments:a-label-does-not-outlive-its-asset´
#[test]
fn a_label_of_a_governed_kind_with_no_asset_is_the_orphan() {
    let (mut build, owner, region) = one_owner();
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    build.mint(owner, region, "test:unit:orphan", 10);
    let mint = build.mint(owner, region, "test:unit:alpha", 40);
    let asset = build.asset(owner, profile, "alpha");
    build.derives(asset, mint);
    let inventory = labels::inventory(&build.g, &build.r);
    assert_eq!(rules(&inventory), vec!["label-inventory-orphan"]);
}

/// (´[LBL-inv:labels:inventory]´): the invariant is "within each owner", so
/// two owners deriving one label text collide with nothing.
///
/// The inventory is checked within each owner, so two owners deriving one text collide with nothing.
/// ´claim:judgments:the-inventory-is-per-owner´
#[test]
fn the_inventory_is_checked_within_each_owner() {
    let mut build = Build::new();
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    for (id, path) in [("pkg.one", "one/doc.md"), ("pkg.other", "other/doc.md")] {
        let owner = build.owner(id, &[]);
        let source = build.source(owner, path);
        let region = build.region(source, false);
        let mint = build.mint(owner, region, "test:unit:alpha", 10);
        let asset = build.asset(owner, profile, "alpha");
        build.derives(asset, mint);
    }
    assert!(labels::inventory(&build.g, &build.r).is_empty());
}

/// (´[LBL-inv:labels:generated-compliance]´): an authored region is no
/// subject of this clause, whatever stands in it.
///
/// An authored region is no subject of the generated-compliance clause.
/// ´claim:judgments:an-authored-region-is-not-generated´
#[test]
fn an_authored_regions_occurrences_are_not_judged_here() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    build.citation(region, "sig:one:missing", None, 60);
    assert!(labels::generated_compliance(&build.g, &build.r, adoption()).is_empty());
}

/// (´[LBL-inv:labels:generated-compliance]´): a generated mint of a kind
/// outside K stands on its authorship like any other.
///
/// "An authorship a generator transcribes from the record of the authors'
/// choice is that choice still": generation is a fact about the pen, and
/// warrants attach to no pen. Demanding a derivation here would demand the
/// one warrant an authored kind does not admit.
///
/// A generated mint of an authored kind stands on its authorship, generation being a fact about the pen.
/// ´claim:judgments:a-generated-authored-mint-is-clean´
#[test]
fn f3_a_generated_mint_of_an_authored_kind_is_clean() {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &[]);
    let source = build.source(owner, "one/register.md");
    let region = build.region(source, true);
    build.mint(owner, region, "sig:one:transcribed", 10);
    assert!(
        labels::generated_compliance(&build.g, &build.r, adoption()).is_empty(),
        "an authored kind is warrant-totality's business, not this clause's"
    );
}

/// (´[LBL-inv:labels:generated-compliance]´): and a reserved kind beside it
/// in the same region still fails, so the narrowing narrows and never
/// silences.
///
/// A reserved kind beside it in one region still fails, so the narrowing never silences.
/// ´claim:judgments:the-narrowing-does-not-silence´
#[test]
fn f3_a_reserved_kind_in_the_same_generated_region_still_fails() {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &[]);
    let source = build.source(owner, "one/register.md");
    let region = build.region(source, true);
    build.mint(owner, region, "sig:one:transcribed", 10);
    build.mint(owner, region, "test:unit:alpha", 40);
    assert_eq!(
        rules(&labels::generated_compliance(
            &build.g,
            &build.r,
            adoption()
        )),
        vec!["label-generated-unwarranted"]
    );
}

/// (´[LBL-inv:labels:generated-compliance]´): a generated mint of a kind in
/// K stands on a derivation, that being the only warrant its kind admits.
///
/// A generated mint of a reserved kind stands on a derivation or on nothing at all.
/// ´claim:judgments:a-generated-reserved-mint-needs-its-derivation´
#[test]
fn a_generated_mint_with_no_derivation_fails() {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &[]);
    let source = build.source(owner, "one/register.md");
    let region = build.region(source, true);
    build.mint(owner, region, "test:unit:alpha", 10);
    assert_eq!(
        rules(&labels::generated_compliance(
            &build.g,
            &build.r,
            adoption()
        )),
        vec!["label-generated-unwarranted"]
    );
}

/// (´[LBL-inv:labels:generated-compliance]´): a generated mint with its
/// derivation is an occurrence in full.
///
/// (´claim:judgments:a-generated-reserved-mint-needs-its-derivation´)
#[test]
fn a_generated_mint_with_its_derivation_is_clean() {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &[]);
    let source = build.source(owner, "one/register.md");
    let region = build.region(source, true);
    let mint = build.mint(owner, region, "test:unit:alpha", 10);
    let profile = build.profile("rust-test", "test", ProfileStatus::Effective);
    let asset = build.asset(owner, profile, "alpha");
    build.derives(asset, mint);
    assert!(labels::generated_compliance(&build.g, &build.r, adoption()).is_empty());
}

/// (´[LBL-inv:labels:generated-compliance]´): an unresolvable span in
/// generated output is a generator defect.
///
/// An unresolvable span in generated output is a generator defect.
/// ´claim:judgments:an-unresolvable-generated-span-is-a-defect´
#[test]
fn a_generated_citation_resolving_nowhere_is_a_generator_defect() {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &[]);
    let source = build.source(owner, "one/register.md");
    let region = build.region(source, true);
    let citation = build.citation(region, "sig:one:missing", None, 60);
    build.resolve(citation, owner, "sig:one:missing");
    assert_eq!(
        rules(&labels::generated_compliance(
            &build.g,
            &build.r,
            adoption()
        )),
        vec!["label-generated-dangling"]
    );
}

/// (´[LBL-inv:labels:generated-compliance]´): a generated citation resolves
/// as every citation must, and then it is clean.
///
/// (´claim:judgments:an-unresolvable-generated-span-is-a-defect´)
#[test]
fn a_generated_citation_that_resolves_is_clean() {
    let mut build = Build::new();
    let owner = build.owner("pkg.one", &[]);
    let authored = build.source(owner, "one/doc.md");
    let authored = build.region(authored, false);
    build.mint(owner, authored, "sig:one:alpha", 10);
    let source = build.source(owner, "one/register.md");
    let region = build.region(source, true);
    let citation = build.citation(region, "sig:one:alpha", None, 60);
    build.resolve(citation, owner, "sig:one:alpha");
    assert!(labels::generated_compliance(&build.g, &build.r, adoption()).is_empty());
}

/// (´[LBL-inf:labels:anchor-harvest]´): the domain is empty in this corpus,
/// and an empty domain passes vacuously rather than by absence.
///
/// An empty domain passes vacuously rather than by absence.
/// ´claim:judgments:an-empty-domain-passes-vacuously´
#[test]
fn the_anchor_harvest_passes_vacuously() {
    let (build, _, _) = one_owner();
    assert!(labels::anchor_harvest(&build.g, adoption()).is_empty());
}

/// (´[LBL-inf:labels:anchor-harvest]´): the check that is not absent — an
/// `Anchors` edge where no index is designated is a finding, which is what
/// makes the vacuous pass mean something.
///
/// An anchor edge where no index is designated is a finding, which is what makes a vacuous pass mean something.
/// ´claim:judgments:an-undesignated-anchor-fails´
#[test]
fn an_anchor_with_no_designation_fails() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    let carried = build.label_node(owner, "sig:one:alpha");
    let source = build.source(owner, "one/index.md");
    build.g.add_edge(source, carried, EdgeW::Anchors);
    assert_eq!(
        rules(&labels::anchor_harvest(&build.g, adoption())),
        vec!["anchor-undesignated"]
    );
}

/// (´[LBL-inf:labels:synthetic-citation]´): `[typed-data]` designates no
/// class, so the domain is empty and the judgment passes vacuously.
///
/// (´claim:judgments:an-empty-domain-passes-vacuously´)
#[test]
fn the_synthetic_citation_check_passes_vacuously() {
    let (build, _, _) = one_owner();
    assert!(labels::synthetic_citation(&build.g, adoption()).is_empty());
}

fn registry() -> &'static KindRegistry {
    static LOADED: OnceLock<KindRegistry> = OnceLock::new();
    LOADED.get_or_init(|| {
        let path = adoption().registry_document();
        let text =
            std::fs::read_to_string(root().join(&path)).expect("the registry document is readable");
        let source = SourceFile {
            path,
            owner: OwnerId::new("pkg.cogra-linter"),
            language: Some(Language::new("markdown")),
            generated: false,
            bytes: text.clone().into_bytes(),
        };
        let parsed = frontend_md::parse(&source, adoption()).expect("the registry parses");
        KindRegistry::from_markdown(&parsed, &text, adoption())
            .expect("the registry document is its own fixture")
    })
}

/// (´[KND-judg:kinds:head-validation]´): out-degree one over `ValidatesAs`
/// is a validated head.
///
/// A head validating exactly once is clean.
/// ´claim:judgments:a-head-validating-once-is-clean´
#[test]
fn a_head_validating_once_is_clean() {
    let (mut build, _, region) = one_owner();
    let head = build.head(region, "Convention", "conv", 10);
    build.pair(head, "Convention", "conv");
    assert!(kinds::head_validation(&build.g, registry()).is_empty());
}

/// (´[KND-judg:kinds:head-validation]´): zero is an uncatalogued pair — an
/// edge with no target, which is why the pairs are nodes.
///
/// A head validating nowhere is an uncatalogued pair.
/// ´claim:judgments:an-unvalidated-head-is-uncatalogued´
#[test]
fn a_head_validating_nowhere_is_uncatalogued() {
    let (mut build, _, region) = one_owner();
    build.head(region, "Frobnication", "conv", 10);
    let found = kinds::head_validation(&build.g, registry());
    assert_eq!(rules(&found), vec!["kind-head-uncatalogued"]);
    assert!(found[0].message.contains("Frobnication"));
}

/// (´dec:lint:head-recognition´): matching is case-exact, so a head whose
/// only defect is capitalization lands in the uncatalogued class and its
/// message names the spelling the catalogue carries.
///
/// Head matching is case-exact, and a miscapitalized head is named against the catalogue's spelling.
/// ´claim:judgments:head-matching-is-case-exact´
#[test]
fn a_miscapitalized_head_is_uncatalogued_and_named() {
    let (mut build, _, region) = one_owner();
    build.head(region, "convention", "conv", 10);
    let found = kinds::head_validation(&build.g, registry());
    assert_eq!(rules(&found), vec!["kind-head-uncatalogued"]);
}

/// (´[KND-def:kinds:presentation-reduction]´): a head whose reduction
/// stopped at one of its bounds gets its own rule, because the two failures
/// are answered in different places — an uncatalogued head at the registry,
/// this one at the head — and the finding names the bound rather than the
/// catalogue nothing consulted.
///
/// A head whose reduction stopped at a bound carries its own rule and names the bound.
/// ´claim:judgments:a-bounded-reduction-has-its-own-rule´
#[test]
fn f9_a_head_beyond_the_reduction_bounds_carries_its_own_rule() {
    let (mut build, _, region) = one_owner();
    build.head(
        region,
        "Main Key Toy Working Running Convention",
        "conv",
        10,
    );
    let found = kinds::head_validation(&build.g, registry());
    assert_eq!(rules(&found), vec!["kind-head-beyond-reduction-bounds"]);
    assert!(
        found[0].message.contains("devices"),
        "the finding names the bound: {}",
        found[0].message
    );
    assert!(
        !found[0].message.contains("carries no pair"),
        "and never blames the catalogue: {}",
        found[0].message
    );
}

/// (´[KND-judg:kinds:head-validation]´): two is an ambiguous reduction.
///
/// A head validating twice is an ambiguous reduction.
/// ´claim:judgments:a-twice-validated-head-is-ambiguous´
#[test]
fn a_head_validating_twice_is_ambiguous() {
    let (mut build, _, region) = one_owner();
    let head = build.head(region, "Main Convention", "conv", 10);
    build.pair(head, "Convention", "conv");
    build.pair(head, "Convention*", "conv");
    let found = kinds::head_validation(&build.g, registry());
    assert_eq!(rules(&found), vec!["kind-head-ambiguous"]);
    assert!(found[0].message.contains('2'));
}

/// (´[ARCH-dec:linter:registry-as-data]´): the verdict is the edges', and
/// the registry supplies only the words — so a head the harvest validated
/// stays validated whatever a second call to `validate` would say.
///
/// The verdict is the graph's and the registry supplies only the words.
/// ´claim:judgments:the-verdict-is-the-graphs´
#[test]
fn the_edges_carry_the_verdict_and_the_registry_the_words() {
    let (mut build, _, region) = one_owner();
    let head = build.head(region, "Frobnication", "conv", 10);
    build.pair(head, "Frobnication", "conv");
    assert!(kinds::head_validation(&build.g, registry()).is_empty());
}

/// (´dec:lint:registry-bootstrap´): with no registry the label judgments run
/// normally and one diagnostic names kind validation as suppressed, counting
/// the heads it did not validate.
///
/// With no registry one diagnostic names kind validation as suppressed and counts the heads.
/// ´claim:judgments:a-suppression-names-itself´
#[test]
fn a_suppressed_registry_names_itself_and_counts_the_heads() {
    let (mut build, _, region) = one_owner();
    build.head(region, "Convention", "conv", 10);
    build.head(region, "Decision", "dec", 60);
    let found = judge::judge_all(&build.g, &build.r, adoption(), None);
    let suppressed = found
        .iter()
        .find(|one| one.rule.as_str() == "kind-validation-suppressed")
        .expect("the suppression is named");
    assert!(suppressed.message.contains('2'), "{}", suppressed.message);
    assert_eq!(
        suppressed.primary.path,
        adoption().registry_document(),
        "the finding sits on the document that would not parse"
    );
}

/// (´dec:lint:registry-bootstrap´): the label judgments run whether or not
/// the registry parsed — the registry document is linted first by the rules
/// that need no kinds.
///
/// The label judgments run whether or not the registry parsed.
/// ´claim:judgments:the-label-judgments-need-no-registry´
#[test]
fn the_label_judgments_run_without_a_registry() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 10);
    build.mint(owner, region, "sig:one:alpha", 90);
    let found = judge::judge_all(&build.g, &build.r, adoption(), None);
    assert!(rules(&found).contains(&"label-duplicate-mint"));
}

/// (´sig:lint:judgment-api´): with a registry, head validation runs and no
/// suppression is claimed.
///
/// With a registry, head validation runs and no suppression is claimed.
/// ´claim:judgments:a-parsed-registry-claims-no-suppression´
#[test]
fn a_parsed_registry_validates_heads_and_claims_no_suppression() {
    let (mut build, _, region) = one_owner();
    let head = build.head(region, "Convention", "conv", 10);
    build.pair(head, "Convention", "conv");
    let found = judge::judge_all(&build.g, &build.r, adoption(), Some(registry()));
    assert!(found.is_empty(), "{found:?}");
}

/// (´sig:lint:diagnostic-api´): a judgment leaves line, column, and
/// enforcement unset, and stamping fills all three from the sources the run
/// entry holds anyway.
///
/// Stamping fills the line, column, and enforcement a judgment leaves unset.
/// ´claim:judgments:stamping-fills-what-a-judgment-cannot-know´
#[test]
fn stamping_fills_what_a_judgment_cannot_know() {
    let mut build = Build::new();
    let owner = build.owner("pkg.linter", &[]);
    let source = build.source(owner, "crates/cogra-linter/docs/design.md");
    let region = build.region(source, false);
    build.mint(owner, region, "sig:one:alpha", 8);
    build.mint(owner, region, "sig:one:alpha", 8);
    let mut found = labels::unique_mint(&build.g, &build.r);
    assert_eq!((found[0].primary.line, found[0].primary.column), (0, 0));
    assert_eq!(found[0].enforcement, Enforcement::Advisory);

    let mut sources = std::collections::BTreeMap::new();
    sources.insert(
        PathBuf::from("crates/cogra-linter/docs/design.md"),
        Vec::from("one\ntwo\nthree\n"),
    );
    judge::stamp(&mut found, &sources, adoption());
    assert_eq!((found[0].primary.line, found[0].primary.column), (3, 1));
    assert_eq!(
        found[0].enforcement,
        Enforcement::Failing,
        "the linter's docs tree is the failing set"
    );
}

/// (´dec:lint:enforcement-partition´): a finding about the adoption data
/// rather than about a source keeps its zeros, because no source's bytes
/// locate it.
///
/// A finding about the adoption data rather than about a source keeps its zeros.
/// ´claim:judgments:a-sourceless-finding-keeps-its-zeros´
#[test]
fn a_finding_with_no_source_keeps_its_zeros() {
    let (mut build, owner, region) = one_owner();
    build.mint(owner, region, "sig:one:alpha", 8);
    build.mint(owner, region, "sig:one:alpha", 8);
    let mut found = labels::unique_mint(&build.g, &build.r);
    judge::stamp(&mut found, &std::collections::BTreeMap::new(), adoption());
    assert_eq!((found[0].primary.line, found[0].primary.column), (0, 0));
}

/// (´conv:lint:finding-or-error´): no judgment returns `Result`, and an
/// empty list is the positive answer — asserted over the whole surface at
/// once, so a judgment added later inherits the shape.
///
/// No judgment returns an error, and an empty list is the positive answer.
/// ´claim:judgments:an-empty-list-is-the-positive-answer´
#[test]
fn every_judgment_answers_an_empty_corpus_with_an_empty_list() {
    let g = Corpus::new();
    let r = Registries::new();
    assert!(labels::unique_mint(&g, &r).is_empty());
    assert!(labels::total_resolution(&g, &r).is_empty());
    assert!(labels::warrant_totality(&g, &r, adoption()).is_empty());
    assert!(labels::inventory(&g, &r).is_empty());
    assert!(labels::generated_compliance(&g, &r, adoption()).is_empty());
    assert!(labels::anchor_harvest(&g, adoption()).is_empty());
    assert!(labels::synthetic_citation(&g, adoption()).is_empty());
    assert!(kinds::head_validation(&g, registry()).is_empty());
}

/// (´sig:lint:diagnostic-api´): no rule identifier is label-shaped, because
/// `lint` is a reserved kind no profile governs.
///
/// (´claim:diagnostics:no-rule-identifier-is-label-shaped´)
#[test]
fn no_judgment_rule_identifier_is_label_shaped() {
    for rule in labels::RULES
        .iter()
        .chain(&kinds::RULES)
        .chain(&judge::RULES)
        .chain(&judge::claims::RULES)
        .chain(&judge::freshness::RULES)
        .chain(&cogra_linter::registers::RULES)
        .chain(&cogra_linter::RULES)
    {
        assert!(
            !rule.as_str().contains(':'),
            "the rule identifier {rule} is label-shaped"
        );
    }
}
