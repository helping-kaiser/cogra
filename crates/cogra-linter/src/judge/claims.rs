//! ´mod:module:claims´
//!
//! The claim discipline: the authored statement each covered test evidences.
//!
//! A derived test label names the function and says nothing about what the
//! function establishes (´[LBL-cav:labels:assets]´). This judgment holds the
//! second, authored fact beside it: every covered test of an activated owner
//! carries a claim — its own, minted on the final line of its documentation,
//! or a citation of the claim a sibling minted (´dec:lint:claim-standing´).
//!
//! # What this judgment does not do
//!
//! It does not check that a minted claim is unique, and it does not resolve a
//! cited one. A claim is an ordinary label in the one graph, so a claim minted
//! twice in an owner is (´[LBL-inv:labels:unique-mint]´)'s finding and a
//! citation reaching no mint is (´[LBL-inv:labels:total-resolution]´)'s, both
//! already reported corpus-wide and neither worth a second voice
//! (´dec:lint:claims-ride-the-calculus´). What is left for this module is
//! exactly what the calculus cannot see: whether a covered test carries a
//! claim at all, and whether the one it carries stands where the discipline
//! puts it.
//!
//! # What the staging reaches
//!
//! The unwritten claim, and nothing else. An owner outside the activation has
//! its claimless tests counted by [`census`] and reported nowhere; an owner
//! inside it owes one on every covered test. Placement binds everywhere from a
//! claim's first commit, because a written claim that is wrong is a defect and
//! not a schedule (´[LBL-sig:labels:profiles]´).

use std::collections::BTreeMap;

use petgraph::stable_graph::NodeIndex;

use crate::adopt::{Adoption, Claims, Kind, OwnerId, ProfileStatus};
use crate::diag::{Diagnostic, Enforcement, Location, RuleId, Severity};
use crate::graph::{Corpus, EdgeW, NodeKind, NodeW, nodes_of, out_along, owner_of, source_of};
use crate::scan::{Label, Occurrence, scan_code};

/// A covered test of an activated owner that carries no claim.
pub const MISSING: RuleId = RuleId::new("claim-missing");

/// A claim that does not stand on the final documentation line.
pub const MISPLACED: RuleId = RuleId::new("claim-misplaced");

/// A claim that shares its line with other words.
pub const NOT_ALONE: RuleId = RuleId::new("claim-not-alone");

/// More than one claim in one test's documentation.
pub const REPEATED: RuleId = RuleId::new("claim-repeated");

/// A test citing another owner's claim.
pub const FOREIGN: RuleId = RuleId::new("claim-foreign");

/// A minted claim with no statement above it.
pub const STATEMENT_MISSING: RuleId = RuleId::new("claim-statement-missing");

/// A statement carrying a backtick, which the matrix would present as prose.
pub const STATEMENT_QUOTED: RuleId = RuleId::new("claim-statement-quoted");

/// Every rule this module can report.
pub const RULES: [RuleId; 7] = [
    MISSING,
    MISPLACED,
    NOT_ALONE,
    REPEATED,
    FOREIGN,
    STATEMENT_MISSING,
    STATEMENT_QUOTED,
];

/// Which form a claim occurrence takes at a covered test.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Form {
    /// The test mints the claim: the statement is written here.
    Mint,
    /// The test cites a claim a sibling minted.
    Citation,
}

/// A claim standing where the discipline puts it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ClaimLine {
    /// The claim label.
    pub label: Label,
    /// Whether the test mints it or cites it.
    pub form: Form,
    /// The last non-empty documentation line above the claim line: the
    /// statement the label names. Empty for a citation, whose statement was
    /// written where the claim was minted.
    pub statement: String,
}

/// A claim occurrence that is not where the standard place puts it.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Defect {
    /// It does not stand on the final documentation line.
    Misplaced,
    /// It shares its line with other words.
    NotAlone,
    /// The documentation carries more than one.
    Repeated,
    /// It cites another owner's claim, where a test evidences its own
    /// owner's statement.
    Foreign,
}

impl Defect {
    /// The rule this defect reports under.
    #[must_use]
    pub fn rule(self) -> RuleId {
        match self {
            Defect::Misplaced => MISPLACED,
            Defect::NotAlone => NOT_ALONE,
            Defect::Repeated => REPEATED,
            Defect::Foreign => FOREIGN,
        }
    }

    /// What the diagnostic says went wrong.
    #[must_use]
    pub fn said(self) -> &'static str {
        match self {
            Defect::Misplaced => "it does not stand on the final documentation line",
            Defect::NotAlone => "it shares its line with other words",
            Defect::Repeated => "the documentation carries more than one claim",
            Defect::Foreign => "it cites another owner's claim",
        }
    }
}

/// What one covered test's documentation says about its claim.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Standing {
    /// No claim occurrence at all.
    Unclaimed,
    /// One claim, standing where the discipline puts it.
    Claimed(ClaimLine),
    /// A claim that is not where the discipline puts it.
    Defective(Defect),
}

