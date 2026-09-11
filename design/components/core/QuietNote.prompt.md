The small true line about the surface the reader is standing on. Use it for every one of them.

```jsx
<QuietNote>Your comment on "The long way home".</QuietNote>
<QuietNote>Drag to move, pinch to zoom.</QuietNote>
<QuietNote>Words first — pictures can join them, and they upload while you write.</QuietNote>
```

**It never asks for anything.** A note states a fact on the way past — what the surface is, how it works, what a gesture does. The moment a line needs the reader to act it stops being a note: that is a button, a `hint` under a `TextField`, or `UploadErrorLine`. Never colour one `--error`.

**It owns no spacing.** `margin` is zeroed and the column it sits in owns the gap, so the note stays with whatever it describes. If a board needs the line centred, padded, or inline in a row, that is the board's own layout and it writes its own — do not add a prop here, or this becomes where layout decisions get made.

Distinct from `SectionLabel`, which is the same size but names a group underneath it rather than describing the surface.
