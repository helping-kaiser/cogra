//! Recursive descent over the productions of RFC 8610 Appendix B.
//!
//! One function per production, named after it, in the order the ABNF
//! gives them. Every failure is a [`SyntaxError`] carrying a line and a
//! column, because a theory that cannot be read must say where it stopped
//! being readable.
//!
//! # Where the grammar needs a second look
//!
//! Appendix B is an ABNF grammar read as an ordered choice, and three of
//! its productions cannot be decided by looking at one token.
//!
//! **A rule assigned with `=` may be either kind.** `typename` and
//! `groupname` are both `id`, and `assignt` and `assigng` share the `=`
//! spelling, so `a = (1, 2)` is a group rule and `a = (1)` is a type rule
//! and nothing before the parenthesis says which. The parser tries the
//! type alternative first, as the ordered choice has it, and falls back to
//! the group entry — where "tries" means: parses, and then checks that
//! what follows is the start of another rule or the end of the source.
//! Only `/=` and `//=` settle the kind by themselves.
//!
//! **A member key is only known once it ends.** `memberkey` begins with a
//! whole `type1` in its first alternative, and whether that was a key or
//! the entry's own type is decided by the `=>` that may or may not follow
//! it. The parser parses the `type1`, looks for the arrow, and rewinds if
//! it is not there.
//!
//! **A group entry's parentheses may be either.** `(a)` is a
//! parenthesized type; `(a, b)` is an inline group. Alternative 1 is tried
//! first and alternative 3 catches what it cannot take. The middle
//! alternative, `[occur S] groupname [genericarg]`, is never tried: the
//! RFC marks it "preempted by above" itself.
//!
//! # Where the grammar admits no space
//!
//! Several productions place their parts side by side with no `S` between
//! them, and the parser holds them to it — the tokenizer does not, since a
//! token knows only itself. Adjacency is required between a name and its
//! generic arguments (`typename [genericarg]`), between the parts of an
//! occurrence indicator (`[uint] "*" [uint]`), and between a tag head and
//! its parenthesis (`"#" "6" ["." uint] "(" ...`). So `#6 (a)` is the
//! major type 6 followed by a group, not a tagged type, and `2 * 3` is two
//! group entries rather than one occurrence indicator.

use super::ast::{
    Assign, Cddl, GenericArgs, GenericParams, Group, GroupChoice, GroupEntry, GroupEntryKind,
    MemberKey, MemberKeyKind, Name, Occur, OccurKind, Operation, Operator, Rule, RuleBody, Type,
    Type1, Type2, Type2Kind, Uint, Value, ValueKind,
};
use super::lex::{NumberToken, Span, SyntaxError, Token, TokenKind, tokenize};

/// The location a fabricated span points at. Unreachable in practice: the
/// token vector always holds at least the end-of-input token.
const NOWHERE: Span = Span {
    start: 0,
    end: 0,
    line: 1,
    column: 1,
};

/// The end-of-input token kind, for looking past the end of the vector.
static END: TokenKind = TokenKind::Eof;

/// Read `source` as a whole CDDL document.
///
/// `cddl = S 1*(rule S)`: at least one rule, so an empty source is a
/// located refusal rather than an empty document.
pub(crate) fn parse(source: &str) -> Result<Cddl, SyntaxError> {
    let tokens = tokenize(source)?;
    let mut parser = Parser {
        tokens,
        pos: 0,
        depth: 0,
    };
    parser.cddl()
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
    /// How many `type2` productions are open on the call stack: the guard
    /// against a theory nested deeply enough to overflow the recursive
    /// descent.
    depth: usize,
}

/// The greatest `type2` nesting the parser descends before it refuses the
/// theory as too deeply nested.
///
/// Every level of `(...)`, `{...}`, `[...]`, `#6(...)`, and `<...>` opens
/// one `type2`, so this bounds the recursion. Recursive-descent parsers
/// standardly bound their depth (serde_json's `RECURSION_LIMIT` is 128);
/// this matches it, and real theories nest fewer than ten deep.
const MAX_PARSE_DEPTH: usize = 128;

impl Parser {
    // -- cursor -----------------------------------------------------------

    fn kind(&self) -> &TokenKind {
        self.kind_at(self.pos)
    }

    fn kind_at(&self, index: usize) -> &TokenKind {
        match self.tokens.get(index) {
            Some(token) => &token.kind,
            None => &END,
        }
    }

    fn span(&self) -> Span {
        self.span_at(self.pos)
    }

    fn span_at(&self, index: usize) -> Span {
        match self.tokens.get(index) {
            Some(token) => token.span,
            None => NOWHERE,
        }
    }

    fn at(&self, kind: &TokenKind) -> bool {
        self.kind() == kind
    }

    fn bump(&mut self) {
        if self.pos + 1 < self.tokens.len() {
            self.pos += 1;
        }
    }

    fn eat(&mut self, kind: &TokenKind) -> bool {
        if self.at(kind) {
            self.bump();
            true
        } else {
            false
        }
    }

    fn expect(&mut self, kind: &TokenKind, what: &str) -> Result<Span, SyntaxError> {
        if self.at(kind) {
            let span = self.span();
            self.bump();
            Ok(span)
        } else {
            Err(self.unexpected(what))
        }
    }

    fn unexpected(&self, what: &str) -> SyntaxError {
        SyntaxError::at(
            self.span(),
            format!("expected {what}, found {}", self.kind().describe()),
        )
    }

    /// The span from the token at `start` through the token just consumed.
    fn span_since(&self, start: usize) -> Span {
        if self.pos <= start {
            return self.span_at(start);
        }
        self.span_at(start).to(self.span_at(self.pos - 1))
    }

