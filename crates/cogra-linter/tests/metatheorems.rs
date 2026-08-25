//! The metatheorems this slice owes, one property per theorem, named after
//! it (´conv:lint:metatheorems-as-tests´), (´tab:lint:metatheorem-tests´).
//!
//! Four rows of that table fall here — order independence, the diagnostic
//! order, presentation invariance, and warrant lapse — and each is
//! universally quantified over generated corpora, which is what a property
//! framework is for and what a vector table cannot express. The remaining
//! rows belong to earlier slices, which discharged them, or to slice 6.
//!
//! # What is owed later, and why
//!
//! (´[LBL-metathm:labels:no-self-support]´) is stated over a *designated*
//! citation index or a generated label register, and this corpus has
//! neither: `[citation-indexes]` designates nothing and carries its
//! designations as free text with no upstream owner a `PresentedSet` could
//! be built from, and the first label register is generated in slice 6. The
//! half that is exercisable now — that a generated region's occurrences are
//! occurrences in full — is asserted below; the exclusion half is owed to
//! slice 6, where the generator that makes a presented set exist lands.
//!
//! (´dec:lint:one-generator´) is likewise slice 6's: there is no generator
//! to be idempotent yet.
//!
//! # No regular expressions in the generators
//!
//! proptest's string strategies are regular-expression driven, and no
//! regular expression is admissible anywhere this crate builds
//! (´[ARCH-dec:linter:no-regex]´). Every generator here is a pure
//! combinator over a small alphabet, as slice 2's already are.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use petgraph::stable_graph::NodeIndex;
use proptest::prelude::*;

use cogra_linter::frontend::RegionKind;
use cogra_linter::graph::{
    CitationNode, Corpus, EdgeW, LabelNode, MintNode, NodeW, OwnerNode, RegionNode, Registries,
    SourceNode,
};
use cogra_linter::judge::labels;
use cogra_linter::scan::{Label, Prefix, Syntax};
use cogra_linter::{Adoption, ByteSpan, Diagnostic, Language, OwnerId, SourceFile};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::load(&root().join("corpus-adoption.toml")).expect("the adoption data load")
    })
}

/// A small alphabet, so that collisions between generated names are common
/// enough to exercise duplicate minting and cross-owner resolution.
const ALPHABET: [char; 4] = ['a', 'b', 'c', 'd'];

fn word() -> impl Strategy<Value = String> {
    proptest::collection::vec(proptest::sample::select(ALPHABET.to_vec()), 1..3)
        .prop_map(|letters| letters.into_iter().collect())
}

/// A label of an authored kind, so that no generated corpus trips the
/// warrant-totality clause for reasons the property is not about.
fn any_label() -> impl Strategy<Value = String> {
    (word(), word()).prop_map(|(area, name)| format!("sig:{area}:{name}"))
}

/// One generated document: its path, and the occurrences it carries.
#[derive(Clone, Debug)]
struct Document {
    tree: usize,
    stem: String,
    mints: Vec<String>,
    citations: Vec<String>,
}

impl Document {
    fn path(&self) -> PathBuf {
        PathBuf::from(format!("docs/{}/{}.md", self.tree, self.stem))
    }

    /// The document as one paragraph: bare occurrences mint, parenthesized
    /// ones cite.
    fn tight(&self) -> String {
        let mut text = String::from("Generated.\n\n");
        for label in &self.mints {
            text.push_str(&format!("It mints `{label}` here.\n\n"));
        }
        for label in &self.citations {
            text.push_str(&format!("It cites (`{label}`) here.\n\n"));
        }
        text
    }

    /// The same document re-formed: every label value preserved, every
    /// occurrence's presentation moved — wrapped across lines, re-ordered
    /// inside its paragraph, and re-worded around
    /// (´[LBL-metathm:labels:presentation-invariance]´).
    fn reformed(&self) -> String {
        let mut text = String::from("Generated,\nre-formed.\n\n");
        for label in &self.citations {
            text.push_str(&format!("Cited\nhere:\n(`{label}`).\n\n"));
        }
        for label in &self.mints {
            text.push_str(&format!("> Minted below.\n>\n> `{label}`\n\n"));
        }
        text
    }
}

