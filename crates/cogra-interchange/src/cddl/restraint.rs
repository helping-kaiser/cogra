//! The restraint report over an assigned theory.
//!
//! The invariant: an assigned theory admits floating-point values, tags, or
//! simple values other than `false`, `true`, and `null` only by explicit
//! provision, and every such provision fixes the canonical form of what it
//! admits. This module makes that machine-visible — it *computes* where a
//! theory reaches such a value and how, and enforces nothing: refusing a
//! theory that reaches one without naming it is acquisition's act
//! (´sig:xchg:restraint-api´).
//!
//! # What separates a provision from a reach
//!
//! The line is *what the theory's author wrote*. The walk descends through
//! the theory's own rules, because the author wrote them and every position
//! inside them is a position they chose. A name of the standard prelude is
//! not descended into: the author did not write `float16-32 / float64`,
//! they wrote `float`. So a prelude name is classified by what it denotes:
//!
//! - everything it admits is of one restrained kind — `float`, `time`,
//!   `undefined` — and naming it is an **explicit provision**;
//! - it admits a restrained kind among other things — `number`, which is
//!   `int / float`, or `any`, which is everything — and naming it is an
//!   **implicit reach**, because nothing in what the author wrote says
//!   "float".
//!
//! The forms written inline fall the same way. `#7.25`, `#6.1(tstr)`,
//! `#7.23`, and a floating-point literal each name the kind at the
//! position; `#`, a bare `#7`, and a bare `#6` admit one without naming it,
//! and are the "unrestricted major-type reference" the design names.
//!
//! # Where the walk stops
//!
//! Three stops, each recorded rather than assumed.
//!
//! - **A prelude name is not descended into**, per the line above. So
//!   `time`, whose tag carries a `number`, is one provision of a tag and
//!   not also a reach to the float inside it. A tag written *inline* by the
//!   author is a provision and its content is walked, because the author
//!   wrote that content.
//! - **A control operator's operand is not a position.** `.size 4` and
//!   `.eq 1.5` carry control values, which constrain a position rather than
//!   being one. Both endpoints of a *range* are positions, and are walked.
//! - **Generic parameters are not substituted.** A generic argument is
//!   walked where it is written, so `a<float>` reports the float; a
//!   parameter standing in a generic rule's body resolves to nothing and
//!   contributes nothing there.
//!
//! Recursive rules terminate on a visited set of the own-rule names one
//! content key's walk has entered: a rule reached twice under one key
//! contributes its findings once.

use std::collections::BTreeSet;

use super::ast::{
    GenericArgs, Group, GroupEntry, GroupEntryKind, MemberKey, MemberKeyKind, Name, Operator,
    RuleBody, Type, Type1, Type2, Type2Kind, Uint, ValueKind,
};
use super::resolve::RuleTable;
use super::{Theory, fragment, print};
use crate::ContentKey;

/// A kind of value the restraint invariant governs.
///
/// The three the conventions name, and no fourth: everything else the data
/// language carries is admitted freely.
///
/// ```
/// use cogra_interchange::{Restrained, Theory};
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => float64}"#)
///     .expect("an assignable theory");
/// let report = theory.restraint();
/// let kinds: Vec<Restrained> = report.provisions().map(|p| p.kind()).collect();
/// assert_eq!(kinds, [Restrained::Float]);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum Restrained {
    /// A floating-point value.
    Float,
    /// A tagged item.
    Tag,
    /// A simple value other than `false`, `true`, and `null`.
    Simple,
}

/// Where an assigned theory reaches a floating-point value, a tag, or a
/// simple value other than `false`, `true`, and `null`.
///
/// ```
/// use cogra_interchange::Theory;
///
/// let theory = Theory::parse(
///     r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => uint, ? 3 => tstr}"#,
/// )
/// .expect("an assignable theory");
/// let report = theory.restraint();
/// assert!(report.is_restrained());
/// assert_eq!(report.provisions().count(), 0);
/// assert_eq!(report.implicit_reaches().count(), 0);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct RestraintReport {
    provisions: Vec<Provision>,
    implicit_reaches: Vec<ImplicitReach>,
}

