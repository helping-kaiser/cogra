//! The API contract judgment over fabricated documents.
//!
//! Each test plants one disagreement between a small specification and a
//! small exported schema and asserts the finding it raises — its rule, its
//! enforcement, and where it sits — so that both directions of the
//! reconciliation are shown to bite and not merely to stay quiet on the real
//! corpus. The adoption is the corpus's own, with its contract replaced by
//! one naming the fixtures; the specification sits under `docs/`, which the
//! partition enforces, exactly as the real one does.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use cogra_linter::judge::contract::{
    self, SCHEMA_ONLY, SPEC_ONLY, STALE_ENTRY, SUPPRESSED, UNREADABLE,
};
use cogra_linter::{
    Adoption, ApiContract, ByteSpan, ContractSurface, Diagnostic, Enforcement, KnownUnreadable,
    Location, StagedName,
};

const SPEC_PATH: &str = "docs/spec.md";
const SCHEMA_PATH: &str = "schema.graphql";

/// A specification declaring one query, one mutation, one error code, and
/// one union, its descriptions written the way the real one writes them.
const SPEC: &str = "# Spec

The read surface.

```graphql
type Query {
  \"The viewer, or null when the request is
   anonymous.\"
  me: User
}
```

The write surface.

```graphql
extend type Mutation {
  logIn(input: LogInInput!): LogInPayload!
}

enum ErrorCode {
  INTERNAL
}

union Target = Post | Comment
```
";

/// The schema that agrees with [`SPEC`] exactly.
const SCHEMA: &str = "schema {
\tquery: Query
\tmutation: Mutation
}
type Query {
\tme: User
}
type Mutation {
\tlogIn(input: LogInInput!): LogInPayload!
}
enum ErrorCode {
\tINTERNAL
}
union Target = Post | Comment
";

/// The corpus's adoption with its contract pointed at the fixtures.
fn adoption(staged: Vec<StagedName>, known_unreadable: Vec<KnownUnreadable>) -> Adoption {
    let mut adoption = Adoption::load(Path::new(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../corpus-adoption.toml"
    )))
    .expect("the corpus's own adoption data is ruled");
    adoption.api_contract = Some(ApiContract {
        spec: PathBuf::from(SPEC_PATH),
        schema: PathBuf::from(SCHEMA_PATH),
        fence: Box::from("graphql"),
        error_enum: Box::from("ErrorCode"),
        staged,
        known_unreadable,
    });
    adoption
}

/// The two documents as a run would hold them.
fn sources(spec: &str, schema: &str) -> BTreeMap<PathBuf, Vec<u8>> {
    BTreeMap::from([
        (PathBuf::from(SPEC_PATH), spec.as_bytes().to_vec()),
        (PathBuf::from(SCHEMA_PATH), schema.as_bytes().to_vec()),
    ])
}

/// A list entry's location, which no test reads for anything but identity.
fn somewhere() -> Location {
    Location::new(
        PathBuf::from("corpus-adoption.toml"),
        ByteSpan::new(0, 0),
        1,
        1,
    )
}

/// One staged name.
fn staged(surface: ContractSurface, name: &str) -> StagedName {
    StagedName {
        surface,
        name: Box::from(name),
        built_by: Box::from("the packet that builds it"),
        at: somewhere(),
    }
}

/// The one finding a reconciliation reports, where it reports exactly one.
fn only(found: &[Diagnostic]) -> &Diagnostic {
    assert_eq!(found.len(), 1, "{found:#?}");
    &found[0]
}

/// The line a finding's primary location names, as text.
fn line(text: &str, at: &Location) -> String {
    text.lines()
        .nth(at.line.saturating_sub(1) as usize)
        .map(String::from)
        .unwrap_or_default()
}

/// The fixtures agree, so the reconciliation of them reports nothing.
///
/// A specification and a schema declaring one surface reconcile with no finding.
/// ´claim:contract:agreeing-documents-are-clean´
#[test]
fn two_agreeing_documents_reconcile_cleanly() {
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(SPEC, SCHEMA));
    assert!(found.is_empty(), "{found:#?}");
}

/// The first direction: a mutation only the specification declares is a
/// failing finding at the specification's own declaration of it.
///
/// A declaration only the specification carries fails at its own line.
/// ´claim:contract:a-spec-only-declaration-fails´
#[test]
fn a_mutation_only_the_specification_declares_fails() {
    let spec = SPEC.replace(
        "  logIn(input: LogInInput!): LogInPayload!\n",
        "  logIn(input: LogInInput!): LogInPayload!\n  logOut: Boolean!\n",
    );
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(&spec, SCHEMA));
    let one = only(&found);
    assert_eq!(one.rule, SPEC_ONLY);
    assert_eq!(one.enforcement, Enforcement::Failing);
    assert_eq!(one.primary.path, PathBuf::from(SPEC_PATH));
    assert!(line(&spec, &one.primary).contains("logOut"), "{one:#?}");
    assert!(one.message.contains("mutation logOut"), "{}", one.message);
}

