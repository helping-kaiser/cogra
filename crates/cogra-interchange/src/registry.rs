//! ´mod:module:registry´
//!
//! The held state: assigned coordinates with their immutable theory
//! objects, acquisition, refusal, ceilings, targeting, and stamping.
//!
//! A reader's registry is downward-closed within each major, and its copy
//! is complete below its *ceiling* — the greatest minor it holds. The
//! representation is what carries that: a major line is a strictly
//! increasing vector of held minors, so a minor missing below the ceiling
//! was never assigned, and **its absence is knowledge, not ignorance**
//! (´[ICX-def:interchange:acceptance]´). Gaps are possible, and they are
//! permanent: assignment proceeds in increasing minor order, and a gap
//! below an assigned minor is never filled.
//!
//! # What acquisition refuses
//!
//! Acquisition is the crate's trust boundary. Every pattern a `.regexp`
//! ever executes, every theory a document is ever judged against, entered
//! the held state through [`Registry::acquire`], which refuses six ways:
//! pins that disagree with the coordinate, a theory whose model class is
//! not inside the base theory's, an out-of-order minor, a re-acquisition
//! that would change a held theory object, a minor-inclusion breach, and —
//! outside [`Registry::lenient`] — a position reaching a restrained value
//! without naming it.
//!
//! # Where the registry is not the registry
//!
//! **R** is the owner's map from coordinates to assigned theories; this
//! type is one reader's copy of part of it. Growth is the reader's act,
//! assignment the owner's, and the two are never the same event. How a
//! reader comes by published theory material is governance and lies
//! outside this crate: there is no fetch here, no manifest, and no file
//! format.

use std::collections::BTreeMap;

use crate::cddl::inclusion::compare;
use crate::error::AcquireError;
use crate::{
    Content, Coordinate, Document, Envelope, ImplicitReach, Inclusion, NamespaceLabel, OpenTheory,
    Theory, Version, satisfies, satisfies_global,
};

/// A reader's registry state: assigned coordinates with their immutable
/// theory objects, holding downward-closed within each major.
///
/// ```
/// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
///
/// let mut registry = Registry::new();
/// registry
///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
///     .expect("the first minor of a major");
///
/// assert_eq!(registry.ceiling(&label, 1), Some(0));
/// assert!(registry.holds_major(&label, 1));
/// ```
///
/// # Cloning, and threads
///
/// The registry owns its theories and hands out `&Theory`. A consumer
/// wanting a registry on another thread clones the registry; nothing here
/// is shared behind a handle.
#[derive(Clone, Debug, Default)]
pub struct Registry {
    /// Label to major to that major's line. Nested so that a lookup by
    /// label borrows rather than clones, and so that the greatest major of
    /// a label is the last entry of the inner map.
    lines: BTreeMap<NamespaceLabel, BTreeMap<u64, MajorLine>>,
    /// Whether an implicit reach to a restrained value is admitted.
    lenient: bool,
}

/// One major line: its held minors in ascending order, and the open
/// companion of the theory at its ceiling.
///
/// A line is created holding one coordinate and removed when its last
/// coordinate goes, so a line that exists is never empty.
#[derive(Clone, Debug)]
struct MajorLine {
    /// Strictly increasing by minor, complete below the ceiling.
    entries: Vec<(u64, Theory)>,
    /// The companion of the ceiling's theory: derived once per
    /// acquisition, and re-derived whenever the ceiling moves.
    companion: OpenTheory,
}

impl MajorLine {
    /// Re-derive the memoized companion after the ceiling moved.
    fn remember_companion(&mut self) {
        if let Some((_, ceiling)) = self.entries.last() {
            self.companion = ceiling.open_companion();
        }
    }
}

/// What a reader holds of one major: the ceiling, the companion memoized
/// at it, and the held theories.
///
/// Crate-internal, and the one lookup dispatch performs: it exists so that
/// choosing an instrument costs one descent and no allocation
/// (´alg:xchg:companion´).
#[derive(Debug)]
pub(crate) struct Holding<'r> {
    pub(crate) ceiling: u64,
    pub(crate) companion: &'r OpenTheory,
    entries: &'r [(u64, Theory)],
}

