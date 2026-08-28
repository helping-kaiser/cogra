Use `FeedFilter` on every feed view — member, applicant, and guest alike; filtering is a read control. The trigger sits on the right edge of the `CograBand` (`trailing`), and scrolls away and back with it.

```jsx
const [filter, setFilter] = React.useState(FEED_FILTER_DEFAULT);

<CograBand trailing={<FeedFilter value={filter} onChange={setFilter} />} />
```

- **The trigger reads back the view in words, deviations only** — "Posts" at rest, "Posts · newest · showing seen" when flipped. No glyph: there is no filter icon in the inlined set, §5 forbids drawing one, and an icon cannot tell you Newest is on.
- **The pill has a budget.** The kinds always show; once the exceptions stop fitting they collapse to a count — "Posts · 3 changes". A pill that overflows has told the reader nothing, and "far from the default" is the fact that matters at that point.
- **Kinds combine, order does not.** `FEED_KINDS` is the one list of ranked kinds, shared with search — the word is "Profiles" everywhere. Ranked-versus-newest plus the seen toggle live in the shared `OrderSection`. Do not turn either into the other.
- **It applies live.** Every tap changes the feed behind the sheet. No Apply button — that asks the reader to commit to a guess about their own feed.
- **An empty filter is legal.** With no kinds selected the feed shows its empty state naming what is off; the chip does not refuse the tap.
- **The sheet carries its own "?"** (the pads' precedent) opening "The filter" dialog — the text lives in `guidelines/copy-voice.md` and names the settings default.
- **"Also show" is not a warning.** Sensitive content arrives veiled, a removed record arrives as its skeleton. Neither takes `error` colouring here or anywhere.
- **Search wears the same pill.** A surface that owns its own sheet uses `FilterTrigger` with its own reading — same idiom, same silence at the default.
- `defaultOpen` renders the sheet open, for static boards.
- Do not add a kind whose surface does not exist yet — the same rule `BottomNav` keeps for slots.
