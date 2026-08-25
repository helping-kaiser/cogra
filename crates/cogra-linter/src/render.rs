//! Diagnostic rendering and the run summary.
//!
//! [`diag`](crate::diag) has already ordered the findings
//! (´conv:lint:diagnostic-order´); this module only spells them. Nothing
//! here decides what is reported, and no judgment, register, or error site
//! knows how output is spelled — which is what makes a second form, a JSON
//! one say, a change to this module and to nothing else
//! (´dec:lint:diagnostic-format´).
//!
//! # The form is a contract
//!
//! ```text
//! path:line:col: severity rule: message
//!     path:line:col: note
//! ```
//!
//! One line per finding, its related locations following it indented four
//! spaces, each in the same `path:line:col:` shape. `severity` is `error` or
//! `warning`, `rule` is the rule's own token, and the message is a single
//! line. This is the shape a GitHub Actions problem matcher consumes with no
//! translator in front of it, which is the only machine consumer the
//! linter's consumer set has, and it is the shape a compiler-trained reader
//! already parses by eye. Being a contract, it is stable: changing it is a
//! breaking change to whatever consumes it.

use std::fmt::Write as _;
use std::path::Path;

use crate::diag::{Diagnostic, Enforcement, Location, Severity};
use crate::registers::{Freshness, Register, RegisterScope};
use crate::timing::Timing;

/// One finding, in the ruled form, with its related locations under it.
///
/// ```
/// use cogra_linter::render;
/// use cogra_linter::{ByteSpan, Diagnostic, Enforcement, Location, RuleId, Severity};
/// use std::path::PathBuf;
///
/// let one = Diagnostic {
///     rule: RuleId::new("label-duplicate-mint"),
///     severity: Severity::Error,
///     enforcement: Enforcement::Failing,
///     primary: Location::new(PathBuf::from("docs/x.md"), ByteSpan::new(4, 9), 12, 3),
///     related: Vec::new(),
///     message: String::from("this label is minted twice by one owner"),
/// };
///
/// assert_eq!(
///     render::diagnostic(&one),
///     "docs/x.md:12:3: error label-duplicate-mint: this label is minted twice by one owner",
/// );
/// ```
#[must_use]
pub fn diagnostic(one: &Diagnostic) -> String {
    let mut out = format!(
        "{}: {} {}: {}",
        at(&one.primary),
        severity(one.severity),
        one.rule,
        one.message
    );
    for related in &one.related {
        let _ = write!(out, "\n    {}: {}", at(&related.at), related.note);
    }
    out
}

/// Every finding, one after another, each in the ruled form.
#[must_use]
pub fn report(findings: &[&Diagnostic]) -> String {
    findings
        .iter()
        .map(|one| diagnostic(one))
        .collect::<Vec<String>>()
        .join("\n")
}

/// What a run found, counted by enforcement half.
///
/// A run that is clean on the failing set reads as clean: the advisory
/// findings are counted here and listed only when they are asked for
/// (´dec:lint:enforcement-partition´).
#[must_use]
pub fn summary(findings: &[Diagnostic], sources: usize) -> String {
    let failing = findings
        .iter()
        .filter(|one| one.enforcement == Enforcement::Failing)
        .count();
    let advisory = findings.len() - failing;
    format!(
        "{sources} sources · {failing} failing · {advisory} advisory",
    )
}

/// The per-phase report every run prints beside its findings
/// (´req:lint:timing´).
#[must_use]
pub fn timing(spent: &Timing) -> String {
    spent.to_string()
}

/// One register's standing, as the regeneration mode reports it.
///
/// The offset of a stale register is spelled and no diff is drawn: a diff
/// would be a second contract to keep, and the byte offset is what the
/// comparison actually knows (´dec:lint:no-digest´).
#[must_use]
pub fn freshness(reg: &Register, found: &Freshness) -> String {
    let what = match &reg.scope {
        RegisterScope::LabelRegister { owner, profile } => {
            format!("label register of {} for {}", owner.as_str(), profile.as_str())
        }
        RegisterScope::Attestation => String::from("attestation register"),
        RegisterScope::Region { span, .. } => {
            format!("generated region at bytes {}..{}", span.start, span.end)
        }
    };
    let standing = match found {
        Freshness::Current => String::from("current"),
        Freshness::Stale { at } => format!("stale, first differing at byte {at}"),
        Freshness::Staged => String::from("staged, never generated"),
    };
    format!("{}: {what} — {standing}", reg.path.display())
}

/// One location, in the ruled `path:line:col` shape.
fn at(one: &Location) -> String {
    format!("{}:{}:{}", display(&one.path), one.line, one.column)
}

/// A path as the corpus spells it: forward slashes on every platform, so
/// that one corpus produces one output whatever walked it
/// (´[ARCH-req:linter:determinism]´).
fn display(path: &Path) -> String {
    path.components()
        .map(|one| one.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<String>>()
        .join("/")
}

/// The token a severity is spelled with.
const fn severity(one: Severity) -> &'static str {
    match one {
        Severity::Error => "error",
        Severity::Warning => "warning",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diag::{ByteSpan, Related, RuleId};
    use std::path::PathBuf;

    fn one(path: &str) -> Diagnostic {
        Diagnostic {
            rule: RuleId::new("label-unresolved-citation"),
            severity: Severity::Warning,
            enforcement: Enforcement::Advisory,
            primary: Location::new(PathBuf::from(path), ByteSpan::new(0, 1), 3, 7),
            related: Vec::new(),
            message: String::from("this citation resolves nowhere"),
        }
    }

    #[test]
    fn a_related_location_follows_indented_four_spaces() {
        let mut finding = one("a.md");
        finding.related.push(Related {
            at: Location::new(PathBuf::from("b.md"), ByteSpan::new(0, 1), 9, 2),
            note: String::from("the first mint sits here"),
        });
        let rendered = diagnostic(&finding);
        let mut lines = rendered.lines();
        assert_eq!(
            lines.next(),
            Some("a.md:3:7: warning label-unresolved-citation: this citation resolves nowhere")
        );
        assert_eq!(lines.next(), Some("    b.md:9:2: the first mint sits here"));
    }

    #[test]
    fn a_path_is_spelled_with_forward_slashes_on_every_platform() {
        let nested = one("crates/cogra-linter/docs/design.md");
        assert!(diagnostic(&nested).starts_with("crates/cogra-linter/docs/design.md:3:7:"));
    }

    #[test]
    fn the_summary_counts_both_halves() {
        let mut failing = one("a.md");
        failing.enforcement = Enforcement::Failing;
        let findings = vec![failing, one("b.md"), one("c.md")];
        assert_eq!(summary(&findings, 12), "12 sources · 1 failing · 2 advisory");
    }
}
