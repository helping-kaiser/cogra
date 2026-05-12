# Collectives

A **Collective** is an actor node on the graph — any group of
people that needs a single graph identity to act through. The
term spans the full range from informal to formal: a household,
a band, a co-op, a studio, a partnership, an NGO, a company.

On the outbound side a Collective looks like a [User](../primitive/user.md): it
authors content, creates actor edges toward other nodes, owns
items (via ItemOwnership), is followed / liked / disliked, and
appears in feeds and is ranked like any other actor. The full
outgoing-edge catalog is in
[edges.md §1 "Collective as actor"](../primitive/edges.md#collective-as-actor).
A Collective having sentiment toward another Collective, or
toward a User, or vice versa, is perfectly normal — there is no
asymmetry between Collective and User as edge endpoints.

What makes a Collective different from a User is the off-graph
side: a Collective has **no credentials of its own** and takes
no gestures by itself. Every action attributed to a Collective
is initiated by an authorized member — a User, or a sub-Collective
acting recursively through its own authorized members — per the
Collective's social contract. The graph records the action as the
Collective's; no per-edge record of the acting member is kept.
The mechanism is in [§Acting through the Collective](#acting-through-the-collective).

This means Collectives are **user-created nodes**: each Collective
begins with one founding User and a written social contract (see
[§Creation](#creation)).

On the graph the Collective carries a `name` property — the handle
used for mentions and lookups, analogous to `User.username` — and
the universal `moderation_status` per
[nodes.md "Universal: moderation_status"](../primitive/nodes.md#universal-moderation_status).
Both are layered per [layers.md](../primitive/layers.md). Concrete
types and indexes live in
[graph-data-model.md](../implementation/graph-data-model.md).

## Creation

A Collective is brought into existence by a single founding
gesture from exactly one **User**:

1. The founding User writes the Collective's social contract
   (§Governance) — at minimum its initial decision-type rules
   and its act-as rules (§Acting through the Collective).
2. The system atomically creates the `:Collective` node and the
   founder's `CollectiveMember` junction.

Because the founder's CollectiveMember is the bootstrap — there
is no prior membership to approve it — the
[two-edge approval pattern](../primitive/graph-model.md#5-junction-node-flows)
collapses to its 1-of-1 special case: the founder signs both
the claim (`CollectiveMember → Collective`) and the approval
(`Collective → CollectiveMember`) in the same atomic gesture.
See [§Approval flow](#approval-flow) for the regular case.

The founder's role on their CollectiveMember junction is
whatever the social contract names for the inaugural role
(`founder`, `owner`, `partner`, …). There is no special "creator"
role and no uniqueness constraint on the inaugural role:
**additional founders are added afterward through the regular
CollectiveMember addition flow**, and their `founder` (or
equivalent) role carries the same weight as the bootstrap
founder's. The creator-User is identifiable on the graph as the
earliest layer-1 timestamp among the Collective's incoming
CollectiveMember-claim edges — the same earliest-incoming-edge
rule that derives authorship for any other node (see
[authorship.md](../primitive/authorship.md)).

### Sub-Collectives

A Collective creating another Collective follows the same
pattern: the founding Collective acts through one of its
authorized members (a governance-act per §Acting through the
Collective), producing the bootstrap gesture, and the new
sub-Collective's first CollectiveMember junction is
`parent Collective → new sub-Collective`. The User who
originated the gesture remains identifiable through the parent
Collective's own CollectiveMember chain, but is not directly
recorded on the sub-Collective's graph structure. Nesting depth
is unlimited.

## Acting through the Collective

A Collective produces actor edges, but has no credentials and
takes no gestures by itself. Every edge attributed to a
Collective is **initiated by an authorized member** — a User, or
a sub-Collective acting through its own authorized members. At
the graph layer the Collective is the source of the edge: there
is no `acting_user` dimension on the edge, no separate junction
recording which member produced the gesture, no on-graph trace
that links the edge back to its initiator.

This pure-delegation framing is deliberate. Once a member is
authorized to act for the Collective, the Collective IS the
actor for the graph's purposes — accountability for a member's
gestures lives in the social contract (which decides who can
authorize what), not in per-edge attribution. A Collective whose
authorized members produce harmful gestures is accountable as a
Collective; whether and how it then holds individual members
accountable internally is itself a matter for its social
contract.

### Content-acts vs governance-acts

Two coarse classes of gestures, with different defaults:

**Content-acts** — authoring [Posts](post.md) and
[Comments](comment.md), and creating sentiment/relevance actor
edges toward other nodes (likes, dislikes, follows, interest).
**Default: any active CollectiveMember may produce a content-act
on behalf of the Collective.** A Collective that wants to lock
content-acts down (e.g. "only the press officer posts") declares
an explicit act-as rule that overrides the default; otherwise
the any-active-member default applies.

**Governance-acts** — authoring [Proposals](proposal.md) on
behalf of the Collective, casting votes in governance instances
the Collective is eligible in, creating or approving
[ItemOwnership](items.md) junctions, and creating or approving
[CollectiveMember](#membership-collectivemember) junctions on
other Collectives. **Default: no member can produce a
governance-act on behalf of the Collective.** An explicit act-as
rule in the social contract is required. Governance-acts have
external consequences (they bind the Collective to votes, to
owned items, to memberships in other Collectives); defaulting
them off forces the Collective to declare in writing who can
carry them out.

The two defaults reflect the same principle from the rest of the
governance primitive ([governance.md](../primitive/governance.md)):
routine, reversible-by-the-actor gestures can be permissive;
consequential, binding gestures require explicit eligibility.

### Routing

When a member attempts to act-as a Collective C with a gesture
that would produce edge E:

1. The system classifies E as a content-act or governance-act.
2. The system looks up the act-as rule in C's social contract.
   If an explicit rule exists for E (by class or by specific
   edge type), eligibility, weight, and threshold come from
   that rule; otherwise the default for the class applies
   (allow for content-acts, deny for governance-acts).
3. If the rule's threshold is `1`, the gesture immediately
   produces C's actor edge.
4. If the threshold is greater than `1`, the gesture creates a
   pending state and waits for the required co-signatures from
   other eligible members — the same shape as a multi-sig
   junction approval per
   [graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows).
   Only when the threshold is satisfied does the system produce
   C's outgoing edge.

If the acting "member" is itself a sub-Collective, its own
social contract is consulted recursively before the parent
Collective's edge is produced — the sub-Collective must
authorize the gesture on its end before the parent Collective's
on-behalf-of step is reached. Nesting depth is unlimited.

## Economic role — no preferential treatment

No actor type receives preferential treatment in ad-revenue
distribution. Revenue follows graph topology, not actor type:
whichever nodes have the most economic weight in a "rich" part of
the graph — an influencer with massive reach, a bridging user that
connects otherwise-disconnected communities, a niche collective in
a dense neighborhood — receives a share proportional to that
weight. See the fair-economics principle in
[CLAUDE.md](../../CLAUDE.md). The graph decides — actor type does not.

This applies symmetrically: commercial collectives that buy ads do
not receive preferential placement, and non-commercial collectives
(households, hobby groups, co-ops) are not penalized for not buying
ads.

## Collectives always have members

Every collective has, or at some point had, at least one
[CollectiveMember](#membership-collectivemember). A collective with
**zero active members** is a collective that has dissolved — the
history is preserved (members come and go via state transitions on
the structural edges, per
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows)), but no one currently acts on
the collective's behalf.

## Membership: CollectiveMember

A `CollectiveMember` is a junction node (see
[graph-model.md §2](../primitive/graph-model.md#2-node-categories)) connecting **Collective to
User or Collective**. A collective can be a member of another
collective — subsidiaries, holdings, partner firms, coalitions of
bands under a label, households as members of a co-op.
CollectiveMember is not restricted to human members.

It carries **role** and role-attached quantities as properties on
the node itself (not in edge dimensions):

- `role` — one of `founder`, `shareholder`, `worker`, `band member`,
  `subsidiary`, `partner`, `member`, etc. Categorical, defined per
  collective.
- `ownership_pct` — when the role implies a stake (e.g. shareholder).
- Additional properties as needed (voting weight, vesting schedule,
  etc.).

Role properties stay on the junction node rather than being encoded
in edge dimensions — see [graph-model.md §2](../primitive/graph-model.md#2-node-categories) for the
reasoning.

## Approval flow

CollectiveMember uses the **two-edge approval pattern** described in
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows):

1. Actor (User or Collective) creates an actor edge toward a new
   **CollectiveMember** node.
2. System creates `CollectiveMember → Collective` (claim).
3. Required approving actors create actor edges toward the same
   CollectiveMember node. Approval policy depends on the target
   role — a new shareholder may require approval from existing
   founders and/or a threshold of current shareholders; adding a
   worker may be at founder discretion; adding a household member
   may need only the existing members' approval.
4. Once the collective's approval policy is satisfied, the system
   creates `Collective → CollectiveMember` (approval).
5. Actor is an active member.

Multi-sig approval thresholds are expressed as "N actor edges from
specific roles required," with role-weighted voting derived from
the properties on the approving actors' own CollectiveMember nodes.

The bootstrap case — the founder's CollectiveMember at Collective
creation — collapses this to its 1-of-1 form, with the founder
signing both edges atomically. See [§Creation](#creation).

## Governance — the social contract

A collective's **social contract** is its set of governance rules:
which decisions need votes, who can vote on each, with what
weights, and at what threshold. Different collectives have very
different rules — a corporation's CEO can fire workers
unilaterally; a household requires consensus for everything; a
co-op uses 2/3 majorities for major decisions. The graph supports
all of these without any primitive changes.

### Per-decision-type instances

Every decision-type in a collective is a separate governance
instance per [governance.md §2](../primitive/governance.md#2-the-five-components). Each instance has
its own:

- **Subject** — what's being decided (a CollectiveMember junction
  for member changes; a Proposal node for property changes).
- **Eligibility** — who can vote (`role = CEO`,
  `role = board_member`, all members, members weighted by
  `ownership_pct`, …).
- **Weights** — how each voter's contribution is computed (uniform,
  role-based, or property-derived).
- **Threshold** — quorum and pass-threshold.

Instances coexist on the same Collective. Hiring a worker and
removing a board member can use entirely different rules; the
system routes each decision to its instance based on the subject
and the subject's role.

### Act-as rules

Act-as rules are a second family of rules in the social
contract, sitting alongside the decision-type instances above.
They govern the on-behalf-of mechanism described in
[§Acting through the Collective](#acting-through-the-collective):
which members can produce which classes of gestures as the
Collective.

An act-as rule has the same parameter shape as a decision-type
instance — eligibility, weights, threshold — but its outcome is
the production of the Collective's outgoing edge itself, not a
state transition on a separate subject. A single-signer rule
(threshold `1`) is the common case; a multi-sig rule
(threshold > `1`) delays the gesture until co-signers satisfy
the threshold, analogous to a multi-sig junction approval.

The defaults from §Acting through the Collective apply when no
explicit rule covers a gesture: content-acts default to
any-active-member at threshold `1`; governance-acts default to
deny. Explicit rules override these — content-acts can be
locked down, governance-acts can be opened up. The example
configurations below include illustrative act-as rules
alongside the existing decision-type rules.

### No primitive defaults

Unlike Chats — which default to community-vote moderation because
that fits informal communities — Collectives must explicitly
define their rules at creation. Creating a Collective is the act
of writing its social contract. The example configurations below
are starting templates, not enforced defaults.

### Hierarchical authority is just a parameter choice

The "no admin veto" stance from chat governance is a chat-specific
default, not a primitive principle. A collective whose social
contract gives the CEO `weight = ∞` (or just `threshold = 1` with
`eligibility = role = CEO`) for the "fire worker" decision IS
expressing CEO-unilateral authority — and the graph supports it.
The primitive doesn't pick a power structure; the collective does.

### Example configurations

The roles used in the configurations below (`CEO`, `founder`,
`board_member`, `shareholder`, `worker`, etc.) are
**collective-specific** — each collective's social contract
defines its own role vocabulary. Roles are not a global enum;
the primitive only requires that a collective name them
consistently for its own eligibility/weight rules.

#### Corporate hierarchy

A small company with founders, a CEO, board members, and workers.

| Decision-type / Act-as rule        | Eligibility                                            | Threshold |
|------------------------------------|--------------------------------------------------------|-----------|
| Hire / fire worker                 | `role = CEO`                                           | 1 vote    |
| Promote worker to senior           | `role = CEO`                                           | 1 vote    |
| Add board member                   | `role = founder`, weighted by `ownership_pct`          | > 50%     |
| Remove board member                | `role IN (founder, board_member)`, excluding subject   | ≥ 2/3     |
| Remove CEO                         | `role = board_member`                                  | ≥ 2/3     |
| Change `ownership_pct`             | `role IN (founder, shareholder)`, weighted by stake    | ≥ 75%     |
| Change `Collective.name`           | All active members                                     | > 50%     |
| Act-as: post / comment             | `role = press_officer` *(override of the any-member default)*   | 1 signer  |
| Act-as: author external Proposal   | `role = CEO`                                           | 1 signer  |
| Act-as: cast vote in external Proposal | `role = CEO` or `role = board_member`              | 1 signer  |
| Act-as: transfer Item (acquire / release) | `role IN (founder, board_member)`, weighted by stake | ≥ 50% signers |

A worker is fired by a single CEO vote; a board member is removed
only by board supermajority; a CEO is removed only by the rest of
the board. Routine PR posting is delegated to a single press
officer (locking down the otherwise any-member default for
content-acts), while consequential moves — proposing, voting,
and transferring company assets — are routed to leadership and
the board.

#### Household (5 people)

| Decision-type / Act-as rule    | Eligibility                                | Threshold                                 |
|--------------------------------|--------------------------------------------|-------------------------------------------|
| Add a new member               | All active members                         | 100% of cast, 100% quorum                 |
| Remove a member                | All members except subject                 | ≥ 90% of cast, 100% quorum of remaining   |
| Routine spending (if tracked)  | All active members                         | > 50%, ≥ 60% quorum                       |
| Act-as: vote in HOA Proposal   | All active members                         | > 50% signers                              |
| Act-as: acquire shared Item    | All active members                         | > 50% signers                              |

Everyone has equal voice; consensus dominates. Content-acts
(posting to the household feed, reacting on shared content) are
left at the any-member default — no override.

#### Worker co-op

All members equal stake; some routine decisions delegated to
officers.

| Decision-type / Act-as rule         | Eligibility                | Threshold       |
|-------------------------------------|----------------------------|-----------------|
| Add a new member                    | All active members         | ≥ 2/3           |
| Remove a member                     | All members except subject | ≥ 2/3           |
| Routine operations                  | `role = officer`           | > 50%           |
| Major policy change                 | All active members         | ≥ 2/3           |
| Change capital structure            | All active members         | ≥ 75%           |
| Act-as: vote in federation Proposal | All active members         | > 50% signers   |
| Act-as: transfer co-op-held Item    | All active members         | ≥ 2/3 signers   |

### Where governance rules live

Each decision-type's and act-as rule's parameters are stored as a
structured property on the Collective node (e.g.,
`Collective.governance_rules.remove_worker = { eligibility, weights, threshold }`,
`Collective.governance_rules.act_as_transfer_item = { eligibility, weights, threshold }`).
Changes to any rule follow the standard Proposal pattern with that
rule's **own** configurable parameters. The bootstrap rules are set
at collective creation; everything afterward is governance of
governance.

## Leaving / being removed

State transitions on a CollectiveMember junction follow the
primitive — see [graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows)
("Revocation and state transitions") for voluntary leave and
governance-instance removal mechanics.

The collective-specific piece is the removal instance itself:
eligibility, weights, and threshold come from the social contract
above. The shape of "removal" varies enormously across collectives —
a 1-of-1 CEO firing instance and a 2/3-of-board expulsion instance
are both valid configurations.
