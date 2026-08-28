Use `HelpDot` wherever a surface earns its one "?" — at most one per screen, top-right of the header or of the sheet/card it explains (the pads and the filter sheet carry their own).

```jsx
<PageHeader title="Cite something" action={<HelpDot ariaLabel="How searching works" />} />
```

- It opens a plain dialog: title, at most two short paragraphs, Close. The texts live in `guidelines/copy-voice.md` — reuse them verbatim, never improvise a variant.
- Never more than one per screen, and never as decoration on a control that already explains itself.