impl<'r> Holding<'r> {
    /// The theory held at this minor, if the minor is held.
    pub(crate) fn theory(&self, minor: u64) -> Option<&'r Theory> {
        let index = self
            .entries
            .binary_search_by_key(&minor, |(held, _)| *held)
            .ok()?;
        self.entries.get(index).map(|(_, theory)| theory)
    }
}

impl Registry {
    /// An empty registry, refusing a theory that reaches a restrained
    /// value implicitly.
    ///
    /// ```
    /// use cogra_interchange::{NamespaceLabel, Registry};
    ///
    /// let registry = Registry::new();
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// assert_eq!(registry.ceiling(&label, 1), None);
    /// ```
    pub fn new() -> Registry {
        Registry::default()
    }

    /// An empty registry that admits a theory reaching a restrained value
    /// implicitly, rather than refusing it. Every other refusal stands.
    ///
    /// For a reader consuming a registry it does not own: such a reader
    /// did not write the theories and cannot fix them, and refusing here
    /// would leave it unable to route documents it is obliged to route.
    /// The report is computed either way, and stays available through
    /// [`Theory::restraint`].
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// // `any` at key 2 reaches a float without naming one.
    /// let source = r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => any}"#;
    /// let theory = Theory::parse(source).expect("an assignable theory");
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let coord = Coordinate::new(label, 1, 0);
    ///
    /// assert!(Registry::new().acquire(coord.clone(), theory.clone()).is_err());
    /// assert!(Registry::lenient().acquire(coord, theory).is_ok());
    /// ```
    pub fn lenient() -> Registry {
        Registry {
            lines: BTreeMap::new(),
            lenient: true,
        }
    }

    /// Take a published theory into the held state.
    ///
    /// Refuses, in this order: a theory whose pins disagree with the
    /// coordinate, a theory whose model class is not inside the base
    /// theory's, an implicit reach to a restrained value outside a lenient
    /// registry, a re-acquisition that would change an already-held
    /// theory object, an out-of-order minor, and a minor-inclusion breach
    /// against the greatest held theory below.
    ///
    /// # Two readings the caller should know
    ///
    /// **Re-acquiring what is held is admitted.** Permanence makes the
    /// theory object at a coordinate immutable, and offering that same
    /// object again changes nothing; only a *different* theory at a held
    /// coordinate is [`AcquireError::Immutable`]. Sameness is decided over
    /// the normalized print of the two theories, so comments and layout —
    /// exposition, which patch revisions are free to move — do not make a
    /// second object, while any difference the print shows does.
    ///
    /// **Inclusion is checked against one theory, not against all.** The
    /// comparison runs against the greatest held theory below the acquired
    /// minor and no lower one, which is sound because carrying a key
    /// verbatim composes along a chain.
    ///
    /// ```
    /// use cogra_interchange::{AcquireError, Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let first = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
    ///     .expect("an assignable theory");
    /// // A key new at a later minor must be optional.
    /// let second = Theory::parse(
    ///     r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, 3 => uint}"#,
    /// )
    /// .expect("an assignable theory");
    ///
    /// let mut registry = Registry::new();
    /// registry
    ///     .acquire(Coordinate::new(label.clone(), 1, 0), first)
    ///     .expect("the first minor");
    /// let err = registry
    ///     .acquire(Coordinate::new(label, 1, 1), second)
    ///     .expect_err("key 3 is new and required");
    /// assert!(matches!(err, AcquireError::InclusionViolated { against: 0, .. }));
    /// ```
    pub fn acquire(&mut self, coord: Coordinate, theory: Theory) -> Result<(), AcquireError> {
        let (major, minor) = theory.coordinate();
        if theory.label() != coord.label() || major != coord.major() || minor != coord.minor() {
            return Err(AcquireError::PinMismatch {
                found: format!("{} {major}.{minor}", theory.label()),
            });
        }
        extends_base(&theory)?;
        if !self.lenient {
            let reaches: Vec<ImplicitReach> =
                theory.restraint().implicit_reaches().cloned().collect();
            if !reaches.is_empty() {
                return Err(AcquireError::ImplicitReach { reaches });
            }
        }

        let Some(line) = self
            .lines
            .get_mut(coord.label())
            .and_then(|majors| majors.get_mut(&major))
        else {
            let companion = theory.open_companion();
            self.lines.entry(coord.label().clone()).or_default().insert(
                major,
                MajorLine {
                    entries: vec![(minor, theory)],
                    companion,
                },
            );
            return Ok(());
        };

        if let Ok(index) = line.entries.binary_search_by_key(&minor, |(held, _)| *held) {
            return match line.entries.get(index) {
                Some((_, held)) if held.to_cddl() == theory.to_cddl() => Ok(()),
                _ => Err(AcquireError::Immutable),
            };
        }

        if let Some((ceiling, below)) = line.entries.last() {
            let ceiling = *ceiling;
            if minor <= ceiling {
                return Err(AcquireError::OutOfOrder { minor, ceiling });
            }
            if let Inclusion::Violated(breaches) = compare(below, &theory) {
                return Err(AcquireError::InclusionViolated {
                    against: ceiling,
                    breaches,
                });
            }
        }

        line.entries.push((minor, theory));
        line.remember_companion();
        Ok(())
    }

