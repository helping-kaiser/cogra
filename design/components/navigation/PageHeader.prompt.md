Use `PageHeader` at the top of every surface. Tab roots pass a title only; drill-ins and task flows pass `backHref` and `backLabel` too.

```jsx
<PageHeader title="Feed" />
<PageHeader title="@ada" backHref="/feed" backLabel="Back to feed" action={<SettingsLink />} />
```

**On a read drill-in the arrow is history; in the entry funnel it is a link** (readme §4, *Navigation*). A post, a profile or a tag page sits as a layer over wherever the reader came from — a deep link included — and the arrow goes back there, to the exact state they left. `backLabel` names that place by the screen's origin-noun table (`Back to Saved`, `Back to the profile`, `Back to #saltmaps`), and `backHref` is the cold fallback: with no history behind the screen, the owning tab's root — Feed for a post, a comment or a profile, Explore for a tag — under that root's label. The entry funnel's screens are reached from outside the app with nothing beneath them, so there the arrow is a link to the board it names, never `history.back()`. The trailing action is always a text-variant control — never a filled button in the header.

**Whether it collapses is the surface's, not the header's.** Browse collapses, task pins: wrap it in `CollapsingTop` on a surface the reader dwells in and scrolls for content, and pin it — `position: sticky` on web — on a surface they are passing through to finish something. The readme's §4 table names every surface on both sides; read it rather than deciding per screen.
