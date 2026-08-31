//! The checked-in schema.graphql is the frontend contract (Apollo Kotlin
//! codegen input). This test fails when the Rust schema drifts from it —
//! regenerate with `make schema`.

/// The checked-in schema is the one the code exports, which is what makes it a contract both clients can generate from.
/// ´claim:server:the-checked-in-schema-is-the-code´
#[test]
fn checked_in_schema_matches_the_code() {
    let checked_in =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../schema.graphql"))
            .expect("schema.graphql must exist at the repo root (make schema)");
    assert_eq!(
        checked_in,
        api::schema::sdl(),
        "schema.graphql is stale — run `make schema` and commit the result"
    );
}
