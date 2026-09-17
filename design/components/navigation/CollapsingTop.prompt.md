Wrap the `PageHeader` — and any must-act banner that has to follow the reader, like the key-restore card or the guest notice — in `CollapsingTop`, **on the surfaces that collapse**.

Which those are is ruled per surface, not per screen: browse collapses, task pins, and the readme's §4 table names both sides. A surface the reader dwells in and scrolls for content wraps its top in here; a surface they are passing through to finish something pins it instead, `position: sticky` on web. Web adopts this component on the collapsing surfaces too, so a scroll is answered the same way on both platforms.

```jsx
<CollapsingTop>
  <PageHeader title="Feed" />
  {keyMissing && <RestoreCard />}
  {signedOut && <GuestBanner />}
</CollapsingTop>
```

It hides only once half its own slot has scrolled past, and returns only after about a third of a screen of accumulated upward scroll — never on the first upward pixel. Ordinary content banners do **not** go in here; they scroll away with the flow.
