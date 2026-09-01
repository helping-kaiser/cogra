//! Every committed client operation, replayed against the schema under
//! both budget postures.
//!
//! The budgets in `schema::QueryBudgets` are only meaningful against the
//! traffic they have to admit, and that traffic is checked in: the
//! Apollo Kotlin documents under `android/core/network/src/main/graphql`
//! and the codegen documents under `web/src/lib/graphql`. This suite
//! anchors them the way `schema_drift` anchors the SDL — a client
//! document that outgrows a posture fails here, by name, instead of
//! reaching a device as "can't reach server".
//!
//! Each operation is sent the way a client sends it: one operation plus
//! the fragments it transitively spreads, never the whole file. The
//! complexity visitor walks *every* operation in a document, so a
//! concatenated corpus would price as their sum and measure nothing.
//!
//! Requires a live Postgres (`make up`) for the context the schema is
//! built over; the operations never reach a resolver — the ids and
//! inputs are deliberately left unbound, so argument coercion refuses
//! after validation has already done the measuring.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use sqlx::PgPool;

use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;

/// The two budget rejections async-graphql raises; both are message-only
/// validation errors, which is what lets this suite name the operation
/// that tripped one.
const TOO_COMPLEX: &str = "Query is too complex.";
const TOO_DEEP: &str = "Query is nested too deep.";

/// The page sizes the clients actually send, keyed by the variable name
/// the document binds them to: `FEED_PAGE_SIZE` / `CONTENT_PAGE_SIZE`
/// (20) and an unset `limit` — the priciest of the values either client
/// passes for it, since an absent limit charges the default page. A
/// reply thread arrives as a count rather than a page (Q49), so neither
/// corpus binds a replies page-size variable any more.
///
/// Only variables a complexity expression reads need a value: the
/// visitor resolves `first`/`last`/`limit` from the request at
/// validation time, and a missing one is a validation error rather than
/// a free field. A new paginated field with a new variable name lands
/// here or fails loudly, which is the point.
fn client_variables() -> async_graphql::Variables {
    async_graphql::Variables::from_json(serde_json::json!({
        "first": 20,
        "commentsFirst": 20,
        "limit": null,
    }))
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

/// Every `.graphql` file in one client's operation directory, split into
/// definitions.
fn corpus(dir: &Path) -> Vec<Definition> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
        .map(|entry| entry.expect("dir entry").path())
        .filter(|path| path.extension().is_some_and(|e| e == "graphql"))
        .collect();
    files.sort();
    assert!(!files.is_empty(), "no documents under {}", dir.display());
    files
        .iter()
        .flat_map(|path| {
            let source = std::fs::read_to_string(path)
                .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
            definitions(&source)
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

/// The operations one client sends, each already assembled for the wire.
fn client_operations(relative: &str) -> Vec<(String, String)> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(relative);
    let definitions = corpus(&dir);
    let fragments: BTreeMap<String, &Definition> = definitions
        .iter()
        .filter(|d| d.text.starts_with("fragment"))
        .map(|d| (d.name.clone(), d))
        .collect();
    let operations: Vec<(String, String)> = definitions
        .iter()
        .filter(|d| !d.text.starts_with("fragment"))
        .map(|d| (d.name.clone(), wire_document(d, &fragments)))
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

/// Sends one operation the way the HTTP handler would, with the client's
/// own page sizes bound. Ids and inputs stay unbound on purpose: the
/// budgets are decided in validation, and coercion refuses afterwards
/// without any resolver running.
async fn budget_errors(schema: &ApiSchema, name: &str, document: &str) -> Vec<String> {
    let request = async_graphql::Request::new(document)
        .operation_name(name)
        .variables(client_variables())
        .data(Option::<api::auth::Viewer>::None);
    schema
        .execute(request)
        .await
        .errors
        .iter()
        .map(|e| e.message.clone())
        .filter(|message| message == TOO_COMPLEX || message == TOO_DEEP)
        .collect()
}

async fn assert_corpus_fits(schema: &ApiSchema, posture: &str) {
    for (client, relative) in [
        ("android", "android/core/network/src/main/graphql"),
        ("web", "web/src/lib/graphql"),
    ] {
        for (name, document) in client_operations(relative) {
            let rejected = budget_errors(schema, &name, &document).await;
            assert!(
                rejected.is_empty(),
                "{posture} budgets reject the {client} client's {name}: {rejected:?}"
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
    probe: fn(usize) -> QueryBudgets,
) -> usize {
    let mut refused = 0;
    let mut admitted = 1_000_000;
    while admitted - refused > 1 {
        let middle = refused + (admitted - refused) / 2;
        let schema = schema(pool.clone(), probe(middle));
        if budget_errors(&schema, name, document).await.is_empty() {
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
    for (client, relative) in [
        ("android", "android/core/network/src/main/graphql"),
        ("web", "web/src/lib/graphql"),
    ] {
        for (name, document) in client_operations(relative) {
            let complexity = measured(&pool, &name, &document, complexity_probe).await;
            let depth = measured(&pool, &name, &document, depth_probe).await;
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
            .map(|(name, _)| name)
            .collect();
        for expected in ["PostDetail", "Posts", "CommentReplies", "PreparePost"] {
            assert!(
                names.contains(expected),
                "{relative} is missing {expected}: {names:?}"
            );
        }
    }
}