fn any_document() -> impl Strategy<Value = Document> {
    (
        0usize..3,
        word(),
        proptest::collection::vec(any_label(), 0..3),
        proptest::collection::vec(any_label(), 0..3),
    )
        .prop_map(|(tree, stem, mints, citations)| Document {
            tree,
            stem,
            mints,
            citations,
        })
}

fn any_corpus() -> impl Strategy<Value = Vec<Document>> {
    proptest::collection::vec(any_document(), 1..5)
}

/// The generated corpus as sources, each owned by Ω's first match.
fn sources(corpus: &[Document], reformed: bool) -> Vec<SourceFile> {
    let mut seen = BTreeSet::new();
    corpus
        .iter()
        .filter(|one| seen.insert(one.path()))
        .map(|one| SourceFile {
            path: one.path(),
            owner: adoption().partition.owner_for(&one.path()),
            language: Some(Language::new("markdown")),
            generated: false,
            bytes: if reformed {
                one.reformed().into_bytes()
            } else {
                one.tight().into_bytes()
            },
        })
        .collect()
}

/// The rendered findings, which is what "byte-identical output" means before
/// there is a renderer (´dec:lint:diagnostic-format´).
fn rendered(findings: &[Diagnostic]) -> String {
    findings
        .iter()
        .map(|one| {
            format!(
                "{}:{}:{}: {} {}: {}\n",
                one.primary.path.display(),
                one.primary.line,
                one.primary.column,
                match one.severity {
                    cogra_linter::Severity::Error => "error",
                    cogra_linter::Severity::Warning => "warning",
                },
                one.rule,
                one.message
            )
        })
        .collect()
}

/// The minting registry as values rather than as node indices: which owner
/// carries which label, which is the registry's whole content
/// (´[LBL-inv:labels:two-pass]´).
fn minted(run: &cogra_linter::Run) -> BTreeSet<(String, String)> {
    run.registries
        .mints
        .keys()
        .filter_map(|(owner, label)| match run.graph.node_weight(*owner) {
            Some(NodeW::Owner(weight)) => {
                Some((weight.id.as_str().to_owned(), label.as_str().to_owned()))
            }
            _ => None,
        })
        .collect()
}

/// The generators produce occurrences, which is what makes every property
/// above about something.
///
/// A property quantified over corpora that carry nothing passes for the
/// wrong reason, and this vector is the guard against that: one generated
/// document, harvested, with its mint and its citation both in the graph.
///
/// The one finding a fixture corpus always carries is the kind-validation
/// suppression: the registry document is not among these two files, and
/// (´dec:lint:registry-bootstrap´) says so loudly rather than treating every
/// head as valid.
#[test]
fn the_generated_documents_carry_occurrences() {
    let document = Document {
        tree: 0,
        stem: String::from("ab"),
        mints: vec![String::from("sig:ab:cd")],
        citations: vec![String::from("sig:ab:cd")],
    };
    for reformed in [false, true] {
        let run = cogra_linter::check_sources(
            adoption(),
            sources(std::slice::from_ref(&document), reformed),
        );
        assert_eq!(run.registries.mints.len(), 1, "reformed: {reformed}");
        assert_eq!(
            cogra_linter::nodes_of(&run.graph, cogra_linter::NodeKind::Citation).count(),
            1,
            "reformed: {reformed}",
        );
        let rules: Vec<&str> = run.findings.iter().map(|one| one.rule.as_str()).collect();
        assert_eq!(
            rules,
            vec!["kind-validation-suppressed"],
            "reformed {reformed}: {:?}",
            run.findings
        );
    }
}

