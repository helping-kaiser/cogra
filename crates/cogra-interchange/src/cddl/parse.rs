//! ´mod:module:parse´
//!
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
//! it. The parser parses the `type1` once; if an arrow follows it was the
//! key, and if not the same `type1` is handed on as the value's first
//! choice — never parsed a second time, so a deeply nested entry costs one
//! descent, not a doubling per level.
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
    ///
    /// The generic parameters are taken only where they touch the name: no `S`
    /// stands between the two.
    fn rule(&mut self) -> Result<Rule, SyntaxError> {
        let start = self.pos;
        let name = self.name("a rule name")?;
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
    ///
    /// The lookahead can scan the parameters flatly because `genericparm`
    /// holds only names and commas, so it cannot nest.
    fn at_rule_boundary(&self) -> bool {
        if self.at(&TokenKind::Eof) {
            return true;
        }
        if !matches!(self.kind(), TokenKind::Ident(_)) {
            return false;
        }
        let mut index = self.pos + 1;
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

    /// `type = type1 *(S "/" S type1)`
    fn ty(&mut self) -> Result<Type, SyntaxError> {
        let start = self.pos;
        let first = self.type1()?;
        self.ty_from_first(first, start)
    }

    /// Finish a `type = type1 *( "/" type1 )` whose first `type1` is
    /// already parsed.
    ///
    /// `start` is the token index the first `type1` began at, so the whole
    /// type's span still runs from there. A group entry parses one `type1`
    /// to look for a `=>`; when none follows, that `type1` is the value's
    /// first choice, and resuming here spares the parser a second descent
    /// through it — the difference between one parse per nesting level and
    /// a doubling.
    fn ty_from_first(&mut self, first: Type1, start: usize) -> Result<Type, SyntaxError> {
        let mut choices = vec![first];
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
    ///
    /// `optcom = S ["," S]`, so the comma between entries is optional and
    /// carries no meaning: it is consumed and not recorded.
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
    ///
    /// ```abnf
    /// memberkey = type1 S ["^" S] "=>"
    ///           / bareword S ":"
    ///           / value S ":"
    /// ```
    ///
    /// The colon forms are told from a plain value by one token of
    /// lookahead. The `=>` form is only known to be a key once its arrow
    /// is reached, but the leading `type1` is parsed a single time: if an
    /// arrow follows it is the key and the value is read after it;
    /// otherwise that `type1` is handed on as the value's first choice, and a
    /// cut marker eaten along the way belongs to no one and is given back.
    fn member(&mut self) -> Result<GroupEntryKind, SyntaxError> {
        if let Some(key) = self.colon_memberkey() {
            let value = self.ty()?;
            return Ok(GroupEntryKind::Member {
                key: Some(key),
                value,
            });
        }
        let start = self.pos;
        let first = self.type1()?;
        let after_first = self.pos;
        let cut = self.eat(&TokenKind::Caret);
        if self.eat(&TokenKind::Arrow) {
            let key = MemberKey {
                kind: MemberKeyKind::Type {
                    key: Box::new(first),
                    cut,
                },
                span: self.span_since(start),
            };
            let value = self.ty()?;
            return Ok(GroupEntryKind::Member {
                key: Some(key),
                value,
            });
        }
        self.pos = after_first;
        let value = self.ty_from_first(first, start)?;
        Ok(GroupEntryKind::Member { key: None, value })
    }

    /// The two colon member-key forms, `bareword S ":"` and `value S ":"`,
    /// decided by one token of lookahead.
    ///
    /// Returns `None` — position untouched — when the entry has no colon
    /// key, leaving the caller to read the `type1 "=>"` form or a plain
    /// value.
    ///
    /// The literal arm reads its value with `ok()?` rather than an unwrap:
    /// the token is already known to be a literal, so [`Parser::value`] cannot
    /// fail there, and this is that certainty spelled without a panic.
    fn colon_memberkey(&mut self) -> Option<MemberKey> {
        if self.kind_at(self.pos + 1) != &TokenKind::Colon {
            return None;
        }
        let start = self.pos;
        let kind = match self.kind() {
            TokenKind::Ident(text) => {
                let bareword = MemberKeyKind::Bareword(Name {
                    text: text.clone(),
                    span: self.span(),
                });
                self.bump();
                bareword
            }
            TokenKind::Number(_) | TokenKind::Text(_) | TokenKind::Bytes { .. } => {
                MemberKeyKind::Value(self.value().ok()?)
            }
            _ => return None,
        };
        self.bump();
        Some(MemberKey {
            kind,
            span: self.span_since(start),
        })
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

    /// Figure 14 defines 40 rules, `any` through `undefined`, the first of
    /// them `any = #`.
    #[test]
    fn the_prelude_is_read_the_way_the_rfc_wrote_it() {
        let (_, prelude) = CORPUS[2];
        let cddl = accept(prelude);
        assert_eq!(cddl.rules.len(), 40);
        assert_eq!(cddl.rules[0].name.text, "any");
        assert_eq!(cddl.rules[39].name.text, "undefined");
        assert!(matches!(
            &cddl.rules[0].body,
            RuleBody::Type(ty) if matches!(ty.choices[0].target.kind, Type2Kind::Any)
        ));
    }

    /// `cddl` and `rule`: one rule and many, leading and trailing `S`,
    /// comments as `S`, a rule boundary without a newline, and each assignment
    /// operator. `a = (1)` is the parenthesis that is a type rather than a
    /// group, and the two socket rules take a plug through `/=` and `//=`.
    #[test]
    fn cddl_and_rule() {
        assert_eq!(
            accept_all(&[
                "a = 1",
                "a = 1\nb = 2",
                "  \n a = 1 \n ",
                "; comment\na = 1",
                "a = 1 b = 2",
                "a = int",
                "a /= 2",
                "a //= (b: 1)",
                "a = (b: 1, c: 2)",
                "a = (1)",
                "$$plug //= (sack: true)",
                "$socket /= text",
            ]),
            12
        );
    }

    /// `genericparm` and `genericarg`: one parameter and several, `S` inside
    /// the angle brackets, an argument that is a whole `type1`, and arguments
    /// after `~`, after `&`, and inside a group.
    #[test]
    fn generic_parameters_and_arguments() {
        assert_eq!(
            accept_all(&[
                "messages<a> = [a]",
                "messages<a, b> = [a, b]",
                "messages< a , b > = [a]",
                "a = messages<int>",
                "a = messages<int, text>",
                "a = messages<1 .. 2>",
                "a = ~envelope<int>",
                "a = &choices<int>",
                "a = [* messages<int>]",
            ]),
            9
        );
    }

    /// `type` and `type1`: one alternative and several, both range operators,
    /// a range over names, and control operators — including `.lorem`, a
    /// control name no one defines, which the grammar admits all the same.
    #[test]
    fn types_and_choices() {
        assert_eq!(
            accept_all(&[
                "a = int",
                "a = int / text",
                "a = int / text / bool",
                "a = 1 .. 10",
                "a = 1 ... 10",
                "a = min .. max",
                "a = text .size 4",
                "a = text .regexp \"a+\"",
                "a = uint .lorem 1",
            ]),
            9
        );
    }

    /// Every alternative of `type2`: a value, a typename, the parenthesized
    /// type, a map, an array, `~`, both `&` forms, and each tag and
    /// major-type head down to the bare `#`. A tag number may be written in
    /// another base, and the grammar's `DIGIT` reaches 9.
    #[test]
    fn type2_alternatives() {
        assert_eq!(
            accept_all(&[
                "a = 1",
                "a = b",
                "a = (int)",
                "a = {b: 1}",
                "a = [1, 2]",
                "a = ~b",
                "a = &(x: 1, y: 2)",
                "a = &b",
                "a = #6.24(bstr)",
                "a = #6(bstr)",
                "a = #7.25",
                "a = #2",
                "a = #",
                "a = #6.0x18(bstr)",
                "a = #9",
            ]),
            15
        );
    }

    /// `group` and `grpchoice`: one choice and several, the empty group that
    /// makes `{}` and `[]` groups at all, and `optcom` with a comma, without
    /// one, and trailing. Since `grpchoice = *(grpent optcom)` admits no
    /// entries, a choice may be empty on either side of the `//`.
    #[test]
    fn group_and_grpchoice() {
        assert_eq!(
            accept_all(&[
                "a = {b: 1}",
                "a = {b: 1 // c: 2}",
                "a = {b: 1 // c: 2 // d: 3}",
                "a = {}",
                "a = []",
                "a = {b: 1, c: 2}",
                "a = {b: 1 c: 2}",
                "a = {b: 1,}",
                "a = [1 2 3]",
                "a = {b: 1 //}",
                "a = {//}",
            ]),
            11
        );
    }

    /// Every alternative of `grpent`: a type alone, an occurrence indicator
    /// before it, a member key, both together, and an inline group with and
    /// without an occurrence indicator or a choice. `a = [group-name]` is the
    /// alternative the RFC marks preempted, reached through the first.
    #[test]
    fn grpent_alternatives() {
        assert_eq!(
            accept_all(&[
                "a = [b]",
                "a = [? b]",
                "a = {b: 1}",
                "a = {? b: 1}",
                "a = [(b, c)]",
                "a = [* (b, c)]",
                "a = [group-name]",
                "a = [(b // c)]",
            ]),
            8
        );
    }

    /// Every `memberkey` form: `type1 "=>"` plain, with the cut marker, with a
    /// literal key type, with a range, and with a type as the key; and the
    /// colon form after a bareword, a number, a text literal, and a byte
    /// string.
    #[test]
    fn memberkey_forms() {
        assert_eq!(
            accept_all(&[
                "a = {b => 1}",
                "a = {b ^ => 1}",
                "a = {\"b\" => 1}",
                "a = {(1 .. 2) => 3}",
                "a = {b: 1}",
                "a = {1: 2}",
                "a = {\"b\": 1}",
                "a = {h'ff': 1}",
                "a = {text => any}",
            ]),
            9
        );
    }

    /// Every `occur` form: `*`, `+`, `?`, and the bounded indicator with a
    /// lower bound, an upper bound, and both — the bounds writable in another
    /// base. The last has the indicator standing before a member key.
    #[test]
    fn occur_forms() {
        assert_eq!(
            accept_all(&[
                "a = [* b]",
                "a = [+ b]",
                "a = [? b]",
                "a = [2* b]",
                "a = [*3 b]",
                "a = [2*3 b]",
                "a = [0x2*0x3 b]",
                "a = {* text => any}",
            ]),
            8
        );
    }

    /// Every `value` form: numbers in each base and each float spelling,
    /// including a hexfloat; text plain, empty, and carrying an escape; and
    /// byte strings unqualified, base 16, and base 64.
    #[test]
    fn value_forms() {
        assert_eq!(
            accept_all(&[
                "a = 0",
                "a = 42",
                "a = -42",
                "a = 0x2a",
                "a = 0b101010",
                "a = 1.5",
                "a = 1e3",
                "a = 0x1.8p3",
                "a = \"text\"",
                "a = \"\"",
                "a = \"quote \\\" here\"",
                "a = 'bytes'",
                "a = h'0f0f'",
                "a = b64'aGVsbG8='",
            ]),
            14
        );
    }

    /// Each of these parses, and parses as something other than what it
    /// resembles. `#6 (b)` is not a tag — the ABNF puts no `S` before the
    /// parenthesis — so it is the major type 6 and then a group of its own.
    /// `2 *3` is not one occurrence indicator but the value 2 and then
    /// three-or-more of `b`, and `-1*3` is the same, `-1` being no `uint` and
    /// so no lower bound. A control operator needs the space that keeps it out
    /// of the name in front of it; without that space `text.size` is one name,
    /// and a legal one.
    #[test]
    fn the_absence_of_space_is_load_bearing() {
        assert_eq!(
            accept_all(&[
                "a = [#6 (b)]",
                "a = [2 *3 b]",
                "a = text .size 4",
                "a = text.size",
                "a = [-1*3 b]",
            ]),
            5
        );
    }

    /// `cddl = S 1*(rule S)` requires a rule.
    #[test]
    fn refuses_an_empty_document() {
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

    /// `genericparm` requires at least one id.
    #[test]
    fn refuses_empty_generic_parameters() {
        let error = refuse("a<> = 1");
        assert_eq!((error.line, error.column), (1, 3));
    }

    #[test]
    fn refuses_empty_generic_arguments() {
        let error = refuse("a = b<>");
        assert_eq!((error.line, error.column), (1, 7));
    }

    /// `genericarg` holds `type1`, which cannot be a choice.
    #[test]
    fn refuses_a_generic_argument_that_is_a_type_choice() {
        let error = refuse("a = b<int / text>");
        assert!(error.detail.contains("`>`"));
    }

    #[test]
    fn refuses_a_range_with_no_upper_bound() {
        let error = refuse("a = 1 ..");
        assert!(error.detail.contains("expected a type"));
    }

    /// `type1` admits one operation, so the second is unexpected.
    #[test]
    fn refuses_a_chained_range() {
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

    /// `optcom` follows an entry; it does not precede one.
    #[test]
    fn refuses_a_leading_comma_in_a_group() {
        let error = refuse("a = {, b: 1}");
        assert_eq!((error.line, error.column), (1, 6));
    }

    #[test]
    fn refuses_an_occurrence_indicator_with_no_entry() {
        let error = refuse("a = [*]");
        assert_eq!((error.line, error.column), (1, 7));
    }

    /// `occur = [uint] "*" [uint]` admits no space, so the `2` here is an
    /// entry of its own and `*3` is left wanting one.
    #[test]
    fn refuses_an_occurrence_indicator_held_off_from_its_bound() {
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

    /// A group entry may sit beside another; a rule body may not.
    #[test]
    fn refuses_two_types_juxtaposed_at_the_top_level() {
        let error = refuse("a = 1 2");
        assert_eq!((error.line, error.column), (1, 7));
    }

    /// `rule = typename [genericparm] S assignt`: no `S` before the
    /// parameters.
    #[test]
    fn refuses_generic_parameters_held_off_by_a_space() {
        let error = refuse("a <b> = 1");
        assert_eq!((error.line, error.column), (1, 3));
        assert!(error.detail.contains("`=`"));
    }

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

    /// Located, not a panic: the refusal points at where the descent gave up.
    #[test]
    fn refuses_a_type_nested_past_the_depth_bound() {
        let deep = format!("a = {}1{}", "(".repeat(400), ")".repeat(400));
        let error = refuse(&deep);
        assert!(error.detail.contains("nested deeper"));
        assert!(error.line >= 1 && error.column >= 1);
    }

    /// Eight levels of array nesting — deeper than any real theory — is well
    /// within the bound.
    #[test]
    fn a_realistically_nested_theory_still_parses() {
        let nested = format!("a = {}uint{}", "[".repeat(8), "]".repeat(8));
        accept(&nested);
    }

    /// Each nested map, array, and inline group is a group entry, and a group
    /// entry's leading `type1` is parsed exactly once. A parser that parsed it
    /// twice — once to look for a `=>` and again as the value — would cost a
    /// depth-`d` entry 2^d work, and forty levels of any of these shapes would
    /// not finish. The time bound is generous, so the guard survives a slow
    /// machine without ever admitting a parser that doubles.
    #[test]
    fn a_deeply_nested_group_entry_parses_without_reparsing() {
        let depth = 40;
        let arrays = format!("a = {{{}uint{}}}", "[".repeat(depth), "]".repeat(depth));
        let maps = format!("a = {}uint{}", "{".repeat(depth), "}".repeat(depth));
        let content_key = format!(
            "a = {{{}uint{} => 0}}",
            "[".repeat(depth),
            "]".repeat(depth)
        );
        let mut inline = String::from("0, 0");
        for _ in 0..depth {
            inline = format!("({inline}), 0");
        }
        let inline_groups = format!("a = [{inline}]");

        let start = std::time::Instant::now();
        accept(&arrays);
        accept(&maps);
        accept(&content_key);
        accept(&inline_groups);
        let elapsed = start.elapsed();
        assert!(
            elapsed < std::time::Duration::from_secs(2),
            "deep group entries took {elapsed:?}, far past a single descent"
        );
    }

    /// The value after `=>` is a whole `type`, so its first `type1` — the one
    /// the entry parsed while looking for the arrow — must go on to collect
    /// the remaining `/`-choices rather than standing alone.
    #[test]
    fn a_content_key_carries_a_value_with_choices() {
        let cddl = accept("a = {2 => x / y / z}");
        let RuleBody::Type(ty) = &cddl.rules[0].body else {
            panic!("expected a type rule");
        };
        let Type2Kind::Map(group) = &ty.choices[0].target.kind else {
            panic!("expected a map");
        };
        let GroupEntryKind::Member { key, value } = &group.choices[0].entries[0].kind else {
            panic!("expected a member entry");
        };
        assert!(
            matches!(
                key.as_ref().map(|k| &k.kind),
                Some(MemberKeyKind::Type { .. })
            ),
            "expected a `=>` type key"
        );
        assert_eq!(value.choices.len(), 3, "the value keeps all three choices");
    }

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
