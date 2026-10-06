//! ´mod:module:contract´
//!
//! The API contract: the specification and the exported schema declare one
//! surface between them, and neither drifts from the other.
//!
//! `[api-contract]` names the two documents. The specification declares the
//! surface in its fenced GraphQL blocks; the schema is the SDL the API
//! exports. What is reconciled, in both directions, is every field of the
//! query root, every field of the mutation root, every value of the error
//! enum, every union, and every member of a union both documents declare. A
//! declaration one document carries and the other does not is a drift, and
//! every drift is a finding but the staged ones below.
//!
//! # Two readers, and why
//!
//! The schema is read by `async-graphql-parser`, the parser of the release
//! whose `sdl()` wrote it, so a schema that does not parse is a schema the
//! API itself could not have exported.
//!
//! The specification cannot be read that way. Its descriptions are ordinary
//! quoted strings that run across lines, which the GraphQL grammar's string
//! rule refuses and which every reader of the document plainly means as
//! descriptions. [`read_fence`] is therefore a reader of the type-system
//! grammar written here, conservative everywhere but in that one admission:
//! a quoted string may hold a line terminator. It reads a fence as a
//! sequence of definitions and refuses at the token it cannot place.
//!
//! A fence that does not open with a definition — a description or one of
//! the definition keywords — is an excerpt: a field list quoted for
//! discussion, an example operation. It declares nothing and is not read.
//! Inside a fence that does open with one, every refusal is a finding,
//! because what the definition it falls in declares is missing from the
//! comparison. The reading resumes at the next definition rather than
//! stopping, so one defect never hides the declarations after it; and a
//! declaration the lost definition carried that the schema also carries
//! surfaces as a schema-only drift, so the loss shows twice and is never
//! silent. A schema that does not parse stops the reconciliation instead:
//! it is the generated half, a parse failure there is the exporter's, and
//! nothing read around it would be the API's surface.
//!
//! # Where a finding sits
//!
//! On the specification, always. It is the contract's own document, and the
//! partition enforces it, where the exported schema at the corpus root is
//! advisory. A declaration only the schema carries is reported at the
//! specification's own declaration of the type it belongs to, the schema's
//! site following as a related location.
//!
//! # The staged names
//!
//! The specification is the target contract and runs ahead of what is
//! built, so the rule is not equality. It is two rules. The schema's surface
//! lies inside the specification's, without exception: a declaration only
//! the schema carries is always a finding. And the specification's lead —
//! what it declares that the schema does not — equals the
//! `[api-contract] staged` list exactly: an unstaged lead is a finding, and
//! so is a staged name the schema now declares or the specification no
//! longer does. The list therefore burns down as the surface is built, and
//! what is staged produces no finding at all, because it is no defect: it
//! is the specification being ahead, said out loud in the adoption data.
//!
//! A place a fence refuses to read that `[api-contract] known_unreadable`
//! lists is carried the same way: it produces no finding while the
//! specification still refuses there, and its row is a finding once the
//! refusal is gone.
//!
//! # A departure from the ruled signature, named
//!
//! (´sig:lint:judgment-api´) hands a judgment the graph, and this one takes
//! the run's sources instead, exactly as [`super::freshness::registers`]
//! does and for its reason: the contract is a fact about two files' bytes,
//! which no node of the graph carries, and reading them a second time would
//! judge bytes the run did not lint. For that reason it is called beside
//! [`super::judge_all`] rather than from it, and it sets each finding's
//! enforcement itself: every finding takes the enforcement the partition
//! gives the specification, wherever its location sits, because the
//! contract's document is the specification.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use async_graphql_parser::types::{TypeKind, TypeSystemDefinition};
use pulldown_cmark::{CodeBlockKind, Event, Options, Parser, Tag, TagEnd};

use crate::adopt::{Adoption, ApiContract, ContractSurface, DriftSide, relative_str};
use crate::diag::{ByteSpan, Diagnostic, Enforcement, Location, Related, RuleId, Severity};

/// The specification declares what the exported schema does not.
pub const SPEC_ONLY: RuleId = RuleId::new("contract-spec-only");

/// The exported schema declares what the specification does not.
pub const SCHEMA_ONLY: RuleId = RuleId::new("contract-schema-only");

/// A staged name that is built or no longer specified, or a known
/// unreadable line the specification no longer refuses at.
pub const STALE_ENTRY: RuleId = RuleId::new("contract-stale-entry");

/// A document of the contract that could not be read.
pub const UNREADABLE: RuleId = RuleId::new("contract-unreadable");

/// The contract went unreconciled: a document it names is not in the run.
pub const SUPPRESSED: RuleId = RuleId::new("contract-suppressed");

/// Every rule this module can report.
pub const RULES: [RuleId; 5] = [SCHEMA_ONLY, SPEC_ONLY, STALE_ENTRY, SUPPRESSED, UNREADABLE];

/// How deep a reader descends into nested values and list types before it
/// refuses, so that no input can exhaust the stack.
const DEPTH: usize = 64;

