//! The per-query demand budgets (roadmap.md slice 1.1): depth and
//! complexity limits in both postures, the introspection posture, and
//! the connection page-size budget. Requires a live Postgres
//! (`make up`) — the schema context wants a pool, though rejected
//! queries never reach it.

use std::sync::Arc;

use sqlx::PgPool;

use api::schema::types::{
    DEFAULT_PAGE_SIZE, FOLD_LIST_BOUND, MAX_PAGE_SIZE, connection_cost, offset_connection,
};
use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;

fn schema(pool: PgPool, budgets: QueryBudgets) -> ApiSchema {
    let (ctx, _auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    build_with(ctx, budgets)
}

/// Executes a query with the context the HTTP handler injects per
/// request. A query that fails validation never reads that context, which
/// is what lets the budget tests run against an anonymous viewer.
async fn execute(schema: &ApiSchema, query: &str) -> async_graphql::Response {
    let request = async_graphql::Request::new(query).data(Option::<api::auth::Viewer>::None);
    schema.execute(request).await
}

fn first_error(response: &async_graphql::Response) -> String {
    response
        .errors
        .first()
        .map(|e| e.message.clone())
        .unwrap_or_default()
}

/// A viewer-rooted chain nested `levels` deep: each level is one
/// `invitedBy` hop through the Actor union.
fn nested_query(levels: usize) -> String {
    let mut inner = "handle".to_string();
    for _ in 0..levels {
        inner = format!("invitedBy {{ ... on User {{ {inner} }} }}");
    }
    format!("{{ me {{ {inner} }} }}")
}

/// Fifteen `invitedBy` hops under `me` come to 17 field levels, past the
/// budget.
///
/// The depth budget cuts at its stated level, rejecting a query past it during validation.
/// ´claim:budgets:the-depth-budget-cuts-where-it-says´
#[sqlx::test(migrations = "../../migrations")]
async fn a_query_past_the_depth_budget_is_rejected(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let response = execute(&schema, &nested_query(15)).await;
    assert_eq!(first_error(&response), "Query is nested too deep.");
}

/// Ten hops come to depth 12, inside the budget. The anonymous viewer
/// resolves `me` to null; the point is that validation let the query
/// through at all.
///
/// (´claim:budgets:the-depth-budget-cuts-where-it-says´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_query_within_the_depth_budget_passes_validation(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let response = execute(&schema, &nested_query(10)).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

/// 100 posts × 100 comments × 100 replies is over a million fields —
/// the multiplicative blowup the complexity budget exists to refuse.
/// Two connection levels no longer reach it: the clients themselves
/// page three deep, so the ceiling that admits them sits above any
/// two-level product.
///
/// The complexity budget refuses the multiplicative blowup of nested full pages while sitting above any product the clients' own paging reaches.
/// ´claim:budgets:the-complexity-budget-refuses-the-blowup´
#[sqlx::test(migrations = "../../migrations")]
async fn nested_full_page_connections_exceed_the_complexity_budget(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let query = "{ posts(first: 100) { edges { node {
        comments(first: 100) { edges { node {
            replies(first: 100) { edges { node { id } } }
        } } }
    } } } }";
    let response = execute(&schema, query).await;
    assert_eq!(first_error(&response), "Query is too complex.");
}

/// (´claim:budgets:the-complexity-budget-refuses-the-blowup´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_modest_connection_query_fits_the_budget(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let query = "{ me { inviteLinks(first: 20) { edges { node { id singleUse } } } } }";
    let response = execute(&schema, query).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