    /// Whether the current token begins exactly where the previous one
    /// ended — the check that stands in for the ABNF's *absence* of `S`.
    fn adjacent_to_previous(&self) -> bool {
        self.pos > 0 && self.span().start == self.span_at(self.pos - 1).end
    }

    // -- cddl -------------------------------------------------------------

    /// `cddl = S 1*(rule S)`
    fn cddl(&mut self) -> Result<Cddl, SyntaxError> {
        let start = self.pos;
        let mut rules = Vec::new();
        while !self.at(&TokenKind::Eof) {
            rules.push(self.rule()?);
        }
        if rules.is_empty() {
            return Err(SyntaxError::at(
                self.span(),
                "expected at least one rule; a CDDL document cannot be empty",
            ));
        }
        Ok(Cddl {
            span: self.span_since(start),
            rules,
        })
    }

    /// ```abnf
    /// rule = typename [genericparm] S assignt S type
    ///      / groupname [genericparm] S assigng S grpent
    /// ```
    fn rule(&mut self) -> Result<Rule, SyntaxError> {
        let start = self.pos;
        let name = self.name("a rule name")?;
        // No `S` stands between a name and its generic parameters.
        let params = if self.at(&TokenKind::Lt) && self.adjacent_to_previous() {
            Some(self.generic_params()?)
        } else {
            None
        };
        let assign = match self.kind() {
            TokenKind::Assign => Assign::Plain,
            TokenKind::TypeChoiceAssign => Assign::TypeChoice,
            TokenKind::GroupChoiceAssign => Assign::GroupChoice,
            _ => return Err(self.unexpected("`=`, `/=`, or `//=` after the rule name")),
        };
        self.bump();
        let body = match assign {
            Assign::Plain => self.ambiguous_rule_body()?,
            Assign::TypeChoice => RuleBody::Type(self.ty()?),
            Assign::GroupChoice => RuleBody::Group(Box::new(self.grpent()?)),
        };
        Ok(Rule {
            name,
            params,
            assign,
            body,
            span: self.span_since(start),
        })
    }

    /// The body of a rule assigned with `=`, which either alternative of
    /// `rule` could have produced.
    ///
    /// The type alternative is tried first and accepted only if the source
    /// then continues with another rule or ends; otherwise the group entry
    /// is tried. When both fail, the refusal reported is the one that got
    /// further into the source, which is the one more likely to name the
    /// reader's actual mistake.
    fn ambiguous_rule_body(&mut self) -> Result<RuleBody, SyntaxError> {
        let start = self.pos;
        let (type_error, type_reach) = match self.ty() {
            Ok(body) if self.at_rule_boundary() => return Ok(RuleBody::Type(body)),
            Ok(_) => (self.unexpected("the end of the rule"), self.pos),
            Err(error) => (error, self.pos),
        };
        self.pos = start;
        let group_error = match self.grpent() {
            Ok(entry) if self.at_rule_boundary() => {
                return Ok(RuleBody::Group(Box::new(entry)));
            }
            Ok(_) => self.unexpected("the end of the rule"),
            Err(error) => error,
        };
        if self.pos >= type_reach {
            Err(group_error)
        } else {
            Err(type_error)
        }
    }

    /// Whether the source has reached the end or the head of another rule:
    /// `id [genericparm]` followed by an assignment operator.
    fn at_rule_boundary(&self) -> bool {
        if self.at(&TokenKind::Eof) {
            return true;
        }
        if !matches!(self.kind(), TokenKind::Ident(_)) {
            return false;
        }
        let mut index = self.pos + 1;
        // `genericparm` holds only names and commas, so it cannot nest.
        if self.kind_at(index) == &TokenKind::Lt
            && self.span_at(index).start == self.span_at(self.pos).end
        {
            index += 1;
            while matches!(self.kind_at(index), TokenKind::Ident(_) | TokenKind::Comma) {
                index += 1;
            }
            if self.kind_at(index) != &TokenKind::Gt {
                return false;
            }
            index += 1;
        }
        matches!(
            self.kind_at(index),
            TokenKind::Assign | TokenKind::TypeChoiceAssign | TokenKind::GroupChoiceAssign
        )
    }

    // -- names and generics -----------------------------------------------

    /// `id`, in any of its roles.
    fn name(&mut self, what: &str) -> Result<Name, SyntaxError> {
        match self.kind() {
            TokenKind::Ident(text) => {
                let name = Name {
                    text: text.clone(),
                    span: self.span(),
                };
                self.bump();
                Ok(name)
            }
            _ => Err(self.unexpected(what)),
        }
    }

    /// `genericparm = "<" S id S *("," S id S ) ">"`
    fn generic_params(&mut self) -> Result<GenericParams, SyntaxError> {
        let start = self.pos;
        self.expect(&TokenKind::Lt, "`<` opening generic parameters")?;
        let mut names = vec![self.name("a generic parameter name")?];
        while self.eat(&TokenKind::Comma) {
            names.push(self.name("a generic parameter name")?);
        }
        self.expect(&TokenKind::Gt, "`>` closing generic parameters")?;
        Ok(GenericParams {
            names,
            span: self.span_since(start),
        })
    }

    /// `genericarg = "<" S type1 S *("," S type1 S ) ">"`
    fn generic_args(&mut self) -> Result<GenericArgs, SyntaxError> {
        let start = self.pos;
        self.expect(&TokenKind::Lt, "`<` opening generic arguments")?;
        let mut args = vec![self.type1()?];
        while self.eat(&TokenKind::Comma) {
            args.push(self.type1()?);
        }
        self.expect(&TokenKind::Gt, "`>` closing generic arguments")?;
        Ok(GenericArgs {
            args,
            span: self.span_since(start),
        })
    }