proptest! {
    /// (´[LBL-metathm:labels:order-independence]´): over generated corpora
    /// and shuffled traversal orders, the rendered output is byte-identical.
    ///
    /// The staging is what makes this hold rather than a sort afterwards:
    /// the run entry orders its sources by path whatever order they arrive
    /// in, so a shuffled traversal reaches an identical harvest and not one
    /// that has to be repaired.
    #[test]
    fn resolution_is_independent_of_traversal_order(
        corpus in any_corpus(),
        rotate in 0usize..8,
    ) {
        let forward = sources(&corpus, false);
        let mut shuffled = forward.clone();
        shuffled.reverse();
        let held = shuffled.len();
        if held > 0 {
            shuffled.rotate_left(rotate % held);
        }
        let one = cogra_linter::check_sources(adoption(), forward);
        let other = cogra_linter::check_sources(adoption(), shuffled);
        prop_assert_eq!(rendered(&one.findings), rendered(&other.findings));
        prop_assert_eq!(minted(&one), minted(&other));
    }

    /// (´conv:lint:diagnostic-order´): two runs over one generated corpus
    /// emit the same sequence.
    #[test]
    fn two_runs_emit_the_same_sequence(corpus in any_corpus()) {
        let one = cogra_linter::check_sources(adoption(), sources(&corpus, false));
        let other = cogra_linter::check_sources(adoption(), sources(&corpus, false));
        prop_assert_eq!(rendered(&one.findings), rendered(&other.findings));
    }

    /// (´conv:lint:diagnostic-order´): the comparator is a total order —
    /// antisymmetric, transitive, and total on the corpus, two diagnostics
    /// with the same path, offset, and rule being the same finding.
    #[test]
    fn the_diagnostic_order_is_total(corpus in any_corpus()) {
        let run = cogra_linter::check_sources(adoption(), sources(&corpus, false));
        let findings = &run.findings;
        for (at, one) in findings.iter().enumerate() {
            for other in &findings[at..] {
                prop_assert_eq!(one.cmp(other), other.cmp(one).reverse());
                for third in &findings[at..] {
                    if one <= other && other <= third {
                        prop_assert!(one <= third);
                    }
                }
            }
        }
        prop_assert!(findings.windows(2).all(|pair| pair[0] <= pair[1]));
    }

    /// (´[LBL-metathm:labels:presentation-invariance]´): a re-forming that
    /// preserves every label value changes presentation, not denotation —
    /// the registries and every derivation over them are unchanged.
    ///
    /// The spans move, so the findings' offsets move with them; what the
    /// theorem fixes is the registries, and that is what is compared.
    #[test]
    fn a_re_forming_that_preserves_labels_preserves_the_registries(corpus in any_corpus()) {
        let before = cogra_linter::check_sources(adoption(), sources(&corpus, false));
        let after = cogra_linter::check_sources(adoption(), sources(&corpus, true));
        prop_assert_eq!(minted(&before), minted(&after));
        prop_assert_eq!(
            before.registries.mints.len(),
            after.registries.mints.len(),
            "the same labels mint, however the occurrences are laid out",
        );
        let unresolved = |run: &cogra_linter::Run| -> usize {
            run.findings
                .iter()
                .filter(|one| one.rule.as_str() == "label-unresolved-citation")
                .count()
        };
        prop_assert_eq!(unresolved(&before), unresolved(&after));
    }

    /// (´sig:lint:index-maps´) over generated corpora harvested by the run
    /// entry rather than by hand: every key of `mints` is a key of `labels`.
    #[test]
    fn every_minted_label_is_a_carried_label(corpus in any_corpus()) {
        let run = cogra_linter::check_sources(adoption(), sources(&corpus, false));
        for key in run.registries.mints.keys() {
            prop_assert!(run.registries.labels.contains_key(key));
        }
    }
}

/// One owner carrying one covered asset, its derived mint, and the citations
/// of it — the fixture every warrant-lapse transition starts from.
struct Lapse {
    g: Corpus,
    r: Registries,
    owner: NodeIndex,
    other: NodeIndex,
    region: NodeIndex,
}

impl Lapse {
    /// The asset's label as the profile derives it: kind, then the
    /// classification's area, then the transformed identifier
    /// (´[LBL-judg:labels:derivation]´).
    fn derived(area: &str, identifier: &str) -> String {
        format!("test:{area}:{identifier}")
    }

