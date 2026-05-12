# Authorship

Authorship in CoGra is a **derived fact**, not a stored field. The
author of a node is the actor whose incoming edge has the earliest
layer 1 timestamp. A node cannot exist without someone creating it, so
the very first edge ever created toward a node identifies the author.

The dimension values on the author's edge are just normal opinion
values — the author's initial feelings about their own content
(typically high positive sentiment and relevance).

## Example

Jakob creates a post. His actor edge `Jakob → Post_X` is layer 1, with
the earliest timestamp of any incoming edge on Post_X. That makes Jakob
the author. Later, Alice likes the same post — her edge
`Alice → Post_X` also has a layer 1, but its timestamp is later than
Jakob's. The author is always the earliest.

## Collective-authored content

When a Collective is the author, the rule is unchanged: the
on-graph author is the actor whose incoming edge has the
earliest layer-1 timestamp, and that actor is the Collective
itself. The gesture that produced the edge is initiated
off-graph by an authorized CollectiveMember per the Collective's
social contract (see
[user.md §1](user.md#1-user-vs-collective) and
[collectives.md "Acting through the Collective"](../instances/collectives.md#2-acting-through-the-collective)),
but no acting-member identity is recorded on the authorship
edge. Querying "who authored this?" returns the Collective; the
member who initiated the gesture is not derivable from the
authored node.

## Caching

Looking up "who authored this?" by scanning all incoming layer 1
timestamps on every view would be expensive. The author ID should be
cached:

- **On the node itself** as a property (`author_id`) — keeps the info
  in the graph for traversal queries.
- **In Postgres metadata** (e.g. `posts.author_id`) — for display
  queries that don't need the graph.

Both are derived caches. The graph (earliest incoming layer 1) is the
source of truth; if the caches ever disagree with the graph, the graph
wins and the caches should be rebuilt.