    /// The `[genericarg]` that may follow a name, which must touch it.
    fn generic_args_opt(&mut self) -> Result<Option<GenericArgs>, SyntaxError> {
        if self.at(&TokenKind::Lt) && self.adjacent_to_previous() {
            Ok(Some(self.generic_args()?))
        } else {
            Ok(None)
        }
    }

    // -- types ------------------------------------------------------------

    /// `type = type1 *(S "/" S type1)`
    fn ty(&mut self) -> Result<Type, SyntaxError> {
        let start = self.pos;
        let mut choices = vec![self.type1()?];
        while self.eat(&TokenKind::Slash) {
            choices.push(self.type1()?);
        }
        Ok(Type {
            choices,
            span: self.span_since(start),
        })
    }

    /// `type1 = type2 [S (rangeop / ctlop) S type2]`
    ///
    /// At most one operation: ranges and control operators do not chain.
    fn type1(&mut self) -> Result<Type1, SyntaxError> {
        let start = self.pos;
        let target = self.type2()?;
        let operator = match self.kind() {
            TokenKind::RangeInclusive => Operator::RangeInclusive,
            TokenKind::RangeExclusive => Operator::RangeExclusive,
            TokenKind::Control(text) => Operator::Control(Name {
                text: text.clone(),
                span: self.span(),
            }),
            _ => {
                return Ok(Type1 {
                    target,
                    operation: None,
                    span: self.span_since(start),
                });
            }
        };
        let operator_start = self.pos;
        self.bump();
        let operand = self.type2()?;
        Ok(Type1 {
            target,
            operation: Some(Operation {
                operator,
                operand,
                span: self.span_since(operator_start),
            }),
            span: self.span_since(start),
        })
    }

    /// The ten alternatives of `type2`, guarded against unbounded nesting.
    ///
    /// The depth is balanced on every exit, success or failure, so the
    /// parser's speculative rewinds — which abandon a `type2` mid-parse and
    /// try another reading — leave no descent counted twice.
    fn type2(&mut self) -> Result<Type2, SyntaxError> {
        self.depth += 1;
        if self.depth > MAX_PARSE_DEPTH {
            self.depth -= 1;
            return Err(SyntaxError::at(
                self.span(),
                format!("type nested deeper than {MAX_PARSE_DEPTH} levels"),
            ));
        }
        let result = self.type2_body();
        self.depth -= 1;
        result
    }

    /// The ten alternatives of `type2`.
    fn type2_body(&mut self) -> Result<Type2, SyntaxError> {
        let start = self.pos;
        let kind = match self.kind() {
            TokenKind::Number(_) | TokenKind::Text(_) | TokenKind::Bytes { .. } => {
                Type2Kind::Value(self.value()?)
            }
            TokenKind::Ident(_) => {
                let name = self.name("a type name")?;
                let args = self.generic_args_opt()?;
                Type2Kind::Typename { name, args }
            }
            TokenKind::LParen => {
                self.bump();
                let inner = self.ty()?;
                self.expect(&TokenKind::RParen, "`)` closing a parenthesized type")?;
                Type2Kind::Parenthesized(Box::new(inner))
            }
            TokenKind::LBrace => {
                self.bump();
                let group = self.group()?;
                self.expect(&TokenKind::RBrace, "`}` closing a map")?;
                Type2Kind::Map(group)
            }
            TokenKind::LBracket => {
                self.bump();
                let group = self.group()?;
                self.expect(&TokenKind::RBracket, "`]` closing an array")?;
                Type2Kind::Array(group)
            }
            TokenKind::Tilde => {
                self.bump();
                let name = self.name("a type name to unwrap")?;
                let args = self.generic_args_opt()?;
                Type2Kind::Unwrap { name, args }
            }
            TokenKind::Ampersand => {
                self.bump();
                if self.eat(&TokenKind::LParen) {
                    let group = self.group()?;
                    self.expect(&TokenKind::RParen, "`)` closing an enumerated group")?;
                    Type2Kind::EnumInline(Box::new(group))
                } else {
                    let name = self.name("a group name to enumerate")?;
                    let args = self.generic_args_opt()?;
                    Type2Kind::EnumGroup { name, args }
                }
            }
            TokenKind::Hash { major, ai } => {
                let major = *major;
                let ai = ai.clone();
                let head = self.span();
                self.bump();
                self.hash(major, ai, head)?
            }
            _ => return Err(self.unexpected("a type")),
        };
        Ok(Type2 {
            kind,
            span: self.span_since(start),
        })
    }

    /// The three `type2` alternatives that begin with `#`, told apart by
    /// what the tokenizer found after it.
    ///
    /// ```abnf
    /// type2 =/ "#" "6" ["." uint] "(" S type S ")"
    ///        / "#" DIGIT ["." uint]
    ///        / "#"
    /// ```
    ///
    /// The first alternative names the major type `6` literally and puts
    /// no `S` before its parenthesis, so only `#6(` and `#6.N(` — written
    /// without a space — are tagged types.
    fn hash(
        &mut self,
        major: Option<u8>,
        ai: Option<String>,
        head: Span,
    ) -> Result<Type2Kind, SyntaxError> {
        let ai = ai.map(|text| Uint { text, span: head });
        if major == Some(6) && self.at(&TokenKind::LParen) && self.adjacent_to_previous() {
            self.bump();
            let inner = self.ty()?;
            self.expect(&TokenKind::RParen, "`)` closing a tagged type")?;
            return Ok(Type2Kind::Tagged {
                number: ai,
                inner: Box::new(inner),
            });
        }
        match major {
            Some(major) => Ok(Type2Kind::Representation { major, ai }),
            None => Ok(Type2Kind::Any),
        }
    }

