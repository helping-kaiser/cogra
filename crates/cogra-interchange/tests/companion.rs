//! The open companion, and the obligation that it makes exactly two edits.
//!
//! The design does not ask for the two edits to be *inspected*; it asks for
//! them to be *compared*. Both theories go through the same normalized
//! printer, and the check below diffs the two printed forms and reads the
//! hunks: exactly two, one freeing the minor position of key 1 and one
//! adding the base theory's wildcard. Anything else the derivation touched
//! would appear as a third hunk (`design.md`, `alg:xchg:companion`).

use cogra_interchange::Theory;

/// The conventions' own illustration of an assigned theory, with both a
/// required and an optional content key so that requiredness has something
/// to survive.
const ASSIGNED: &str = r#"example = {
  0 => "com.company.example",
  1 => [1, 2, uint],
  2 => tstr,
  ? 7 => bstr
}"#;

fn parse(source: &str) -> Theory {
    match Theory::parse(source) {
        Ok(theory) => theory,
        Err(error) => panic!("expected {source:?} to be an assigned theory, but: {error}"),
    }
}

// -- the diff -------------------------------------------------------------

/// One run of removed and inserted tokens standing between two matches.
#[derive(Debug, PartialEq, Eq)]
struct Hunk {
    removed: Vec<String>,
    inserted: Vec<String>,
}

/// The printed form split into the pieces a difference can fall between.
///
/// Coarser than characters, so that a one-token substitution reads as one
/// substitution rather than as a scatter of letters; finer than lines, so
/// that two edits on the root rule's single line stay two.
fn tokens(printed: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut chars = printed.chars().peekable();

    while let Some(c) = chars.next() {
        if c.is_whitespace() {
            continue;
        }
        if "{}[](),".contains(c) {
            out.push(c.to_string());
            continue;
        }
        let mut token = String::from(c);
        // A text literal is one token however it is spelled inside.
        if c == '"' {
            for c in chars.by_ref() {
                token.push(c);
                if c == '"' {
                    break;
                }
            }
            out.push(token);
            continue;
        }
        while let Some(&next) = chars.peek() {
            if next.is_whitespace() || "{}[](),\"".contains(next) {
                break;
            }
            token.push(next);
            chars.next();
        }
        out.push(token);
    }

    out
}

/// The hunks between two token sequences, over a longest common
/// subsequence: everything not in the subsequence is a difference, and
/// adjacent removals and insertions are one hunk.
fn hunks(before: &[String], after: &[String]) -> Vec<Hunk> {
    let (n, m) = (before.len(), after.len());
    let mut lengths = vec![vec![0usize; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            lengths[i][j] = if before[i] == after[j] {
                lengths[i + 1][j + 1] + 1
            } else {
                lengths[i + 1][j].max(lengths[i][j + 1])
            };
        }
    }

    let mut out: Vec<Hunk> = Vec::new();
    let mut open: Option<Hunk> = None;
    let (mut i, mut j) = (0, 0);
    while i < n || j < m {
        if i < n && j < m && before[i] == after[j] {
            if let Some(hunk) = open.take() {
                out.push(hunk);
            }
            i += 1;
            j += 1;
            continue;
        }
        let hunk = open.get_or_insert_with(|| Hunk {
            removed: Vec::new(),
            inserted: Vec::new(),
        });
        if j == m || (i < n && lengths[i + 1][j] >= lengths[i][j + 1]) {
            hunk.removed.push(before[i].clone());
            i += 1;
        } else {
            hunk.inserted.push(after[j].clone());
            j += 1;
        }
    }
    if let Some(hunk) = open {
        out.push(hunk);
    }

    out
}

fn hunks_between(theory: &Theory) -> Vec<Hunk> {
    let open = theory.open_companion();
    hunks(&tokens(&theory.to_cddl()), &tokens(&open.to_cddl()))
}

/// The check the diff exists for: exactly two hunks, and each is the edit
/// the derivation is allowed.
fn assert_exactly_the_two_edits(source: &str, minor: &str) {
    let theory = parse(source);
    let found = hunks_between(&theory);
    assert_eq!(
        found.len(),
        2,
        "the companion of {source:?} differs in {} places, not two: {found:?}",
        found.len()
    );

    assert_eq!(
        found[0],
        Hunk {
            removed: vec![minor.to_owned()],
            inserted: vec!["uint".to_owned()],
        },
        "the first edit is not the minor position freed to `uint`"
    );
    assert_eq!(
        found[1],
        Hunk {
            removed: Vec::new(),
            inserted: [",", "*", "(", "uint", ".gt", "1", ")", "=>", "any"]
                .iter()
                .map(|token| (*token).to_owned())
                .collect(),
        },
        "the second edit is not the base theory's wildcard joining the map"
    );
}