/// The second direction: an error code only the exported schema declares is
/// a failing finding too. It sits on the specification, at its declaration
/// of the enum the code is missing from, and the schema's site follows it.
///
/// A declaration only the schema carries fails on the specification, the schema's site related.
/// ´claim:contract:a-schema-only-declaration-fails´
#[test]
fn an_error_code_only_the_schema_declares_fails() {
    let schema = SCHEMA.replace("\tINTERNAL\n", "\tINTERNAL\n\tRATE_LIMITED\n");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(SPEC, &schema));
    let one = only(&found);
    assert_eq!(one.rule, SCHEMA_ONLY);
    assert_eq!(one.enforcement, Enforcement::Failing);
    assert_eq!(one.primary.path, PathBuf::from(SPEC_PATH));
    assert!(
        line(SPEC, &one.primary).contains("enum ErrorCode"),
        "{one:#?}"
    );
    assert_eq!(one.related.len(), 1, "{one:#?}");
    assert_eq!(one.related[0].at.path, PathBuf::from(SCHEMA_PATH));
    assert!(line(&schema, &one.related[0].at).contains("RATE_LIMITED"));
    assert!(
        one.message.contains("error-code RATE_LIMITED"),
        "{}",
        one.message
    );
}

/// A query works the same way as a mutation, from either side.
///
/// A query either document alone declares is a finding.
/// ´claim:contract:a-lone-query-is-a-finding´
#[test]
fn a_query_either_document_alone_declares_is_a_finding() {
    let schema = SCHEMA.replace("\tme: User\n", "\tme: User\n\tnode(id: ID!): Node\n");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(SPEC, &schema));
    assert_eq!(only(&found).rule, SCHEMA_ONLY);
    assert!(only(&found).message.contains("query node"));

    let spec = SPEC.replace("  me: User\n", "  me: User\n  node(id: ID!): Node\n");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(&spec, SCHEMA));
    assert_eq!(only(&found).rule, SPEC_ONLY);
}

/// A staged name is the specification being ahead, and produces no finding;
/// once the schema declares it, it is built and the entry fails until it is
/// deleted, so the list burns down.
///
/// A staged name is silent while unbuilt and fails once the schema declares it.
/// ´claim:contract:the-staged-list-burns-down´
#[test]
fn a_staged_name_is_silent_until_built_and_then_fails() {
    let spec = SPEC.replace("  INTERNAL\n", "  INTERNAL\n  ASK_LINK_UNUSABLE\n");
    let entry = staged(ContractSurface::ErrorCode, "ASK_LINK_UNUSABLE");
    let found = contract::reconcile(
        &adoption(vec![entry.clone()], Vec::new()),
        &sources(&spec, SCHEMA),
    );
    assert!(found.is_empty(), "{found:#?}");

    let built = SCHEMA.replace("\tINTERNAL\n", "\tINTERNAL\n\tASK_LINK_UNUSABLE\n");
    let found = contract::reconcile(&adoption(vec![entry], Vec::new()), &sources(&spec, &built));
    let one = only(&found);
    assert_eq!(one.rule, STALE_ENTRY);
    assert_eq!(one.enforcement, Enforcement::Failing);
    assert!(one.message.contains("built"), "{}", one.message);
}

/// The staged list is exactly the specification's lead, so a staged name
/// the specification does not declare fails too.
///
/// A staged name the specification does not declare fails.
/// ´claim:contract:a-staged-name-must-be-specified´
#[test]
fn a_staged_name_the_specification_does_not_declare_fails() {
    let found = contract::reconcile(
        &adoption(vec![staged(ContractSurface::Query, "feed")], Vec::new()),
        &sources(SPEC, SCHEMA),
    );
    let one = only(&found);
    assert_eq!(one.rule, STALE_ENTRY);
    assert!(
        one.message
            .contains("the specification does not declare it"),
        "{}",
        one.message
    );
}

/// Staging never reaches the schema's side: a name only the schema
/// declares fails even when the staged list names it.
///
/// A schema-only declaration fails whatever the staged list says.
/// ´claim:contract:nothing-is-staged-on-the-schema-side´
#[test]
fn a_staged_name_never_excuses_a_schema_only_declaration() {
    let schema = SCHEMA.replace("\tINTERNAL\n", "\tINTERNAL\n\tRATE_LIMITED\n");
    let found = contract::reconcile(
        &adoption(
            vec![staged(ContractSurface::ErrorCode, "RATE_LIMITED")],
            Vec::new(),
        ),
        &sources(SPEC, &schema),
    );
    let rules: Vec<_> = found.iter().map(|one| one.rule).collect();
    assert_eq!(rules, vec![SCHEMA_ONLY, STALE_ENTRY], "{found:#?}");
    assert!(
        found
            .iter()
            .all(|one| one.enforcement == Enforcement::Failing)
    );
}