/// Reconcile the specification and the exported schema `[api-contract]`
/// names.
///
/// `sources` maps each carrier path to its bytes, as the harvest read them.
/// An adoption with no `[api-contract]` reconciles nothing, and neither does
/// a run holding neither document: a fixture corpus of two files is not the
/// corpus the contract describes, and reporting on it would put a finding
/// in every fixture. A run holding one document and not the other leaves
/// one advisory finding naming the reconciliation as suppressed — the shape
/// a missing registry document leaves for kind validation — because a
/// contract half-present is a renamed or deleted document, and the
/// acceptance suite pins the real corpus to a reconciliation that ran.
///
/// ```
/// use cogra_linter::judge::contract;
/// use std::collections::BTreeMap;
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
///
/// let found = contract::reconcile(&adoption, &BTreeMap::new());
/// assert!(found.is_empty(), "a run holding neither document reconciles nothing");
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn reconcile(a: &Adoption, sources: &BTreeMap<PathBuf, Vec<u8>>) -> Vec<Diagnostic> {
    let Some(contract) = a.api_contract.as_ref() else {
        return Vec::new();
    };
    let enforcement = a.enforcement.enforcement_for(&contract.spec);
    let spec = held(sources, &contract.spec);
    let schema = held(sources, &contract.schema);
    if spec.is_none() && schema.is_none() {
        return Vec::new();
    }
    let (Some(spec), Some(schema)) = (spec, schema) else {
        return [(&contract.spec, spec), (&contract.schema, schema)]
            .into_iter()
            .filter(|(_, bytes)| bytes.is_none())
            .map(|(path, _)| suppressed(path))
            .collect();
    };

    let (Ok(spec_text), Ok(schema_text)) = (std::str::from_utf8(spec), std::str::from_utf8(schema))
    else {
        return [(&contract.spec, spec), (&contract.schema, schema)]
            .into_iter()
            .filter(|(_, bytes)| std::str::from_utf8(bytes).is_err())
            .map(|(path, _)| Diagnostic {
                rule: UNREADABLE,
                severity: Severity::Error,
                enforcement,
                primary: Location::new(path.clone(), ByteSpan::new(0, 0), 0, 0),
                related: Vec::new(),
                message: String::from("this document of the API contract is not UTF-8 text"),
            })
            .collect();
    };
    let schema_definitions = match read_schema(schema_text) {
        Ok(definitions) => definitions,
        Err(refusal) => {
            return vec![Diagnostic {
                rule: UNREADABLE,
                severity: Severity::Error,
                enforcement,
                primary: Location::in_source(
                    contract.schema.clone(),
                    ByteSpan::new(refusal.at, refusal.at),
                    schema_text,
                ),
                related: Vec::new(),
                message: format!(
                    "the exported schema does not parse, so the contract went unreconciled: {}",
                    refusal.expected
                ),
            }];
        }
    };
    let schema_side = surface_of(contract, &schema_definitions);

    let mut found = Vec::new();
    let (spec_definitions, refusals) = spec_definitions(contract, spec_text);
    let mut unread_allowed: BTreeSet<usize> = BTreeSet::new();
    for refusal in &refusals {
        let line = line_of(spec_text, refusal.at).trim();
        let allowance = contract
            .known_unreadable
            .iter()
            .position(|row| *row.line == *line);
        match allowance {
            Some(index) => {
                unread_allowed.insert(index);
            }
            None => found.push(refused(contract, spec_text, refusal, enforcement)),
        }
    }
    let spec_side = surface_of(contract, &spec_definitions);

    let texts = Texts {
        spec: (&contract.spec, spec_text),
        schema: (&contract.schema, schema_text),
    };
    for drift in compare(&spec_side, &schema_side) {
        let staged = drift.side == DriftSide::SpecOnly
            && contract
                .staged
                .iter()
                .any(|one| one.surface == drift.surface && *one.name == *drift.name);
        if !staged {
            found.push(drifted(
                &drift,
                &texts,
                &spec_side,
                &schema_side,
                enforcement,
            ));
        }
    }
    for one in &contract.staged {
        let key = (one.surface, one.name.to_string());
        let why = if schema_side.declared.contains_key(&key) {
            "the exported schema declares it, so it is built"
        } else if !spec_side.declared.contains_key(&key) {
            "the specification does not declare it"
        } else {
            continue;
        };
        found.push(stale(
            &one.at,
            &format!(
                "this row stages {} {}, and {why}; delete it from the staged list",
                one.surface, one.name
            ),
            enforcement,
        ));
    }
    for (index, row) in contract.known_unreadable.iter().enumerate() {
        if !unread_allowed.contains(&index) {
            found.push(stale(
                &row.at,
                &format!(
                    "this row allows the unreadable line {}, and the specification no longer refuses there; delete the row",
                    row.line
                ),
                enforcement,
            ));
        }
    }
    found
}

/// The run's bytes for one configured path, matched as the adoption data
/// spells paths.
fn held<'s>(sources: &'s BTreeMap<PathBuf, Vec<u8>>, wanted: &Path) -> Option<&'s [u8]> {
    if let Some(bytes) = sources.get(wanted) {
        return Some(bytes);
    }
    let spelled = relative_str(wanted);
    sources
        .iter()
        .find(|(path, _)| relative_str(path) == spelled)
        .map(|(_, bytes)| bytes.as_slice())
}

