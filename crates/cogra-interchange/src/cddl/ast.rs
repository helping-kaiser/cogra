//! The CDDL syntax tree: one node per production of RFC 8610 Appendix B.
//!
//! The tree is *faithful*, not simplified. Every construct the ABNF can
//! generate has a node here, including the constructs the version-1
//! evaluator will decline to evaluate, because fragment membership and the
//! key-by-key identity comparison are questions about a whole parsed
//! theory and neither is answerable over a region the crate could not read
//! (`design.md`, `dec:xchg:cddl-coverage`). A node that stood for "some
//! CDDL I did not understand" would make the identity comparison report
//! two different types as the same one, which is the worst answer this
//! crate could give.
//!
//! # What the tree keeps and what it drops
//!
//! It keeps everything that changes meaning: the choice of assignment
//! operator, generic parameters and arguments, the operator of a range,
//! the name of a control operator, occurrence bounds as written, the cut
//! marker, and the spelling of every literal.
//!
//! It drops what the grammar makes optional layout: whitespace, comments,
//! and the optional comma of `optcom`. Nothing downstream can tell whether
//! a group's entries were separated by commas, because `optcom = S ["," S]`
//! says nothing distinguishes them.
//!
//! # No structural equality
//!
//! These types deliberately do not implement [`PartialEq`]. Two theories
//! are compared by rendering both through the normalized printer and
//! comparing the text: spans differ between any two parses of the same
//! type written in two places, so a derived equality would report equal
//! types as different, and an equality that skipped spans would be a
//! second, silently divergent definition of type identity next to the
//! printer's. One definition is safer than two.
//!
//! # Spans
//!
//! Every node carries the [`Span`] of the source it was read from, so any
//! later refusal — an unresolved rule, a type outside the assignable
//! fragment — can be located as precisely as a syntax error.

use super::lex::{ByteQual, NumberToken, Span};

/// A whole CDDL source: `cddl = S 1*(rule S)`.
///
/// At least one rule, because the ABNF says `1*`.
#[derive(Clone, Debug)]
pub(crate) struct Cddl {
    /// The rules, in the order they were written. The first is the root.
    pub(crate) rules: Vec<Rule>,
    /// The whole source.
    pub(crate) span: Span,
}

/// One rule: `rule = typename [genericparm] S assignt S type`
/// or `groupname [genericparm] S assigng S grpent`.
#[derive(Clone, Debug)]
pub(crate) struct Rule {
    /// The type name or group name being defined.
    pub(crate) name: Name,
    /// `genericparm`, when the rule is generic.
    pub(crate) params: Option<GenericParams>,
    /// Which assignment operator was written.
    pub(crate) assign: Assign,
    /// What the rule assigns.
    pub(crate) body: RuleBody,
    /// The whole rule.
    pub(crate) span: Span,
}

/// The assignment operator, kept because the two augmenting forms mean
/// something the plain form does not.
///
/// `assignt = "=" / "/="` and `assigng = "=" / "//="`: `=` defines,
/// `/=` adds a type choice to an existing name, `//=` adds a group choice.
/// The augmenting forms are what makes the socket/plug convention of
/// RFC 8610 Section 3.9 work.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub(crate) enum Assign {
    /// `=`
    Plain,
    /// `/=`, adding an alternative to a type choice.
    TypeChoice,
    /// `//=`, adding an alternative to a group choice.
    GroupChoice,
}

impl Assign {
    /// The operator as it is written.
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Assign::Plain => "=",
            Assign::TypeChoice => "/=",
            Assign::GroupChoice => "//=",
        }
    }
}

