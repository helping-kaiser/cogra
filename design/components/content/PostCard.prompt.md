Use `PostCard` for a post anywhere it appears — the feed, the post page, a profile chronicle. Do not re-compose it out of `Card` + `ActorChip` + `StanceControl` per surface; that is how the three copies in the product drifted.

```jsx
<PostCard {...post} onOpen={() => open(post.id)} />           {/* feed */}
<PostCard {...post} variant="detail" />                        {/* post page */}
```

**Every card carries the overflow menu.** Genesis content always declares a license, so there is always at least one item in it, and a trigger that appears on some cards and not others is worse than one that is always in the same place.

**The license is not on the initial view.** It is a term over downstream reuse, read once in a hundred readings, so it lives behind the card's overflow menu (`License terms`) and appears under the content only once asked for. Pass extra rare interactions — report, open a proposal, copy a link — as `menuItems`.

**The Post Score is a prop, not something each surface passes in.** Every post in a ranked listing has one, so `score` renders it in the affordance row after the stance control, as Material's `graph_3` glyph plus the number. Uncapped, negative allowed, never coloured.

Everything a post grows beyond its content goes in the **affordance row**: **one line, never wrapping**, in a fixed order — **stance, Post Score, comments, then `actions`**. A second row reads as a second kind of thing, and it costs height the post does not have. That constraint is why every affordance here is glyph-plus-number rather than words. Nothing in that row may take `primaryContainer` — the stance knob already spends it.

**`redacted` renders the skeleton, not a field.** Redaction is record-granular — an illegal verdict removes the payload, so title, description, body, media, and the license go at once. Never veil or blank them individually. What survives is the point: author, timestamp, thread position, and the stance a reader can still take, because no record leaves the graph and no removal is silent. Pass `{reason: "author"}` for a self-erasure, which must read differently from a verdict.

**Comments have their own affordance** (`comments` count + `onOpenComments`). "Read the replies" is a different intent from "read the post", so it does not hide behind the card tap — it opens the **comments sheet** (readme §13, 2026-08-28), from the feed and the detail view alike; the detail view is just about the post. `chat_bubble` plus the count, the same glyph-plus-number shape as the score beside it; the count is spoken by the accessible name, and zero shows the glyph alone. On `detail` the card cedes its overflow dot to the page header, which owns the one menu.

**`sensitive` veils the body and the description while the title stays readable**, and the veil names whose mark it is — `source: "author"` for the author's own warning, `"platform"` for a verdict — with `reason` after it. One reveal answers for the whole card. This is per-post honesty, not redaction — nothing is removed.

**Tapping the card opens the post.** Anything in it that has its own meaning — the author chip, the overflow trigger, the affordance row — keeps it; everything else routes to the detail view.

**A post's body is `content` XOR `media` — words or a picture, never both.** Words that belong beside a picture are the `description`, so a media post carries no `content` at all; a text post's body is `content`. Both kinds draw in one order: **title · body · description**. Hand the card both and it renders the media reading and drops `content` — the manifest is the body, and an impossible post never gets an invented layout.

`summary` clamps the description to two lines and the text body to 22 — the height a 4:5 media post takes at the card's own content width, so a feed of both kinds keeps one rhythm — and makes the text region the link; `More` opens what is folded. `detail` sets the body at `body-large`, clamps nothing, and puts the title at `headline-small`. In both, the **author leads** — people first, so the chip is above the content, never a byline under it. The stance control sits outside the link region because it acts rather than navigates. Media is full-bleed via `media` (`MediaGallery`), portrait capped at 4:5 and height-capped at `--media-max-height` so the whole card — affordance row included — fits above the bottom bar.
