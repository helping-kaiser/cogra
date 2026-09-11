The line between the wizard header and the tray on every pick board — what the step will take, and the way out of it.

```jsx
<PickPrompt
  caption="Pick one picture, several, or one video."
  escapeLabel="Write words instead"
  onEscape={goToWords}
/>
<PickTray count={3} onShowAll={openSheet}>…</PickTray>
```

**The escape belongs on this line.** An author who came for a photo and decided the words are the post leaves the media path here, at the moment they read what it wants. Not in the header — that X leaves the whole composer, and two ways out in one bar is where the reader stops knowing which is which. Not under the tray, where it is found only after failing to pick.

**It is `Button variant="text" size="sm"`** and stays quieter than anything in the tray below: picking is what the step is for, writing instead is offered without being urged. The caption is one sentence in `text-secondary`; it names what may be picked, never what has been.