impl RestraintReport {
    /// Whether the theory obeys the restraint invariant: it reaches a
    /// restrained value only by explicit provision.
    ///
    /// True exactly when [`RestraintReport::implicit_reaches`] is empty — a
    /// theory that reaches nothing restrained at all is restrained
    /// vacuously, and one whose every reach is named is restrained by
    /// provision. This is the predicate acquisition refuses on
    /// (´dec:xchg:restraint-enforcement´).
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let named = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => float64}"#)
    ///     .expect("an assignable theory");
    /// assert!(named.restraint().is_restrained());
    ///
    /// let reaching = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => any}"#)
    ///     .expect("an assignable theory");
    /// assert!(!reaching.restraint().is_restrained());
    /// ```
    pub fn is_restrained(&self) -> bool {
        self.implicit_reaches.is_empty()
    }

    /// The explicit provisions, in ascending key order.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(
    ///     r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => float32, ? 3 => #6.1(tstr)}"#,
    /// )
    /// .expect("an assignable theory");
    /// let keys: Vec<u64> = theory
    ///     .restraint()
    ///     .provisions()
    ///     .map(|provision| provision.key().get())
    ///     .collect();
    /// assert_eq!(keys, [2, 3]);
    /// ```
    pub fn provisions(&self) -> impl Iterator<Item = &Provision> + '_ {
        self.provisions.iter()
    }

    /// The positions reaching a restrained value without naming it, in
    /// ascending key order.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => number}"#)
    ///     .expect("an assignable theory");
    /// let report = theory.restraint();
    /// // `number` is `int / float`: the float is reached, and unnamed.
    /// assert_eq!(report.implicit_reaches().count(), 1);
    /// ```
    pub fn implicit_reaches(&self) -> impl Iterator<Item = &ImplicitReach> + '_ {
        self.implicit_reaches.iter()
    }
}

/// An explicit provision: a position naming a restrained kind, and whether
/// it fixes the canonical form of what it admits.
///
/// ```
/// use cogra_interchange::Theory;
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => float64}"#)
///     .expect("an assignable theory");
/// let report = theory.restraint();
/// let provision = report.provisions().next().expect("one provision");
/// assert_eq!(provision.named(), "float64");
/// assert!(provision.fixes_canonical_form());
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct Provision {
    key: ContentKey,
    kind: Restrained,
    named: String,
    fixes_canonical_form: bool,
}

impl Provision {
    /// The content key under which the provision stands.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 5 => float}"#)
    ///     .expect("an assignable theory");
    /// let report = theory.restraint();
    /// assert_eq!(report.provisions().next().expect("one").key().get(), 5);
    /// ```
    pub fn key(&self) -> ContentKey {
        self.key
    }

    /// Which restrained kind the position admits.
    ///
    /// ```
    /// use cogra_interchange::{Restrained, Theory};
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => time}"#)
    ///     .expect("an assignable theory");
    /// let report = theory.restraint();
    /// assert_eq!(report.provisions().next().expect("one").kind(), Restrained::Tag);
    /// ```
    pub fn kind(&self) -> Restrained {
        self.kind
    }

    /// What the position writes: the name, or the form as the normalized
    /// printer renders it.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => #7.25}"#)
    ///     .expect("an assignable theory");
    /// let report = theory.restraint();
    /// assert_eq!(report.provisions().next().expect("one").named(), "#7.25");
    /// ```
    pub fn named(&self) -> &str {
        &self.named
    }

    /// Whether the provision names the *one* form of what it admits: a
    /// single floating-point width, a single tag number, a single simple
    /// value.
    ///
    /// This is the conservative fact the crate can compute, and the rustdoc
    /// says exactly that much: `float64` names a width and `float` does
    /// not; `#6.1(tstr)` names a tag number and `#6(tstr)` does not. What
    /// the invariant's "fixes the canonical form of what it admits"
    /// requires *beyond* that — whether tags are required or forbidden, how
    /// negative zero and subnormals are handled, whether integral-valued
    /// floats may be written as integers — is an open question the design
    /// records and does not settle, and this flag is not an answer to it
    /// (´dec:xchg:restraint-enforcement´).
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(
    ///     r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => float, 3 => float16}"#,
    /// )
    /// .expect("an assignable theory");
    /// let report = theory.restraint();
    /// let fixed: Vec<bool> = report
    ///     .provisions()
    ///     .map(|provision| provision.fixes_canonical_form())
    ///     .collect();
    /// assert_eq!(fixed, [false, true]);
    /// ```
    pub fn fixes_canonical_form(&self) -> bool {
        self.fixes_canonical_form
    }
}

