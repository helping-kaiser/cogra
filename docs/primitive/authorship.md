# Authorship

Authorship in CoGra is a **derived fact**, not a stored field. The
author of a node is the actor whose incoming edge has the earliest
layer 1 timestamp. A node cannot exist without someone creating it, so
the very first edge ever created toward a node identifies the author.
Junctions are the one exception: they are authored by their
**bearer**, fixed by the `:AUTHOR` label rather than the timestamp —
see [Junction authorship](#junction-authorship).

**"Creator" is a synonym for "author"; "author" is canonical.**
Wherever a User or Collective is described as "creating" a node
— Item, Chat, ChatMessage, Collective, Post, Comment, Proposal — the on-graph
fact is the same: they hold the earliest-layer-1 incoming edge,
the `:AUTHOR` label, and the rights and obligations that
authorship carries. "Founder" is *not* a synonym — it is the
CollectiveMember **role string** used inside a Collective (see
[graph-model.md §5 "Bootstrap"](graph-model.md#5-junction-node-flows)
and [collectives.md §1](../instances/collectives.md#1-creation)).

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

## Graph-layer label — `:AUTHOR`

The authoring edge is the one actor edge that carries a sub-label
distinct from `:ACTOR` — `:AUTHOR` — per
[edges.md §3 "Sub-category labels"](edges.md#sub-category-labels).
The label is the system's mechanical implementation of the
"earliest incoming edge" rule above: created at the same gesture as
the authoring edge, permanent across re-layerings, and
queryable in a single label scan.

`:AUTHOR` is also load-bearing for the feed-ranking author-hop
traversal rule ([feed-ranking.md §3.5](feed-ranking.md#35-traversal-restrictions)),
which terminates `:REFERENCES`-to-actor paths after exactly one
outgoing `:AUTHOR` hop.

Same tensor shape, same `[-1, +1]` range, same append-only layer
semantics as any actor edge — only the label differs.

## Junction authorship

A junction (`ChatMember`, `CollectiveMember`, `ItemOwnership`) is
authored by its **bearer** — the actor the junction represents. The
authoring edge is the bearer's `User/Collective → junction` actor
edge carrying the `:AUTHOR` sub-label, written in the same gesture as
the bearer's self-claim — the act of claiming or approving the
relationship (see
[graph-model.md §5](graph-model.md#5-junction-node-flows)). Its
dimensions are the bearer's stance on holding the membership or
ownership, like any actor edge.

For junctions the author is fixed by the **`:AUTHOR` label, not the
earliest-incoming-edge timestamp.** A junction receives third-party
`:ACTOR` sentiment edges (others endorsing or rejecting the
membership), and in an invite flow the junction exists — bound to its
prospective bearer by `:BEARER` — before the bearer self-claims, so a
third party's sentiment edge can carry an earlier timestamp than the
bearer's authoring edge. The label resolves it: the bearer's
`:AUTHOR` edge is the author whichever incoming edge is earliest.
Third-party sentiment is never authorship.

`:BEARER` (junction → bearer) and `:AUTHOR` (bearer → junction)
coexist and point opposite ways: `:BEARER` is the system's
non-traversable identity binding, written at junction creation;
`:AUTHOR` is the bearer's own traversable opinion edge, written when
they self-claim. See
[edges.md "Bearer binding"](edges.md#bearer-binding).

## Proposal authorship

A Proposal's opening gesture always writes a
`User/Collective → Proposal` `:AUTHOR` actor edge, whichever vote
shape opens it. Opened by a **Shape A** vote, that vote edge is
itself the authoring edge — vote and authorship are one edge
([proposal.md §5](../instances/proposal.md#5-authorship)). Opened
by a **Shape B** vote, the vote is a structural edge from the
opener's eligibility junction and cannot carry `:AUTHOR`, so the
actor behind the opening junction writes the `:AUTHOR` actor edge
in the same gesture — the same paired-edge pattern as the junction
self-claim above. Either way the Proposal carries an incoming
actor edge from its first instant, so the earliest-incoming-edge
derivation and the rule-snapshot timestamp it anchors
([governance.md §5](governance.md#rule-snapshot-at-author-time))
are always defined.

## Caching

Display queries that don't touch the graph need a fast author
lookup, so `author_id` is cached on the Postgres `posts`,
`comments`, and `chat_messages` rows — see
[data-model.md](../implementation/data-model.md).

The graph is the source of truth. The `:AUTHOR` label is
derivable from the earliest-layer-1 rule; the Postgres
`author_id` is derivable from the graph. If either disagrees,
rebuild from the graph.

**Economics does not read the Postgres cache.** Ad-revenue
distribution, payouts, and any value-bearing computation walk
the graph directly. A stale `author_id` affects display ordering
at most; it never changes what the author is paid. The cache may
drift briefly without correctness risk. Campaign attribution
resolves each contributor from the `:AUTHOR` edges on the paths it
walks — see [economics.md §6](economics.md#6-attribution--per-path-shapley).

**Rebuild trigger.** Stale cache entries self-heal
opportunistically: when a viewing user's feed-ranking pass
touches a post via a path that traverses its `:AUTHOR` edge, the
ranking step has the authoritative author UUID. If it disagrees
with `posts.author_id` (or the equivalent column), the API
enqueues a rebuild for that row. Rebuilds run out-of-band — the
read that detected the drift never blocks.

A user with no path to the post never triggers a rebuild, but
also has no display query depending on the column — so the
drift is invisible until someone with a path looks. Any
disagreement that matters to display gets corrected by someone
who would have seen the wrong value.
