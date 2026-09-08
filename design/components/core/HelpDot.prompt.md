Use `HelpDot` wherever a surface earns its one "?" — at most one per screen, top-right of the header or of the sheet/card it explains (the pads and the filter sheet carry their own).

```jsx
<PageHeader title="Cite something" action={<HelpDot ariaLabel="How searching works" />} />
```

- **On a tonal panel it is `variant="inverse"`** — `Button`'s word for the same situation. The ring and the glyph take the panel's own `currentColor` instead of spending `--border-hairline` and `--primary` inside a block that already has a colour family. Use it only there.
- It opens a plain dialog: title, at most two short paragraphs, Close. The texts live in `guidelines/copy-voice.md` — reuse them verbatim, never improvise a variant.
- Never more than one per screen, and never as decoration on a control that already explains itself.