/// What the claims come to, whether or not their owners are activated.
///
/// Every figure is counted over every owner, and the activation decides only
/// which of them also produce findings. That is the whole of the staging: a
/// count is a schedule made legible, and suppressing the count as well would
/// make an unclosed wave indistinguishable from a closed one.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ClaimCensus {
    /// Covered tests, over every owner.
    pub covered: usize,
    /// How many carry a claim.
    pub claimed: usize,
    /// How many carry none.
    pub unclaimed: usize,
    /// How many mint their own.
    pub mints: usize,
    /// How many cite a sibling's.
    pub citations: usize,
    /// How many carry one that is not where the discipline puts it.
    pub defective: usize,
    /// Per owner: covered tests, and how many of them carry no claim.
    pub by_owner: BTreeMap<OwnerId, OwnerTally>,
    /// The distinct claim areas in use, and how many tests carry each.
    pub by_area: BTreeMap<Box<str>, usize>,
}

/// One owner's share of the census.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct OwnerTally {
    /// Covered tests of this owner.
    pub covered: usize,
    /// How many of them carry no claim.
    pub unclaimed: usize,
    /// Whether the activation holds this owner to the requirement.
    pub activated: bool,
}

/// Every covered test carries a claim, and every claim stands where the
/// discipline puts it.
///
/// The domain is the census of the profile the discipline rides, and the
/// judgment is vacuous where the corpus adopts no claim discipline at all —
/// implemented rather than skipped, for the reason every empty-domain query
/// here is (´tab:lint:judgment-implementation´).
#[must_use]
pub fn claims(g: &Corpus, a: &Adoption) -> Vec<Diagnostic> {
    let Some(declared) = a.claims.as_ref() else {
        return Vec::new();
    };
    let mut found = Vec::new();
    for asset in covered(g, a, declared) {
        let Some(owner) = owner_of(g, asset).and_then(|node| owner_id(g, node)) else {
            continue;
        };
        let activated = declared.activation.admits(&owner);
        let Some(NodeW::Asset(weight)) = g.node_weight(asset) else {
            continue;
        };
        let name = weight.identifier.clone();
        let standing = standing(&weight.documentation, &declared.kind);
        let Some(at) = at_asset(g, asset) else {
            continue;
        };
        match standing {
            Standing::Claimed(line) if line.form == Form::Mint => {
                if line.statement.is_empty() {
                    if activated {
                        found.push(finding(
                            STATEMENT_MISSING,
                            at,
                            format!(
                                "covered test {name} of {owner} mints {} with no statement above it",
                                line.label
                            ),
                        ));
                    }
                } else if line.statement.contains('`') {
                    found.push(finding(
                        STATEMENT_QUOTED,
                        at,
                        format!(
                            "the statement of {} carries a backtick, which the claim matrix would present as a prose span",
                            line.label
                        ),
                    ));
                }
            }
            Standing::Claimed(_) => {}
            Standing::Unclaimed => {
                if activated {
                    found.push(finding(
                        MISSING,
                        at,
                        format!(
                            "covered test {name} of {owner} carries no claim, and its authoring wave has closed"
                        ),
                    ));
                }
            }
            Standing::Defective(defect) => found.push(finding(
                defect.rule(),
                at,
                format!(
                    "the claim of covered test {name} of {owner} is not at the standard place: {}",
                    defect.said()
                ),
            )),
        }
    }
    found
}

/// What the claims come to, over every owner.
///
/// The count an unactivated owner's unwritten claims travel in: `report`
/// prints it, no exit status reads it, and the wave closes when one edit to
/// the activation says so (´[LBL-sig:labels:profiles]´).
#[must_use]
pub fn census(g: &Corpus, a: &Adoption) -> ClaimCensus {
    let mut tally = ClaimCensus::default();
    let Some(declared) = a.claims.as_ref() else {
        return tally;
    };
    for asset in covered(g, a, declared) {
        let Some(NodeW::Asset(weight)) = g.node_weight(asset) else {
            continue;
        };
        tally.covered += 1;
        let owner = owner_of(g, asset).and_then(|node| owner_id(g, node));
        if let Some(owner) = owner.clone() {
            let activated = declared.activation.admits(&owner);
            let held = tally.by_owner.entry(owner).or_default();
            held.covered += 1;
            held.activated = activated;
        }
        match standing(&weight.documentation, &declared.kind) {
            Standing::Claimed(line) => {
                tally.claimed += 1;
                match line.form {
                    Form::Mint => tally.mints += 1,
                    Form::Citation => tally.citations += 1,
                }
                *tally
                    .by_area
                    .entry(Box::from(line.label.area()))
                    .or_default() += 1;
            }
            Standing::Unclaimed => {
                tally.unclaimed += 1;
                if let Some(owner) = owner
                    && let Some(held) = tally.by_owner.get_mut(&owner)
                {
                    held.unclaimed += 1;
                }
            }
            Standing::Defective(_) => tally.defective += 1,
        }
    }
    tally
}

