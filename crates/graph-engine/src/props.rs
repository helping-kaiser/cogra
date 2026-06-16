//! Cypher fragments for the layered node-property shape.
//!
//! Every property marked "layered" in
//! [graph-data-model.md](../../../docs/implementation/graph-data-model.md)
//! occupies two slots: `X` (the current top-layer value, read directly by
//! queries and constraints) and `X_layers` (the append-only
//! `List<Map{value, timestamp, layer}>` history). At creation a property has
//! one layer, so its history list is a single entry stamped with the
//! statement's shared `now`.
//!
//! These helpers emit `SET`-clause text that references a `now` already
//! bound in the query (`WITH localDateTime() AS now`), so every property and
//! edge written by one statement shares one strictly-consistent timestamp —
//! the "single timestamp pins the node's full state" rule from
//! graph-data-model.md.

/// A `SET` assignment for a layered property: writes the top-layer slot and
/// seeds its single-entry history. `value_expr` is a Cypher expression
/// (a parameter like `$username` or a literal like `'normal'`).
pub(crate) fn layered(target: &str, prop: &str, value_expr: &str) -> String {
    format!(
        "{target}.{prop} = {value_expr}, \
         {target}.{prop}_layers = [{{value: {value_expr}, timestamp: now, layer: 1}}]"
    )
}

/// A `SET` assignment for a single-slot (non-layered) property — the
/// `moderation_status` cache and the `id` / `singleton_marker` identity
/// slots, which carry no history.
pub(crate) fn plain(target: &str, prop: &str, value_expr: &str) -> String {
    format!("{target}.{prop} = {value_expr}")
}

/// The full `SET` body for a `:User` node, less the `id` (set by the `MERGE`
/// key). `role_expr` is the `network_role` value expression — `'moderator'`
/// for the genesis User, `'member'` for every registrant. All per-field
/// moderation statuses start `'normal'`; the node-level cache mirrors them.
///
/// The `username` data property carries the handle; the `display_name` /
/// `bio` / `avatar` / `cover` / `website_url` graph properties hold their
/// field's moderation **status**, not the text — the displayed values live
/// in Postgres (graph-data-model.md "per-field moderation-status
/// properties").
pub(crate) fn user_set_body(target: &str, role_expr: &str) -> String {
    let mut clauses = vec![
        layered(target, "username", "$username"),
        layered(target, "network_role", role_expr),
        layered(target, "username_status", "'normal'"),
        layered(target, "display_name", "'normal'"),
        layered(target, "bio", "'normal'"),
        layered(target, "avatar", "'normal'"),
        layered(target, "cover", "'normal'"),
        layered(target, "website_url", "'normal'"),
    ];
    clauses.push(plain(target, "moderation_status", "'normal'"));
    clauses.join(", ")
}