/// The two documents' paths and texts, for locating a finding in either.
struct Texts<'t> {
    spec: (&'t Path, &'t str),
    schema: (&'t Path, &'t str),
}

/// One document's declared surface.
#[derive(Debug, Default)]
pub struct Surface {
    /// Every declaration, by surface and name, at the span of its name.
    pub declared: BTreeMap<(ContractSurface, String), Site>,
    /// The first definition or extension of each type the document names,
    /// at the span of the type's name: where a declaration the document
    /// lacks is reported against it.
    pub anchors: BTreeMap<String, ByteSpan>,
}

/// Where one declaration sits, and the type it belongs to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Site {
    /// The span of the declaration's name, in whole-file coordinates.
    pub span: ByteSpan,
    /// The type it is declared in: the root, the error enum, or the union.
    pub container: String,
}

/// One declaration one document carries and the other does not.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Drift {
    /// What kind of declaration it is.
    pub surface: ContractSurface,
    /// Its name; `Union.Member` for a union member.
    pub name: String,
    /// Which document carries it alone.
    pub side: DriftSide,
}

/// Every drift between two surfaces, the specification's first.
///
/// A union one document lacks altogether is one drift and not one per
/// member: its members are reported only where both documents declare the
/// union, so a missing union reads as the single repair it is.
#[must_use]
pub fn compare(spec: &Surface, schema: &Surface) -> Vec<Drift> {
    let mut found = Vec::new();
    for (side, here, there) in [
        (DriftSide::SpecOnly, spec, schema),
        (DriftSide::SchemaOnly, schema, spec),
    ] {
        for ((surface, name), site) in &here.declared {
            if there.declared.contains_key(&(*surface, name.clone())) {
                continue;
            }
            if *surface == ContractSurface::UnionMember
                && !there
                    .declared
                    .contains_key(&(ContractSurface::Union, site.container.clone()))
            {
                continue;
            }
            found.push(Drift {
                surface: *surface,
                name: name.clone(),
                side,
            });
        }
    }
    found
}

/// One definition, as either reader leaves it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Definition {
    /// What it defines.
    pub kind: DefinitionKind,
    /// The type's name; empty for a schema definition.
    pub name: String,
    /// The span of the name, local to the text the reader was given.
    pub span: ByteSpan,
    /// Its fields, enum values, or union members, each at its name's span.
    pub members: Vec<(String, ByteSpan)>,
    /// For a schema definition, its operation roots: `query`, `mutation`,
    /// or `subscription` against the type that serves it.
    pub roots: Vec<(String, String)>,
}

impl Definition {
    /// The same definition, every span moved by `by` bytes.
    #[must_use]
    pub fn shifted(mut self, by: usize) -> Definition {
        self.span = ByteSpan::new(self.span.start + by, self.span.end + by);
        for (_, span) in &mut self.members {
            *span = ByteSpan::new(span.start + by, span.end + by);
        }
        self
    }

    /// The same definition, every span mapped by `place`.
    fn placed(mut self, place: impl Fn(ByteSpan) -> ByteSpan) -> Definition {
        self.span = place(self.span);
        for (_, span) in &mut self.members {
            *span = place(*span);
        }
        self
    }
}

/// The kinds of type-system definition the readers distinguish.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DefinitionKind {
    /// An object type or its extension.
    Object,
    /// An interface type or its extension.
    Interface,
    /// An input object type or its extension.
    Input,
    /// An enum type or its extension.
    Enum,
    /// A union type or its extension.
    Union,
    /// A scalar type or its extension.
    Scalar,
    /// The schema definition or its extension.
    Schema,
    /// A directive definition.
    Directive,
}

/// The surface a list of definitions declares.
///
/// The roots are the schema definition's where the document writes one, and
/// GraphQL's default names where it does not. The first declaration of a
/// name wins and a repeated one is not reported: a name declared twice
/// within one document is that document's affair, and this judgment's is
/// only whether the two documents agree.
#[must_use]
pub fn surface_of(contract: &ApiContract, definitions: &[Definition]) -> Surface {
    let mut query = String::from("Query");
    let mut mutation = String::from("Mutation");
    for one in definitions
        .iter()
        .filter(|one| one.kind == DefinitionKind::Schema)
    {
        for (operation, served) in &one.roots {
            match operation.as_str() {
                "query" => query.clone_from(served),
                "mutation" => mutation.clone_from(served),
                _ => {}
            }
        }
    }
    let mut surface = Surface::default();
    for one in definitions {
        if one.kind == DefinitionKind::Schema || one.kind == DefinitionKind::Directive {
            continue;
        }
        surface.anchors.entry(one.name.clone()).or_insert(one.span);
        let member_surface = match one.kind {
            DefinitionKind::Object if one.name == query => ContractSurface::Query,
            DefinitionKind::Object if one.name == mutation => ContractSurface::Mutation,
            DefinitionKind::Enum if *one.name == *contract.error_enum => ContractSurface::ErrorCode,
            DefinitionKind::Union => {
                surface
                    .declared
                    .entry((ContractSurface::Union, one.name.clone()))
                    .or_insert_with(|| Site {
                        span: one.span,
                        container: one.name.clone(),
                    });
                ContractSurface::UnionMember
            }
            _ => continue,
        };
        for (member, span) in &one.members {
            let name = if member_surface == ContractSurface::UnionMember {
                format!("{}.{member}", one.name)
            } else {
                member.clone()
            };
            surface
                .declared
                .entry((member_surface, name))
                .or_insert_with(|| Site {
                    span: *span,
                    container: one.name.clone(),
                });
        }
    }
    surface
}