// -- the two edits, and no third ------------------------------------------

#[test]
fn the_companion_makes_exactly_two_edits() {
    assert_exactly_the_two_edits(ASSIGNED, "2");
}

#[test]
fn the_two_edits_are_the_only_ones_whatever_the_theory_enumerates() {
    assert_exactly_the_two_edits(r#"e = {0 => "com.example", 1 => [0, 0, uint]}"#, "0");
    assert_exactly_the_two_edits(
        r#"e = {0 => "com.example", 1 => [7, 13, uint], 2 => tstr .size 3, ? 3 => [* uint]}"#,
        "13",
    );
    assert_exactly_the_two_edits(
        concat!(
            "e = {0 => \"com.example\", 1 => [1, 5, uint], 2 => inner}\n",
            "inner = {a: 1, b: [* tstr]}\n",
        ),
        "5",
    );
}

/// The edit is at the minor and nowhere else in the triple: a theory whose
/// major and minor are the same number still frees only the second element.
#[test]
fn a_repeated_coordinate_frees_only_the_minor() {
    let theory = parse(r#"e = {0 => "com.example", 1 => [4, 4, uint]}"#);
    assert!(
        theory
            .open_companion()
            .to_cddl()
            .contains("[4, uint, uint]")
    );
}

/// The wildcard the companion gains is the base theory's own clause,
/// character for character as the base theory prints it.
#[test]
fn the_wildcard_is_the_base_theorys() {
    let theory = parse(ASSIGNED);
    let printed = theory.open_companion().to_cddl();
    let wildcard = "* (uint .gt 1) => any";
    assert!(printed.contains(wildcard));
    assert!(cogra_interchange::global().to_cddl().contains(wildcard));
}

// -- what survives the derivation -----------------------------------------

#[test]
fn the_companion_keeps_the_label_and_the_floor() {
    let theory = parse(ASSIGNED);
    let open = theory.open_companion();
    assert_eq!(open.label(), theory.label());
    assert_eq!(open.floor(), theory.coordinate());
    assert_eq!(open.floor(), (1, 2));
}

#[test]
fn every_content_key_keeps_its_type_and_its_requiredness() {
    let theory = parse(ASSIGNED);
    let printed = theory.open_companion().to_cddl();
    assert!(printed.contains("2 => tstr"));
    assert!(printed.contains("? 7 => bstr"));
}

/// The rules below the root are not the map, so the derivation does not
/// reach them: a theory's own vocabulary comes through untouched.
#[test]
fn the_rules_below_the_root_come_through_untouched() {
    let theory = parse(concat!(
        "e = {0 => \"com.example\", 1 => [1, 5, uint], 2 => inner}\n",
        "inner = {a: 1, b: [* tstr]}\n",
    ));
    let printed = theory.open_companion().to_cddl();
    assert!(printed.contains("inner = {a: 1, b: [* tstr]}\n"));
}

/// The companion of the minimal theory is the minimal theory's envelope
/// with the base theory's wildcard: nothing is enumerated, and the two
/// edits still land.
#[test]
fn the_companion_of_a_theory_that_enumerates_nothing() {
    let theory = parse(r#"e = {0 => "com.example", 1 => [3, 9, uint]}"#);
    assert_eq!(
        theory.open_companion().to_cddl(),
        "e = {0 => \"com.example\", 1 => [3, uint, uint], * (uint .gt 1) => any}\n"
    );
}

/// Derivation is a function of the immutable theory: two companions of one
/// theory are the same text, and the theory is unchanged by the asking.
#[test]
fn deriving_twice_gives_the_same_companion() {
    let theory = parse(ASSIGNED);
    let before = theory.to_cddl();
    let first = theory.open_companion().to_cddl();
    let second = theory.open_companion().to_cddl();
    assert_eq!(first, second);
    assert_eq!(theory.to_cddl(), before);
}

// -- the diff helper itself -----------------------------------------------

/// The obligation is only as good as the diff behind it, so the diff is
/// exercised on cases whose answer is known by hand.
#[test]
fn the_diff_reads_the_hunks_it_is_asked_about() {
    let before = tokens("a = {1, 2, 3}");
    assert!(hunks(&before, &before).is_empty());

    let substitution = hunks(&before, &tokens("a = {1, uint, 3}"));
    assert_eq!(
        substitution,
        vec![Hunk {
            removed: vec!["2".to_owned()],
            inserted: vec!["uint".to_owned()],
        }]
    );

    let two = hunks(&before, &tokens("a = {1, uint, 3, 4}"));
    assert_eq!(two.len(), 2);
}