    /// `value = number / text / bytes`
    fn value(&mut self) -> Result<Value, SyntaxError> {
        let span = self.span();
        let kind = match self.kind() {
            TokenKind::Number(number) => ValueKind::Number(number.clone()),
            TokenKind::Text(text) => ValueKind::Text(text.clone()),
            TokenKind::Bytes { qual, raw } => ValueKind::Bytes {
                qual: *qual,
                raw: raw.clone(),
            },
            _ => return Err(self.unexpected("a literal value")),
        };
        self.bump();
        Ok(Value { kind, span })
    }

    // -- groups -----------------------------------------------------------

    /// `group = grpchoice *(S "//" S grpchoice)`
    fn group(&mut self) -> Result<Group, SyntaxError> {
        let start = self.pos;
        let mut choices = vec![self.grpchoice()?];
        while self.eat(&TokenKind::DoubleSlash) {
            choices.push(self.grpchoice()?);
        }
        Ok(Group {
            choices,
            span: self.span_since(start),
        })
    }

    /// `grpchoice = *(grpent optcom)`
    ///
    /// May be empty, which is how `{}` and `[]` are groups at all. It ends
    /// at whatever closes the construct that contains it — a group only
    /// ever appears between brackets — or at the `//` that starts the next
    /// choice.
    fn grpchoice(&mut self) -> Result<GroupChoice, SyntaxError> {
        let start = self.pos;
        let mut entries = Vec::new();
        while !matches!(
            self.kind(),
            TokenKind::RBrace
                | TokenKind::RBracket
                | TokenKind::RParen
                | TokenKind::DoubleSlash
                | TokenKind::Eof
        ) {
            entries.push(self.grpent()?);
            // `optcom = S ["," S]`: the comma is optional and carries no
            // meaning, so it is consumed and not recorded.
            self.eat(&TokenKind::Comma);
        }
        Ok(GroupChoice {
            entries,
            span: self.span_since(start),
        })
    }

    /// One group entry, guarded against unbounded nesting.
    ///
    /// A group entry may be a parenthesized inline group, and inline groups
    /// nest through `grpent` without passing `type2`, so this shares the
    /// same depth counter and the same balanced-exit discipline.
    fn grpent(&mut self) -> Result<GroupEntry, SyntaxError> {
        self.depth += 1;
        if self.depth > MAX_PARSE_DEPTH {
            self.depth -= 1;
            return Err(SyntaxError::at(
                self.span(),
                format!("group nested deeper than {MAX_PARSE_DEPTH} levels"),
            ));
        }
        let result = self.grpent_body();
        self.depth -= 1;
        result
    }

    /// ```abnf
    /// grpent = [occur S] [memberkey S] type
    ///        / [occur S] groupname [genericarg]  ; preempted by above
    ///        / [occur S] "(" S group S ")"
    /// ```
    fn grpent_body(&mut self) -> Result<GroupEntry, SyntaxError> {
        let start = self.pos;
        let occur = self.occur();
        let after_occur = self.pos;
        let member_error = match self.member() {
            Ok(kind) => {
                return Ok(GroupEntry {
                    occur,
                    kind,
                    span: self.span_since(start),
                });
            }
            Err(error) => error,
        };
        self.pos = after_occur;
        if self.eat(&TokenKind::LParen) {
            let group = self.group()?;
            self.expect(&TokenKind::RParen, "`)` closing an inline group")?;
            return Ok(GroupEntry {
                occur,
                kind: GroupEntryKind::Inline(group),
                span: self.span_since(start),
            });
        }
        Err(member_error)
    }

    /// `[memberkey S] type`, the first alternative of `grpent`.
    fn member(&mut self) -> Result<GroupEntryKind, SyntaxError> {
        let start = self.pos;
        let key = match self.memberkey() {
            Ok(key) => Some(key),
            Err(_) => {
                self.pos = start;
                None
            }
        };
        let value = self.ty()?;
        Ok(GroupEntryKind::Member { key, value })
    }

    /// ```abnf
    /// memberkey = type1 S ["^" S] "=>"
    ///           / bareword S ":"
    ///           / value S ":"
    /// ```
    ///
    /// The first alternative is only known to be a member key once its
    /// `=>` is reached, so it is parsed and rewound. The colon forms are
    /// decided by one token of lookahead.
    fn memberkey(&mut self) -> Result<MemberKey, SyntaxError> {
        let start = self.pos;
        if let Ok(key) = self.type1() {
            let cut = self.eat(&TokenKind::Caret);
            if self.eat(&TokenKind::Arrow) {
                return Ok(MemberKey {
                    kind: MemberKeyKind::Type {
                        key: Box::new(key),
                        cut,
                    },
                    span: self.span_since(start),
                });
            }
        }
        self.pos = start;
        if self.kind_at(self.pos + 1) == &TokenKind::Colon {
            let kind = match self.kind() {
                TokenKind::Ident(text) => MemberKeyKind::Bareword(Name {
                    text: text.clone(),
                    span: self.span(),
                }),
                TokenKind::Number(_) | TokenKind::Text(_) | TokenKind::Bytes { .. } => {
                    MemberKeyKind::Value(self.value()?)
                }
                _ => return Err(self.unexpected("a member key")),
            };
            if matches!(kind, MemberKeyKind::Bareword(_)) {
                self.bump();
            }
            self.bump();
            return Ok(MemberKey {
                kind,
                span: self.span_since(start),
            });
        }
        Err(self.unexpected("a member key"))
    }