/// A position admitting a restrained value without naming it — through
/// `any`, through an unrestricted major-type reference, or through a
/// prelude type that reaches one.
///
/// ```
/// use cogra_interchange::Theory;
///
/// let theory = Theory::parse(concat!(
///     "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => payload}\n",
///     "payload = [* any]\n",
/// ))
/// .expect("an assignable theory");
/// let report = theory.restraint();
/// let reach = report.implicit_reaches().next().expect("a reach");
/// assert_eq!(reach.key().get(), 2);
/// assert_eq!(reach.path().collect::<Vec<&str>>(), ["payload", "any"]);
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct ImplicitReach {
    key: ContentKey,
    kind: Restrained,
    path: Vec<String>,
}

impl ImplicitReach {
    /// The content key under which the reach stands.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 4 => any}"#)
    ///     .expect("an assignable theory");
    /// let report = theory.restraint();
    /// assert_eq!(report.implicit_reaches().next().expect("a reach").key().get(), 4);
    /// ```
    pub fn key(&self) -> ContentKey {
        self.key
    }

    /// Which restrained kind is reached.
    ///
    /// ```
    /// use cogra_interchange::{Restrained, Theory};
    ///
    /// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => number}"#)
    ///     .expect("an assignable theory");
    /// let report = theory.restraint();
    /// let reach = report.implicit_reaches().next().expect("a reach");
    /// assert_eq!(reach.kind(), Restrained::Float);
    /// ```
    pub fn kind(&self) -> Restrained {
        self.kind
    }

    /// The path by which it reaches: the theory's own rules entered, in
    /// order, ending in the form that does the reaching.
    ///
    /// Structural steps — an array, a map entry — are not recorded; the
    /// names are what a reader needs to find the position again.
    ///
    /// ```
    /// use cogra_interchange::Theory;
    ///
    /// let theory = Theory::parse(concat!(
    ///     "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => outer}\n",
    ///     "outer = [* inner]\n",
    ///     "inner = number\n",
    /// ))
    /// .expect("an assignable theory");
    /// let report = theory.restraint();
    /// let reach = report.implicit_reaches().next().expect("a reach");
    /// assert_eq!(
    ///     reach.path().collect::<Vec<&str>>(),
    ///     ["outer", "inner", "number"]
    /// );
    /// ```
    pub fn path(&self) -> impl Iterator<Item = &str> + '_ {
        self.path.iter().map(String::as_str)
    }
}

/// Compute the report: one walk per content key, in ascending key order.
pub(crate) fn report(theory: &Theory) -> RestraintReport {
    let mut entries = fragment::content_entries(&theory.cddl);
    entries.sort_by_key(|(key, _, _)| key.get());

    let mut report = RestraintReport::default();
    for (key, _, ty) in entries {
        let mut walk = Walk {
            table: &theory.table,
            key,
            path: Vec::new(),
            entered: BTreeSet::new(),
            report: &mut report,
        };
        walk.ty(ty);
    }
    report
}

/// One content key's walk.
struct Walk<'t> {
    table: &'t RuleTable,
    key: ContentKey,
    path: Vec<String>,
    entered: BTreeSet<String>,
    report: &'t mut RestraintReport,
}