    /// Acquire an ordered sequence, one coordinate at a time, stopping at
    /// the first refusal and reporting it. Coordinates taken before the
    /// refusal stay held.
    ///
    /// A convenience over [`Registry::acquire`] with no semantics of its
    /// own — the loop every consumer would otherwise write. It is
    /// expressly not a file format, a manifest, or a fetch.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let sources = [
    ///     r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#,
    ///     r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 3 => uint}"#,
    /// ];
    /// let published = sources.iter().enumerate().map(|(minor, source)| {
    ///     (
    ///         Coordinate::new(label.clone(), 1, minor as u64),
    ///         Theory::parse(source).expect("an assignable theory"),
    ///     )
    /// });
    ///
    /// let mut registry = Registry::new();
    /// registry.acquire_all(published).expect("an ascending chain");
    /// assert_eq!(registry.ceiling(&label, 1), Some(1));
    /// ```
    pub fn acquire_all(
        &mut self,
        theories: impl IntoIterator<Item = (Coordinate, Theory)>,
    ) -> Result<(), AcquireError> {
        for (coord, theory) in theories {
            self.acquire(coord, theory)?;
        }
        Ok(())
    }

    /// Decline a major from a minor upward.
    ///
    /// Refusal truncates: nothing at or above `from_minor` is held
    /// thereafter, and the ceiling falls. This is the API form of the
    /// host-policy clause — whether a host processes a given theory's CDDL
    /// is the host's policy, and a reader that will not process an
    /// assigned theory holds neither it nor anything above it in that
    /// major, which is what preserves downward-closed holding. The natural
    /// caller is a consumer whose [`Theory::parse`] returned
    /// [`crate::TheoryError::Unevaluable`].
    ///
    /// Refusing a major nothing is held of does nothing.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let mut registry = Registry::new();
    /// for minor in 0..3u64 {
    ///     let source =
    ///         format!(r#"e = {{0 => "com.example", 1 => [1, {minor}, uint], 2 => tstr}}"#);
    ///     registry
    ///         .acquire(
    ///             Coordinate::new(label.clone(), 1, minor),
    ///             Theory::parse(&source).expect("an assignable theory"),
    ///         )
    ///         .expect("an ascending chain");
    /// }
    ///
    /// registry.refuse(&label, 1, 1);
    /// assert_eq!(registry.ceiling(&label, 1), Some(0));
    /// assert_eq!(registry.minors(&label, 1).collect::<Vec<u64>>(), vec![0]);
    /// ```
    pub fn refuse(&mut self, label: &NamespaceLabel, major: u64, from_minor: u64) {
        let Some(majors) = self.lines.get_mut(label) else {
            return;
        };
        let Some(line) = majors.get_mut(&major) else {
            return;
        };

        line.entries.retain(|(minor, _)| *minor < from_minor);
        if line.entries.is_empty() {
            majors.remove(&major);
            if majors.is_empty() {
                self.lines.remove(label);
            }
        } else {
            line.remember_companion();
        }
    }

    /// The greatest minor held of this major, if any is held.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [2, 7, uint], 2 => tstr}"#)
    ///     .expect("an assignable theory");
    ///
    /// let mut registry = Registry::new();
    /// registry
    ///     .acquire(Coordinate::new(label.clone(), 2, 7), theory)
    ///     .expect("a first minor, wherever it starts");
    ///
    /// assert_eq!(registry.ceiling(&label, 2), Some(7));
    /// assert_eq!(registry.ceiling(&label, 3), None);
    /// ```
    pub fn ceiling(&self, label: &NamespaceLabel, major: u64) -> Option<u64> {
        self.holding(label, major).map(|holding| holding.ceiling)
    }

