//! Every committed client operation, replayed against the schema under
//! both budget postures.
//!
//! The budgets in `schema::QueryBudgets` are only meaningful against the
//! traffic they have to admit, and that traffic is checked in: the
//! Apollo Kotlin documents under `android/core/network/src/main/graphql`,
//! the codegen documents under `web/src/lib/graphql`, and the ranker
//! pod's reads under `crates/ranker-server/graphql` — the pod is the
//! third generated consumer of the same contract. This suite
//! anchors them the way `schema_drift` anchors the SDL — a client
//! document that outgrows a posture, or that the schema's validator
//! refuses at all, fails here, by name, instead of reaching a device as
//! "can't reach server".
//!
//! Each operation is sent the way a client sends it: one operation plus
//! the fragments it transitively spreads, never the whole file. The
//! complexity visitor walks *every* operation in a document, so a
//! concatenated corpus would price as their sum and measure nothing.
//!
//! Requires a live Postgres (`make up`) for the context the schema is
//! built over. The ids and inputs are deliberately left unbound, so a
//! resolver that reads one refuses before it does any work, after
//! validation has already done the measuring.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use sqlx::PgPool;

use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;

/// The two budget rejections async-graphql raises; both are message-only
/// validation errors, which is what lets the bisection below tell a
/// tripped budget from any other refusal.
const TOO_COMPLEX: &str = "Query is too complex.";
const TOO_DEEP: &str = "Query is nested too deep.";

/// The page size the clients actually send, READ FROM THE ARTIFACT the
/// clients are themselves pinned to (`client-constants.json`,
/// `paging.defaultPageSize`) rather than restated here.
///
/// A hardcoded copy is the defect this closes: raise the clients' page
/// size and a guard that kept measuring at the old one passes while real
/// traffic is heavier, and the miss is multiplicative because the page
/// size multiplies every connection's cost. The coupling now runs
/// through one file — the clients' own tests pin their constants to it,
/// and so does this — instead of through a sentence.
fn default_page_size() -> usize {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../client-constants.json");
    let raw = std::fs::read_to_string(&path).expect("client-constants.json is committed");
    let parsed: serde_json::Value = serde_json::from_str(&raw).expect("the artifact is JSON");
    parsed["paging"]["defaultPageSize"]
        .as_u64()
        .expect("paging.defaultPageSize is a number") as usize
}

/// The variables the clients bind, keyed by the variable name each
/// document uses. `limit` stays unset — the priciest value either corpus
/// passes for it, since an absent limit charges the default page. A reply
/// thread arrives as a count rather than a page (Q49), so neither corpus
/// binds a replies page-size variable any more.
///
/// Only variables a complexity expression reads need a value: the
/// visitor resolves `first`/`last`/`limit` from the request at
/// validation time, and a missing one is a validation error rather than
/// a free field. A new paginated field with a new variable name lands
/// here or fails loudly, which is the point.
///
/// `@include` flags are deliberately left unbound: the complexity
/// visitor prices every branch of a document whatever its flags say, so
/// leaving them unset measures the worst case, which is what a ceiling
/// has to admit.
fn page_variables() -> serde_json::Value {
    let page = default_page_size();
    serde_json::json!({
        "first": page,
        "commentsFirst": page,
        "limit": null,
    })
}

/// How many ids a client sends at most to a `nodes(ids:)` read — the one
/// other variable a complexity expression reads (`Query.nodes` costs
/// `ids.len()` times its row).
#[derive(Clone, Copy)]
enum IdBatch {
    /// The comment rows of one tagged page: the Android
    /// `TopicRepositoryImpl.withCommentCards`
    /// (`android/core/network/src/main/kotlin/com/cogra/network/repo/Topics.kt:69-72`)
    /// and the web `fetchHashtagDetail`
    /// (`web/src/lib/api/topics-api.ts:64-72`) send the comment ids of one
    /// `taggedContent` answer, which neither client gives a limit, so it
    /// is the server's default page — pinned to `paging.defaultPageSize`
    /// (`tests/client_constants.rs`), the number `first` is bound to.
    TaggedPage,
    /// The server's cap on one lookup (`Query.nodes`). The trace reads
    /// chunk at it (Android `MAX_NAMES`, web `TRACE_NODES_CHUNK`, both
    /// 100), and `ContentGraphIds` sends every id a form names, unchunked
    /// on both clients, so the cap is its worst case.
    ServerCap,
}