impl Walk<'_> {
    fn body(&mut self, body: &RuleBody) {
        match body {
            RuleBody::Type(ty) => self.ty(ty),
            RuleBody::Group(entry) => self.entry(entry),
        }
    }

    fn ty(&mut self, ty: &Type) {
        for choice in &ty.choices {
            self.type1(choice);
        }
    }

    /// Both endpoints of a range are positions, since both are admitted; a
    /// control operator's operand is a control value and no position of its
    /// own, so it is not walked.
    fn type1(&mut self, ty: &Type1) {
        self.type2(&ty.target);
        if let Some(operation) = &ty.operation
            && !matches!(operation.operator, Operator::Control(_))
        {
            self.type2(&operation.operand);
        }
    }

    /// One `type2`. A float literal is a provision naming a value and no
    /// width; a tag's inner type is a position of the author's like any
    /// other, since they wrote what the tag carries.
    fn type2(&mut self, ty: &Type2) {
        match &ty.kind {
            Type2Kind::Value(value) => {
                if let ValueKind::Number(number) = &value.kind
                    && number.is_float
                {
                    self.provision(Restrained::Float, &number.text, false);
                }
            }
            Type2Kind::Any => {
                let spelling = printed(ty);
                for kind in [Restrained::Float, Restrained::Tag, Restrained::Simple] {
                    self.implicit(kind, &spelling);
                }
            }
            Type2Kind::Representation { major, ai } => self.representation(*major, ai, ty),
            Type2Kind::Tagged { number, inner } => {
                self.provision(Restrained::Tag, &printed(ty), number.is_some());
                self.ty(inner);
            }
            Type2Kind::Typename { name, args } | Type2Kind::EnumGroup { name, args } => {
                self.args(args);
                self.reference(name, false);
            }
            Type2Kind::Unwrap { name, args } => {
                self.args(args);
                self.reference(name, true);
            }
            Type2Kind::Parenthesized(inner) => self.ty(inner),
            Type2Kind::Map(group) | Type2Kind::Array(group) => self.group(group),
            Type2Kind::EnumInline(group) => self.group(group),
        }
    }

    /// `#N` and `#N.M`: the major-type forms, restricted or not.
    ///
    /// An `ai` this crate cannot read as a number restricts major 7 to
    /// something unreadable rather than to nothing, as does an unrestricted
    /// `#6.<unreadable>`; both fall to the final arm with the major types that
    /// carry nothing restrained.
    fn representation(&mut self, major: u8, ai: &Option<Uint>, ty: &Type2) {
        let spelling = printed(ty);
        match (
            major,
            ai.as_ref().and_then(|ai| fragment::uint_text(&ai.text)),
        ) {
            (MAJOR_TAG, None) => self.implicit(Restrained::Tag, &spelling),
            (MAJOR_TAG, Some(_)) => self.provision(Restrained::Tag, &spelling, true),
            (MAJOR_SEVEN, None) => {
                self.implicit(Restrained::Float, &spelling);
                self.implicit(Restrained::Simple, &spelling);
            }
            (MAJOR_SEVEN, Some(ai)) => match ai {
                FALSE | TRUE | NULL => {}
                HALF | SINGLE | DOUBLE => {
                    self.provision(Restrained::Float, &spelling, true);
                }
                _ => self.provision(Restrained::Simple, &spelling, true),
            },
            _ => {}
        }
    }

    /// Generic arguments, walked without substitution: an argument is a
    /// position where it is written, and a parameter inside the generic rule's
    /// body resolves to nothing.
    fn args(&mut self, args: &Option<GenericArgs>) {
        let Some(args) = args else {
            return;
        };
        for arg in &args.args {
            self.type1(arg);
        }
    }

    fn group(&mut self, group: &Group) {
        for choice in &group.choices {
            for entry in &choice.entries {
                self.entry(entry);
            }
        }
    }

    fn entry(&mut self, entry: &GroupEntry) {
        match &entry.kind {
            GroupEntryKind::Member { key, value } => {
                if let Some(key) = key {
                    self.member_key(key);
                }
                self.ty(value);
            }
            GroupEntryKind::Inline(group) => self.group(group),
        }
    }

    /// A map key is a position too: a map keyed by floats admits floats.
    fn member_key(&mut self, key: &MemberKey) {
        match &key.kind {
            MemberKeyKind::Bareword(_) | MemberKeyKind::Value(_) => {}
            MemberKeyKind::Type { key, .. } => self.type1(key),
        }
    }

    /// A reference to a rule: descended into where the theory owns it,
    /// classified by its denotation where the prelude does.
    ///
    /// A name the table does not hold contributes nothing — an undefined
    /// socket is the empty choice, and a generic parameter stands for its
    /// argument, which was walked where it was written. Under `~` the tag is
    /// stripped, so what the position admits is what the tag carries.
    fn reference(&mut self, name: &Name, unwrap: bool) {
        let table = self.table;
        let Some(rule) = table.get(&name.text) else {
            return;
        };
        let inner = if unwrap {
            tagged_inner(rule.body())
        } else {
            None
        };
        let spelling = if unwrap {
            format!("~{}", name.text)
        } else {
            name.text.clone()
        };

        if rule.is_from_prelude() {
            let shape = match inner {
                Some(ty) => shape_of_type(table, ty, &mut BTreeSet::new()),
                None => shape_of_body(table, rule.body(), &mut BTreeSet::new()),
            };
            self.classify(shape, &spelling);
            return;
        }

        if !self.entered.insert(name.text.clone()) {
            return;
        }
        self.path.push(spelling);
        match inner {
            Some(ty) => self.ty(ty),
            None => self.body(rule.body()),
        }
        self.path.pop();
    }

    /// A prelude name: a provision where everything it admits is of one
    /// restrained kind, a reach where it admits one among other things.
    fn classify(&mut self, shape: Shape, spelling: &str) {
        match shape.sole_kind() {
            Some(kind) => self.provision(kind, spelling, shape.pin(kind).fixes()),
            None => {
                for kind in shape.kinds() {
                    self.implicit(kind, spelling);
                }
            }
        }
    }

    fn provision(&mut self, kind: Restrained, named: &str, fixes_canonical_form: bool) {
        let provision = Provision {
            key: self.key,
            kind,
            named: named.to_owned(),
            fixes_canonical_form,
        };
        if !self.report.provisions.contains(&provision) {
            self.report.provisions.push(provision);
        }
    }

    fn implicit(&mut self, kind: Restrained, spelling: &str) {
        let mut path = self.path.clone();
        path.push(spelling.to_owned());
        let reach = ImplicitReach {
            key: self.key,
            kind,
            path,
        };
        if !self.report.implicit_reaches.contains(&reach) {
            self.report.implicit_reaches.push(reach);
        }
    }
}