/// What a rule assigns: a type, or a group entry.
///
/// The two rule alternatives of the ABNF are told apart by what follows
/// the assignment, not by the name in front of it — `typename` and
/// `groupname` are both `id`. With `=` either is possible, and the parser
/// resolves it as the ordered choice does: a type if the text is one, a
/// group entry otherwise.
#[derive(Clone, Debug)]
pub(crate) enum RuleBody {
    /// A type rule.
    Type(Type),
    /// A group rule, whose body is one `grpent`.
    ///
    /// Boxed: a group entry carries an occurrence indicator and a member
    /// key that a type never has, and type rules are the common case.
    Group(Box<GroupEntry>),
}

/// An `id` as it appears in the source: a type name, group name, bareword,
/// control-operator name, or generic parameter.
#[derive(Clone, Debug)]
pub(crate) struct Name {
    /// The identifier, byte for byte.
    pub(crate) text: String,
    /// Where it was written.
    pub(crate) span: Span,
}

impl Name {
    /// Whether this is a *type socket*: a name starting with one `$`.
    ///
    /// The convention of RFC 8610 Section 3.9. Nothing in the grammar
    /// distinguishes such a name — `$` is an `EALPHA` like any other — so
    /// this is a reading of the name, offered here so that resolution does
    /// not have to reinvent it.
    pub(crate) fn is_type_socket(&self) -> bool {
        self.text.starts_with('$') && !self.text.starts_with("$$")
    }

    /// Whether this is a *group socket*: a name starting with `$$`.
    pub(crate) fn is_group_socket(&self) -> bool {
        self.text.starts_with("$$")
    }
}

/// `genericparm = "<" S id S *("," S id S ) ">"`.
#[derive(Clone, Debug)]
pub(crate) struct GenericParams {
    /// The parameter names, in order. Never empty: the ABNF requires one.
    pub(crate) names: Vec<Name>,
    /// From `<` to `>`.
    pub(crate) span: Span,
}

/// `genericarg = "<" S type1 S *("," S type1 S ) ">"`.
#[derive(Clone, Debug)]
pub(crate) struct GenericArgs {
    /// The arguments, in order. Never empty: the ABNF requires one.
    ///
    /// The elements are `type1` and not `type`, so an argument cannot be a
    /// bare type choice; `<a / b>` is not generic-argument syntax.
    pub(crate) args: Vec<Type1>,
    /// From `<` to `>`.
    pub(crate) span: Span,
}

/// `type = type1 *(S "/" S type1)`: a type choice.
#[derive(Clone, Debug)]
pub(crate) struct Type {
    /// The alternatives, in order. Never empty.
    pub(crate) choices: Vec<Type1>,
    /// The whole choice.
    pub(crate) span: Span,
}

/// `type1 = type2 [S (rangeop / ctlop) S type2]`.
///
/// One operation at most: ranges and control operators do not chain, so
/// `1 .. 2 .. 3` is not CDDL.
#[derive(Clone, Debug)]
pub(crate) struct Type1 {
    /// The left-hand type.
    pub(crate) target: Type2,
    /// The operator and its right-hand type, when one was written.
    pub(crate) operation: Option<Operation>,
    /// The whole `type1`.
    pub(crate) span: Span,
}

/// The optional half of a `type1`.
#[derive(Clone, Debug)]
pub(crate) struct Operation {
    /// Which operator.
    pub(crate) operator: Operator,
    /// The right-hand type.
    pub(crate) operand: Type2,
    /// From the operator to the end of the operand.
    pub(crate) span: Span,
}

/// `rangeop = "..." / ".."` and `ctlop = "." id`.
#[derive(Clone, Debug)]
pub(crate) enum Operator {
    /// `..`, a range including its upper bound.
    RangeInclusive,
    /// `...`, a range excluding its upper bound.
    RangeExclusive,
    /// `.name`, a control operator.
    ///
    /// The name is kept as a name and nothing more. Which names this crate
    /// evaluates, and which it refuses, is settled at a later stage
    /// (`design.md`, `dec:xchg:evaluable-subset`); the parser admits every
    /// name the grammar admits, including names no implementation defines.
    Control(Name),
}