/// The specification's definitions out of its declaring fences, and every
/// refusal, both in whole-file coordinates.
fn spec_definitions(contract: &ApiContract, text: &str) -> (Vec<Definition>, Vec<Refusal>) {
    let mut definitions = Vec::new();
    let mut refusals = Vec::new();
    for fence in fences(text, &contract.fence) {
        let read = read_fence(&fence.text);
        definitions.extend(
            read.definitions
                .into_iter()
                .map(|one| one.placed(|span| fence.place(span))),
        );
        refusals.extend(read.refusals.into_iter().map(|refusal| Refusal {
            at: fence.place(ByteSpan::new(refusal.at, refusal.at)).start,
            expected: refusal.expected,
        }));
    }
    (definitions, refusals)
}

/// The text of the line holding byte `at`, without its line terminator.
fn line_of(text: &str, at: usize) -> &str {
    let start = text
        .get(..at)
        .and_then(|before| before.rfind('\n'))
        .map_or(0, |found| found + 1);
    let rest = text.get(start..).unwrap_or_default();
    rest.find('\n')
        .map_or(rest, |end| rest.get(..end).unwrap_or_default())
}

/// Where a reader stopped, and what it wanted there.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Refusal {
    /// The byte offset, local to the text the reader was given.
    pub at: usize,
    /// What it wanted.
    pub expected: String,
}

/// The exported schema's definitions, read by `async-graphql-parser`.
///
/// # Errors
///
/// [`Refusal`] carrying the parser's own message, at the position it names.
pub fn read_schema(text: &str) -> Result<Vec<Definition>, Refusal> {
    let document = async_graphql_parser::parse_schema(text).map_err(|error| {
        let at = error
            .positions()
            .next()
            .map_or(0, |pos| offset_of(text, pos.line, pos.column));
        Refusal {
            at,
            expected: error.to_string().replace('\n', " "),
        }
    })?;
    let mut definitions = Vec::with_capacity(document.definitions.len());
    for definition in &document.definitions {
        match definition {
            TypeSystemDefinition::Schema(schema) => {
                let roots = [
                    ("query", schema.node.query.as_ref()),
                    ("mutation", schema.node.mutation.as_ref()),
                    ("subscription", schema.node.subscription.as_ref()),
                ]
                .into_iter()
                .filter_map(|(operation, served)| {
                    served.map(|name| (String::from(operation), name.node.to_string()))
                })
                .collect();
                let at = offset_of(text, schema.pos.line, schema.pos.column);
                definitions.push(Definition {
                    kind: DefinitionKind::Schema,
                    name: String::new(),
                    span: ByteSpan::new(at, at),
                    members: Vec::new(),
                    roots,
                });
            }
            TypeSystemDefinition::Directive(_) => {}
            TypeSystemDefinition::Type(typed) => {
                let node = &typed.node;
                let (kind, members): (DefinitionKind, Vec<(String, ByteSpan)>) = match &node.kind {
                    TypeKind::Scalar => (DefinitionKind::Scalar, Vec::new()),
                    TypeKind::Object(object) => (
                        DefinitionKind::Object,
                        object
                            .fields
                            .iter()
                            .map(|field| located(text, &field.node.name))
                            .collect(),
                    ),
                    TypeKind::Interface(interface) => (
                        DefinitionKind::Interface,
                        interface
                            .fields
                            .iter()
                            .map(|field| located(text, &field.node.name))
                            .collect(),
                    ),
                    TypeKind::Union(union) => (
                        DefinitionKind::Union,
                        union
                            .members
                            .iter()
                            .map(|member| located(text, member))
                            .collect(),
                    ),
                    TypeKind::Enum(enumeration) => (
                        DefinitionKind::Enum,
                        enumeration
                            .values
                            .iter()
                            .map(|value| located(text, &value.node.value))
                            .collect(),
                    ),
                    TypeKind::InputObject(input) => (
                        DefinitionKind::Input,
                        input
                            .fields
                            .iter()
                            .map(|field| located(text, &field.node.name))
                            .collect(),
                    ),
                };
                let (name, span) = located(text, &node.name);
                definitions.push(Definition {
                    kind,
                    name,
                    span,
                    members,
                    roots: Vec::new(),
                });
            }
        }
    }
    Ok(definitions)
}

/// One positioned name of the parser's tree, as its text and the byte span
/// it occupies.
fn located<N: std::ops::Deref<Target = str>>(
    text: &str,
    name: &async_graphql_parser::Positioned<N>,
) -> (String, ByteSpan) {
    let at = offset_of(text, name.pos.line, name.pos.column);
    (
        String::from(&*name.node),
        ByteSpan::new(at, at + name.node.len()),
    )
}