impl IdBatch {
    fn len(self) -> usize {
        match self {
            Self::TaggedPage => default_page_size(),
            Self::ServerCap => api::schema::types::MAX_PAGE_SIZE as usize,
        }
    }
}

/// Every client operation that passes a variable to `nodes(ids:)`, by
/// operation name, with the batch it sends. An operation missing here
/// fails [`client_variables`] by name rather than measuring its rows at
/// nothing; a stale row fails `every_nodes_read_has_its_batch`.
const ID_BATCHES: [(&str, IdBatch); 4] = [
    ("TaggedComments", IdBatch::TaggedPage),
    ("TraceNames", IdBatch::ServerCap),
    ("TraceNodes", IdBatch::ServerCap),
    ("ContentGraphIds", IdBatch::ServerCap),
];

/// The variables a document's root `nodes(ids:)` selections read their
/// ids from, read off the parsed document. A literal list names no
/// variable: it is priced as written.
fn nodes_id_variables(document: &str) -> BTreeSet<String> {
    use async_graphql::parser::types::{DocumentOperations, Selection};
    let parsed = async_graphql::parser::parse_query(document)
        .unwrap_or_else(|e| panic!("a client document does not parse: {e}"));
    let operations: Vec<_> = match parsed.operations {
        DocumentOperations::Single(operation) => vec![operation],
        DocumentOperations::Multiple(operations) => operations.into_values().collect(),
    };
    let mut out = BTreeSet::new();
    for operation in &operations {
        for selection in &operation.node.selection_set.node.items {
            let Selection::Field(field) = &selection.node else {
                continue;
            };
            if field.node.name.node != "nodes" {
                continue;
            }
            let Some(ids) = field.node.get_argument("ids") else {
                continue;
            };
            let read = ids
                .node
                .clone()
                .into_const_with(|name| Err::<async_graphql::Value, String>(name.to_string()));
            if let Err(variable) = read {
                out.insert(variable);
            }
        }
    }
    out
}

/// The variables a client binds for one operation: the page sizes, and
/// for a `nodes(ids:)` read its batch of ids from [`ID_BATCHES`].
fn client_variables(operation: &str, document: &str) -> async_graphql::Variables {
    let mut variables = page_variables();
    for variable in nodes_id_variables(document) {
        let batch = ID_BATCHES
            .iter()
            .find(|(name, _)| *name == operation)
            .map(|(_, batch)| *batch)
            .unwrap_or_else(|| {
                panic!("{operation} reads nodes(ids: ${variable}) and has no row in ID_BATCHES")
            });
        variables[variable.as_str()] = serde_json::Value::Array(vec![
            serde_json::json!(
                "00000000-0000-0000-0000-000000000000"
            );
            batch.len()
        ]);
    }
    async_graphql::Variables::from_json(variables)
}

/// One top-level definition, kept as source text: what has to go back on
/// the wire for the operation to mean what the client meant.
struct Definition {
    name: String,
    text: String,
    /// The fragments this definition spreads, directly.
    spreads: BTreeSet<String>,
}

/// Splits a `.graphql` file into its top-level definitions.
///
/// Column zero starts a definition and brace depth ends it — the shape
/// every document in both client corpora is written in, and the shape
/// `graphql-codegen` and Apollo Kotlin parse. A file that drifts out of
/// it fails as a parse error downstream rather than silently dropping an
/// operation.
///
/// Braces are counted on the code half of each line only: comments are
/// the one place either corpus writes a quote, so cutting at `#` keeps
/// prose out of the count.
fn definitions(source: &str) -> Vec<Definition> {
    let mut out = Vec::new();
    let mut current: Option<(String, usize)> = None;
    let mut depth = 0usize;
    let mut start = 0usize;
    for (offset, line) in line_offsets(source) {
        let trimmed = line.trim_start();
        let top_level = !line.starts_with([' ', '\t']) && !trimmed.is_empty();
        if current.is_none() && top_level && !trimmed.starts_with('#') {
            let Some(name) = definition_name(trimmed) else {
                continue;
            };
            current = Some((name, offset));
            start = offset;
            depth = 0;
        }
        if current.is_none() {
            continue;
        }
        let code = line.split('#').next().unwrap_or(line);
        depth += code.matches('{').count();
        depth = depth.saturating_sub(code.matches('}').count());
        if depth == 0 && code.contains('}') {
            let end = offset + line.len();
            let text = source[start..end].to_string();
            let (name, _) = current.take().expect("open definition");
            let spreads = spreads_in(&text);
            out.push(Definition {
                name,
                text,
                spreads,
            });
        }
    }
    out
}