/// One alternative of `type2`.
#[derive(Clone, Debug)]
pub(crate) struct Type2 {
    /// Which alternative.
    pub(crate) kind: Type2Kind,
    /// Where it was written.
    pub(crate) span: Span,
}

/// The ten alternatives of `type2`.
#[derive(Clone, Debug)]
pub(crate) enum Type2Kind {
    /// `value`: a literal.
    Value(Value),
    /// `typename [genericarg]`: a reference to a type rule.
    Typename {
        /// The referenced name.
        name: Name,
        /// Generic arguments, when the reference instantiates them.
        args: Option<GenericArgs>,
    },
    /// `"(" S type S ")"`: a parenthesized type.
    ///
    /// Kept as its own node rather than unwrapped, because dropping the
    /// parentheses would change how the printed form reparses around a
    /// range or control operator.
    Parenthesized(Box<Type>),
    /// `"{" S group S "}"`: a map.
    Map(Group),
    /// `"[" S group S "]"`: an array.
    Array(Group),
    /// `"~" S typename [genericarg]`: unwrapping a tag or a wrapped group.
    Unwrap {
        /// The name being unwrapped.
        name: Name,
        /// Generic arguments, when the reference instantiates them.
        args: Option<GenericArgs>,
    },
    /// `"&" S "(" S group S ")"`: the enumeration of an inline group.
    EnumInline(Box<Group>),
    /// `"&" S groupname [genericarg]`: the enumeration of a named group.
    EnumGroup {
        /// The referenced group name.
        name: Name,
        /// Generic arguments, when the reference instantiates them.
        args: Option<GenericArgs>,
    },
    /// `"#" "6" ["." uint] "(" S type S ")"`: a tagged type.
    Tagged {
        /// The tag number, absent for `#6(...)`, which tags with any
        /// number.
        number: Option<Uint>,
        /// The type inside the tag.
        inner: Box<Type>,
    },
    /// `"#" DIGIT ["." uint]`: a major type, optionally with additional
    /// information.
    Representation {
        /// The major type, 0 through 9 as the grammar's `DIGIT` allows.
        ///
        /// CBOR defines only 0 through 7; the grammar admits 8 and 9, and
        /// the parser admits what the grammar admits.
        major: u8,
        /// The additional information, when one was written.
        ai: Option<Uint>,
    },
    /// `"#"`: any data item.
    Any,
}

/// An unsigned integer literal used as a number rather than as a value:
/// a tag number, an additional information, or an occurrence bound.
///
/// Kept as written, so that `#6.0x18` prints back as `#6.0x18`.
#[derive(Clone, Debug)]
pub(crate) struct Uint {
    /// The digits, byte for byte, in whatever base they were written.
    pub(crate) text: String,
    /// Where they were written.
    pub(crate) span: Span,
}

/// `group = grpchoice *(S "//" S grpchoice)`.
#[derive(Clone, Debug)]
pub(crate) struct Group {
    /// The choices, in order. Never empty — a group with no `//` has one
    /// choice, which may itself have no entries.
    pub(crate) choices: Vec<GroupChoice>,
    /// The whole group.
    pub(crate) span: Span,
}

/// `grpchoice = *(grpent optcom)`.
#[derive(Clone, Debug)]
pub(crate) struct GroupChoice {
    /// The entries, in order. May be empty: `{}` and `[]` are groups with
    /// one empty choice.
    pub(crate) entries: Vec<GroupEntry>,
    /// The whole choice.
    pub(crate) span: Span,
}

/// One `grpent`.
#[derive(Clone, Debug)]
pub(crate) struct GroupEntry {
    /// `[occur S]`.
    pub(crate) occur: Option<Occur>,
    /// Which `grpent` alternative.
    pub(crate) kind: GroupEntryKind,
    /// The whole entry, occurrence indicator included.
    pub(crate) span: Span,
}