    /// Build the corpus for one state of the asset.
    ///
    /// `owner_of_asset` is which package holds it, `area` its
    /// classification, and `identifier` its bare name — the three facets the
    /// derivation reads and therefore the three a transition can move.
    fn build(
        owner_of_asset: usize,
        area: &str,
        identifier: &str,
        cited: &[(usize, &str)],
    ) -> Lapse {
        let mut g = Corpus::new();
        let mut r = Registries::new();
        let mut owners = Vec::new();
        for (id, prefix) in [("pkg.one", "ONE"), ("pkg.other", "OTH")] {
            let node = g.add_node(NodeW::Owner(OwnerNode {
                id: OwnerId::new(id),
                prefixes: vec![Prefix::parse(prefix).expect("a prefix")],
            }));
            r.owners.insert(OwnerId::new(id), node);
            r.prefixes
                .insert(Prefix::parse(prefix).expect("a prefix"), node);
            owners.push(node);
        }
        let holder = owners[owner_of_asset];
        let source = g.add_node(NodeW::Source(SourceNode {
            path: PathBuf::from("one/src/lib.rs"),
            language: Some(Language::new("rust")),
            generated: false,
        }));
        g.add_edge(holder, source, EdgeW::Owns);
        let region = g.add_node(NodeW::Region(RegionNode {
            kind: RegionKind::Prose,
            span: ByteSpan::new(0, 900),
            participates: true,
            generated: false,
            presents: None,
        }));
        g.add_edge(source, region, EdgeW::Contains);

        let text = Lapse::derived(area, identifier);
        let label = Label::parse(&text).expect("the derivation is well-formed");
        let carried = g.add_node(NodeW::Label(LabelNode {
            label: label.clone(),
        }));
        g.add_edge(holder, carried, EdgeW::Owns);
        let mint = g.add_node(NodeW::Mint(MintNode {
            label: label.clone(),
            span: ByteSpan::new(10, 40),
            syntax: Syntax::Code,
        }));
        g.add_edge(region, mint, EdgeW::Contains);
        g.add_edge(mint, carried, EdgeW::Mints);
        r.record_mint(holder, label, mint, carried);

        let mut lapse = Lapse {
            g,
            r,
            owner: owners[0],
            other: owners[1],
            region,
        };
        for (at, (which, text)) in cited.iter().enumerate() {
            lapse.cite(owners[*which], text, at * 100 + 100);
        }
        lapse
    }

    /// One citation, in the same owner or imported, resolved the way pass 2
    /// resolves it.
    fn cite(&mut self, citing_owner: NodeIndex, text: &str, at: usize) {
        let label = Label::parse(text).expect("a well-formed citation target");
        let imported = citing_owner != self.owner;
        let node = self.g.add_node(NodeW::Citation(CitationNode {
            label: label.clone(),
            prefix: imported.then(|| Prefix::parse("ONE").expect("a prefix")),
            span: ByteSpan::new(at, at + 30),
            syntax: Syntax::Code,
        }));
        let source = self.g.add_node(NodeW::Source(SourceNode {
            path: PathBuf::from(if imported {
                "other/src/lib.rs"
            } else {
                "one/src/doc.rs"
            }),
            language: Some(Language::new("rust")),
            generated: false,
        }));
        self.g.add_edge(citing_owner, source, EdgeW::Owns);
        let region = self.g.add_node(NodeW::Region(RegionNode {
            kind: RegionKind::Prose,
            span: ByteSpan::new(0, 900),
            participates: true,
            generated: false,
            presents: None,
        }));
        self.g.add_edge(source, region, EdgeW::Contains);
        self.g.add_edge(region, node, EdgeW::Contains);
        let _ = self.region;

        let cited = if imported { self.owner } else { citing_owner };
        self.g.add_edge(node, cited, EdgeW::Cites);
        if self.r.mints.contains_key(&(cited, label.clone()))
            && let Some(target) = self.r.labels.get(&(cited, label)).copied()
        {
            self.g.add_edge(node, target, EdgeW::ResolvesTo);
        }
    }

    /// How many citations dangle in this state.
    fn dangling(&self) -> usize {
        labels::total_resolution(&self.g, &self.r)
            .iter()
            .filter(|one| one.rule.as_str() == "label-unresolved-citation")
            .count()
    }
}

