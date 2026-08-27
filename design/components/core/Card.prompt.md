Use `Card` for every raised region: a post in the feed, a status banner, a chronicle row, a form block that needs to sit off the page ground.

```jsx
<Card>
  <h2 className="text-title-medium">Your key isn't on this browser</h2>
  <p className="text-body-medium" style={{ color: "var(--text-secondary)" }}>
    Restore it with your recovery code to post, vouch, and act.
  </p>
  <Button size="sm" selfStart onClick={restore}>Restore the key</Button>
</Card>
```

It has no variants and takes no border, shadow, or outline — the fill is the affordance. Card headings are `title-medium`, card body `body-medium` on `--text-secondary`. Do not nest a card inside a card; step the container role instead.