/// Major type 6, the tagged item.
const MAJOR_TAG: u8 = 6;
/// Major type 7, where the floats and the simple values live.
const MAJOR_SEVEN: u8 = 7;

/// The three simple values the invariant admits freely, and the three
/// floating-point widths, as major type 7's additional information writes
/// them.
const FALSE: u64 = 20;
const TRUE: u64 = 21;
const NULL: u64 = 22;
const HALF: u64 = 25;
const SINGLE: u64 = 26;
const DOUBLE: u64 = 27;

fn printed(ty: &Type2) -> String {
    let mut out = String::new();
    print::print_type2(ty, &mut out);
    out
}

/// The type a tagged rule carries, where the rule's body is one tag.
fn tagged_inner(body: &RuleBody) -> Option<&Type> {
    let RuleBody::Type(ty) = body else {
        return None;
    };
    let [only] = ty.choices.as_slice() else {
        return None;
    };
    if only.operation.is_some() {
        return None;
    }
    match &only.target.kind {
        Type2Kind::Tagged { inner, .. } => Some(inner),
        _ => None,
    }
}

/// The named form of an admitted kind: none, exactly one, or not fixed.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq)]
enum Pin {
    /// The kind is not admitted here.
    #[default]
    Absent,
    /// It is, and one form of it is named: a width, a tag number, a simple
    /// value.
    Fixed(u64),
    /// It is, and no single form is named.
    Loose,
}

impl Pin {
    fn join(self, other: Pin) -> Pin {
        match (self, other) {
            (Pin::Absent, pin) | (pin, Pin::Absent) => pin,
            (Pin::Fixed(one), Pin::Fixed(two)) if one == two => Pin::Fixed(one),
            _ => Pin::Loose,
        }
    }

    fn is_absent(self) -> bool {
        matches!(self, Pin::Absent)
    }

    fn fixes(self) -> bool {
        matches!(self, Pin::Fixed(_))
    }
}

/// What a type admits at its own top level: the restrained kinds, each with
/// its named form, and whether anything unrestrained is admitted beside
/// them.
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq)]
struct Shape {
    plain: bool,
    float: Pin,
    tag: Pin,
    simple: Pin,
}

impl Shape {
    fn plain() -> Shape {
        Shape {
            plain: true,
            ..Shape::default()
        }
    }

    fn of(kind: Restrained, pin: Pin) -> Shape {
        let mut shape = Shape::default();
        match kind {
            Restrained::Float => shape.float = pin,
            Restrained::Tag => shape.tag = pin,
            Restrained::Simple => shape.simple = pin,
        }
        shape
    }