fn line_offsets(source: &str) -> impl Iterator<Item = (usize, &str)> {
    let mut offset = 0;
    source.lines().map(move |line| {
        let at = offset;
        offset += line.len() + 1;
        (at, line)
    })
}

/// The name a definition carries: the token after `query`, `mutation`,
/// `subscription` or `fragment`, cut where the variable list or the
/// selection set begins. Anything else is not a definition this corpus
/// uses.
fn definition_name(line: &str) -> Option<String> {
    let (keyword, rest) = line.split_once(|c: char| c.is_whitespace())?;
    if !matches!(keyword, "query" | "mutation" | "subscription" | "fragment") {
        return None;
    }
    let name: String = rest
        .trim_start()
        .chars()
        .take_while(|c| c.is_alphanumeric() || *c == '_')
        .collect();
    (!name.is_empty()).then_some(name)
}

/// The fragment names a definition spreads. `...Name` is a spread;
/// `... on Type` is an inline fragment and names nothing.
fn spreads_in(text: &str) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    let mut cursor = 0;
    while let Some(at) = text[cursor..].find("...") {
        let after = cursor + at + 3;
        cursor = after;
        let name: String = text[after..]
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_')
            .collect();
        if !name.is_empty() {
            out.insert(name);
        }
    }
    out
}

/// Every `.graphql` file at or under `dir`, in path order.
///
/// Recursive, because both clients' toolchains are: Apollo Kotlin and the
/// codegen preset pick up a document wherever it sits under the operation
/// root, so a flat read would leave a document in a subdirectory building
/// on a device and unmeasured here.
fn graphql_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(dir).unwrap_or_else(|e| panic!("read {}: {e}", dir.display())) {
        let path = entry.expect("dir entry").path();
        if path.is_dir() {
            files.extend(graphql_files(&path));
        } else if path.extension().is_some_and(|e| e == "graphql") {
            files.push(path);
        }
    }
    files
}

/// Every `.graphql` file in one client's operation tree, split into
/// definitions, each with the file it is written in, relative to `dir`.
fn corpus(dir: &Path) -> Vec<(PathBuf, Definition)> {
    let mut files = graphql_files(dir);
    files.sort();
    assert!(!files.is_empty(), "no documents under {}", dir.display());
    files
        .iter()
        .flat_map(|path| {
            let source = std::fs::read_to_string(path)
                .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
            let file = path.strip_prefix(dir).unwrap_or(path).to_path_buf();
            definitions(&source)
                .into_iter()
                .map(move |definition| (file.clone(), definition))
        })
        .collect()
}

/// The document a client puts on the wire for one operation: the
/// operation plus the transitive closure of the fragments it spreads.
/// Unused fragments are a validation error, so the closure has to be
/// exact.
fn wire_document(operation: &Definition, fragments: &BTreeMap<String, &Definition>) -> String {
    let mut needed: BTreeSet<String> = BTreeSet::new();
    let mut frontier: Vec<String> = operation.spreads.iter().cloned().collect();
    while let Some(name) = frontier.pop() {
        if !needed.insert(name.clone()) {
            continue;
        }
        let fragment = fragments
            .get(&name)
            .unwrap_or_else(|| panic!("{} spreads unknown fragment {name}", operation.name));
        frontier.extend(fragment.spreads.iter().cloned());
    }
    let mut document = operation.text.clone();
    for name in &needed {
        document.push_str("\n\n");
        document.push_str(&fragments[name].text);
    }
    document
}

/// One operation a client sends, assembled for the wire, with the file
/// it is written in so a refusal names where to fix it.
struct ClientOperation {
    file: PathBuf,
    name: String,
    document: String,
}

