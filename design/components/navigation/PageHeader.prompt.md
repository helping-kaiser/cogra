Use `PageHeader` at the top of every surface. Tab roots pass a title only; drill-ins and task flows pass `backHref` and `backLabel` too.

```jsx
<PageHeader title="Feed" />
<PageHeader title="@ada" backHref="/feed" backLabel="Back to feed" action={<SettingsLink />} />
```

The back affordance is a link, never `history.back()`. Place it inside `CollapsingTop` on any surface that scrolls. The trailing action is always a text-variant control — never a filled button in the header.