/// What one covered test's documentation says about its claim.
///
/// The occurrence forms are the scanner's, read off one line at a time rather
/// than matched against a formatted string: a private copy of "what a claim
/// occurrence looks like" is exactly how a reader and a writer of one
/// discipline drift apart (´dec:lint:claim-standing´). A span that parses as
/// no form is text and contributes nothing, as everywhere
/// (´[LBL-gram:labels:well-formed]´).
#[must_use]
pub fn standing(documentation: &[Box<str>], kind: &Kind) -> Standing {
    let mut hits: Vec<(usize, Occurrence)> = Vec::new();
    for (index, line) in documentation.iter().enumerate() {
        for occurrence in scan_code(line, 0).occurrences {
            if occurrence.label().kind() == kind.as_str() {
                hits.push((index, occurrence));
            }
        }
    }
    let [(index, occurrence)] = hits.as_slice() else {
        return if hits.is_empty() {
            Standing::Unclaimed
        } else {
            Standing::Defective(Defect::Repeated)
        };
    };
    let form = match occurrence {
        Occurrence::Mint { .. } => Form::Mint,
        Occurrence::SameOwner { .. } => Form::Citation,
        Occurrence::Imported { .. } => return Standing::Defective(Defect::Foreign),
    };
    let Some(last) = documentation.len().checked_sub(1) else {
        return Standing::Unclaimed;
    };
    if *index != last {
        return Standing::Defective(Defect::Misplaced);
    }
    let span = occurrence.span();
    if span.start != 0 || span.end != documentation[*index].len() {
        return Standing::Defective(Defect::NotAlone);
    }
    Standing::Claimed(ClaimLine {
        label: occurrence.label().clone(),
        statement: match form {
            Form::Mint => statement(&documentation[..*index]),
            Form::Citation => String::new(),
        },
        form,
    })
}

/// The statement a mint's documentation states: the last non-empty line above
/// the claim line.
///
/// One line and not the whole documentation above it, which is where this
/// corpus parts from the sibling linter's gloss. A test's documentation here
/// routinely cites the design clause it discharges, and a whole-gloss rule
/// would copy those citations into the generated matrix — a second occurrence
/// of something its author wrote once, and one whose form changes on the way,
/// since the documentation is code syntax and the matrix is prose. One
/// authored line, written for the purpose, travels cleanly
/// (´dec:lint:claim-standing´).
fn statement(lines: &[Box<str>]) -> String {
    lines
        .iter()
        .rev()
        .map(|line| line.trim())
        .find(|line| !line.is_empty())
        .unwrap_or_default()
        .to_owned()
}

/// The covered assets of the profile the discipline rides, in index order.
///
/// A staged profile covers nothing, here as everywhere
/// (´dec:lint:staged-profiles´): a discipline riding one would have no census
/// to hold anybody to.
fn covered(g: &Corpus, a: &Adoption, declared: &Claims) -> Vec<NodeIndex> {
    let Some(profile) = a
        .profiles
        .effective()
        .find(|profile| profile.id == declared.rides)
    else {
        return Vec::new();
    };
    nodes_of(g, NodeKind::Profile)
        .filter(|node| match g.node_weight(*node) {
            Some(NodeW::Profile(weight)) => {
                weight.id == profile.id && weight.status == ProfileStatus::Effective
            }
            _ => false,
        })
        .flat_map(|node| out_along(g, node, EdgeW::Covers))
        .collect()
}

/// Where a covered asset itself sits.
///
/// Not [`crate::judge::at`], which points an asset's finding at the mint of
/// its derived label — the right anchor for a finding about the inventory,
/// and the wrong one for a finding about a test's own documentation, which is
/// nowhere near the owner's register.
fn at_asset(g: &Corpus, asset: NodeIndex) -> Option<Location> {
    let NodeW::Asset(weight) = g.node_weight(asset)? else {
        return None;
    };
    let source = source_of(g, asset)?;
    let NodeW::Source(held) = g.node_weight(source)? else {
        return None;
    };
    Some(Location::new(held.path.clone(), weight.span, 0, 0))
}

/// The owner id a node names.
fn owner_id(g: &Corpus, owner: NodeIndex) -> Option<OwnerId> {
    match g.node_weight(owner) {
        Some(NodeW::Owner(weight)) => Some(weight.id.clone()),
        _ => None,
    }
}

/// One finding, with the line, column, and enforcement the stamping pass
/// fills (´sig:lint:judgment-api´).
fn finding(rule: RuleId, primary: Location, message: String) -> Diagnostic {
    Diagnostic {
        rule,
        severity: Severity::Error,
        enforcement: Enforcement::Advisory,
        primary,
        related: Vec::new(),
        message,
    }
}
