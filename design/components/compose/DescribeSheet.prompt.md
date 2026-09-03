Use `DescribeSheet` for writing a picture's description (alt text) — reached per picture from `DescribeCounter` and from the Show all sheet's Describe links. **Never from the crop step**: a geometry step is no place for a keyboard.

```jsx
<DescribeSheet open src={picture} value={text} onChange={setText} onClose={close} />
```

What holds:

- **Authored, optional, never invented** — the component rule (`MediaAttachment`) made enterable. A picture without a description is skipped by screen readers, not guessed at.
- A permanent sub-line under the title says who the words are for ("Read aloud to people who can't see it.") on both shapes; the "?" (copy-voice: *Describing pictures*) carries the rest. `DescribeCounter` repeats it under the row that opens the sheet.
- `video` gives the clip's shape: "Describe the video", one entry for the whole clip, the preview wearing the play disc, the cover never offered.
- The preview shows the whole frame on the reserved surface; the field is the house `TextField` with the "Optional" corner.