    /// Whether this exact coordinate is held.
    ///
    /// A coordinate below the ceiling that is not held was never assigned:
    /// the answer is knowledge about the owner's registry, not a gap in
    /// this copy of it.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
    ///     .expect("an assignable theory");
    ///
    /// let mut registry = Registry::new();
    /// registry
    ///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
    ///     .expect("the first minor");
    ///
    /// assert!(registry.holds(&Coordinate::new(label.clone(), 1, 0)));
    /// assert!(!registry.holds(&Coordinate::new(label, 1, 1)));
    /// ```
    pub fn holds(&self, coord: &Coordinate) -> bool {
        self.theory(coord).is_some()
    }

    /// Whether any minor of this major is held.
    ///
    /// The question dispatch asks first: holding no minor of a major, a
    /// reader rejects every document of it whole, and that rejection is a
    /// fact about the state rather than about the document.
    ///
    /// ```
    /// use cogra_interchange::{NamespaceLabel, Registry};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// assert!(!Registry::new().holds_major(&label, 1));
    /// ```
    pub fn holds_major(&self, label: &NamespaceLabel, major: u64) -> bool {
        self.holding(label, major).is_some()
    }

    /// The theory held at this coordinate, if it is held.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let source = r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#;
    /// let theory = Theory::parse(source).expect("an assignable theory");
    ///
    /// let mut registry = Registry::new();
    /// registry
    ///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
    ///     .expect("the first minor");
    ///
    /// let held = registry
    ///     .theory(&Coordinate::new(label, 1, 0))
    ///     .expect("the coordinate is held");
    /// assert_eq!(held.source(), source);
    /// ```
    pub fn theory(&self, coord: &Coordinate) -> Option<&Theory> {
        self.holding(coord.label(), coord.major())?
            .theory(coord.minor())
    }