/// The byte offset of a one-based line and a one-based column counted in
/// characters, which is how `async-graphql-parser` reports a position.
fn offset_of(text: &str, line: usize, column: usize) -> usize {
    let mut start = 0;
    for _ in 1..line {
        match text.get(start..).and_then(|rest| rest.find('\n')) {
            Some(found) => start += found + 1,
            None => return text.len(),
        }
    }
    let rest = text.get(start..).unwrap_or_default();
    start
        + rest
            .char_indices()
            .nth(column.saturating_sub(1))
            .map_or(rest.len(), |(at, _)| at)
}

/// One declaring fence of the specification: its text, and the file ranges
/// the text was assembled from.
#[derive(Debug, Default)]
struct Fence {
    text: String,
    pieces: Vec<(usize, usize, usize)>,
}

impl Fence {
    /// The whole-file span of a span local to the fence's text.
    fn place(&self, local: ByteSpan) -> ByteSpan {
        ByteSpan::new(self.at(local.start), self.at(local.end))
    }

    /// The file offset of one offset local to the fence's text: inside the
    /// piece that holds it, or the end of the last piece past them all.
    fn at(&self, local: usize) -> usize {
        self.pieces
            .iter()
            .find(|&&(from, _, len)| from <= local && local <= from + len)
            .or(self.pieces.last())
            .map_or(0, |&(from, file, len)| {
                file + local.saturating_sub(from).min(len)
            })
    }
}

/// Every fenced code block of `text` whose info string's first word is
/// `info`, read through the Markdown parser the frontend uses, with its
/// one extension.
fn fences(text: &str, info: &str) -> Vec<Fence> {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    let mut found = Vec::new();
    let mut open: Option<Fence> = None;
    for (event, range) in Parser::new_ext(text, options).into_offset_iter() {
        match event {
            Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(written)))
                if written.split_whitespace().next() == Some(info) =>
            {
                open = Some(Fence::default());
            }
            Event::Text(content) => {
                if let Some(fence) = open.as_mut() {
                    fence
                        .pieces
                        .push((fence.text.len(), range.start, content.len()));
                    fence.text.push_str(&content);
                }
            }
            Event::End(TagEnd::CodeBlock) => {
                if let Some(fence) = open.take() {
                    found.push(fence);
                }
            }
            _ => {}
        }
    }
    found
}

/// One token of the specification's GraphQL.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Token<'s> {
    /// A punctuator; `...` is spelled `.`.
    Punct(u8),
    /// A name.
    Name(&'s str),
    /// An integer or float value.
    Number,
    /// A quoted or block string.
    Str,
}

/// The specification's GraphQL as tokens, each at its byte offset, and the
/// refusal that ended the lexing early, if one did.
///
/// The lexical grammar is GraphQL's own (October 2021, section 2.1) with one
/// admission: a quoted string may hold a line terminator, because the
/// specification's descriptions do. Lexing is over bytes, which is sound
/// because every byte the grammar distinguishes is ASCII and no byte of a
/// multi-byte UTF-8 sequence is.
fn lex(text: &str) -> (Vec<(Token<'_>, usize)>, Option<Refusal>) {
    let bytes = text.as_bytes();
    let mut tokens = Vec::new();
    let mut at = 0;
    let refuse = |at: usize, expected: &str| Refusal {
        at,
        expected: String::from(expected),
    };
    while let Some(&byte) = bytes.get(at) {
        match byte {
            b' ' | b'\t' | b',' | b'\n' | b'\r' => at += 1,
            0xEF if bytes.get(at..at + 3) == Some(&[0xEF, 0xBB, 0xBF][..]) => at += 3,
            b'#' => {
                while bytes
                    .get(at)
                    .is_some_and(|&one| one != b'\n' && one != b'\r')
                {
                    at += 1;
                }
            }
            b'!' | b'$' | b'&' | b'(' | b')' | b':' | b'=' | b'@' | b'[' | b']' | b'{' | b'|'
            | b'}' => {
                tokens.push((Token::Punct(byte), at));
                at += 1;
            }
            b'.' => {
                if bytes.get(at..at + 3) != Some(&b"..."[..]) {
                    return (tokens, Some(refuse(at, "a spread, which is three dots")));
                }
                tokens.push((Token::Punct(b'.'), at));
                at += 3;
            }
            b'"' if bytes.get(at..at + 3) == Some(&b"\"\"\""[..]) => {
                let start = at;
                at += 3;
                loop {
                    match bytes.get(at..at + 3) {
                        Some(b"\"\"\"") => {
                            at += 3;
                            break;
                        }
                        Some([b'\\', b'"', b'"']) if bytes.get(at + 3) == Some(&b'"') => at += 4,
                        Some(_) => at += 1,
                        None => {
                            return (tokens, Some(refuse(start, "the end of this block string")));
                        }
                    }
                }
                tokens.push((Token::Str, start));
            }
            b'"' => {
                let start = at;
                at += 1;
                loop {
                    match bytes.get(at) {
                        Some(b'"') => {
                            at += 1;
                            break;
                        }
                        Some(b'\\') => at += 2,
                        Some(_) => at += 1,
                        None => return (tokens, Some(refuse(start, "the end of this string"))),
                    }
                }
                tokens.push((Token::Str, start));
            }
            b'-' | b'0'..=b'9' => {
                let start = at;
                at += 1;
                while bytes.get(at).is_some_and(|one| {
                    one.is_ascii_alphanumeric() || matches!(one, b'.' | b'+' | b'-')
                }) {
                    at += 1;
                }
                tokens.push((Token::Number, start));
            }
            b'_' | b'A'..=b'Z' | b'a'..=b'z' => {
                let start = at;
                while bytes
                    .get(at)
                    .is_some_and(|one| one.is_ascii_alphanumeric() || *one == b'_')
                {
                    at += 1;
                }
                tokens.push((Token::Name(text.get(start..at).unwrap_or_default()), start));
            }
            _ => return (tokens, Some(refuse(at, "a GraphQL token"))),
        }
    }
    (tokens, None)
}

/// The words a definition may open with, after its description.
const OPENERS: [&str; 9] = [
    "directive",
    "enum",
    "extend",
    "input",
    "interface",
    "scalar",
    "schema",
    "type",
    "union",
];

/// What one fence read as: its definitions, and every place the reading
/// stopped.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct FenceRead {
    /// Every definition read to its end, at spans local to the fence.
    pub definitions: Vec<Definition>,
    /// Every refusal, at offsets local to the fence.
    pub refusals: Vec<Refusal>,
}

