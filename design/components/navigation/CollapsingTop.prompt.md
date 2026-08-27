Wrap the `PageHeader` — and any must-act banner that has to follow the reader, like the key-restore card or the guest notice — in `CollapsingTop`.

```jsx
<CollapsingTop>
  <PageHeader title="Feed" />
  {keyMissing && <RestoreCard />}
  {signedOut && <GuestBanner />}
</CollapsingTop>
```

It hides only once half its own slot has scrolled past, and returns only after about a third of a screen of accumulated upward scroll — never on the first upward pixel. Ordinary content banners do **not** go in here; they scroll away with the flow.
