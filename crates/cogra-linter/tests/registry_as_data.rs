//! The kind registry read as data (´sig:lint:kind-registry-api´).
//!
//! The primary fixture is the registry document itself: its own Convention
//! tables are parsed, its hybrid triples derived and side-conditioned, its
//! headline counts recomputed, and `Hom(C_A)` derived — nothing here
//! transcribes a row (´[ARCH-dec:linter:registry-as-data]´).
//!
//! The recomputed counts are asserted against the *parse*, never against
//! the committed headline table: that table is a generated region
//! maintained only by regeneration, so it is stale by construction until
//! the first generation run (´[KND-tab:kinds:headline-counts]´).
//!
//! Trace convention: every test's doc comment names the clause it traces
//! to.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::frontend::{Parsed, Table};
use cogra_linter::{
    Adoption, Diagnostic, HeadVerdict, HeadlineCounts, Kind, KindRegistry, Language, OwnerId,
    SourceFile, frontend_md, judge,
};

/// The registry document, relative to the corpus root.
const REGISTRY: &str = "crates/cogra-linter/docs/environment-kinds.md";

/// The documents of the failing set, which are the material written under
/// the discipline (´dec:lint:enforcement-partition´).
const WRITTEN_UNDER_THE_DISCIPLINE: [&str; 13] = [
    "crates/cogra-interchange/docs/audit.md",
    "crates/cogra-interchange/docs/commissioning.md",
    "crates/cogra-interchange/docs/concept.md",
    "crates/cogra-interchange/docs/design.md",
    "crates/cogra-linter/docs/adoption-notes.md",
    "crates/cogra-linter/docs/architecture.md",
    "crates/cogra-linter/docs/concept.md",
    "crates/cogra-linter/docs/design.md",
    "crates/cogra-linter/docs/environment-kinds.md",
    "crates/cogra-linter/docs/identity-adjudication.md",
    "crates/cogra-linter/docs/interchange-conventions.md",
    "crates/cogra-linter/docs/kickoff.md",
    "crates/cogra-linter/docs/label-calculus.md",
];

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        let toml = std::fs::read_to_string(root().join("corpus-adoption.toml"))
            .expect("the adoption data is readable");
        Adoption::from_str(&toml, Path::new("corpus-adoption.toml")).expect("the adoption loads")
    })
}

fn parse(path: &str, markdown: &str) -> Parsed {
    let source = SourceFile {
        path: PathBuf::from(path),
        owner: OwnerId::new("linter"),
        language: Some(Language::new("markdown")),
        generated: false,
        bytes: Vec::from(markdown),
    };
    frontend_md::parse(&source, adoption()).expect("the document parses")
}

/// One registry built from an inline fixture.
fn from(markdown: &str) -> Result<KindRegistry, Vec<Diagnostic>> {
    let parsed = parse(REGISTRY, markdown);
    KindRegistry::from_markdown(&parsed, markdown, adoption())
}

/// The registry document's own text, read once.
fn registry_text() -> &'static str {
    static LOADED: OnceLock<String> = OnceLock::new();
    LOADED.get_or_init(|| {
        std::fs::read_to_string(root().join(REGISTRY)).expect("the registry document is readable")
    })
}

/// The registry document, parsed once.
fn registry_doc() -> &'static Parsed {
    static LOADED: OnceLock<Parsed> = OnceLock::new();
    LOADED.get_or_init(|| parse(REGISTRY, registry_text()))
}

/// C_A as the registry document itself lays it down.
fn registry() -> &'static KindRegistry {
    static LOADED: OnceLock<KindRegistry> = OnceLock::new();
    LOADED.get_or_init(|| {
        KindRegistry::from_markdown(registry_doc(), registry_text(), adoption())
            .expect("the registry document is its own fixture and must parse")
            .with_extensions(&adoption().kinds.extensions)
    })
}

/// A two-column table fixture, spelled the way the registry spells one.
fn table(header: &str, rows: &[(&str, &str)]) -> String {
    let mut out = format!("| {header} | Kind |\n| --- | --- |\n");
    for (name, kind) in rows {
        out.push_str(&format!("| {name} | {kind} |\n"));
    }
    out
}

