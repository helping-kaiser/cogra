The composer's text cursor, held still at the end of the words.

```jsx
<p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
  The glovebox camera earns its keep — this is the print from 2019.
  <Caret />
</p>
```

**It is what makes a drawn composer a composer.** A board is a photograph of a moment, and the moment worth drawing is mid-sentence. Without the caret the body reads as already said, and the screen becomes a preview of a finished reply instead of one being written.

**Decoration, not a control.** The shipped surfaces put a real `<textarea>` here and the platform draws its own blinking cursor wherever the insertion point actually is. This is the still frame of that: nothing focuses it, nothing announces it, and it takes no props.

**Inside the paragraph, after the last word.** It sits on `text-bottom` at one `body-large` line's height so it ends the sentence rather than floating past it. A caret on a line of its own is a loading bar, not a cursor.
