Use `DescribeSheet` for writing a picture's description (alt text) — reached per picture from `DescribeCounter` and from the Show all sheet's Describe links. **Never from the crop step**: a geometry step is no place for a keyboard.

```jsx
<DescribeSheet open src={picture} value={text} onChange={setText} onClose={close} />
```

What holds:

- **Authored, optional, never invented** — the component rule (`MediaAttachment`) made enterable. A picture without a description is skipped by screen readers, not guessed at.
- The caption says what it is in one line ("Read aloud to people who can't see it, and shown if the picture can't load."); the "?" (copy-voice: *Describing pictures*) carries the rest.
- The preview shows the whole frame on the reserved surface; the field is the house `TextField` with the "Optional" corner.
