Two states, opposite granularity. Get that wrong and the design misrepresents the data model.

**`SensitiveVeil` — per field, per attachment.**

```jsx
<SensitiveScope>            {/* once per post */}
  <h3><SensitiveVeil kind="text">{post.title}</SensitiveVeil></h3>
  <SensitiveVeil radius="0px"><MediaAttachment src={…} /></SensitiveVeil>
</SensitiveScope>
```

- A **title, a description, a text body, and each media attachment** can be veiled alone — `FieldModerationStatus` exists per field for exactly this, and per-field granularity exists for sensitive *only*. One image in a gallery is veiled while its neighbours read normally. Never blanket a post: that throws away the one thing the data model went out of its way to keep.
- **Reveal is per post.** `SensitiveScope` makes one tap answer for every veil inside — the reader decided once, and asking again per item turns one decision into five. A veil with no scope governs only itself, the right default for a lone tile.
- **The content stays mounted and keeps its space**, so revealing moves nothing. Text is blurred in place rather than replaced: the reader can see there *is* a sentence.
- **No `error` colouring, no warning glyph, no red.** A neutral wash of the standard scrim and a plain chip.
- **`radius` is authoritative and forwarded to the child**, so pass it once. A veiled tile in a flush gallery must not end up rounded beside a square neighbour — media meets the card's straight sides, never its corners.
- **Do not read the reader's severity level.** The 0–10 range is for a future where someone accepts one category and refuses another; today a veil either exists or does not, decided before this renders.

**`RedactedContent` — the whole record, never a field.**

```jsx
<RedactedContent reason="illegal" when="Removed 4 days ago" />
```

- An illegal verdict removes the **payload**, so **every authored field goes at once**: no title, no body, no description, no media. Granularity is the record — the content commitment forbids partial rewrite. There is no redacted title beside a surviving body, and no redaction inside a sentence. `PostCard`'s `redacted` prop does this for you.
- **What remains is the skeleton, and that is the point:** author, timestamp, thread position, standing, the stance a reader can still take. No record leaves the graph and no removal is silent — a reader must never wonder whether something was quietly deleted.
- **`reason` matters.** "illegal" is removed for cause by proposal; "author" is removed by choice. They must read differently, or a verdict can hide behind an author's decision.
- A redacted node is **not feed material** — it is reached by direct link, by structure still pointing at it, or by a filter that admits it. Whoever is looking arrived on purpose, so say what happened and nothing more.