    /// The held minors of this major, ascending.
    ///
    /// The sequence is complete below the ceiling, so a minor missing from
    /// it was never assigned.
    ///
    /// ```
    /// use cogra_interchange::{NamespaceLabel, Registry};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let registry = Registry::new();
    /// assert_eq!(registry.minors(&label, 1).count(), 0);
    /// ```
    pub fn minors(&self, label: &NamespaceLabel, major: u64) -> impl Iterator<Item = u64> + '_ {
        self.lines
            .get(label)
            .and_then(|majors| majors.get(&major))
            .map_or(&[][..], |line| line.entries.as_slice())
            .iter()
            .map(|(minor, _)| *minor)
    }

    /// The greatest held coordinate of this label: what an emitter
    /// targets.
    ///
    /// Targeting and stamping are two acts. An emitter targets the
    /// greatest coordinate it supports — the vocabulary it writes under —
    /// and stamps the least minor its content satisfies
    /// ([`Registry::stamp`]).
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel, Registry, Theory};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let mut registry = Registry::new();
    /// for (major, minor) in [(1u64, 0u64), (1, 1), (2, 0)] {
    ///     let source =
    ///         format!(r#"e = {{0 => "com.example", 1 => [{major}, {minor}, uint], 2 => tstr}}"#);
    ///     registry
    ///         .acquire(
    ///             Coordinate::new(label.clone(), major, minor),
    ///             Theory::parse(&source).expect("an assignable theory"),
    ///         )
    ///         .expect("ascending within each major");
    /// }
    ///
    /// assert_eq!(registry.target(&label), Some(Coordinate::new(label, 2, 0)));
    /// ```
    pub fn target(&self, label: &NamespaceLabel) -> Option<Coordinate> {
        let (major, line) = self.lines.get(label)?.iter().next_back()?;
        let (minor, _) = line.entries.last()?;
        Some(Coordinate::new(label.clone(), *major, *minor))
    }

    /// The least held minor of this major whose theory this content
    /// satisfies: what an emitter stamps.
    ///
    /// Satisfaction is tested against the *content class* rather than
    /// against the whole document, because the whole document's key 1 pins
    /// the very minor being sought. The content is judged inside the
    /// envelope each candidate theory itself pins, which is exactly the
    /// question "is this content the content of some document that theory
    /// admits".
    ///
    /// # Why a binary search is sound here
    ///
    /// The satisfying minors are upward closed: a later minor carries
    /// every earlier key verbatim and adds only optional ones, so the
    /// content class of an earlier theory is included in that of every
    /// later one. Acquisition is what keeps that true — it refuses a minor
    /// that breaks the additive regime — and a linear scan would answer
    /// the same, one probe at a time.
    ///
    /// ```
    /// use cogra_interchange::{
    ///     Content, ContentKey, Coordinate, NamespaceLabel, Registry, Theory, Value,
    /// };
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let sources = [
    ///     r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#,
    ///     r#"e = {0 => "com.example", 1 => [1, 1, uint], 2 => tstr, ? 3 => uint}"#,
    /// ];
    /// let mut registry = Registry::new();
    /// for (minor, source) in sources.iter().enumerate() {
    ///     registry
    ///         .acquire(
    ///             Coordinate::new(label.clone(), 1, minor as u64),
    ///             Theory::parse(source).expect("an assignable theory"),
    ///         )
    ///         .expect("an ascending chain");
    /// }
    ///
    /// let mut content = Content::new();
    /// content.insert(
    ///     ContentKey::new(2).expect("a content key"),
    ///     Value::Text("hello".to_owned().into()),
    /// );
    /// // Nothing here needs the vocabulary minor 1 added.
    /// assert_eq!(registry.stamp(&label, 1, &content), Some(0));
    ///
    /// content.insert(ContentKey::new(3).expect("a content key"), Value::Unsigned(7));
    /// assert_eq!(registry.stamp(&label, 1, &content), Some(1));
    /// ```
    pub fn stamp(&self, label: &NamespaceLabel, major: u64, content: &Content) -> Option<u64> {
        let entries = self.lines.get(label)?.get(&major)?.entries.as_slice();
        let index = entries.partition_point(|(_, theory)| !models(theory, content));
        entries.get(index).map(|(minor, _)| *minor)
    }

    /// What this reader holds of one major, in one descent.
    pub(crate) fn holding(&self, label: &NamespaceLabel, major: u64) -> Option<Holding<'_>> {
        let line = self.lines.get(label)?.get(&major)?;
        let (ceiling, _) = line.entries.last()?;
        Some(Holding {
            ceiling: *ceiling,
            companion: &line.companion,
            entries: line.entries.as_slice(),
        })
    }
}

/// Whether the theory's model class is included in the base theory's.
///
/// The base theory admits any value at any content key above 1, and an
/// assigned theory pins key 1 to `[M, m, uint]`, which every version
/// admits. So the whole of the inclusion rests on the pinned label being
/// one the base theory's own recognizers accept, and the check is exactly
/// that: the theory's pinned envelope, judged by the base theory. This is
/// the acquisition-time crosscheck of the two label recognizers — the ABNF
/// scanner that built the label, and the `.regexp` and `.size` the base
/// theory carries.
fn extends_base(theory: &Theory) -> Result<(), AcquireError> {
    let (major, minor) = theory.coordinate();
    let envelope = Envelope::new(theory.label().clone(), Version::new(major, minor, 0));
    match satisfies_global(&Document::new(envelope, Content::new())) {
        crate::Satisfaction::Holds => Ok(()),
        crate::Satisfaction::Fails(mismatches) => Err(AcquireError::NotExtendingBase {
            detail: mismatches
                .iter()
                .map(|mismatch| {
                    format!(
                        "{}: expected {}, found {}",
                        mismatch.at(),
                        mismatch.expected(),
                        mismatch.found()
                    )
                })
                .collect::<Vec<String>>()
                .join("; "),
        }),
    }
}

/// Whether the content lies in the theory's content class.
///
/// The content class of a theory is the set of contents of the documents
/// it admits, so the question is answered by putting the content inside
/// the envelope the theory itself pins — label and coordinate — and asking
/// the ordinary judgment. The patch position is free in every assigned
/// theory, so the zero chosen for it is not a choice.
fn models(theory: &Theory, content: &Content) -> bool {
    let (major, minor) = theory.coordinate();
    let envelope = Envelope::new(theory.label().clone(), Version::new(major, minor, 0));
    satisfies(&Document::new(envelope, content.clone()), theory).holds()
}
