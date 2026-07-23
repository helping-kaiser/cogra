# Invitations

How a person joins CoGra and gets their first edges. The
invitation is one half of the admission AND gate
([substrate-map.md §1](substrate-map.md#1-actors-and-identity)),
and it is what prevents a new member from starting as an isolated
node with no path to or from the rest of the graph.

Two relations that must never be confused
([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)):
the L1 **chat Invitation** hyper-edge is a proposal to join a
*chat*; the **CoGra-join relation** below is admission to the
*platform* and never uses that family. Collectives are not
invited — they come into existence through a different mechanism
([collectives.md](../instances/collectives.md)).

---

## 1. The admission AND gate

A person becomes a CoGra member when **both** halves hold:

- **L1 write eligibility** — a funded Layer 0 burn to the
  person's own address clears the write rule
  ([substrate.md §6](substrate.md#6-authoring-path-and-admission)).
  Who funds it — the community, the inviter, the person — is
  economics ([economics.md](economics.md)); the comparator sees a
  funded member exactly as a self-funded one.
- **An accepted CoGra invitation** — the mutual stance pair of §2.

Neither half alone admits. Burn without invitation buys write
capacity on the shared graph but no CoGra membership; invitation
without burn leaves the person unable to act. Email is
authentication and recovery only — never a gate
([user.md §2](user.md#2-creation)).

An actor may pre-exist CoGra on the shared graph: joining is then
just the connecting stance pair plus service registration — the
L1 side already stands.

---

## 2. The mutual-pair relation

The CoGra-join relation is **mutual-pair-and-accept-gated**, and
Layer 1 is its truth home:

- Any number of members may point an **Opinion toward the
  joiner's Profile** — the interpersonal stance carrier
  ([substrate-map.md §3](substrate-map.md#3-stances-and-revision)).
  Each is an ordinary, priced, public stance; none of them is yet
  an invitation.
- The joiner **accepts by pointing back**: their own Opinion
  toward a would-be inviter's Profile completes a mutual pair.
- **The inviter is the single actor the joiner reciprocates
  first** — the ≺-earliest accepted back-edge. One inviter per
  member, fixed by public record order, permanent.

A unilateral edge never constitutes an invitation: otherwise
actors could be linked, unconsented, to reap inviter benefits.
Acceptance is the joiner's own authored act — the same
consent shape as chat membership materializing only from the
invitee's own Participant edge
([substrate.md §4](substrate.md#4-the-gesture-pattern)).

The pair does double duty by construction:

- **The joiner's first outbound edge.** Their reciprocal Opinion
  is their first walkable connection — the seed of their feed
  ([feed-ranking.md](feed-ranking.md)).
- **The joiner's first inbound person edge.** The inviter's
  Opinion is a Full-tier stance toward the new Profile — the
  grounding that makes the new member reachable for eligibility
  cones and, when positive, the first vouch feeding their
  standing ([economics.md §4.1](economics.md#41-eligibility--both-sides)).

---

## 3. Default values and customization

Both Opinions carry the authored stance parameters — valence and
connection, `(p_d, p_i)` ([edges.md](edges.md)). Each side
chooses their own values during the flow; the defaults are a
fallback for those who skip the choice, **not** the recommended
values.

**Defaults are `(+0.1, +0.1)` on each direction** — and this is
CoGra's standing policy for every normal action, not an
invitation quirk: **defaults sit low so that stronger stances
stay expressible.** A vocabulary whose default is already strong
leaves no headroom for the deliberate super-like; a low default
keeps the full magnitude range meaningful. An uncustomized
invitation is a real but modest endorsement — walkable, vouching,
easily outweighed the moment either party authors something
deliberate.

### Inviter side: shaping the new member's reach

The inviter's Opinion controls how the new member's content
traverses the inviter's network — paths from the inviter's
neighborhood reach the joiner through it at its real `w̃` — and,
being a vouch-positive person stance, it feeds the joiner's
standing through the standing projection. The inviter is
signaling to their network how strongly to weight this new voice. Strong
values are a real commitment: severance later means authoring the
counter-stance that nets the pair to `(0, 0)`
([feed-ranking.md §8.1](feed-ranking.md#81-the-act)).

### Invitee side: shaping their own first feed

The invitee's reciprocal Opinion is initially their *only*
outbound edge, so their entire first feed runs through it. Its
values matter most once the invitee forms a **second** outbound
edge — the relative path products decide which neighborhood
dominates.

**Worked example: invited by a friend with different interests.**
The invitee values the inviter as a person but does not share
their content tastes. The instinct to author negative connection
— "love them, don't want their content" — is a trap under the
sign rule: a pair with `p_i < 0` **taints** every path through it
(taint is absorbing,
[feed-ranking.md §5.2](feed-ranking.md#52-sign--balance-and-taint)),
so the inviter's whole neighborhood would enter the feed as
*negative* contributions — active suppression, not neutrality.
The stance that matches the intent is a **modest positive pair**,
e.g. `(+0.5, +0.1)`: warm valence, weak connection. Weak positive
path products fade naturally once the invitee's second edge —
say `(+0.5, +0.5)` toward a Collective they care about — starts
sourcing stronger paths; the inviter's neighborhood recedes
without ever being punished. Actually not wanting to see someone's
content is the read-side blocklist's job
([feed-ranking.md §8.2](feed-ranking.md#82-the-read-side-blocklist));
negative stances are for genuine disendorsement.

The broader lesson survives the rebase: stance values encode a
relationship the math respects until a new record moves the
bundle. Picking deliberately at invitation time avoids "I left
the default and now my feed is dominated by my inviter's
network" — though the low defaults make that trap shallow.

---

## 4. Invite links: staged applicants, explicit approval

The inviter's Opinion is a priced act toward a specific Profile —
one that does not exist when a link is generated. So a link never
authors anything: it is **pure service-side UX that stages
applicants**, and the inviter's **approval is the priced act**.
There is no fire-and-forget invitation.

The flow:

1. **The link stages.** A person following the link registers as
   an **applicant** — off-graph service state only. An abandoned
   or unapproved application leaves no record beyond itself:
   no account, no records, nothing on the graph.
2. **The inviter approves** — per applicant, or in batches for
   high-reach onboarding. Approval is the deliberate act that
   commits the inviter's stance: the backend then runs the
   admission sequence — the funded burn, the Registration
   grounding the new Actor + Profile, and the inviter's Opinion
   toward the new Profile. The link's stance values are
   **pre-filled, not pre-committed** — the inviter can adjust
   them at approval.
3. **The joiner accepts by reciprocating** (§2) — their own
   Opinion toward the inviter's Profile completes the pair and
   the membership.

While waiting for approval, an applicant can already **read** —
the shared graph is public — they just cannot act. Approval
latency (an inviter who doesn't check their phone for hours) is
a UX cost, not a correctness problem.

**Link modes.** When generating a link, the inviter picks
**single-use or multi-use**; both are time-gated and revocable at
any time.

- **Single-use.** One applicant slot. Best for targeted invites —
  a specific link to a specific person; a leaked link stages at
  most one stranger, and approval still gates the join.
- **Multi-use.** Many applicants can stage through the same link
  until its timer expires — the shared-funnel mode influencers
  and public communities need, where the inviter does not know in
  advance who will apply. What scales is the *queue*, never the
  vouching: each join still costs the inviter one explicit,
  priced approval.

Registration mechanics — email verification, applicant handling,
the service-level admission step — live in
[auth.md](../implementation/auth.md).

---

## 5. The inviter reward

The accepted inviter earns the **single-hop 1% CGT reward**: at
each campaign settlement, an earner's inviter receives `0.01·P`
sized by that earner's payout share
([economics.md §7.3](economics.md#73-the-inviter-reward)). Direct
inviter only — no chain, no pyramid dynamic; permanent — the
relation never expires, so the inviter earns over the member's
lifetime; paid in CGT, the reward economy, never the L0 reserve.
It fires only on the accepted mutual pair — never on a one-way
edge. Genesis members have no inviter; their share falls back to
burn.

---

## 6. The bot-cluster trade-off

Multi-use links shared publicly create an attack surface: a bot
cluster staging through an influencer's funnel and getting
batch-approved makes the influencer a **bridge node into the
cluster**. The approval gate (§4) doesn't remove the hazard —
carelessly batch-approving unknown applicants *is* mis-vouching —
it makes the mis-vouch an explicit, priced act. The same mechanic
that gives the inviter reach — and lifetime referral earnings —
concentrates the cost onto them. Single-use links sidestep this
by construction.

The system tolerates the multi-use case because public links are
necessary for high-reach onboarding, and the abuse is
self-correcting — with teeth the pre-L1 design lacked:

- **Severance is the counter.** The inviter's network — or the
  inviter — reverses stances toward the bridge to a `(0,0)` net
  ([feed-ranking.md §8.3](feed-ranking.md#83-cascading-severance--and-its-locality)).
  A cluster reachable only through the bridge loses every live
  path: absent from feeds, from attribution earnings, from vouch
  propagation, from subsidy — the zero-jail
  ([feed-ranking.md §7](feed-ranking.md#7-sort-order-tie-breakers-zero-jail)).
- **Severance and defunding are the same act.** The reversed
  stances stop propagating standing, dropping the cluster below
  the wall — the community stops paying for actors it has severed
  ([economics.md](economics.md)).
- **Every bot join was priced.** Each cluster account consumed a
  funded burn and priced acts; a severed cluster is sunk cost,
  not recyclable infrastructure.

Inviters learn to be selective with where they post their links.
The trade-off is intentional: restricting the mechanism would
deprive legitimate high-reach actors of a critical onboarding
tool; pushing the consequence onto the inviter aligns the
incentive with the actor most able to manage it.
