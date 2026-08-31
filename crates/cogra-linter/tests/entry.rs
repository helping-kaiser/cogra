//! The path into the effective profile family (´dec:lint:staged-profiles´).
//!
//! Both profiles are in Π, so everything a profile in force does — the
//! `Derives` warrant the harvest lays, the inventory bijection over it, the
//! warrant-totality arm that reads it — has a subject under the ruled
//! adoption data. The fixtures run it over a handful of sources built here
//! rather than walked.
//!
//! Building the sources is the point: a corpus small enough to state exactly
//! is what lets a test say which warrant runs where. The corpus itself is
//! never touched — what writes, writes into a temporary root of its own.
//! Both profiles are in force under the ruled data, so the staged half of
//! (´dec:lint:staged-profiles´) is held by inverted fixtures: the ruled
//! adoption with a profile put back where it entered from, which is the one
//! way a test can still ask what staging does.
//!
//! Trace convention: every test's doc comment names the clause it traces to.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use petgraph::stable_graph::NodeIndex;

use cogra_linter::graph::{Corpus, EdgeW, NodeKind, NodeW, in_along, nodes_of, out_along};
use cogra_linter::registers::{Freshness, Register, RegisterScope, compare, regenerate_all};
use cogra_linter::{Adoption, Label, Language, OwnerId, ProfileId, Run, SourceFile, check_sources};

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

/// The ruled adoption, which carries both profiles in Π
/// (´dec:lint:staged-profiles´).
fn entered() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        Adoption::from_str(adoption_text(), Path::new("corpus-adoption.toml"))
            .expect("the ruled adoption loads")
    })
}

/// The ruled adoption with every profile put back where it entered from.
///
/// The named regeneration is a step a staged migration takes, and both
/// profiles have taken it. The mechanism outlives those two uses — the next
/// profile whose standard place is a register needs it — so the fixture
/// stages what the ruled data no longer stages, and Π is empty
/// (´dec:lint:staged-profiles´).
fn staged() -> Adoption {
    let text = adoption_text()
        .replace("effective = 2", "effective = 0")
        .replace("status = \"effective\"", "status = \"staged\"");
    Adoption::from_str(&text, Path::new("corpus-adoption.toml"))
        .expect("the condition each profile entered on is recorded beside it")
}

/// The ruled adoption with the module profile alone put back where it entered
/// from, leaving the test profile in Π.
///
/// The module profile is the last one `[profiles]` registers, so the last
/// effective status in the file is its own. Staging exactly one is what lets
/// a test put a staged census and an effective one in the same run
/// (´dec:lint:staged-profiles´).
fn module_staged() -> Adoption {
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
}

/// The owner every fixture source belongs to, and the tree its rule names.
const OWNER: &str = "pkg.l1-standin";

/// Where that owner's label register sits, by the generator's own answer.
const REGISTER: &str = "crates/l1-standin/label-register.md";

fn rust(path: &str, body: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from(path),
        owner: OwnerId::new(OWNER),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from(body),
    }
}

/// The owner's label register, as a committed generated Markdown source.
fn register(bytes: Vec<u8>) -> SourceFile {
    SourceFile {
        path: PathBuf::from(REGISTER),
        owner: OwnerId::new(OWNER),
        language: Some(Language::new("markdown")),
        generated: true,
        bytes,
    }
}

/// One test function, which the test profile's census covers.
fn tested(name: &str) -> String {
    format!("#[test]\nfn {name}() {{}}\n")
}

fn label(text: &str) -> Label {
    Label::parse(text).unwrap_or_else(|why| panic!("{text} is well-formed: {why:?}"))
}

/// Every finding of one rule, spelled for a failure message.
fn of(run: &Run, rule: &str) -> Vec<String> {
    run.findings
        .iter()
        .filter(|one| one.rule.as_str() == rule)
        .map(cogra_linter::render::diagnostic)
        .collect()
}

/// The label register the generator produces for a corpus of `sources`.
///
/// The two-phase shape is the obligation itself: a check over sources with no
/// register generates what the register should hold, and the second check —
/// with exactly those bytes committed — is the check-after-a-write of
/// (´dec:lint:one-generator´).
fn generated_register(sources: Vec<SourceFile>) -> Register {
    generated_register_under(entered(), sources)
}