/// The registry document is its own fixture, and it parses.
#[test]
fn the_registry_document_parses() {
    assert!(registry().headline_counts().names > 0);
}

/// The Markdown frontend finds no defect in the document that defines the
/// discipline it implements.
#[test]
fn the_registry_document_carries_no_frontend_finding() {
    assert_eq!(registry_doc().diagnostics, []);
}

/// A table whose header row is `Environment | Kind` is a catalogue table;
/// the fourteen Conventions carry one each.
#[test]
fn every_convention_table_is_a_catalogue_table() {
    let catalogue = registry_doc()
        .tables
        .iter()
        .filter(|table| table.headers == ["Environment", "Kind"])
        .count();
    assert_eq!(catalogue, 14);
}

/// The emphasis and status modifiers are the one `Modifier | Kind` table,
/// and the registry carries twelve.
#[test]
fn the_modifier_table_is_found() {
    let modifiers: Vec<&Table> = registry_doc()
        .tables
        .iter()
        .filter(|table| table.headers == ["Modifier", "Kind"])
        .collect();
    assert_eq!(modifiers.len(), 1);
    assert_eq!(modifiers[0].rows.len(), 12);
}

/// A generated presentation derives no classification pair, so the headline
/// counts table contributes nothing (´[KND-sig:kinds:registry-data]´).
#[test]
fn the_headline_table_contributes_no_pair() {
    let headline = registry_doc()
        .tables
        .iter()
        .find(|table| table.headers == ["Measure", "Count"])
        .expect("the generated headline table is in the document");
    for row in &headline.rows {
        assert!(registry().classify(&row[0]).next().is_none(), "{row:?}");
    }
}

/// The five counts are derived from the tables alone, and the derivation is
/// checked by recomputing it a second way off the same parse.
#[test]
fn the_headline_counts_are_derived_from_the_tables() {
    let mut names: BTreeSet<String> = BTreeSet::new();
    let mut pairs: BTreeSet<(String, String)> = BTreeSet::new();
    let mut kinds: BTreeSet<String> = BTreeSet::new();
    let mut hybrids = 0;
    let mut devices = 0;
    for table in &registry_doc().tables {
        if table.headers != ["Environment", "Kind"] {
            continue;
        }
        for row in &table.rows {
            let name = row[0].trim().trim_end_matches('\u{2020}').trim().to_owned();
            let kind = row[1].trim().trim_matches('`').to_owned();
            if row[1].trim() == "\u{2014}" {
                devices += 1;
                continue;
            }
            if name.contains('\u{2013}') {
                hybrids += 1;
            }
            names.insert(name.clone());
            pairs.insert((name, kind.clone()));
            kinds.insert(kind);
        }
    }
    assert_eq!(
        registry().headline_counts(),
        HeadlineCounts {
            names: names.len(),
            rows: pairs.len(),
            kinds: kinds.len(),
            declared_hybrids: hybrids,
            device_classes: devices,
        }
    );
}

/// The counts the derivation produces, pinned so a change to the registry
/// is a change to this test rather than a silent drift.
#[test]
fn the_derived_counts_are_pinned() {
    assert_eq!(
        registry().headline_counts(),
        HeadlineCounts {
            names: 333,
            rows: 349,
            kinds: 208,
            declared_hybrids: 3,
            device_classes: 10,
        }
    );
}

/// The rows of C are the catalogue rows with the derived hybrid rows
/// included and the device rows excluded.
#[test]
fn the_device_rows_are_excluded_from_the_rows_count() {
    let counts = registry().headline_counts();
    let catalogue: usize = registry_doc()
        .tables
        .iter()
        .filter(|table| table.headers == ["Environment", "Kind"])
        .map(|table| table.rows.len())
        .sum();
    assert_eq!(counts.rows, catalogue - counts.device_classes);
}

/// Classification is a relation: one name may carry several kinds, one per
/// catalogued sense (´[KND-judg:kinds:classification]´).
#[test]
fn a_name_may_carry_several_kinds() {
    let kinds: Vec<&str> = registry().classify("Structure").map(Kind::as_str).collect();
    assert_eq!(kinds, ["class", "constr", "schema"]);
}