/// The operations one client sends, each already assembled for the wire.
fn client_operations(relative: &str) -> Vec<ClientOperation> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative);
    let definitions = corpus(&dir);
    let fragments: BTreeMap<String, &Definition> = definitions
        .iter()
        .map(|(_, d)| d)
        .filter(|d| d.text.starts_with("fragment"))
        .map(|d| (d.name.clone(), d))
        .collect();
    let operations: Vec<ClientOperation> = definitions
        .iter()
        .filter(|(_, d)| !d.text.starts_with("fragment"))
        .map(|(file, d)| ClientOperation {
            file: Path::new(relative).join(file),
            name: d.name.clone(),
            document: wire_document(d, &fragments),
        })
        .collect();
    assert!(!operations.is_empty(), "no operations under {relative}");
    operations
}

fn schema(pool: PgPool, budgets: QueryBudgets) -> ApiSchema {
    let (ctx, _auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    build_with(ctx, budgets)
}

/// The messages of every error the server raised before executing
/// `request`: a parse error, a validation rule's refusal, a tripped
/// budget, an unknown operation name.
///
/// Told apart by phase, not by message text. async-graphql answers a
/// request that fails to parse or validate with those errors alone and
/// runs no execute hook (`Schema::execute` → `prepare_request`), and
/// the schema's `InternalFaults` extension gives every error the
/// execute hook sees an `extensions.code` — `BAD_INPUT` for a variable
/// left unbound (`schema::faults`). An error without a code is the
/// validator's, so it is a defect in the document, never in its
/// unbound ids and inputs.
async fn validation_errors_of(schema: &ApiSchema, request: async_graphql::Request) -> Vec<String> {
    schema
        .execute(request.data(Option::<api::auth::Viewer>::None))
        .await
        .errors
        .iter()
        .filter(|e| {
            !e.extensions
                .as_ref()
                .is_some_and(|extensions| extensions.get("code").is_some())
        })
        .map(|e| e.message.clone())
        .collect()
}

/// Sends one operation the way the HTTP handler would, with the client's
/// own page and batch sizes bound and its ids and inputs otherwise
/// unbound, and keeps every error the validator raised.
async fn validation_errors(schema: &ApiSchema, name: &str, document: &str) -> Vec<String> {
    let request = async_graphql::Request::new(document)
        .operation_name(name)
        .variables(client_variables(name, document));
    validation_errors_of(schema, request).await
}

/// The budget refusals alone under `variables`, for the bisection: a
/// tripped budget is raised before the validation rules' errors and
/// replaces them, so a probe ceiling decides this answer and nothing
/// else does.
async fn budget_errors(
    schema: &ApiSchema,
    name: &str,
    document: &str,
    variables: &async_graphql::Variables,
) -> Vec<String> {
    let request = async_graphql::Request::new(document)
        .operation_name(name)
        .variables(variables.clone());
    validation_errors_of(schema, request)
        .await
        .into_iter()
        .filter(|message| message == TOO_COMPLEX || message == TOO_DEEP)
        .collect()
}

/// Every consumer generated from the contract, with where its documents
/// live.
const CORPORA: [(&str, &str); 3] = [
    ("android", "android/core/network/src/main/graphql"),
    ("web", "web/src/lib/graphql"),
    ("ranker-pod", "crates/ranker-server/graphql"),
];

/// The ranker pod pages the slice at the api's page cap, not at the
/// clients' page size, so its documents are measured at the size they
/// are actually sent with as well.
///
/// The release budgets admit the ranker pod's slice pages at the page cap it sends them with.
/// ´claim:budgets:the-pods-full-pages-fit´
#[sqlx::test(migrations = "../../migrations")]
async fn the_release_budgets_admit_the_ranker_pods_full_pages(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    for operation in client_operations("crates/ranker-server/graphql") {
        let request = async_graphql::Request::new(&operation.document)
            .operation_name(&operation.name)
            .variables(async_graphql::Variables::from_json(serde_json::json!({
                "first": api::schema::types::MAX_PAGE_SIZE,
            })));
        let rejected = validation_errors_of(&schema, request).await;
        assert!(
            rejected.is_empty(),
            "the release budgets reject the pod's {} ({}) at the page cap: {rejected:?}",
            operation.name,
            operation.file.display(),
        );
    }
}

/// Fails on any validation error, not only a tripped budget: a document
/// the schema refuses is refused under every posture.
async fn assert_corpus_fits(schema: &ApiSchema, posture: &str) {
    for (client, relative) in CORPORA {
        for operation in client_operations(relative) {
            let rejected = validation_errors(schema, &operation.name, &operation.document).await;
            assert!(
                rejected.is_empty(),
                "the {posture} schema refuses the {client} client's {} ({}): {rejected:?}",
                operation.name,
                operation.file.display(),
            );
        }
    }
}

/// The guard the release posture never had: production budgets have to
/// admit every operation both clients ship, or the app cannot talk to
/// the server it was built against.
///
/// The budgets admit every operation both clients ship, or the apps cannot talk to the server they were built against.
/// ´claim:budgets:the-budgets-admit-every-shipped-operation´
#[sqlx::test(migrations = "../../migrations")]
async fn the_release_budgets_admit_every_client_operation(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    assert_corpus_fits(&schema, "release").await;
}

/// The dev posture is looser, but it is what every device build talks
/// to — a document that trips it is broken for everyone developing.
///
/// (´claim:budgets:the-budgets-admit-every-shipped-operation´)
#[sqlx::test(migrations = "../../migrations")]
async fn the_dev_budgets_admit_every_client_operation(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::dev());
    assert_corpus_fits(&schema, "dev").await;
}