/// Read one fence of the specification as a sequence of type-system
/// definitions and extensions.
///
/// A fence that does not open with a description or one of the definition
/// keywords is an excerpt and reads as no definitions at all.
///
/// A refusal ends the definition it fell in, and the reading resumes at the
/// next line that opens one in the first column — a description's quote or
/// a definition keyword — which is how every definition of the
/// specification is written. Resuming is what keeps one defect from hiding
/// every declaration after it; the definition the refusal fell in is lost,
/// and the refusal is reported so that the loss is never silent.
///
/// ```
/// use cogra_linter::judge::contract::{read_fence, DefinitionKind};
///
/// let read = read_fence("\"Spans\n lines.\"\nextend type Mutation {\n  go(id: ID!): Boolean!\n}\n");
/// assert!(read.refusals.is_empty());
/// assert_eq!(read.definitions.len(), 1);
/// assert_eq!(read.definitions[0].kind, DefinitionKind::Object);
/// assert_eq!(read.definitions[0].members[0].0, "go");
///
/// assert_eq!(read_fence("attachments: [MediaAttachment!]!\n"), Default::default());
///
/// let broken = read_fence("type Query { me: }\nenum E { A }\n");
/// assert_eq!(broken.refusals.len(), 1);
/// assert_eq!(broken.definitions[0].name, "E", "the reading resumed");
/// ```
#[must_use]
pub fn read_fence(text: &str) -> FenceRead {
    let mut read = FenceRead::default();
    let mut from = 0;
    while let Some(rest) = text.get(from..) {
        let (tokens, lexed) = lex(rest);
        if from == 0 {
            let opens = match tokens.first() {
                Some((Token::Str, _)) => true,
                Some((Token::Name(word), _)) => OPENERS.contains(word),
                _ => false,
            };
            if !opens {
                return read;
            }
        }
        let stop = lexed.as_ref().map_or(rest.len(), |refusal| refusal.at);
        let mut reader = Reader {
            tokens: &tokens,
            next: 0,
            end: stop,
        };
        let mut stopped = None;
        while reader.peek().is_some() {
            match reader.definition() {
                Ok(one) => read.definitions.push(one.shifted(from)),
                Err(refusal) => {
                    stopped = Some(refusal);
                    break;
                }
            }
        }
        let refusal = match (stopped, lexed) {
            (Some(refusal), Some(lexing)) if refusal.at >= lexing.at => Some(lexing),
            (Some(refusal), _) => Some(refusal),
            (None, lexing) => lexing,
        };
        let Some(refusal) = refusal else {
            break;
        };
        let at = from + refusal.at;
        read.refusals.push(Refusal {
            at,
            expected: refusal.expected,
        });
        match resumption(text, at) {
            Some(next) => from = next,
            None => break,
        }
    }
    read
}

/// The start of the first line after the one holding `at` that opens a
/// definition in its first column, where a fence has one.
fn resumption(text: &str, at: usize) -> Option<usize> {
    let mut start = at + text.get(at..)?.find('\n')? + 1;
    loop {
        let line = text.get(start..)?;
        let first_word: &str = line
            .split(|one: char| !(one.is_ascii_alphanumeric() || one == '_'))
            .next()
            .unwrap_or_default();
        if line.starts_with('"') || OPENERS.contains(&first_word) {
            return Some(start);
        }
        start += line.find('\n')? + 1;
    }
}

/// The recursive descent over one fence's tokens.
struct Reader<'t, 's> {
    tokens: &'t [(Token<'s>, usize)],
    next: usize,
    end: usize,
}

