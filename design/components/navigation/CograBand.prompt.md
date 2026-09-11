Use `CograBand` at the top of every tab root — the mark and wordmark on a 48px band. Inner surfaces (anything with a back arrow) wear `PageHeader` instead; the two never stack.

```jsx
<CograBand unread trailing={<FeedFilter value={filter} onChange={setFilter} />}>
  <BorrowedViewBand handle="mira" displayName="Mira Voss" line="…" />
</CograBand>
```

Whatever rides the top region with it — the borrowed-view band, the APK line, a search field — goes in `children`, so the whole block stays one non-shrinking unit above the scrolling surface.

The right edge carries three things in one order, everywhere: `trailing` — the tab's one working control (on feed views, the filter trigger; on your own profile, the gear) — then chats, then the bell. The two the shell owns keep the same two corners on every root; the one that changes per screen is the one that moves inboard. A ⋮ never rides the band: a page's overflow belongs in that page's own row of controls. The band never spends its full width on identity alone, and the whole band scrolls away and returns as one, controls included.

`bell={false}` where nothing can be addressed to the reader: the guest and borrowed-view boards. `unread` lights the bell's quiet dot and says so in its accessible name — never a count, and it clears when the list opens.

`BandIcon` is that icon-control's shape, exported for the clusters a screen builds itself. 40px of ink, 48px of target through `cg-hit` — reach for it instead of a hand-rolled button.