/// (´[LBL-metathm:labels:warrant-lapse]´): a derivation lapses when the
/// asset's name changes, and exactly the citations of that facet dangle.
#[test]
fn renaming_an_asset_dangles_the_citations_of_its_name() {
    let cited = [(0, "test:unit:alpha"), (0, "test:unit:beta")];
    let before = Lapse::build(0, "unit", "alpha", &cited);
    assert_eq!(before.dangling(), 1, "beta names no asset in either state");
    let after = Lapse::build(0, "unit", "renamed", &cited);
    assert_eq!(after.dangling(), 2, "the citation of the old name dangles");
}

/// (´[LBL-metathm:labels:warrant-lapse]´): a derivation lapses when the
/// classification changes, and exactly the citations of that facet dangle.
#[test]
fn reclassifying_an_asset_dangles_the_citations_of_its_area() {
    let cited = [(0, "test:unit:alpha")];
    assert_eq!(Lapse::build(0, "unit", "alpha", &cited).dangling(), 0);
    assert_eq!(
        Lapse::build(0, "integration", "alpha", &cited).dangling(),
        1
    );
}

/// (´[LBL-metathm:labels:warrant-lapse]´): moving an asset across packages
/// dangles exactly the imports under the old package's prefix — ownership
/// enters a citation only through the import prefix.
#[test]
fn moving_an_asset_across_packages_dangles_the_imports_under_the_old_prefix() {
    let cited = [(1, "test:unit:alpha")];
    assert_eq!(
        Lapse::build(0, "unit", "alpha", &cited).dangling(),
        0,
        "the import resolves while the asset lives in the prefix's owner"
    );
    assert_eq!(
        Lapse::build(1, "unit", "alpha", &cited).dangling(),
        1,
        "the same import dangles once the asset moved out"
    );
}

/// (´[LBL-metathm:labels:warrant-lapse]´): moving an asset *within* its
/// package lapses nothing — an asset's owner is its package and never its
/// module, so refactoring inside a package moves nothing.
///
/// The move here is a second source under the same owner, which is what a
/// within-package move is and which the derivation never reads
/// (´[LBL-ansatz:labels:path-derivation]´).
#[test]
fn moving_an_asset_within_its_package_lapses_nothing() {
    let cited = [(0, "test:unit:alpha"), (1, "test:unit:alpha")];
    let before = Lapse::build(0, "unit", "alpha", &cited);
    let mut after = Lapse::build(0, "unit", "alpha", &cited);
    let moved = after.g.add_node(NodeW::Source(SourceNode {
        path: PathBuf::from("one/src/elsewhere.rs"),
        language: Some(Language::new("rust")),
        generated: false,
    }));
    after.g.add_edge(after.owner, moved, EdgeW::Owns);
    assert_eq!(before.dangling(), after.dangling());
    assert_eq!(after.dangling(), 0);
    let _ = after.other;
}

/// (´[LBL-metathm:labels:no-self-support]´), exercisable half: a generated
/// occurrence is an occurrence in full — it enters the registries exactly as
/// an authored one does, minting on its warrant or citing like any other.
///
/// The other half — that a generated region participates in nothing it
/// presents — is owed to slice 6 and flagged in this file's header: nothing
/// in this corpus constructs a `PresentedSet`, because no citation index is
/// designated and no label register has been generated yet.
#[test]
fn a_generated_occurrence_enters_the_registries_in_full() {
    let sources = vec![
        SourceFile {
            path: PathBuf::from("docs/gen/register.md"),
            owner: adoption()
                .partition
                .owner_for(Path::new("docs/gen/register.md")),
            language: Some(Language::new("markdown")),
            generated: true,
            bytes: Vec::from("It mints `sig:gen:one` here.\n"),
        },
        SourceFile {
            path: PathBuf::from("docs/gen/body.md"),
            owner: adoption()
                .partition
                .owner_for(Path::new("docs/gen/body.md")),
            language: Some(Language::new("markdown")),
            generated: false,
            bytes: Vec::from("It cites (`sig:gen:one`) here.\n"),
        },
    ];
    let run = cogra_linter::check_sources(adoption(), sources);
    assert!(
        !run.registries.mints.is_empty(),
        "the generated mint is in the registry like any other"
    );
    assert!(
        run.findings
            .iter()
            .all(|one| one.rule.as_str() != "label-unresolved-citation"),
        "the body's citation resolves against the generated mint: {:?}",
        run.findings,
    );
}
