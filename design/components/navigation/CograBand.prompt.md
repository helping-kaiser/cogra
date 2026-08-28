Use `CograBand` at the top of every tab root — the mark and wordmark on a 48px band. Inner surfaces (anything with a back arrow) wear `PageHeader` instead; the two never stack.

```jsx
<CograBand trailing={<FeedFilter value={filter} onChange={setFilter} />}>
  <BorrowedViewBand handle="mira" displayName="Mira Voss" line="…" />
</CograBand>
```

Whatever rides the top region with it — the borrowed-view band, the APK line, a search field — goes in `children`, so the whole block stays one non-shrinking unit above the scrolling surface.

`trailing` is the band's right edge: the tab's one working control (on feed views, the filter trigger — every feed view wears it, guests included). The band never spends its full width on identity alone, and the whole band scrolls away and returns as one, control included.