    /// `occur = [uint] "*" [uint] / "+" / "?"`
    ///
    /// Absent from the ABNF is any `S`, so every part must touch the next.
    /// A number that does not touch a following `*` is not a bound; it is
    /// a group entry of its own.
    fn occur(&mut self) -> Option<Occur> {
        let start = self.pos;
        match self.kind() {
            TokenKind::Plus => {
                let span = self.span();
                self.bump();
                Some(Occur {
                    kind: OccurKind::OneOrMore,
                    span,
                })
            }
            TokenKind::Question => {
                let span = self.span();
                self.bump();
                Some(Occur {
                    kind: OccurKind::Optional,
                    span,
                })
            }
            TokenKind::Star => {
                self.bump();
                let max = self.adjacent_uint();
                Some(Occur {
                    kind: OccurKind::Bounded { min: None, max },
                    span: self.span_since(start),
                })
            }
            TokenKind::Number(number) if is_uint(number) => {
                if self.kind_at(self.pos + 1) != &TokenKind::Star
                    || self.span_at(self.pos + 1).start != self.span().end
                {
                    return None;
                }
                let min = Some(Uint {
                    text: number.text.clone(),
                    span: self.span(),
                });
                self.bump();
                self.bump();
                let max = self.adjacent_uint();
                Some(Occur {
                    kind: OccurKind::Bounded { min, max },
                    span: self.span_since(start),
                })
            }
            _ => None,
        }
    }

    /// The optional bound after a `*`, which must touch it.
    fn adjacent_uint(&mut self) -> Option<Uint> {
        let TokenKind::Number(number) = self.kind() else {
            return None;
        };
        if !is_uint(number) || !self.adjacent_to_previous() {
            return None;
        }
        let uint = Uint {
            text: number.text.clone(),
            span: self.span(),
        };
        self.bump();
        Some(uint)
    }
}

/// Whether a numeric literal is a `uint`: no sign, no fraction, no
/// exponent.
fn is_uint(number: &NumberToken) -> bool {
    !number.is_float && !number.text.starts_with('-')
}

/// The CDDL documents RFC 8610 writes out in full, as the acceptance
/// corpus for the parser.
///
/// Transcribed into `tests/corpus/` before the parser was written, and
/// carried into the binary by `include_str!` because everything in this
/// module is crate-private and an integration test could not reach it.
#[cfg(test)]
pub(crate) const CORPUS: &[(&str, &str)] = &[
    (
        "Appendix H, the verbose reputon definition",
        include_str!("../../tests/corpus/rfc8610-appendix-h/reputon-verbose.cddl"),
    ),
    (
        "Appendix H, the compact reputon definition",
        include_str!("../../tests/corpus/rfc8610-appendix-h/reputon-compact.cddl"),
    ),
    (
        "Appendix D, the standard prelude",
        include_str!("../../tests/corpus/rfc8610-appendix-d-prelude.cddl"),
    ),
];

#[cfg(test)]
mod tests {
    use super::*;

    /// Parse, or fail the test naming the snippet that would not parse.
    fn accept(source: &str) -> Cddl {
        match parse(source) {
            Ok(cddl) => cddl,
            Err(error) => panic!("expected {source:?} to parse, but: {error}"),
        }
    }

    /// Parse every snippet, returning how many were accepted.
    fn accept_all(sources: &[&str]) -> usize {
        for source in sources {
            accept(source);
        }
        sources.len()
    }

    fn refuse(source: &str) -> SyntaxError {
        match parse(source) {
            Ok(_) => panic!("expected {source:?} to be refused, but it parsed"),
            Err(error) => error,
        }
    }

    #[test]
    fn every_corpus_document_parses() {
        for (what, source) in CORPUS {
            match parse(source) {
                Ok(cddl) => assert!(!cddl.rules.is_empty(), "{what} has rules"),
                Err(error) => panic!("{what} did not parse: {error}"),
            }
        }
    }

    #[test]
    fn the_prelude_is_read_the_way_the_rfc_wrote_it() {
        let (_, prelude) = CORPUS[2];
        let cddl = accept(prelude);
        // Figure 14 defines 40 rules, `any` through `undefined`.
        assert_eq!(cddl.rules.len(), 40);
        assert_eq!(cddl.rules[0].name.text, "any");
        assert_eq!(cddl.rules[39].name.text, "undefined");
        // `any = #`, the first of them.
        assert!(matches!(
            &cddl.rules[0].body,
            RuleBody::Type(ty) if matches!(ty.choices[0].target.kind, Type2Kind::Any)
        ));
    }

    // -- accepts, one family per test -------------------------------------

    #[test]
    fn cddl_and_rule() {
        assert_eq!(
            accept_all(&[
                "a = 1",                   // cddl: one rule
                "a = 1\nb = 2",            // cddl: 1*(rule S)
                "  \n a = 1 \n ",          // cddl: leading and trailing S
                "; comment\na = 1",        // cddl: S admits comments
                "a = 1 b = 2",             // rule boundary without a newline
                "a = int",                 // rule: typename assignt type
                "a /= 2",                  // rule: assignt "/="
                "a //= (b: 1)",            // rule: assigng "//="
                "a = (b: 1, c: 2)",        // rule: groupname assigng grpent
                "a = (1)",                 // rule: the parenthesis that is a type
                "$$plug //= (sack: true)", // rule: a group socket taking a plug
                "$socket /= text",         // rule: a type socket taking a plug
            ]),
            12
        );
    }