/// One operation's exact cost: the smallest ceiling that admits it,
/// found by bisection.
///
/// async-graphql reports a tripped budget and nothing else — there is no
/// public accessor for the number the complexity visitor computed — so
/// the flip point *is* the measurement. `probe` decides which posture
/// axis is being narrowed; the other is left wide so it cannot be the
/// one that refuses.
async fn measured(
    pool: &PgPool,
    name: &str,
    document: &str,
    variables: &async_graphql::Variables,
    probe: fn(usize) -> QueryBudgets,
) -> usize {
    let mut refused = 0;
    let mut admitted = 1_000_000;
    while admitted - refused > 1 {
        let middle = refused + (admitted - refused) / 2;
        let schema = schema(pool.clone(), probe(middle));
        if budget_errors(&schema, name, document, variables)
            .await
            .is_empty()
        {
            admitted = middle;
        } else {
            refused = middle;
        }
    }
    admitted
}

fn complexity_probe(complexity: usize) -> QueryBudgets {
    QueryBudgets {
        depth: 64,
        complexity,
        introspection_enabled: false,
    }
}

fn depth_probe(depth: usize) -> QueryBudgets {
    QueryBudgets {
        depth,
        complexity: usize::MAX,
        introspection_enabled: false,
    }
}

/// The ceilings are measured, not chosen — and this is the measurement,
/// re-run on every CI pass rather than recorded once and trusted.
///
/// It fails when the heaviest committed operation grows into the stated
/// headroom, which is the moment the ceilings are owed a deliberate
/// re-derivation. The guards above only ask whether the corpus still
/// fits; a corpus that fits with nothing to spare is one client document
/// away from the failure this whole suite exists to prevent, and only a
/// measurement can see that coming.
///
/// The numbers themselves are printed, so `--nocapture` reads out the
/// table a re-derivation works from.
///
/// The ceilings are measured rather than chosen, and the measurement is re-run on every pass so growth into the stated headroom is seen coming.
/// ´claim:budgets:the-ceilings-are-measured-every-run´
#[sqlx::test(migrations = "../../migrations")]
async fn the_budget_ceilings_keep_their_stated_headroom(pool: PgPool) {
    let mut heaviest = (String::new(), 0usize);
    let mut deepest = (String::new(), 0usize);
    for (client, relative) in CORPORA {
        for ClientOperation { name, document, .. } in client_operations(relative) {
            let variables = client_variables(&name, &document);
            let complexity = measured(&pool, &name, &document, &variables, complexity_probe).await;
            let depth = measured(&pool, &name, &document, &variables, depth_probe).await;
            println!("{client:8} {name:24} complexity {complexity:7}  depth {depth:3}");
            if complexity > heaviest.1 {
                heaviest = (format!("{client} {name}"), complexity);
            }
            if depth > deepest.1 {
                deepest = (format!("{client} {name}"), depth);
            }
        }
    }

    let budgets = QueryBudgets::release();
    assert!(
        budgets.complexity * 5 >= heaviest.1 * 7,
        "the complexity ceiling {} leaves under 1.4x over {} at {}",
        budgets.complexity,
        heaviest.0,
        heaviest.1,
    );
    assert!(
        budgets.depth >= deepest.1 + 3,
        "the depth ceiling {} leaves under three levels over {} at {}",
        budgets.depth,
        deepest.0,
        deepest.1,
    );
}