/// The same, under an adoption a fixture built rather than the ruled one.
fn generated_register_under(a: &Adoption, sources: Vec<SourceFile>) -> Register {
    let before = check_sources(a, sources);
    let mut produced = regenerate_all(&before.graph, &before.registries, a, before.kinds.as_ref())
        .into_iter()
        .filter(|reg| matches!(reg.scope, RegisterScope::LabelRegister { .. }));
    let one = produced.next().expect("one owner's label register");
    assert!(produced.next().is_none(), "one owner, one register");
    assert_eq!(one.path, PathBuf::from(REGISTER));
    one
}

/// A corpus of two test functions and the register that carries their labels.
fn entered_corpus() -> &'static Run {
    static CHECKED: OnceLock<Run> = OnceLock::new();
    CHECKED.get_or_init(|| {
        let sources = || {
            vec![
                rust("crates/l1-standin/src/lib.rs", &tested("alpha")),
                rust("crates/l1-standin/tests/wire.rs", &tested("beta")),
            ]
        };
        let reg = generated_register(sources());
        let mut held = sources();
        held.push(register(reg.bytes));
        check_sources(entered(), held)
    })
}

/// The asset node of one identifier, and the mints it derives.
fn derives(run: &Run, identifier: &str) -> Vec<Label> {
    let asset = asset_of(&run.graph, identifier);
    out_along(&run.graph, asset, EdgeW::Derives)
        .filter_map(|mint| match run.graph.node_weight(mint) {
            Some(NodeW::Mint(weight)) => Some(weight.label.clone()),
            _ => None,
        })
        .collect()
}

fn asset_of(g: &Corpus, identifier: &str) -> NodeIndex {
    nodes_of(g, NodeKind::Asset)
        .find(|node| {
            matches!(g.node_weight(*node),
                Some(NodeW::Asset(weight)) if &*weight.identifier == identifier)
        })
        .unwrap_or_else(|| panic!("{identifier} is a covered asset"))
}

/// (´dec:lint:staged-profiles´): once a profile is effective the harvest lays
/// one `Derives` edge from each covered asset to the mint at the profile's
/// standard place — the owner's generated register, and not the asset's own
/// source.
#[test]
fn an_effective_profile_derives_each_asset_into_its_register() {
    let run = entered_corpus();
    assert_eq!(derives(run, "alpha"), vec![label("test:unit:alpha")]);
    assert_eq!(
        derives(run, "beta"),
        vec![label("test:integration:beta")],
        "the Cargo target the source lies in decides the area"
    );

    let asset = asset_of(&run.graph, "alpha");
    let mint = out_along(&run.graph, asset, EdgeW::Derives)
        .next()
        .expect("the warrant runs to a mint");
    assert_eq!(
        run.graph.node_weight(mint).map(NodeW::kind),
        Some(NodeKind::Mint),
        "asset to mint, never to label"
    );
    assert_eq!(
        cogra_linter::source_of(&run.graph, mint).and_then(|src| {
            match run.graph.node_weight(src) {
                Some(NodeW::Source(weight)) => Some(weight.path.clone()),
                _ => None,
            }
        }),
        Some(PathBuf::from(REGISTER))
    );
}

/// (´sig:lint:index-maps´): the census side of the bijection is recorded as
/// the harvest lays the warrants, keyed as the minting registry is.
#[test]
fn the_derived_registry_holds_every_covered_assets_label() {
    let run = entered_corpus();
    let owner = *run
        .registries
        .owners
        .get(&OwnerId::new(OWNER))
        .expect("the owner is registered");
    let mut held: Vec<String> = run
        .registries
        .derived
        .keys()
        .filter(|(at, _)| *at == owner)
        .map(|(_, one)| one.to_string())
        .collect();
    held.sort();
    assert_eq!(held, ["test:integration:beta", "test:unit:alpha"]);
}

/// (´[LBL-inv:labels:inventory]´): with the register committed, the census
/// and the carried labels stand in a bijection and the clause reports
/// nothing.
#[test]
fn the_inventory_is_clean_when_the_register_carries_every_label() {
    let run = entered_corpus();
    for rule in [
        "label-inventory-uncarried",
        "label-inventory-repeated",
        "label-inventory-collision",
        "label-inventory-orphan",
    ] {
        assert!(of(run, rule).is_empty(), "{rule}: {:?}", of(run, rule));
    }
}