/// And several names one kind (´[KND-inv:kinds:one-kind]´).
#[test]
fn several_names_may_carry_one_kind() {
    for name in [
        "Proof sketch",
        "Sketch of proof",
        "Outline of proof",
        "Idea of proof",
    ] {
        let kinds: Vec<&str> = registry().classify(name).map(Kind::as_str).collect();
        assert_eq!(kinds, ["sketch"], "{name}");
    }
}

/// A name the registry does not catalogue is classified by nothing.
#[test]
fn an_uncatalogued_name_classifies_to_nothing() {
    assert!(registry().classify("Widget").next().is_none());
}

/// The dagger printed at a row is a status mark on the row, never a
/// character of the name (´[KND-judg:kinds:attestation]´).
#[test]
fn the_dagger_is_not_part_of_the_name() {
    let kinds: Vec<&str> = registry().classify("Yoga").map(Kind::as_str).collect();
    assert_eq!(kinds, ["yoga"]);
    assert!(registry().classify("Yoga \u{2020}").next().is_none());
}

/// A device row carries no kind and contributes no member to C.
#[test]
fn a_device_row_contributes_no_pair() {
    for row in [
        "Numbered environments",
        "Continued environments",
        "Containers (a Box, a Panel, a Callout)",
    ] {
        assert!(registry().classify(row).next().is_none(), "{row}");
    }
}

/// A modifier is a device too, and contributes no member.
#[test]
fn a_modifier_contributes_no_pair() {
    for row in ["Main", "Toy", "Working"] {
        assert!(registry().classify(row).next().is_none(), "{row}");
    }
}

/// A hybrid environment concatenates its parts' kinds in order
/// (´[KND-inf:kinds:hybrid]´).
#[test]
fn a_hybrid_composes_its_parts_kinds() {
    let kinds: Vec<&str> = registry()
        .classify("Definition\u{2013}Proposition")
        .map(Kind::as_str)
        .collect();
    assert_eq!(kinds, ["defprop"]);
}

/// The registry's three declared triples are all derived.
#[test]
fn every_declared_hybrid_is_derived() {
    for (name, kind) in [
        ("Definition\u{2013}Proposition", "defprop"),
        ("Definition\u{2013}Theorem", "defthm"),
        ("Lemma\u{2013}Definition", "lemdef"),
    ] {
        let kinds: Vec<&str> = registry().classify(name).map(Kind::as_str).collect();
        assert_eq!(kinds, [kind], "{name}");
    }
}

/// The derivation reads the parts out of the ordinary rows.
#[test]
fn a_hybrids_parts_are_ordinary_rows() {
    for (part, kind) in [("Definition", "def"), ("Proposition", "prop")] {
        let kinds: Vec<&str> = registry().classify(part).map(Kind::as_str).collect();
        assert_eq!(kinds, [kind]);
    }
}

/// Side condition: the composed token is not otherwise assigned
/// (´[KND-inv:kinds:distinctness]´).
#[test]
fn a_hybrid_token_that_is_otherwise_assigned_fails() {
    let doc = table(
        "Environment",
        &[
            ("Definition", "`def`"),
            ("Proposition", "`prop`"),
            ("Compound", "`defprop`"),
            ("Definition\u{2013}Proposition", "`defprop`"),
        ],
    );
    let findings = from(&doc).expect_err("the token is otherwise assigned");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::HYBRID_COLLIDES)
    );
}

/// Side condition: no two declared hybrids compose one token. Synonymous
/// parts are what makes two distinct hybrid names compose one.
#[test]
fn two_hybrids_composing_one_token_fail() {
    let doc = table(
        "Environment",
        &[
            ("Definition", "`def`"),
            ("Proposition", "`prop`"),
            ("Defn", "`def`"),
            ("Prop", "`prop`"),
            ("Definition\u{2013}Proposition", "`defprop`"),
            ("Defn\u{2013}Prop", "`defprop`"),
        ],
    );
    let findings = from(&doc).expect_err("two hybrids compose one token");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::HYBRID_COLLIDES)
    );
}