    fn join(self, other: Shape) -> Shape {
        Shape {
            plain: self.plain || other.plain,
            float: self.float.join(other.float),
            tag: self.tag.join(other.tag),
            simple: self.simple.join(other.simple),
        }
    }

    fn pin(self, kind: Restrained) -> Pin {
        match kind {
            Restrained::Float => self.float,
            Restrained::Tag => self.tag,
            Restrained::Simple => self.simple,
        }
    }

    fn kinds(self) -> Vec<Restrained> {
        [Restrained::Float, Restrained::Tag, Restrained::Simple]
            .into_iter()
            .filter(|kind| !self.pin(*kind).is_absent())
            .collect()
    }

    /// The one restrained kind this admits and nothing else, where there is
    /// one: what makes naming it an explicit provision.
    fn sole_kind(self) -> Option<Restrained> {
        if self.plain {
            return None;
        }
        match self.kinds().as_slice() {
            [only] => Some(*only),
            _ => None,
        }
    }
}

/// The shape of a rule body. A group is not an item, so as a position it
/// admits no restrained kind at all.
fn shape_of_body(table: &RuleTable, body: &RuleBody, seen: &mut BTreeSet<String>) -> Shape {
    match body {
        RuleBody::Type(ty) => shape_of_type(table, ty, seen),
        RuleBody::Group(_) => Shape::default(),
    }
}

fn shape_of_type(table: &RuleTable, ty: &Type, seen: &mut BTreeSet<String>) -> Shape {
    ty.choices.iter().fold(Shape::default(), |shape, choice| {
        shape.join(shape_of_type2(table, &choice.target, seen))
    })
}

fn shape_of_type2(table: &RuleTable, ty: &Type2, seen: &mut BTreeSet<String>) -> Shape {
    match &ty.kind {
        Type2Kind::Value(value) => match &value.kind {
            ValueKind::Number(number) if number.is_float => {
                Shape::of(Restrained::Float, Pin::Loose)
            }
            _ => Shape::plain(),
        },
        Type2Kind::Any => Shape {
            plain: true,
            float: Pin::Loose,
            tag: Pin::Loose,
            simple: Pin::Loose,
        },
        Type2Kind::Representation { major, ai } => {
            let ai = ai.as_ref().and_then(|ai| fragment::uint_text(&ai.text));
            match (*major, ai) {
                (MAJOR_TAG, None) => Shape::of(Restrained::Tag, Pin::Loose),
                (MAJOR_TAG, Some(number)) => Shape::of(Restrained::Tag, Pin::Fixed(number)),
                (MAJOR_SEVEN, None) => Shape {
                    plain: true,
                    float: Pin::Loose,
                    tag: Pin::Absent,
                    simple: Pin::Loose,
                },
                (MAJOR_SEVEN, Some(ai)) => match ai {
                    FALSE | TRUE | NULL => Shape::plain(),
                    HALF | SINGLE | DOUBLE => Shape::of(Restrained::Float, Pin::Fixed(ai)),
                    _ => Shape::of(Restrained::Simple, Pin::Fixed(ai)),
                },
                _ => Shape::plain(),
            }
        }
        Type2Kind::Tagged { number, .. } => Shape::of(
            Restrained::Tag,
            match number.as_ref().and_then(|n| fragment::uint_text(&n.text)) {
                Some(number) => Pin::Fixed(number),
                None => Pin::Loose,
            },
        ),
        Type2Kind::Parenthesized(inner) => shape_of_type(table, inner, seen),
        Type2Kind::Map(_) | Type2Kind::Array(_) => Shape::plain(),
        Type2Kind::EnumInline(group) => shape_of_group(table, group, seen),
        Type2Kind::EnumGroup { name, .. } => match resolved(table, name, seen) {
            Some(RuleBody::Group(entry)) => shape_of_entry(table, entry, seen),
            Some(body) => shape_of_body(table, body, seen),
            None => Shape::default(),
        },
        Type2Kind::Typename { name, .. } => match resolved(table, name, seen) {
            Some(body) => shape_of_body(table, body, seen),
            None => Shape::default(),
        },
        Type2Kind::Unwrap { name, .. } => match resolved(table, name, seen) {
            Some(body) => match tagged_inner(body) {
                Some(inner) => shape_of_type(table, inner, seen),
                None => Shape::plain(),
            },
            None => Shape::default(),
        },
    }
}

