Use `PageHeader` at the top of every surface. Tab roots pass a title only; drill-ins and task flows pass `backHref` and `backLabel` too.

```jsx
<PageHeader title="Feed" />
<PageHeader title="@ada" backHref="/feed" backLabel="Back to feed" action={<SettingsLink />} />
```

The back affordance is a link, never `history.back()`. The trailing action is always a text-variant control — never a filled button in the header.

**Whether it collapses is the surface's, not the header's.** Browse collapses, task pins: wrap it in `CollapsingTop` on a surface the reader dwells in and scrolls for content, and pin it — `position: sticky` on web — on a surface they are passing through to finish something. The readme's §4 table names every surface on both sides; read it rather than deciding per screen.
