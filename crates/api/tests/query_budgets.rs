//! The per-query demand budgets (roadmap.md slice 1.1): depth and
//! complexity limits in both postures, the introspection posture, and
//! the connection page-size budget. Requires a live Postgres
//! (`make up`) — the schema context wants a pool, though rejected
//! queries never reach it.

use std::sync::Arc;

use sqlx::PgPool;

use api::schema::types::{DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, connection_cost, offset_connection};
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
#[sqlx::test(migrations = "../../migrations")]
async fn a_query_past_the_depth_budget_is_rejected(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let response = execute(&schema, &nested_query(15)).await;
    assert_eq!(first_error(&response), "Query is nested too deep.");
}

/// Ten hops come to depth 12, inside the budget. The anonymous viewer
/// resolves `me` to null; the point is that validation let the query
/// through at all.
#[sqlx::test(migrations = "../../migrations")]
async fn a_query_within_the_depth_budget_passes_validation(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let response = execute(&schema, &nested_query(10)).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

/// 100 links × (100 applications × ~4) is roughly 40k fields — the
/// multiplicative blowup the complexity budget exists to refuse.
#[sqlx::test(migrations = "../../migrations")]
async fn nested_full_page_connections_exceed_the_complexity_budget(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let query = "{ me { inviteLinks(first: 100) { edges { node {
        applications(first: 100) { edges { node { id status } } }
    } } } } }";
    let response = execute(&schema, query).await;
    assert_eq!(first_error(&response), "Query is too complex.");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_modest_connection_query_fits_the_budget(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::release());
    let query = "{ me { inviteLinks(first: 20) { edges { node { id singleUse } } } } }";
    let response = execute(&schema, query).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

/// With no `first`/`last` the field prices at the default page size,
/// 20 × child. A budget sized just under that rejects the bare read,
/// which is what proves omission is not free.
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
/// nothing for introspection: the dev budgets have to stay wide enough
/// that the playground's own schema fetch keeps working.
#[sqlx::test(migrations = "../../migrations")]
async fn the_dev_budgets_admit_the_standard_introspection_query(pool: PgPool) {
    let schema = schema(pool, QueryBudgets::dev());
    let response = execute(&schema, INTROSPECTION_QUERY).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
}

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