/// An author-owned fold list takes no page argument, so nothing in the
/// query says what it costs — `FOLD_LIST_BOUND` does. Pinning the exact
/// flip point is what keeps that bound from drifting silently: one
/// `relevance` per row prices the whole read at `1 + (50 + 1)` — the
/// `post` field, then the fold field plus its bound many one-cost rows.
///
/// A field taking no page argument charges the bound it declares, and pinning the flip point exactly is what keeps that bound from drifting silently.
/// ´claim:budgets:an-unpaged-field-charges-its-declared-bound´
#[sqlx::test(migrations = "../../migrations")]
async fn a_fold_list_charges_its_stated_bound(pool: PgPool) {
    let query = "{ post(id: \"00000000-0000-0000-0000-000000000000\") { topics { relevance } } }";
    let cost = 1 + (FOLD_LIST_BOUND as usize + 1);
    let budgets = |complexity| QueryBudgets {
        depth: 15,
        complexity,
        introspection_enabled: false,
    };
    let under = schema(pool.clone(), budgets(cost - 1));
    assert_eq!(
        first_error(&execute(&under, query).await),
        "Query is too complex."
    );
    let exact = schema(pool, budgets(cost));
    let response = execute(&exact, query).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

/// With no `first`/`last` the field prices at the default page size,
/// 20 × child. A budget sized just under that rejects the bare read,
/// which is what proves omission is not free.
///
/// (´claim:budgets:a-connection-prices-the-requested-or-default-page´)
#[sqlx::test(migrations = "../../migrations")]
async fn an_unpriced_connection_charges_the_default_page(pool: PgPool) {
    let schema = schema(
        pool,
        QueryBudgets {
            depth: 15,
            complexity: 15,
            introspection_enabled: false,
        },
    );
    let response = execute(&schema, "{ me { inviteLinks { edges { node { id } } } } }").await;
    assert_eq!(first_error(&response), "Query is too complex.");
}

/// `totalCount` is one aggregate per connection, not one per edge, but
/// async-graphql hands a connection field a single `child_complexity` —
/// a flat sum over the whole selection set, drawing no line between the
/// connection's own fields and its edges. `connection_cost` multiplies
/// that sum by the page size, so a `totalCount` carrying any weight at
/// all would be charged once per row it does not read. Pinning both
/// queries to the same flip point is what keeps that weight at zero.
///
/// (´claim:budgets:a-connection-prices-the-requested-or-default-page´)
#[sqlx::test(migrations = "../../migrations")]
async fn total_count_is_not_charged_per_edge(pool: PgPool) {
    const NIL_ID: &str = "00000000-0000-0000-0000-000000000000";
    let page = "edges { node { id } }";
    let edges_only =
        format!("{{ post(id: \"{NIL_ID}\") {{ comments(first: 100) {{ {page} }} }} }}");
    let with_count =
        format!("{{ post(id: \"{NIL_ID}\") {{ comments(first: 100) {{ totalCount {page} }} }} }}");

    // The `post` field, then the connection at its requested page times
    // `edges { node { id } }` — three, and three only.
    let cost = 1 + connection_cost(Some(100), None, 3);
    let budgets = |complexity| QueryBudgets {
        depth: 15,
        complexity,
        introspection_enabled: false,
    };

    let exact = schema(pool.clone(), budgets(cost));
    for query in [&edges_only, &with_count] {
        let response = execute(&exact, query).await;
        assert!(
            response.errors.is_empty(),
            "asking for the count must not raise the price: {:?}",
            response.errors
        );
    }

    let under = schema(pool, budgets(cost - 1));
    assert_eq!(
        first_error(&execute(&under, &edges_only).await),
        "Query is too complex.",
        "the pinned cost has to be the real flip point"
    );
}

/// The canonical introspection query GraphiQL and codegen tools issue —
/// ~13 levels deep through the TypeRef ofType recursion.
const INTROSPECTION_QUERY: &str = r#"
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives { name description locations args { ...InputValue } }
  }
}
fragment FullType on __Type {
  kind name description
  fields(includeDeprecated: true) {
    name description
    args { ...InputValue }
    type { ...TypeRef }
    isDeprecated deprecationReason
  }
  inputFields { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
  possibleTypes { ...TypeRef }
}
fragment InputValue on __InputValue {
  name description
  type { ...TypeRef }
  defaultValue
}
fragment TypeRef on __Type {
  kind name
  ofType { kind name
    ofType { kind name
      ofType { kind name
        ofType { kind name
          ofType { kind name
            ofType { kind name
              ofType { kind name }
            }
          }
        }
      }
    }
  }
}
"#;

/// The regression guard for async-graphql's limits, which carve out
/// nothing for introspection: the dev budgets have to keep admitting the
/// playground's own schema fetch. Depth is what that costs — 13 `ofType`
/// levels — not complexity, which comes to 181.
///
/// The dev budgets keep admitting the playground's own schema fetch, which the library's limits carve out nothing for.
/// ´claim:budgets:the-dev-budgets-admit-introspection´
#[sqlx::test(migrations = "../../migrations")]
async fn the_dev_budgets_admit_the_standard_introspection_query(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::dev());
    let response = execute(&schema, INTROSPECTION_QUERY).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

/// The release posture serves no introspection at all.
/// ´claim:budgets:the-release-posture-hides-the-schema´
#[sqlx::test(migrations = "../../migrations")]
async fn the_release_posture_serves_no_introspection(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let response = execute(&schema, "{ __schema { queryType { name } } }").await;
    let data = response.data.into_json().expect("json");
    assert!(
        data.get("__schema").map(|v| v.is_null()).unwrap_or(true),
        "no schema data may resolve: {data}"
    );
}

/// A page past the cap refuses rather than being silently clamped down to it.
/// ´claim:budgets:an-over-sized-page-refuses´
#[tokio::test]
async fn pages_over_the_cap_refuse_instead_of_clamping() {
    let items: Vec<String> = (0..3).map(|i| i.to_string()).collect();
    for (first, last) in [
        (Some(MAX_PAGE_SIZE + 1), None),
        (None, Some(MAX_PAGE_SIZE + 1)),
    ] {
        match offset_connection(items.clone(), None, None, first, last, |s| s).await {
            Err(over) => {
                assert!(over.message.contains("at most 100"), "{}", over.message)
            }
            Ok(_) => panic!("a page over the cap must refuse"),
        }
    }
}

/// A read that names no page size is served the declared default.
/// ´claim:budgets:an-unqualified-read-gets-the-default´
#[tokio::test]
async fn an_unqualified_read_gets_the_default_page() {
    let items: Vec<String> = (0..(DEFAULT_PAGE_SIZE as usize + 5))
        .map(|i| i.to_string())
        .collect();
    let connection = offset_connection(items, None, None, None, None, |s| s)
        .await
        .expect("connection");
    assert_eq!(connection.edges.len(), DEFAULT_PAGE_SIZE as usize);
    assert!(connection.has_next_page);
}

/// A `first` at the cap is served, and a bare `last` pages from the end
/// without picking up the default page size on the way.
///
/// (´claim:budgets:an-over-sized-page-refuses´)
#[tokio::test]
async fn explicit_pages_at_the_cap_still_work() {
    let items: Vec<String> = (0..5).map(|i| i.to_string()).collect();
    let connection = offset_connection(items.clone(), None, None, Some(MAX_PAGE_SIZE), None, |s| s)
        .await
        .expect("first at the cap");
    assert_eq!(connection.edges.len(), 5);
    let connection = offset_connection(items, None, None, None, Some(2), |s| s)
        .await
        .expect("last only");
    assert_eq!(connection.edges.len(), 2);
    assert_eq!(connection.edges[0].node, "3");
}

/// Pricing follows the slice math: `first` wins when both are present,
/// an omitted page charges the default, and out-of-range arguments price
/// at the bounds — the resolver refuses those separately, so the cost
/// function never has to.
///
/// A connection prices at the page it was asked for, at the default when it named none, and at the bounds when the argument is out of range, the resolver refusing those separately.
/// ´claim:budgets:a-connection-prices-the-requested-or-default-page´
#[test]
fn connection_cost_prices_the_requested_or_default_page() {
    assert_eq!(connection_cost(Some(10), None, 3), 31);
    assert_eq!(connection_cost(None, Some(50), 1), 51);
    assert_eq!(connection_cost(Some(10), Some(50), 1), 11);
    assert_eq!(
        connection_cost(None, None, 2),
        DEFAULT_PAGE_SIZE as usize * 2 + 1
    );
    assert_eq!(connection_cost(Some(-5), None, 7), 1);
    assert_eq!(
        connection_cost(Some(MAX_PAGE_SIZE + 900), None, 1),
        MAX_PAGE_SIZE as usize + 1
    );
}