    #[test]
    fn generic_parameters_and_arguments() {
        assert_eq!(
            accept_all(&[
                "messages<a> = [a]",       // genericparm: one
                "messages<a, b> = [a, b]", // genericparm: several
                "messages< a , b > = [a]", // genericparm: S inside
                "a = messages<int>",       // genericarg: one
                "a = messages<int, text>", // genericarg: several
                "a = messages<1 .. 2>",    // genericarg: a type1
                "a = ~envelope<int>",      // genericarg after `~`
                "a = &choices<int>",       // genericarg after `&`
                "a = [* messages<int>]",   // genericarg in a group
            ]),
            9
        );
    }

    #[test]
    fn types_and_choices() {
        assert_eq!(
            accept_all(&[
                "a = int",                 // type: one type1
                "a = int / text",          // type: a choice
                "a = int / text / bool",   // type: several
                "a = 1 .. 10",             // type1: rangeop ".."
                "a = 1 ... 10",            // type1: rangeop "..."
                "a = min .. max",          // type1: a range over names
                "a = text .size 4",        // type1: ctlop
                "a = text .regexp \"a+\"", // type1: ctlop with a text operand
                "a = uint .lorem 1",       // type1: a control name no one defines
            ]),
            9
        );
    }

    #[test]
    fn type2_alternatives() {
        assert_eq!(
            accept_all(&[
                "a = 1",             // type2: value
                "a = b",             // type2: typename
                "a = (int)",         // type2: "(" type ")"
                "a = {b: 1}",        // type2: "{" group "}"
                "a = [1, 2]",        // type2: "[" group "]"
                "a = ~b",            // type2: "~" typename
                "a = &(x: 1, y: 2)", // type2: "&" "(" group ")"
                "a = &b",            // type2: "&" groupname
                "a = #6.24(bstr)",   // type2: "#" "6" "." uint "(" type ")"
                "a = #6(bstr)",      // type2: "#" "6" "(" type ")"
                "a = #7.25",         // type2: "#" DIGIT "." uint
                "a = #2",            // type2: "#" DIGIT
                "a = #",             // type2: "#"
                "a = #6.0x18(bstr)", // a tag number in another base
                "a = #9",            // the grammar's DIGIT reaches 9
            ]),
            15
        );
    }

    #[test]
    fn group_and_grpchoice() {
        assert_eq!(
            accept_all(&[
                "a = {b: 1}",         // group: one grpchoice
                "a = {b: 1 // c: 2}", // group: a group choice
                "a = {b: 1 // c: 2 // d: 3}",
                "a = {}",           // grpchoice: empty
                "a = []",           // grpchoice: empty
                "a = {b: 1, c: 2}", // grpchoice: optcom with a comma
                "a = {b: 1 c: 2}",  // grpchoice: optcom without one
                "a = {b: 1,}",      // grpchoice: a trailing comma
                "a = [1 2 3]",      // grpchoice: no commas at all
                // `grpchoice = *(grpent optcom)` admits none, so a choice
                // may be empty on either side of the `//`.
                "a = {b: 1 //}",
                "a = {//}",
            ]),
            11
        );
    }

    #[test]
    fn grpent_alternatives() {
        assert_eq!(
            accept_all(&[
                "a = [b]",          // grpent: type alone
                "a = [? b]",        // grpent: occur then type
                "a = {b: 1}",       // grpent: memberkey then type
                "a = {? b: 1}",     // grpent: occur, memberkey, type
                "a = [(b, c)]",     // grpent: an inline group
                "a = [* (b, c)]",   // grpent: occur then inline group
                "a = [group-name]", // grpent: the preempted alternative
                "a = [(b // c)]",   // an inline group with a choice
            ]),
            8
        );
    }

    #[test]
    fn memberkey_forms() {
        assert_eq!(
            accept_all(&[
                "a = {b => 1}",        // memberkey: type1 "=>"
                "a = {b ^ => 1}",      // memberkey: the cut marker
                "a = {\"b\" => 1}",    // memberkey: a literal key type
                "a = {(1 .. 2) => 3}", // memberkey: a type1 with a range
                "a = {b: 1}",          // memberkey: bareword ":"
                "a = {1: 2}",          // memberkey: a number value ":"
                "a = {\"b\": 1}",      // memberkey: a text value ":"
                "a = {h'ff': 1}",      // memberkey: a byte-string value ":"
                "a = {text => any}",   // memberkey: a type as the key
            ]),
            9
        );
    }

    #[test]
    fn occur_forms() {
        assert_eq!(
            accept_all(&[
                "a = [* b]",           // occur: "*"
                "a = [+ b]",           // occur: "+"
                "a = [? b]",           // occur: "?"
                "a = [2* b]",          // occur: uint "*"
                "a = [*3 b]",          // occur: "*" uint
                "a = [2*3 b]",         // occur: uint "*" uint
                "a = [0x2*0x3 b]",     // occur: bounds in another base
                "a = {* text => any}", // occur before a member key
            ]),
            8
        );
    }

    #[test]
    fn value_forms() {
        assert_eq!(
            accept_all(&[
                "a = 0",                   // value: number, uint "0"
                "a = 42",                  // value: number, DIGIT1 *DIGIT
                "a = -42",                 // value: number, a negative int
                "a = 0x2a",                // value: number, hexadecimal
                "a = 0b101010",            // value: number, binary
                "a = 1.5",                 // value: number, a fraction
                "a = 1e3",                 // value: number, an exponent
                "a = 0x1.8p3",             // value: number, a hexfloat
                "a = \"text\"",            // value: text
                "a = \"\"",                // value: the empty text
                "a = \"quote \\\" here\"", // value: text with an escape
                "a = 'bytes'",             // value: bytes, unqualified
                "a = h'0f0f'",             // value: bytes, base 16
                "a = b64'aGVsbG8='",       // value: bytes, base 64
            ]),
            14
        );
    }

