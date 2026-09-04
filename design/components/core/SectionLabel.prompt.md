The quiet word that names a group on a sectioned surface.

```jsx
<SectionLabel>Recent</SectionLabel>
<SectionLabel>Posts you cited</SectionLabel>
```

**A caption, not a heading.** It carries no heading level and no weight beyond `label-small`: what it names is visible right under it, and the label's job is only to be findable while scanning past. A surface whose sections need real headings has outgrown this.

**It carries the screen gutter itself**, because it sits in the scroll column beside full-bleed rows that carry their own. Its padding is asymmetric on purpose — 12 above, 4 below — so it belongs to the group it opens instead of floating between two of them.

Do not reach for it as a form field's label: that is `TextField`'s own, and a composer field's caption is `ComposeFieldLabel`'s weight.