/// (´dec:lint:one-generator´): a check run immediately after the write
/// reports `Current` for the register it wrote, which is what arms the exact
/// byte comparison the day the profile enters Π.
#[test]
fn the_committed_register_is_current_and_the_freshness_clause_is_silent() {
    let run = entered_corpus();
    let produced = regenerate_all(&run.graph, &run.registries, entered(), run.kinds.as_ref());
    let reg = produced
        .iter()
        .find(|one| matches!(one.scope, RegisterScope::LabelRegister { .. }))
        .expect("the register is generated from the completed run");
    let committed = run.sources.get(&PathBuf::from(REGISTER)).map(Vec::as_slice);
    assert_eq!(compare(reg, committed), Freshness::Current);
    assert!(of(run, "register-stale").is_empty());
    assert!(of(run, "register-staged").is_empty());
}

/// (´[LBL-inv:labels:warrant-totality]´): a K-kind mint at the standard place
/// now stands on a derivation, and one away from it stands on none.
#[test]
fn the_warrant_arm_sees_the_derivation_and_still_reports_a_stray_mint() {
    let run = entered_corpus();
    assert!(
        of(run, "label-warrant-missing").is_empty(),
        "every test-kind mint of the register is derived: {:?}",
        of(run, "label-warrant-missing")
    );
    assert!(of(run, "label-kind-ungoverned").is_empty());
    assert!(of(run, "label-generated-unwarranted").is_empty());

    let mut held = vec![
        rust("crates/l1-standin/src/lib.rs", &tested("alpha")),
        rust("crates/l1-standin/tests/wire.rs", &tested("beta")),
    ];
    held.push(SourceFile {
        path: PathBuf::from("crates/l1-standin/src/stray.rs"),
        owner: OwnerId::new(OWNER),
        language: Some(Language::new("rust")),
        generated: false,
        bytes: Vec::from("//! ´test:unit:alpha´\n"),
    });
    let reg = generated_register(held.clone());
    held.push(register(reg.bytes));
    let strayed = check_sources(entered(), held);

    let missing = of(&strayed, "label-warrant-missing");
    assert_eq!(
        missing.len(),
        1,
        "the mint away from the standard place: {missing:?}"
    );
    assert!(missing[0].contains("stray.rs"), "{missing:?}");
    assert_eq!(
        of(&strayed, "label-duplicate-mint").len(),
        1,
        "the register mints the same label, and the two are a duplicate"
    );
}

/// (´[LBL-inv:labels:inventory]´): an asset whose label the standard place
/// does not carry is reported uncarried, which is the clause admitting
/// nothing partial.
#[test]
fn an_asset_missing_from_the_register_is_uncarried() {
    let sources = vec![
        rust("crates/l1-standin/src/lib.rs", &tested("alpha")),
        rust("crates/l1-standin/tests/wire.rs", &tested("beta")),
    ];
    let reg = generated_register(sources.clone());
    let text = String::from_utf8(reg.bytes).expect("a register is text");
    let thinned: String = text
        .lines()
        .filter(|line| !line.contains("test:unit:alpha"))
        .map(|line| format!("{line}\n"))
        .collect();

    let mut held = sources;
    held.push(register(thinned.into_bytes()));
    let run = check_sources(entered(), held);

    let uncarried = of(&run, "label-inventory-uncarried");
    assert_eq!(uncarried.len(), 1, "{uncarried:?}");
    assert!(uncarried[0].contains("alpha"), "{uncarried:?}");
    assert!(
        of(&run, "register-stale").len() == 1,
        "and the register itself is stale against the generator"
    );
}

/// (´[LBL-inv:labels:inventory]´): two covered assets of one owner deriving
/// one label is a naming defect of the assets, and the finding names both.
#[test]
fn two_assets_deriving_one_label_name_each_other() {
    let sources = vec![
        rust("crates/l1-standin/src/lib.rs", &tested("alpha")),
        rust("crates/l1-standin/src/again.rs", &tested("alpha")),
    ];
    let reg = generated_register(sources.clone());
    let mut held = sources;
    held.push(register(reg.bytes));
    let run = check_sources(entered(), held);

    let collisions = of(&run, "label-inventory-collision");
    assert_eq!(collisions.len(), 1, "{collisions:?}");
    let found = run
        .findings
        .iter()
        .find(|one| one.rule.as_str() == "label-inventory-collision")
        .expect("the collision is reported");
    assert_eq!(
        found.related.len(),
        1,
        "the second asset is a related location: {found:?}"
    );
}