/// A union one document lacks altogether is one drift, and a member is a
/// drift only where both documents declare its union.
///
/// A missing union is one finding, and a member drifts only inside a union both declare.
/// ´claim:contract:unions-reconcile-by-member´
#[test]
fn a_union_reconciles_as_a_whole_and_then_by_member() {
    let schema = SCHEMA.replace("union Target = Post | Comment\n", "");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(SPEC, &schema));
    let one = only(&found);
    assert_eq!(one.rule, SPEC_ONLY);
    assert!(one.message.contains("union Target"), "{}", one.message);

    let spec = SPEC.replace("Post | Comment", "Post | Comment | Chat");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(&spec, SCHEMA));
    let one = only(&found);
    assert_eq!(one.rule, SPEC_ONLY);
    assert!(
        one.message.contains("union-member Target.Chat"),
        "{}",
        one.message
    );
}

/// A fence that opens like a definition and holds something else is a
/// failing finding where the reading stopped, and the reading resumes at the
/// next definition: a drift declared after the defect is still found.
///
/// An unreadable place in a fence fails, and the definitions after it are still compared.
/// ´claim:contract:an-unreadable-fence-fails-and-resumes´
#[test]
fn an_unreadable_fence_fails_and_the_reading_resumes() {
    let spec = SPEC.replace(
        "enum ErrorCode {",
        "Some prose that was meant to sit outside the fence.\n\nenum ErrorCode {",
    );
    let spec = spec.replace("  INTERNAL\n", "  INTERNAL\n  BAD_INPUT\n");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(&spec, SCHEMA));
    let rules: Vec<_> = found.iter().map(|one| one.rule).collect();
    assert_eq!(rules, vec![UNREADABLE, SPEC_ONLY], "{found:#?}");
    assert!(line(&spec, &found[0].primary).starts_with("Some prose"));
    assert_eq!(found[0].enforcement, Enforcement::Failing);
    assert!(found[1].message.contains("error-code BAD_INPUT"));

    let known = KnownUnreadable {
        line: Box::from("Some prose that was meant to sit outside the fence."),
        removed_by: Box::from("the packet that fixes it"),
        at: somewhere(),
    };
    let found = contract::reconcile(&adoption(Vec::new(), vec![known]), &sources(&spec, SCHEMA));
    assert_eq!(found[0].rule, UNREADABLE);
    assert_eq!(found[0].enforcement, Enforcement::Advisory);
}

/// A fence that does not open with a definition is an excerpt, quoted for
/// discussion, and declares nothing.
///
/// An excerpt fence declares nothing and is not read.
/// ´claim:contract:an-excerpt-declares-nothing´
#[test]
fn an_excerpt_fence_declares_nothing() {
    let spec = format!(
        "{SPEC}\nA gallery is a list:\n\n```graphql\nattachments: [MediaAttachment!]!\nsearch(query: String!): [Node!]!\n```\n"
    );
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(&spec, SCHEMA));
    assert!(found.is_empty(), "{found:#?}");
}

/// A schema that does not parse stops the reconciliation, and the refusal
/// is the only finding: nothing read around it would be the API's surface.
///
/// A schema that does not parse is the one finding, and nothing is compared.
/// ´claim:contract:an-unparsable-schema-stops-the-reconciliation´
#[test]
fn an_unparsable_schema_stops_the_reconciliation() {
    let schema = SCHEMA.replace("\tme: User\n", "\tme: \n");
    let spec = SPEC.replace("  INTERNAL\n", "  INTERNAL\n  BAD_INPUT\n");
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &sources(&spec, &schema));
    let one = only(&found);
    assert_eq!(one.rule, UNREADABLE);
    assert_eq!(one.primary.path, PathBuf::from(SCHEMA_PATH));
    assert_eq!(one.enforcement, Enforcement::Failing);
}

/// A document the run does not hold leaves the reconciliation suppressed
/// and says so, as advisory, rather than reporting a contract it never read.
///
/// A contract document missing from the run suppresses the reconciliation, and says so.
/// ´claim:contract:a-missing-document-suppresses´
#[test]
fn a_missing_document_suppresses_the_reconciliation() {
    let mut held = sources(SPEC, SCHEMA);
    held.remove(&PathBuf::from(SCHEMA_PATH));
    let found = contract::reconcile(&adoption(Vec::new(), Vec::new()), &held);
    let one = only(&found);
    assert_eq!(one.rule, SUPPRESSED);
    assert_eq!(one.enforcement, Enforcement::Advisory);
    assert_eq!(one.primary.path, PathBuf::from(SCHEMA_PATH));
}