/// Documents the schema refuses, one per refusal class a client document
/// drifts into: a field the schema does not have, an argument the field
/// does not take, and an argument of the wrong type. None binds a
/// variable, so nothing they raise can be an unbound variable's refusal.
const INVALID_DOCUMENTS: [(&str, &str); 3] = [
    ("UnknownField", "query UnknownField { noSuchField }"),
    (
        "UnknownArgument",
        "query UnknownArgument { user(handle: \"a\", noSuchArgument: 1) { id } }",
    ),
    (
        "WrongArgumentType",
        "query WrongArgumentType { user(handle: \"a\") { chronicle(first: \"ten\") { pageInfo { hasNextPage } } } }",
    ),
];

/// A valid document whose one variable stays unbound, as every client
/// id does here: the server refuses it while executing, and the guard
/// must not mistake that refusal for an invalid document.
const UNBOUND_VARIABLE: (&str, &str) = (
    "UnboundVariable",
    "query UnboundVariable($id: UUID!) { user(id: $id) { id } }",
);

/// The guard is only as strict as its filter: a check that keeps the
/// budget refusals alone passes a client document the schema refuses.
/// Each invalid document is first shown refused by the server, so a
/// green guard is its filter's verdict, not an accepting schema's.
///
/// The client-operation guard reports every validation error a client document raises, not only a tripped budget, and no unbound variable's refusal.
/// ´claim:budgets:the-guard-reports-an-invalid-client-document´
#[sqlx::test(migrations = "../../migrations")]
async fn the_guard_reports_an_invalid_client_document(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let mut passed = Vec::new();
    for (name, document) in INVALID_DOCUMENTS {
        let request = async_graphql::Request::new(document)
            .operation_name(name)
            .data(Option::<api::auth::Viewer>::None);
        let refused = schema.execute(request).await.errors;
        assert!(!refused.is_empty(), "the schema accepts {name}");
        if validation_errors(&schema, name, document).await.is_empty() {
            let messages: Vec<&str> = refused.iter().map(|e| e.message.as_str()).collect();
            passed.push(format!("{name}: {messages:?}"));
        }
    }
    let (name, document) = UNBOUND_VARIABLE;
    let request = async_graphql::Request::new(document)
        .operation_name(name)
        .data(Option::<api::auth::Viewer>::None);
    assert!(
        !schema.execute(request).await.errors.is_empty(),
        "{name} executes without its variable"
    );
    let reported = validation_errors(&schema, name, document).await;
    assert!(
        reported.is_empty(),
        "the guard reports {name}'s unbound variable: {reported:?}"
    );
    assert!(
        passed.is_empty(),
        "the guard passes documents the schema refuses: {passed:?}"
    );
}

/// Every operation of every corpus that passes a variable to
/// `nodes(ids:)`, by name.
fn nodes_reads() -> BTreeSet<String> {
    CORPORA
        .iter()
        .flat_map(|(_, relative)| client_operations(relative))
        .filter(|operation| !nodes_id_variables(&operation.document).is_empty())
        .map(|operation| operation.name)
        .collect()
}

/// [`ID_BATCHES`] names exactly the `nodes(ids:)` reads the corpora
/// carry: a new one without a row would be priced at nothing, a row
/// whose operation is gone keeps a batch no client sends.
///
/// (´claim:budgets:a-nodes-read-is-priced-at-its-batch´)
#[test]
fn every_nodes_read_has_its_batch() {
    let reads = nodes_reads();
    let rows: BTreeSet<String> = ID_BATCHES
        .iter()
        .map(|(name, _)| (*name).to_string())
        .collect();
    assert_eq!(reads, rows, "the nodes(ids:) reads and ID_BATCHES disagree");
}