impl<'s> Reader<'_, 's> {
    fn peek(&self) -> Option<Token<'s>> {
        self.tokens.get(self.next).map(|(token, _)| *token)
    }

    fn here(&self) -> usize {
        self.tokens.get(self.next).map_or(self.end, |(_, at)| *at)
    }

    fn refuse<T>(&self, expected: &str) -> Result<T, Refusal> {
        Err(Refusal {
            at: self.here(),
            expected: String::from(expected),
        })
    }

    fn eat(&mut self, punct: u8) -> bool {
        if self.peek() == Some(Token::Punct(punct)) {
            self.next += 1;
            return true;
        }
        false
    }

    fn eat_word(&mut self, word: &str) -> bool {
        if self.peek() == Some(Token::Name(word)) {
            self.next += 1;
            return true;
        }
        false
    }

    fn expect(&mut self, punct: u8, expected: &str) -> Result<(), Refusal> {
        if self.eat(punct) {
            return Ok(());
        }
        self.refuse(expected)
    }

    fn name(&mut self) -> Result<(String, ByteSpan), Refusal> {
        match self.tokens.get(self.next) {
            Some((Token::Name(word), at)) => {
                self.next += 1;
                Ok((String::from(*word), ByteSpan::new(*at, at + word.len())))
            }
            _ => self.refuse("a name"),
        }
    }

    fn description(&mut self) {
        if self.peek() == Some(Token::Str) {
            self.next += 1;
        }
    }

    fn definition(&mut self) -> Result<Definition, Refusal> {
        self.description();
        self.eat_word("extend");
        let opened = self.here();
        let (keyword, _) = self.name()?;
        let mut definition = Definition {
            kind: DefinitionKind::Scalar,
            name: String::new(),
            span: ByteSpan::new(self.here(), self.here()),
            members: Vec::new(),
            roots: Vec::new(),
        };
        match keyword.as_str() {
            "schema" => {
                definition.kind = DefinitionKind::Schema;
                self.directives()?;
                if self.eat(b'{') {
                    while !self.eat(b'}') {
                        let (operation, _) = self.name()?;
                        self.expect(b':', "a colon after the operation type")?;
                        let (served, _) = self.name()?;
                        definition.roots.push((operation, served));
                    }
                }
            }
            "scalar" => {
                (definition.name, definition.span) = self.name()?;
                self.directives()?;
            }
            "type" | "interface" => {
                definition.kind = if keyword == "type" {
                    DefinitionKind::Object
                } else {
                    DefinitionKind::Interface
                };
                (definition.name, definition.span) = self.name()?;
                if self.eat_word("implements") {
                    self.eat(b'&');
                    self.name()?;
                    while self.eat(b'&') {
                        self.name()?;
                    }
                }
                self.directives()?;
                if self.eat(b'{') {
                    while !self.eat(b'}') {
                        self.description();
                        definition.members.push(self.name()?);
                        if self.peek() == Some(Token::Punct(b'(')) {
                            self.arguments_definition()?;
                        }
                        self.expect(b':', "a colon before the field's type")?;
                        self.type_reference(0)?;
                        self.directives()?;
                    }
                }
            }
            "input" => {
                definition.kind = DefinitionKind::Input;
                (definition.name, definition.span) = self.name()?;
                self.directives()?;
                if self.eat(b'{') {
                    while !self.eat(b'}') {
                        definition.members.push(self.input_value()?);
                    }
                }
            }
            "enum" => {
                definition.kind = DefinitionKind::Enum;
                (definition.name, definition.span) = self.name()?;
                self.directives()?;
                if self.eat(b'{') {
                    while !self.eat(b'}') {
                        self.description();
                        definition.members.push(self.name()?);
                        self.directives()?;
                    }
                }
            }
            "union" => {
                definition.kind = DefinitionKind::Union;
                (definition.name, definition.span) = self.name()?;
                self.directives()?;
                if self.eat(b'=') {
                    self.eat(b'|');
                    definition.members.push(self.name()?);
                    while self.eat(b'|') {
                        definition.members.push(self.name()?);
                    }
                }
            }
            "directive" => {
                definition.kind = DefinitionKind::Directive;
                self.expect(b'@', "the directive's at sign")?;
                (definition.name, definition.span) = self.name()?;
                if self.peek() == Some(Token::Punct(b'(')) {
                    self.arguments_definition()?;
                }
                self.eat_word("repeatable");
                if !self.eat_word("on") {
                    return self.refuse("the word on, before the directive's locations");
                }
                self.eat(b'|');
                self.name()?;
                while self.eat(b'|') {
                    self.name()?;
                }
            }
            _ => {
                return Err(Refusal {
                    at: opened,
                    expected: String::from("a type-system definition"),
                });
            }
        }
        Ok(definition)
    }

    fn arguments_definition(&mut self) -> Result<(), Refusal> {
        self.expect(b'(', "an opening parenthesis")?;
        while !self.eat(b')') {
            self.input_value()?;
        }
        Ok(())
    }

    fn input_value(&mut self) -> Result<(String, ByteSpan), Refusal> {
        self.description();
        let named = self.name()?;
        self.expect(b':', "a colon before the value's type")?;
        self.type_reference(0)?;
        if self.eat(b'=') {
            self.value(0)?;
        }
        self.directives()?;
        Ok(named)
    }

    fn type_reference(&mut self, depth: usize) -> Result<(), Refusal> {
        if depth > DEPTH {
            return self.refuse("a type nested no deeper than the reader descends");
        }
        if self.eat(b'[') {
            self.type_reference(depth + 1)?;
            self.expect(b']', "the closing bracket of a list type")?;
        } else {
            self.name()?;
        }
        self.eat(b'!');
        Ok(())
    }

    fn directives(&mut self) -> Result<(), Refusal> {
        while self.eat(b'@') {
            self.name()?;
            if self.eat(b'(') {
                while !self.eat(b')') {
                    self.name()?;
                    self.expect(b':', "a colon after the argument's name")?;
                    self.value(0)?;
                }
            }
        }
        Ok(())
    }

    fn value(&mut self, depth: usize) -> Result<(), Refusal> {
        if depth > DEPTH {
            return self.refuse("a value nested no deeper than the reader descends");
        }
        match self.peek() {
            Some(Token::Punct(b'$')) => {
                self.next += 1;
                self.name()?;
            }
            Some(Token::Number | Token::Str | Token::Name(_)) => self.next += 1,
            Some(Token::Punct(b'[')) => {
                self.next += 1;
                while !self.eat(b']') {
                    if self.peek().is_none() {
                        return self.refuse("the closing bracket of a list value");
                    }
                    self.value(depth + 1)?;
                }
            }
            Some(Token::Punct(b'{')) => {
                self.next += 1;
                while !self.eat(b'}') {
                    self.name()?;
                    self.expect(b':', "a colon after the field's name")?;
                    self.value(depth + 1)?;
                }
            }
            _ => return self.refuse("a value"),
        }
        Ok(())
    }
}