/// The row states the composition, and a row disagreeing with it fails: the
/// hybrid rows are exactly the declared instances of the rule.
#[test]
fn a_hybrid_row_disagreeing_with_its_composition_fails() {
    let doc = table(
        "Environment",
        &[
            ("Definition", "`def`"),
            ("Proposition", "`prop`"),
            ("Definition\u{2013}Proposition", "`propdef`"),
        ],
    );
    let findings = from(&doc).expect_err("the row disagrees");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::HYBRID_MISMATCH)
    );
}

/// The parts are non-hybrid names, so a part that is classified by nothing
/// fails.
#[test]
fn a_hybrid_part_that_is_uncatalogued_fails() {
    let doc = table(
        "Environment",
        &[
            ("Definition", "`def`"),
            ("Definition\u{2013}Widget", "`defwidget`"),
        ],
    );
    let findings = from(&doc).expect_err("the part is uncatalogued");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::HYBRID_PART)
    );
}

/// A part carrying several kinds does not determine the composition.
#[test]
fn a_homonymous_hybrid_part_fails() {
    let doc = table(
        "Environment",
        &[
            ("Structure", "`class`"),
            ("Structure", "`schema`"),
            ("Definition", "`def`"),
            ("Definition\u{2013}Structure", "`defclass`"),
        ],
    );
    let findings = from(&doc).expect_err("the part is homonymous");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::HYBRID_PART)
    );
}

/// Homonymy is derived, never declared (´[KND-def:kinds:homonymy]´): a pair
/// is in `Hom` exactly when its name carries another kind too.
#[test]
fn homonymy_is_derived_from_the_relation() {
    let hom: BTreeSet<(&str, &str)> = registry()
        .homonyms()
        .map(|(name, kind)| (name, kind.as_str()))
        .collect();
    for name in ["Structure", "Model", "Schema", "Review", "Test"] {
        let kinds = registry().classify(name).count();
        assert!(kinds > 1, "{name}");
        assert_eq!(
            hom.iter().filter(|(held, _)| *held == name).count(),
            kinds,
            "{name}"
        );
    }
}

/// The caveat's own claim, checked against the derivation: of the
/// Construction–Model–Structure genre, Construction rows nowhere in Hom
/// while Model and Structure both do (´[KND-cav:kinds:homonymy]´).
#[test]
fn construction_is_nowhere_in_hom() {
    let names: BTreeSet<&str> = registry().homonyms().map(|(name, _)| name).collect();
    assert!(!names.contains("Construction"));
    assert!(names.contains("Model"));
    assert!(names.contains("Structure"));
}

/// And the second half of that claim: several names under one kind — `heur`,
/// `assum`, `por`, `fact`, `pred` — row nowhere in Hom at all.
#[test]
fn the_shared_kinds_row_nowhere_in_hom() {
    let kinds: BTreeSet<&str> = registry()
        .homonyms()
        .map(|(_, kind)| kind.as_str())
        .collect();
    for kind in ["heur", "assum", "por", "fact", "pred"] {
        assert!(!kinds.contains(kind), "{kind}");
    }
}

/// A relation with no repeated name has an empty `Hom`.
#[test]
fn a_relation_with_no_repeated_name_has_no_homonym() {
    let doc = table("Environment", &[("Theorem", "`thm`"), ("Lemma", "`lem`")]);
    let registry = from(&doc).expect("parses");
    assert_eq!(registry.homonyms().count(), 0);
}

/// An exact catalogue name carrying the declared kind validates exactly
/// (´[KND-judg:kinds:head-validation]´).
#[test]
fn an_exact_pair_validates_exactly() {
    assert_eq!(
        registry().validate("Convention", &Kind::new("conv")),
        HeadVerdict::Exact
    );
}

/// Matching is case-exact, and the consequence is named rather than
/// discovered: a head whose only defect is capitalization is a validation
/// failure (´dec:lint:head-recognition´).
#[test]
fn a_miscased_head_does_not_validate() {
    assert!(matches!(
        registry().validate("convention", &Kind::new("conv")),
        HeadVerdict::Uncatalogued { .. }
    ));
}

/// An exact catalogue name is never reduced, so a name carrying another
/// kind is uncatalogued for this one rather than reduced into it.
#[test]
fn an_exact_name_with_another_kind_is_uncatalogued() {
    assert_eq!(
        registry().validate("Theorem", &Kind::new("lem")),
        HeadVerdict::Uncatalogued {
            base: "Theorem".into()
        }
    );
}