/// (´[LBL-inv:labels:inventory]´): a label of the governed kind with no
/// covered asset behind it is an inventory label outliving what it names.
#[test]
fn a_register_row_with_no_asset_is_an_orphan() {
    let sources = vec![rust("crates/l1-standin/src/lib.rs", &tested("alpha"))];
    let reg = generated_register(sources.clone());
    let text = String::from_utf8(reg.bytes).expect("a register is text");
    let widened = format!("{text}| `test:unit:ghost` | ghost |\n");

    let mut held = sources;
    held.push(register(widened.into_bytes()));
    let run = check_sources(entered(), held);

    let orphans = of(&run, "label-inventory-orphan");
    assert_eq!(orphans.len(), 1, "{orphans:?}");
    assert!(orphans[0].contains("test:unit:ghost"), "{orphans:?}");
}

/// (´dec:lint:staged-profiles´): the staged profile carries no `Covers` edge
/// and no `Derives` edge, so a module definition beside a covered test puts
/// nothing of its own in the run.
#[test]
fn a_staged_profile_derives_nothing() {
    let staging = module_staged();
    let body = format!("{}mod inner {{ }}\n", tested("alpha"));
    let sources = vec![rust("crates/l1-standin/src/lib.rs", &body)];
    let reg = generated_register_under(&staging, sources.clone());
    let mut held = sources;
    held.push(register(reg.bytes));
    let run = check_sources(&staging, held);

    let assets: Vec<String> = nodes_of(&run.graph, NodeKind::Asset)
        .filter_map(|node| match run.graph.node_weight(node) {
            Some(NodeW::Asset(weight)) => Some(weight.identifier.to_string()),
            _ => None,
        })
        .collect();
    assert_eq!(
        assets,
        vec![String::from("alpha")],
        "the module definition is covered by nothing"
    );
    let derived: Vec<String> = run
        .registries
        .derived
        .keys()
        .map(|(_, one)| one.to_string())
        .collect();
    assert_eq!(derived, vec![String::from("test:unit:alpha")]);
    assert_eq!(
        run.graph
            .edge_indices()
            .filter(|edge| run.graph.edge_weight(*edge) == Some(&EdgeW::Derives))
            .count(),
        1
    );
    let generated: Vec<ProfileId> =
        regenerate_all(&run.graph, &run.registries, &staging, run.kinds.as_ref())
            .into_iter()
            .filter_map(|one| match one.scope {
                RegisterScope::LabelRegister { profile, .. } => Some(profile),
                _ => None,
            })
            .collect();
    assert_eq!(
        generated,
        vec![ProfileId::new("rust-test")],
        "a whole-corpus regeneration sweeps no staged profile up"
    );
}

/// (´[LBL-inv:labels:generated-compliance]´): the register is a generated
/// region whose every occurrence is a warranted mint, which is the clause
/// holding over the one generated carrier file this corpus will gain.
///
/// Both authorities appear here, and the clause covers both: every label
/// the profile derives stands on its one derivation, while the register's
/// own Title mint (´dec:lint:title-head´) stands on the authorship the
/// generator transcribes and carries no derivation at all. Generation is a
/// fact about the pen, and warrants attach to no pen.
#[test]
fn the_generated_register_complies() {
    let run = entered_corpus();
    let generated: Vec<NodeIndex> = nodes_of(&run.graph, NodeKind::Region)
        .filter(|node| {
            matches!(run.graph.node_weight(*node), Some(NodeW::Region(weight)) if weight.generated)
        })
        .collect();
    assert!(
        !generated.is_empty(),
        "the register's regions are generated"
    );
    let mut titles = 0;
    for region in generated {
        for held in out_along(&run.graph, region, EdgeW::Contains) {
            let Some(NodeW::Mint(weight)) = run.graph.node_weight(held) else {
                continue;
            };
            let authored = weight.label.kind() == "reg";
            titles += usize::from(authored);
            assert_eq!(
                in_along(&run.graph, held, EdgeW::Derives).count(),
                usize::from(!authored),
                "a derived mint of the register stands on exactly one derivation, an authored one on none"
            );
        }
    }
    assert!(titles > 0, "the register carries its own Title mint");
    assert!(of(run, "label-generated-dangling").is_empty());
}

