The line between the wizard header and the tray on every pick board — the way out of the media path, and, where a step needs one, a caption.

```jsx
<PickPrompt
  escapeLabel="Write words instead"
  onEscape={goToWords}
/>
<PickTray count={3} onShowAll={openSheet}>…</PickTray>
```

**The escape belongs on this line.** An author who came for a photo and decided the words are the post leaves the media path here, at the moment they read what it wants. Not in the header — that X leaves the whole composer, and two ways out in one bar is where the reader stops knowing which is which. Not under the tray, where it is found only after failing to pick.

**It is `Button variant="text" size="sm"`** and stays quieter than anything in the tray below: picking is what the step is for, writing instead is offered without being urged. The caption, where a step passes one, is one sentence in `text-secondary`; the pick steps pass none, because the roll is the instruction (jakob 2026-11-12), and the escape keeps the row's end alone.