    #[test]
    fn the_absence_of_space_is_load_bearing() {
        assert_eq!(
            accept_all(&[
                // `#6 (a)` is not a tag: the ABNF puts no S before the
                // parenthesis, so this is the major type 6 and then a
                // group of its own.
                "a = [#6 (b)]",
                // `2 * 3` is not an occurrence indicator, so this array
                // holds the value 2 and then three-or-more of b.
                "a = [2 *3 b]",
                // A control operator needs the space that keeps it out of
                // the name in front of it.
                "a = text .size 4",
                // Without the space it is one name, and a legal one.
                "a = text.size",
                // `-1` is not a `uint`, so it cannot be a lower bound; the
                // array holds the value -1 and then three-or-more of b.
                "a = [-1*3 b]",
            ]),
            5
        );
    }

    // -- refusals ---------------------------------------------------------

    #[test]
    fn refuses_an_empty_document() {
        // `cddl = S 1*(rule S)` requires a rule.
        let error = refuse("");
        assert_eq!((error.line, error.column), (1, 1));
        assert!(error.detail.contains("at least one rule"));
    }

    #[test]
    fn refuses_a_document_of_only_trivia() {
        let error = refuse("; nothing but a comment\n");
        assert!(error.detail.contains("at least one rule"));
    }

    #[test]
    fn refuses_a_bare_name_with_no_assignment() {
        let error = refuse("a");
        assert_eq!((error.line, error.column), (1, 2));
        assert!(error.detail.contains("`=`"));
    }

    #[test]
    fn refuses_an_assignment_with_no_body() {
        let error = refuse("a =");
        assert_eq!((error.line, error.column), (1, 4));
    }

    #[test]
    fn refuses_a_rule_that_does_not_start_with_a_name() {
        let error = refuse("= 1");
        assert_eq!((error.line, error.column), (1, 1));
    }

    #[test]
    fn refuses_an_unclosed_array() {
        let error = refuse("a = [1, 2");
        assert_eq!((error.line, error.column), (1, 10));
        assert!(error.detail.contains("`]`"));
    }

    #[test]
    fn refuses_an_unclosed_map() {
        let error = refuse("a = {b: 1");
        assert!(error.detail.contains("`}`"));
    }

    #[test]
    fn refuses_an_unclosed_parenthesis() {
        let error = refuse("a = (int");
        assert!(error.detail.contains("`)`"));
    }

    #[test]
    fn refuses_a_bracket_closed_by_the_wrong_one() {
        let error = refuse("a = [1}");
        assert_eq!((error.line, error.column), (1, 7));
    }

    #[test]
    fn refuses_an_unclosed_generic_parameter_list() {
        let error = refuse("a<b = 1");
        assert!(error.detail.contains("`>`"));
    }

    #[test]
    fn refuses_an_unclosed_generic_argument_list() {
        let error = refuse("a = b<int");
        assert!(error.detail.contains("`>`"));
    }

    #[test]
    fn refuses_empty_generic_parameters() {
        // `genericparm` requires at least one id.
        let error = refuse("a<> = 1");
        assert_eq!((error.line, error.column), (1, 3));
    }

    #[test]
    fn refuses_empty_generic_arguments() {
        let error = refuse("a = b<>");
        assert_eq!((error.line, error.column), (1, 7));
    }

    #[test]
    fn refuses_a_generic_argument_that_is_a_type_choice() {
        // `genericarg` holds `type1`, which cannot be a choice.
        let error = refuse("a = b<int / text>");
        assert!(error.detail.contains("`>`"));
    }

    #[test]
    fn refuses_a_range_with_no_upper_bound() {
        let error = refuse("a = 1 ..");
        assert!(error.detail.contains("expected a type"));
    }

    #[test]
    fn refuses_a_chained_range() {
        // `type1` admits one operation, so the second is unexpected.
        let error = refuse("a = 1 .. 2 .. 3");
        assert_eq!((error.line, error.column), (1, 12));
    }

    #[test]
    fn refuses_a_control_operator_with_no_operand() {
        let error = refuse("a = text .size");
        assert!(error.detail.contains("expected a type"));
    }

    #[test]
    fn refuses_a_control_operator_with_no_name() {
        let error = refuse("a = text . 4");
        assert_eq!((error.line, error.column), (1, 10));
        assert!(error.detail.contains("control-operator"));
    }

    #[test]
    fn refuses_a_type_choice_with_no_second_alternative() {
        let error = refuse("a = int /");
        assert!(error.detail.contains("expected a type"));
    }

    #[test]
    fn refuses_an_arrow_with_no_key_in_front_of_it() {
        let error = refuse("a = {=> 1}");
        assert_eq!((error.line, error.column), (1, 6));
    }

    #[test]
    fn refuses_a_member_key_with_no_value() {
        let error = refuse("a = {b:}");
        assert_eq!((error.line, error.column), (1, 8));
    }

    #[test]
    fn refuses_an_arrow_with_no_value() {
        let error = refuse("a = {b =>}");
        assert_eq!((error.line, error.column), (1, 10));
    }

    #[test]
    fn refuses_a_cut_marker_without_an_arrow() {
        let error = refuse("a = {b ^ 1}");
        assert_eq!((error.line, error.column), (1, 8));
    }

    #[test]
    fn refuses_a_leading_comma_in_a_group() {
        // `optcom` follows an entry; it does not precede one.
        let error = refuse("a = {, b: 1}");
        assert_eq!((error.line, error.column), (1, 6));
    }

    #[test]
    fn refuses_an_occurrence_indicator_with_no_entry() {
        let error = refuse("a = [*]");
        assert_eq!((error.line, error.column), (1, 7));
    }

