Use `CograBand` at the top of every tab root — the mark and wordmark on a 48px band. Inner surfaces (anything with a back arrow) wear `PageHeader` instead; the two never stack.

```jsx
<CograBand>
  <BorrowedViewBand handle="mira" displayName="Mira Voss" line="…" />
</CograBand>
```

Whatever rides the top region with it — the borrowed-view band, the APK line, a search field — goes in `children`, so the whole block stays one non-shrinking unit above the scrolling surface.
