Use `SegmentedFilter` where one list can be shown two to four ways and only one at a time.

```jsx
const [view, setView] = React.useState("posts");

<SegmentedFilter
  ariaLabel="Filter the chronicle"
  value={view}
  onChange={setView}
  options={[
    { value: "posts", label: "Posts" },
    { value: "comments", label: "Comments" },
    { value: "stances", label: "Stances" },
  ]}
/>
```

- **Selection is colour only** — `secondaryContainer` on the selected segment. No underline, no indicator pill, no weight change: a second signal on top of the fill reads as two states.
- **Never `primaryContainer`.** A filter is not the loudest thing on its screen, and the stance knob has already spent that surface.
- Labels are one or two words. A segment that needs a sentence is the wrong control; so is a fifth segment — that is chips.
- It filters; it does not navigate. If picking an option changes the surface rather than the list, use navigation.
- 48px targets, so it can sit directly under a page header without a spacer.