/// (´dec:lint:staged-profiles´): the named regeneration and the harvest agree
/// on one profile's census, which is what makes the registers generated while
/// a profile is staged the ones the check will compare against once it is in
/// force.
#[test]
fn the_named_generation_and_the_harvest_produce_one_register() {
    let run = entered_corpus();
    let from_graph = regenerate_all(&run.graph, &run.registries, entered(), run.kinds.as_ref())
        .into_iter()
        .find(|reg| matches!(reg.scope, RegisterScope::LabelRegister { .. }))
        .expect("the harvest's own register");

    let profile = entered()
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == ProfileId::new("rust-test"))
        .expect("the test profile is registered");
    let census = [(
        OwnerId::new(OWNER),
        vec![
            cogra_linter::Asset {
                profile: profile.id.clone(),
                identifier: String::from("alpha"),
                area: cogra_linter::Area::new("unit"),
                place: profile.standard_place.clone(),
                span: cogra_linter::ByteSpan::new(0, 0),
                opens: 0,
                documentation: Vec::new(),
            },
            cogra_linter::Asset {
                profile: profile.id.clone(),
                identifier: String::from("beta"),
                area: cogra_linter::Area::new("integration"),
                place: profile.standard_place.clone(),
                span: cogra_linter::ByteSpan::new(0, 0),
                opens: 0,
                documentation: Vec::new(),
            },
        ],
    )]
    .into_iter()
    .collect();
    let from_census = cogra_linter::label_registers_of(entered(), profile, &census);

    assert_eq!(from_census.len(), 1);
    assert_eq!(from_census[0].path, from_graph.path);
    assert_eq!(
        from_census[0].bytes, from_graph.bytes,
        "one generator, whichever run supplied the census"
    );
}

/// A corpus root of its own: the adoption data and one owner's source tree.
///
/// The named regeneration walks a root, so proving that it writes needs one —
/// and the corpus's own root is exactly where this lane must not write
/// (´dec:lint:staged-profiles´).
fn temporary(name: &str) -> PathBuf {
    let at = std::env::temp_dir().join(format!("cogra-lint-{name}"));
    let _ = std::fs::remove_dir_all(&at);
    let src = at.join("crates").join("l1-standin").join("src");
    std::fs::create_dir_all(&src).expect("a temporary corpus root");
    std::fs::write(at.join("corpus-adoption.toml"), adoption_text()).expect("the adoption data");
    std::fs::write(src.join("lib.rs"), tested("alpha")).expect("one covered asset");
    at
}

/// (´dec:lint:staged-profiles´): the named regeneration writes the register
/// the migration's entry condition names, at the place the measurement waits
/// on it, while the profile is still staged.
#[test]
fn a_named_regeneration_writes_the_register_a_staged_migration_waits_on() {
    let at = temporary("named-regeneration");
    let ruled = staged();
    let waiting = ProfileId::new("rust-test");
    let profile = ruled
        .profiles
        .profiles
        .iter()
        .find(|one| one.id == waiting)
        .expect("the test profile is registered");
    assert!(
        ruled.profiles.effective().next().is_none(),
        "still staged when its registers are generated"
    );

    let census = cogra_linter::migrate::census(&ruled, &at, &waiting).expect("a census");
    let regs = cogra_linter::label_registers_of(&ruled, profile, &census);
    assert_eq!(regs.len(), 1, "one owner covers an asset here");

    let written = cogra_linter::write_all(&regs, &cogra_linter::Scope::WholeCorpus, &at)
        .expect("the register is written");
    assert_eq!(written.paths, vec![PathBuf::from(REGISTER)]);

    let landed = std::fs::read(at.join(REGISTER)).expect("the register is on disk");
    assert_eq!(landed, regs[0].bytes, "what was produced is what landed");
    assert!(
        String::from_utf8_lossy(&landed).contains("`test:unit:alpha`"),
        "the row carries the label in the Markdown mint form"
    );

    let measured = cogra_linter::distances(&ruled, &at, Some(&waiting))
        .expect("the measurement runs over the same root")
        .pop()
        .expect("the test profile is staged in this fixture");
    assert!(
        measured.arrived(),
        "the entry condition holds once the register is committed: {:?}",
        measured.remaining
    );
    let _ = std::fs::remove_dir_all(&at);
}