/// One drift as a finding, on the specification.
fn drifted(
    drift: &Drift,
    texts: &Texts<'_>,
    spec: &Surface,
    schema: &Surface,
    enforcement: Enforcement,
) -> Diagnostic {
    let key = (drift.surface, drift.name.clone());
    let (spec_path, spec_text) = texts.spec;
    let (schema_path, schema_text) = texts.schema;
    let (rule, primary, related, message) = match drift.side {
        DriftSide::SpecOnly => {
            let site = spec.declared.get(&key);
            let primary = site.map_or(ByteSpan::new(0, 0), |one| one.span);
            let related = site
                .and_then(|one| schema.anchors.get(&one.container))
                .map(|span| Related {
                    at: Location::in_source(schema_path.to_path_buf(), *span, schema_text),
                    note: String::from("the exported schema's declaration of the type, without it"),
                });
            (
                SPEC_ONLY,
                primary,
                related,
                format!(
                    "the specification declares {} {}, which the exported schema does not and the staged list does not name",
                    drift.surface, drift.name
                ),
            )
        }
        DriftSide::SchemaOnly => {
            let site = schema.declared.get(&key);
            let primary = site
                .and_then(|one| spec.anchors.get(&one.container))
                .copied()
                .unwrap_or(ByteSpan::new(0, 0));
            let related = site.map(|one| Related {
                at: Location::in_source(schema_path.to_path_buf(), one.span, schema_text),
                note: String::from("the exported schema's declaration"),
            });
            (
                SCHEMA_ONLY,
                primary,
                related,
                format!(
                    "the exported schema declares {} {}, and the specification does not",
                    drift.surface, drift.name
                ),
            )
        }
    };
    Diagnostic {
        rule,
        severity: Severity::Error,
        enforcement,
        primary: Location::in_source(spec_path.to_path_buf(), primary, spec_text),
        related: related.into_iter().collect(),
        message,
    }
}

/// A list entry the contract no longer bears out.
fn stale(at: &Location, message: &str, enforcement: Enforcement) -> Diagnostic {
    Diagnostic {
        rule: STALE_ENTRY,
        severity: Severity::Error,
        enforcement,
        primary: at.clone(),
        related: Vec::new(),
        message: String::from(message),
    }
}

/// One place a declaring fence of the specification refused to read.
fn refused(
    contract: &ApiContract,
    text: &str,
    refusal: &Refusal,
    enforcement: Enforcement,
) -> Diagnostic {
    let message = format!(
        "this GraphQL fence stops reading here, wanting {}, and what the definition it falls in declares is not compared",
        refusal.expected
    );
    Diagnostic {
        rule: UNREADABLE,
        severity: Severity::Error,
        enforcement,
        primary: Location::in_source(
            contract.spec.clone(),
            ByteSpan::new(refusal.at, refusal.at),
            text,
        ),
        related: Vec::new(),
        message,
    }
}

/// The one finding a document missing from the run leaves behind.
fn suppressed(path: &Path) -> Diagnostic {
    Diagnostic {
        rule: SUPPRESSED,
        severity: Severity::Error,
        enforcement: Enforcement::Advisory,
        primary: Location::new(path.to_path_buf(), ByteSpan::new(0, 0), 0, 0),
        related: Vec::new(),
        message: String::from(
            "the API contract went unreconciled: this document is not among the run's sources",
        ),
    }
}