    #[test]
    fn refuses_an_occurrence_indicator_held_off_from_its_bound() {
        // `occur = [uint] "*" [uint]` admits no space, so the `2` here is
        // an entry of its own and `*3` is left wanting one.
        let error = refuse("a = [2 *3]");
        assert_eq!((error.line, error.column), (1, 10));
        assert!(error.detail.contains("expected a type"));
    }

    #[test]
    fn refuses_a_tag_whose_parenthesis_is_empty() {
        let error = refuse("a = #6.24()");
        assert!(error.detail.contains("expected a type"));
    }

    #[test]
    fn refuses_a_tag_with_no_closing_parenthesis() {
        let error = refuse("a = #6.24(bstr");
        assert!(error.detail.contains("`)`"));
    }

    #[test]
    fn refuses_an_unwrap_with_no_name() {
        let error = refuse("a = ~1");
        assert_eq!((error.line, error.column), (1, 6));
    }

    #[test]
    fn refuses_an_enumeration_with_no_name() {
        let error = refuse("a = &1");
        assert_eq!((error.line, error.column), (1, 6));
    }

    #[test]
    fn refuses_a_stray_token_after_a_complete_rule() {
        let error = refuse("a = 1 ]");
        assert_eq!((error.line, error.column), (1, 7));
    }

    #[test]
    fn refuses_two_types_juxtaposed_at_the_top_level() {
        // A group entry may sit beside another; a rule body may not.
        let error = refuse("a = 1 2");
        assert_eq!((error.line, error.column), (1, 7));
    }

    #[test]
    fn refuses_generic_parameters_held_off_by_a_space() {
        // `rule = typename [genericparm] S assignt`: no S before the
        // parameters.
        let error = refuse("a <b> = 1");
        assert_eq!((error.line, error.column), (1, 3));
        assert!(error.detail.contains("`=`"));
    }

    // -- located refusals from the tokenizer reach the parser -------------

    #[test]
    fn refuses_lexical_faults_through_the_same_channel() {
        assert!(refuse("a = \"open").detail.contains("unterminated text"));
        assert!(refuse("a = h'ff").detail.contains("unterminated byte"));
        assert!(refuse("a = !").detail.contains("unexpected character"));
    }

    #[test]
    fn locates_a_refusal_on_the_line_it_happened() {
        let error = refuse("a = 1\nb = 2\nc = [3");
        assert_eq!((error.line, error.column), (3, 7));
    }

    // -- bounded nesting --------------------------------------------------

    #[test]
    fn refuses_a_type_nested_past_the_depth_bound() {
        let deep = format!("a = {}1{}", "(".repeat(400), ")".repeat(400));
        let error = refuse(&deep);
        assert!(error.detail.contains("nested deeper"));
        // Located, not a panic: the refusal points at where it gave up.
        assert!(error.line >= 1 && error.column >= 1);
    }

    #[test]
    fn a_realistically_nested_theory_still_parses() {
        // Eight levels of array nesting — deeper than any real theory — is
        // well within the bound.
        let nested = format!("a = {}uint{}", "[".repeat(8), "]".repeat(8));
        accept(&nested);
    }

    // -- the ambiguity of `=` ---------------------------------------------

    #[test]
    fn an_equals_rule_takes_the_type_reading_when_there_is_one() {
        let cddl = accept("a = (1)");
        assert!(matches!(cddl.rules[0].body, RuleBody::Type(_)));
    }

    #[test]
    fn an_equals_rule_falls_back_to_the_group_reading() {
        let cddl = accept("a = (1, 2)");
        assert!(matches!(cddl.rules[0].body, RuleBody::Group(_)));
    }

    #[test]
    fn an_equals_rule_reads_a_member_key_as_a_group() {
        let cddl = accept("a = ( rater: text )");
        assert!(matches!(cddl.rules[0].body, RuleBody::Group(_)));
    }

    #[test]
    fn an_occurrence_indicator_forces_the_group_reading() {
        let cddl = accept("a = * text");
        assert!(matches!(cddl.rules[0].body, RuleBody::Group(_)));
    }

    #[test]
    fn a_group_choice_assignment_is_always_a_group() {
        let cddl = accept("a //= 1");
        assert!(matches!(cddl.rules[0].body, RuleBody::Group(_)));
    }

    #[test]
    fn a_type_choice_assignment_is_always_a_type() {
        let cddl = accept("a /= 1");
        assert!(matches!(cddl.rules[0].body, RuleBody::Type(_)));
    }

    // -- spans -------------------------------------------------------------

    #[test]
    fn a_rule_spans_the_text_it_was_read_from() {
        let source = "a = 1\nbb = [2]";
        let cddl = accept(source);
        let second = &cddl.rules[1];
        assert_eq!(&source[second.span.start..second.span.end], "bb = [2]");
        assert_eq!((second.span.line, second.span.column), (2, 1));
    }

    #[test]
    fn a_name_spans_only_itself() {
        let source = "reputation-object = 1";
        let cddl = accept(source);
        let name = &cddl.rules[0].name;
        assert_eq!(&source[name.span.start..name.span.end], "reputation-object");
    }

    #[test]
    fn sockets_are_recognised_by_their_names() {
        let cddl = accept("$a = 1\n$$b = (c: 1)\nd = 2");
        assert!(cddl.rules[0].name.is_type_socket());
        assert!(!cddl.rules[0].name.is_group_socket());
        assert!(cddl.rules[1].name.is_group_socket());
        assert!(!cddl.rules[1].name.is_type_socket());
        assert!(!cddl.rules[2].name.is_type_socket());
        assert!(!cddl.rules[2].name.is_group_socket());
    }
}
