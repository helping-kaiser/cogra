Use `FeedFilter` at the top of any ranked listing — the feed, and later search results, which are the same list of ranked nodes.

```jsx
const [filter, setFilter] = React.useState(FEED_FILTER_DEFAULT);

<FeedFilter value={filter} onChange={setFilter} />
```

- **The trigger reads back the view in words** — "Posts, comments · newest". No glyph: there is no filter icon in the inlined set, §5 forbids drawing one, and an icon cannot tell you Newest is on.
- **The pill has a budget.** The kinds always show; once the exceptions stop fitting they collapse to a count — "Posts, comments · 3 changes". A pill that overflows has told the reader nothing, and "far from the default" is the fact that matters at that point.
- **Kinds combine, order does not.** Seven kinds of ranked content are chips; ranked-versus-newest is a two-option `SegmentedFilter`. Do not turn either into the other.
- **It applies live.** Every tap changes the feed behind the sheet. No Apply button — that asks the reader to commit to a guess about their own feed.
- **An empty filter is legal.** With no kinds selected the feed shows its empty state naming what is off; the chip does not refuse the tap.
- **"Also show" is not a warning.** Sensitive content arrives veiled, a removed record arrives as its skeleton. Neither takes `error` colouring here or anywhere.
- Do not add a kind whose surface does not exist yet — the same rule `BottomNav` keeps for slots.