/// An emphasis modifier is stripped and the base carries the kind
/// (´[KND-def:kinds:presentation-reduction]´).
#[test]
fn an_emphasis_modifier_reduces_to_its_base() {
    assert_eq!(
        registry().validate("Main Theorem", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// The registry's own example: a Key Lemma classifies by its base.
#[test]
fn a_key_lemma_reduces_to_lemma() {
    assert_eq!(
        registry().validate("Key Lemma", &Kind::new("lem")),
        HeadVerdict::Reduced {
            base: "Lemma".into()
        }
    );
}

/// Toy, Worked, Running, and Numerical examples classify by their base,
/// which needs the tail's sentence case restored before it is the
/// catalogue's spelling.
#[test]
fn a_modified_example_reduces_to_example() {
    for head in [
        "Toy example",
        "Worked example",
        "Running example",
        "Numerical example",
    ] {
        assert_eq!(
            registry().validate(head, &Kind::new("ex")),
            HeadVerdict::Reduced {
                base: "Example".into()
            },
            "{head}"
        );
    }
}

/// Numbering is presentation, not denotation.
#[test]
fn a_numbered_environment_reduces() {
    assert_eq!(
        registry().validate("Theorem 1.1", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// So is lettering.
#[test]
fn a_lettered_main_theorem_reduces() {
    assert_eq!(
        registry().validate("Theorem A", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// So is starring and unnumbering.
#[test]
fn a_starred_variant_reduces() {
    assert_eq!(
        registry().validate("theorem*", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// A restated theorem is its original returned to; it names nothing new,
/// and it carries two devices.
#[test]
fn a_restated_theorem_reduces_through_two_devices() {
    assert_eq!(
        registry().validate("Theorem 1.1, restated", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// A continued environment likewise.
#[test]
fn a_continued_environment_reduces() {
    assert_eq!(
        registry().validate("Theorem, continued", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// An attached name is a device: a Theorem (Riemann–Roch) is a Theorem.
#[test]
fn an_attached_name_reduces() {
    assert_eq!(
        registry().validate("Theorem (Riemann\u{2013}Roch)", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// Nesting within a rung is the sub- prefix, iterated at need, and is
/// presentation: a subsection is a section, nested
/// (´[KND-conv:kinds:structure]´).
#[test]
fn a_sub_prefix_reduces_to_its_rung() {
    for head in ["Subsection", "Subsubsection"] {
        assert_eq!(
            registry().validate(head, &Kind::new("sec")),
            HeadVerdict::Reduced {
                base: "Section".into()
            },
            "{head}"
        );
    }
}

/// Working hypothesis and Standing hypothesis are catalogued expressly as
/// overrides of the modifier rule: the exact pair is tried first, so the
/// row wins and no list of overrides is consulted
/// (´dec:lint:reduction-vocabulary´).
#[test]
fn an_overriding_row_takes_precedence_over_reduction() {
    for head in ["Working hypothesis", "Standing hypothesis"] {
        assert_eq!(
            registry().validate(head, &Kind::new("assum")),
            HeadVerdict::Exact,
            "{head}"
        );
        assert!(
            matches!(
                registry().validate(head, &Kind::new("hyp")),
                HeadVerdict::Uncatalogued { .. }
            ),
            "{head}"
        );
    }
}

/// A head reduces to itself by removing nothing when it is already a name.
#[test]
fn a_catalogue_name_reduces_to_itself() {
    let reduced = registry().reduce("Theorem");
    assert_eq!(reduced.bases().collect::<Vec<&str>>(), ["Theorem"]);
    assert!(reduced.routes[0].devices.is_empty());
}

/// An undeclared family strips nothing: `reduce` runs exactly the routines
/// the registry declares.
#[test]
fn an_undeclared_family_strips_nothing() {
    let doc = table("Environment", &[("Theorem", "`thm`")]);
    let registry = from(&doc).expect("parses");
    assert!(matches!(
        registry.validate("Theorem 1.1", &Kind::new("thm")),
        HeadVerdict::Uncatalogued { .. }
    ));
}

/// Declaring the family turns the same routine on.
#[test]
fn a_declared_family_strips() {
    let doc = table(
        "Environment",
        &[("Theorem", "`thm`"), ("Numbered environments", "\u{2014}")],
    );
    let registry = from(&doc).expect("parses");
    assert_eq!(
        registry.validate("Theorem 1.1", &Kind::new("thm")),
        HeadVerdict::Reduced {
            base: "Theorem".into()
        }
    );
}

/// Reduction through two different base pairs is ambiguous, which is the
/// second failure mode of (´[KND-inv:kinds:totality]´).
#[test]
fn two_base_pairs_are_ambiguous() {
    let doc = format!(
        "{}\n{}",
        table(
            "Environment",
            &[
                ("Section", "`sec`"),
                ("Subsection", "`sec`"),
                ("Numbered environments", "\u{2014}"),
                ("Iterated sub- prefixes", "\u{2014}"),
            ],
        ),
        table("Modifier", &[("Main", "\u{2014}")]),
    );
    let registry = from(&doc).expect("parses");
    assert_eq!(
        registry.validate("Subsubsection 2", &Kind::new("sec")),
        HeadVerdict::Ambiguous {
            bases: vec!["Section".into(), "Subsection".into()],
        }
    );
}

/// Reduction is a search over spelling rules, and it is bounded: a
/// pathological head terminates rather than running away.
#[test]
fn reduction_is_bounded() {
    let head = format!("{}section 1.1, restated", "Sub".repeat(200));
    assert!(matches!(
        registry().validate(&head, &Kind::new("sec")),
        HeadVerdict::Uncatalogued { .. } | HeadVerdict::Reduced { .. } | HeadVerdict::Beyond { .. }
    ));
}

/// A reduction stopped by one of its bounds says so, and never that the
/// relation carries no such pair.
///
/// The bound is a fact about the search and the catalogue is a fact about
/// the registry; reporting the first as the second sends its reader to look
/// for a row nothing ever consulted. A head carrying more devices than the
/// reduction may remove is the case that reaches this.
#[test]
fn f9_a_reduction_stopped_by_its_bound_does_not_blame_the_catalogue() {
    let deep = "Main Key Toy Working Running Theorem";
    let verdict = registry().validate(deep, &Kind::new("thm"));
    assert!(
        matches!(verdict, HeadVerdict::Beyond { .. }),
        "a five-device head reports its bound: {verdict:?}"
    );
    let reduced = registry().reduce(deep);
    assert!(
        reduced.bound.is_some(),
        "the reduction records which bound stopped it"
    );
    assert!(
        reduced.routes.is_empty(),
        "and it reached no catalogue name to report"
    );
}

/// A search that finished still reports the catalogue, so the new verdict
/// narrows and never swallows: an unknown name and a miscased one are both
/// uncatalogued, and neither reduction was bounded.
#[test]
fn f9_a_finished_search_still_reports_the_catalogue() {
    for head in ["Frobnicator", "Main Frobnicator", "theorem"] {
        let verdict = registry().validate(head, &Kind::new("thm"));
        assert!(
            matches!(verdict, HeadVerdict::Uncatalogued { .. }),
            "{head} is uncatalogued and not beyond a bound: {verdict:?}"
        );
        assert_eq!(
            registry().reduce(head).bound,
            None,
            "{head}: the search finished"
        );
    }
}

/// A head within the bounds validates as it always did: recording the bound
/// changes no verdict that had one.
#[test]
fn f9_a_head_within_the_bounds_is_unchanged() {
    assert_eq!(
        registry().validate("Theorem", &Kind::new("thm")),
        HeadVerdict::Exact
    );
    assert!(matches!(
        registry().validate("Main Key Motivating Numerical Theorem", &Kind::new("thm")),
        HeadVerdict::Reduced { .. }
    ));
}

/// Validation consumes a classification and never extends the relation.
#[test]
fn validation_extends_nothing() {
    let before = registry().headline_counts();
    let _ = registry().validate("Main Theorem", &Kind::new("thm"));
    let _ = registry().validate("Widget", &Kind::new("thm"));
    assert_eq!(registry().headline_counts(), before);
}

/// A document with no catalogue table has no classification relation, and
/// the failure is loud rather than an empty registry
/// (´dec:lint:registry-bootstrap´).
#[test]
fn a_document_with_no_catalogue_table_fails() {
    let findings = from("just prose, no tables\n").expect_err("no relation");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::NO_TABLES)
    );
}

/// A kind cell that is not a kind token fails, located on the registry
/// document itself.
#[test]
fn a_kind_cell_that_is_not_a_token_fails() {
    let doc = table("Environment", &[("Theorem", "`Thm`")]);
    let findings = from(&doc).expect_err("not a kind token");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::NOT_A_KIND)
    );
    assert_eq!(findings[0].primary.path, PathBuf::from(REGISTRY));
}

/// A modifier row carrying a kind is a defect: a modifier is a device.
#[test]
fn a_modifier_row_with_a_kind_fails() {
    let doc = format!(
        "{}\n{}",
        table("Environment", &[("Theorem", "`thm`")]),
        table("Modifier", &[("Main", "`main`")]),
    );
    let findings = from(&doc).expect_err("a modifier carries no kind");
    assert!(
        findings
            .iter()
            .any(|one| one.rule == judge::kinds::NOT_A_KIND)
    );
}

/// The findings are ordered the way every diagnostic sequence is
/// (´conv:lint:diagnostic-order´).
#[test]
fn the_findings_are_ordered() {
    let doc = table(
        "Environment",
        &[("Theorem", "`Thm`"), ("Lemma", "`LEM`"), ("Axiom", "`AX`")],
    );
    let findings = from(&doc).expect_err("three defects");
    let mut sorted = findings.clone();
    sorted.sort();
    assert_eq!(findings, sorted);
}

/// `X_A` is empty in version 1, and adding it changes nothing.
#[test]
fn the_empty_extensions_change_nothing() {
    let doc = table("Environment", &[("Theorem", "`thm`")]);
    let registry = from(&doc).expect("parses");
    let before = registry.headline_counts();
    let after = registry.with_extensions(&adoption().kinds.extensions);
    assert_eq!(after.headline_counts(), before);
    assert!(after.unapplied_extensions().is_empty());
}

/// Every device family the registry declares has a routine here, so
/// nothing the registry admits goes unimplemented unnoticed.
#[test]
fn every_declared_family_is_recognized() {
    assert_eq!(registry().unrecognized_families(), &[] as &[Box<str>]);
}

/// No rule identifier of this module is label-shaped.
#[test]
fn no_registry_rule_identifier_is_label_shaped() {
    for rule in judge::kinds::RULES {
        assert!(!rule.as_str().contains(':'), "{rule} is label-shaped");
    }
}

/// The end-to-end fixture: every participating authored head of the
/// material written under the discipline validates by exactly one exact
/// pair (´[KND-inv:kinds:totality]´), and the corpus's own registry is what
/// judges them.
#[test]
fn every_head_written_under_the_discipline_validates() {
    let mut heads = 0;
    let mut failed = Vec::new();
    for relative in WRITTEN_UNDER_THE_DISCIPLINE {
        let text =
            std::fs::read_to_string(root().join(relative)).expect("the document is readable");
        let parsed = parse(relative, &text);
        assert_eq!(parsed.diagnostics, [], "{relative}");
        heads += parsed.heads.len();
        for head in &parsed.heads {
            let verdict = registry().validate(&head.text, &head.declared);
            if verdict != HeadVerdict::Exact {
                failed.push(format!(
                    "{relative}: {} {} {verdict:?}",
                    head.text, head.declared
                ));
            }
        }
    }
    assert_eq!(failed, [] as [String; 0]);
    assert_eq!(heads, 430);
}

/// Every heading anchor in the corpus carries `sec`, which is the rung the
/// format supplies classified by the registry's own structure table.
#[test]
fn every_heading_anchor_carries_the_rungs_kind() {
    let text = std::fs::read_to_string(root().join(REGISTRY)).expect("readable");
    let parsed = parse(REGISTRY, &text);
    let rungs = parsed.heads.iter().filter(|head| head.text == "Section");
    for head in rungs {
        assert_eq!(head.declared.as_str(), "sec");
    }
}