/// The body a name stands for, unless this computation already went
/// through it — a cycle among the rules adds nothing new to a union.
fn resolved<'t>(
    table: &'t RuleTable,
    name: &Name,
    seen: &mut BTreeSet<String>,
) -> Option<&'t RuleBody> {
    if !seen.insert(name.text.clone()) {
        return None;
    }
    Some(table.get(&name.text)?.body())
}

/// The values an enumeration admits: those of the group's entries.
fn shape_of_group(table: &RuleTable, group: &Group, seen: &mut BTreeSet<String>) -> Shape {
    let mut shape = Shape::default();
    for choice in &group.choices {
        for entry in &choice.entries {
            shape = shape.join(shape_of_entry(table, entry, seen));
        }
    }
    shape
}

fn shape_of_entry(table: &RuleTable, entry: &GroupEntry, seen: &mut BTreeSet<String>) -> Shape {
    match &entry.kind {
        GroupEntryKind::Member { value, .. } => shape_of_type(table, value, seen),
        GroupEntryKind::Inline(group) => shape_of_group(table, group, seen),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shape(source: &str) -> Shape {
        let theory = match Theory::parse(&format!(
            r#"e = {{0 => "com.example", 1 => [0, 0, uint], 2 => {source}}}"#
        )) {
            Ok(theory) => theory,
            Err(error) => panic!("expected {source:?} at a content key, but: {error}"),
        };
        let entries = fragment::content_entries(&theory.cddl);
        let [(_, _, ty)] = entries.as_slice() else {
            panic!("one content key");
        };
        shape_of_type(&theory.table, ty, &mut BTreeSet::new())
    }

    /// The prelude's float names, read off the prelude itself: `float64`
    /// pins a width and `float` does not, which is the whole of what
    /// `fixes_canonical_form` reports.
    #[test]
    fn the_prelude_float_names_pin_their_widths() {
        assert_eq!(shape("float64").float, Pin::Fixed(DOUBLE));
        assert_eq!(shape("float16").float, Pin::Fixed(HALF));
        assert_eq!(shape("float32").float, Pin::Fixed(SINGLE));
        assert_eq!(shape("float").float, Pin::Loose);
        assert_eq!(shape("float16-32").float, Pin::Loose);
        assert!(!shape("float").plain);
    }

    /// A prelude name that admits something unrestrained beside the
    /// restrained kind is not a provision, and this is why.
    #[test]
    fn a_mixed_prelude_name_admits_something_plain_as_well() {
        assert!(shape("number").plain);
        assert_eq!(shape("number").sole_kind(), None);
        assert!(shape("integer").plain);
        assert_eq!(shape("unsigned").tag, Pin::Fixed(2));
        assert_eq!(shape("unsigned").sole_kind(), None);
    }

    #[test]
    fn the_prelude_tag_names_pin_their_numbers() {
        assert_eq!(shape("time").tag, Pin::Fixed(1));
        assert_eq!(shape("time").sole_kind(), Some(Restrained::Tag));
        assert_eq!(shape("bigint").tag, Pin::Loose);
        assert_eq!(shape("bigint").sole_kind(), Some(Restrained::Tag));
    }

    #[test]
    fn the_freely_admitted_simple_values_are_not_restrained() {
        assert_eq!(shape("bool"), Shape::plain());
        assert_eq!(shape("nil"), Shape::plain());
        assert_eq!(shape("true"), Shape::plain());
        assert_eq!(shape("undefined").simple, Pin::Fixed(23));
    }

    #[test]
    fn a_cycle_among_the_rules_terminates_the_shape() {
        let theory = match Theory::parse(concat!(
            "e = {0 => \"com.example\", 1 => [0, 0, uint], 2 => a}\n",
            "a = b / uint\n",
            "b = a / tstr\n",
        )) {
            Ok(theory) => theory,
            Err(error) => panic!("expected an assigned theory, but: {error}"),
        };
        let entries = fragment::content_entries(&theory.cddl);
        let [(_, _, ty)] = entries.as_slice() else {
            panic!("one content key");
        };
        assert_eq!(
            shape_of_type(&theory.table, ty, &mut BTreeSet::new()),
            Shape::plain()
        );
    }
}