/// A complexity expression that cannot resolve its variable prices its
/// field at nothing and raises a validation error a budget-only filter
/// drops, so an unbound `ids` leaves the rows unpriced. Each one is measured
/// with its batch bound and with it unbound; the bound price has to be the
/// dearer, or the guard is not seeing the rows.
///
/// A batch read of nodes by id is priced at the batch its client sends, never at nothing.
/// ´claim:budgets:a-nodes-read-is-priced-at-its-batch´
#[sqlx::test(migrations = "../../migrations")]
async fn a_nodes_read_is_priced_at_its_batch(pool: PgPool) {
    let unbound = async_graphql::Variables::from_json(page_variables());
    let mut seen = 0;
    for (client, relative) in CORPORA {
        for operation in client_operations(relative) {
            if nodes_id_variables(&operation.document).is_empty() {
                continue;
            }
            seen += 1;
            let (name, document) = (&operation.name, &operation.document);
            let bound = client_variables(name, document);
            let priced = measured(&pool, name, document, &bound, complexity_probe).await;
            let unpriced = measured(&pool, name, document, &unbound, complexity_probe).await;
            assert!(
                priced > unpriced,
                "the {client} client's {name} costs {priced} with its ids bound and {unpriced} without"
            );
        }
    }
    assert!(seen > 0, "no corpus carries a nodes(ids:) read");
}

/// The extraction is load-bearing — an operation silently dropped would
/// make the guards above pass by not looking. Both corpora carry the
/// post-detail read, which is the heaviest document either client sends.
///
/// The extraction is load-bearing, an operation silently dropped making the guards pass by not looking, so both corpora are checked to carry the heaviest document either client sends.
/// ´claim:budgets:the-corpora-carry-what-the-guards-read-them-for´
#[test]
fn the_corpora_carry_the_operations_they_are_read_for() {
    for relative in [
        "android/core/network/src/main/graphql",
        "web/src/lib/graphql",
    ] {
        let names: BTreeSet<String> = client_operations(relative)
            .into_iter()
            .map(|operation| operation.name)
            .collect();
        for expected in ["PostDetail", "FeedRanking", "CommentReplies", "PreparePost"] {
            assert!(
                names.contains(expected),
                "{relative} is missing {expected}: {names:?}"
            );
        }
    }
}

/// The root fields one wire document selects, read off the parsed document
/// rather than its text, so an alias cannot hide a field from the check.
fn root_fields(document: &str) -> BTreeSet<String> {
    use async_graphql::parser::types::{DocumentOperations, Selection};
    let parsed = async_graphql::parser::parse_query(document)
        .unwrap_or_else(|e| panic!("a client document does not parse: {e}"));
    let operations: Vec<_> = match parsed.operations {
        DocumentOperations::Single(operation) => vec![operation],
        DocumentOperations::Multiple(operations) => operations.into_values().collect(),
    };
    operations
        .iter()
        .flat_map(|operation| operation.node.selection_set.node.items.iter())
        .filter_map(|selection| match &selection.node {
            Selection::Field(field) => Some(field.node.name.node.to_string()),
            _ => None,
        })
        .collect()
}

/// The chronological `posts` listing is retired from both clients: once
/// the ranked feed shipped, the feed reads `feedRanking` and its `feed`
/// windows, and Newest is the pod's permutation of that one answer, never
/// the global listing (ranked-feed packet §4.9, item 89). The root stays in
/// the schema; a client document selecting it again would quietly bring
/// back the interim the ranked feed closed, so it fails here by name.
///
/// No client document reads the retired chronological posts listing.
/// ´claim:budgets:the-retired-posts-listing-stays-retired´
#[test]
fn no_client_reads_the_retired_posts_listing() {
    for relative in [
        "android/core/network/src/main/graphql",
        "web/src/lib/graphql",
    ] {
        for ClientOperation { name, document, .. } in client_operations(relative) {
            assert!(
                !root_fields(&document).contains("posts"),
                "{relative} operation {name} reads the retired `posts` listing"
            );
        }
    }
}