/// The alternatives of `grpent`.
///
/// The ABNF lists three. The second, `[occur S] groupname [genericarg]`,
/// carries the RFC's own comment "preempted by above": a bare group name
/// is already `[occur S] [memberkey S] type` with no member key and a type
/// that is a `typename`. It is therefore not a separate variant here —
/// representing it separately would give one piece of source two trees.
#[derive(Clone, Debug)]
pub(crate) enum GroupEntryKind {
    /// `[occur S] [memberkey S] type`.
    Member {
        /// The member key, absent in an array or a bare group reference.
        key: Option<MemberKey>,
        /// The type of the member.
        value: Type,
    },
    /// `[occur S] "(" S group S ")"`: a parenthesized inline group.
    Inline(Group),
}

/// `occur = [uint] "*" [uint] / "+" / "?"`.
#[derive(Clone, Debug)]
pub(crate) struct Occur {
    /// Which form.
    pub(crate) kind: OccurKind,
    /// Where it was written.
    pub(crate) span: Span,
}

/// The three forms of `occur`.
#[derive(Clone, Debug)]
pub(crate) enum OccurKind {
    /// `[uint] "*" [uint]`: bounded below, above, both, or neither.
    ///
    /// A bare `*` is this variant with both bounds absent. The ABNF admits
    /// no space anywhere inside the production, so `2 * 3` is not one
    /// occurrence indicator.
    Bounded {
        /// The lower bound, when written.
        min: Option<Uint>,
        /// The upper bound, when written.
        max: Option<Uint>,
    },
    /// `+`: one or more.
    OneOrMore,
    /// `?`: zero or one.
    Optional,
}

/// `memberkey`.
#[derive(Clone, Debug)]
pub(crate) struct MemberKey {
    /// Which form.
    pub(crate) kind: MemberKeyKind,
    /// From the start of the key through its `=>` or `:`.
    pub(crate) span: Span,
}

/// The three forms of `memberkey`.
///
/// All three are distinct in the tree even where two would describe the
/// same key, because they do not mean the same thing: `a: 1` keys on the
/// *text string* "a", while `a => 1` keys on whatever the type `a`
/// denotes.
#[derive(Clone, Debug)]
pub(crate) enum MemberKeyKind {
    /// `type1 S ["^" S] "=>"`: a key given as a type.
    Type {
        /// The key type.
        ///
        /// Boxed: a `type1` is the deepest node of the grammar, and the
        /// other two key forms are a name and a literal.
        key: Box<Type1>,
        /// Whether the cut marker `^` was written.
        ///
        /// A cut makes a failure to match the member's *value* a failure
        /// of the whole map, rather than a reason to try the next entry.
        cut: bool,
    },
    /// `bareword S ":"`: a key given as a name, denoting that text string.
    ///
    /// The colon form carries an implicit cut, which is why it is not the
    /// same node as a `Type` key that happens to hold a text literal.
    Bareword(Name),
    /// `value S ":"`: a key given as a literal.
    Value(Value),
}

/// `value = number / text / bytes`.
#[derive(Clone, Debug)]
pub(crate) struct Value {
    /// Which kind of literal.
    pub(crate) kind: ValueKind,
    /// Where it was written.
    pub(crate) span: Span,
}

/// The three kinds of literal.
#[derive(Clone, Debug)]
pub(crate) enum ValueKind {
    /// A numeric literal, kept as written.
    Number(NumberToken),
    /// A text literal: the characters between the quotes, escapes intact.
    ///
    /// Escapes are not resolved here. `SESC` admits any printable
    /// character after the backslash, so what an escape *denotes* is a
    /// separate question from whether it is well formed, and the parser
    /// answers only the second.
    Text(String),
    /// A byte-string literal: the characters between the quotes, escapes
    /// intact, with the qualifier that says how to read them.
    Bytes {
        /// `h`, `b64`, or nothing.
        qual: ByteQual,
        /// The characters between the quotes, byte for byte.
        raw: String,
    },
}
