Use `WizardHeader` on every composer-flow stage — the post wizard, the reply flow, the edits, the profile-picture flow. Never a bare `PageHeader` there: the wizard's two ways out are the point.

```jsx
<WizardHeader title="New post" />
<WizardHeader title="What you sign" stageLabel="Last step" help="Signed actions" />
<WizardHeader title="Your picture" leaveLabel="Leave" stageLabel="Last step" help="Changing your picture" />
<WizardHeader title="Edit comment" leaveLabel="Leave — the edit is discarded" help="Editing" />
```

The semantics (jakob 2026-08-31, fixed):

- **The arrow steps one stage back**, never out of the flow — Details reaches crop with it, and the platform back gesture does the same thing.
- **The X leaves the whole flow, from any stage.** Where a draft is kept, leaving keeps it and nothing asks; the reply wizard and comment edit keep none, so leaving them discards. `leaveLabel` says which of the two this X does. Without the X an author deep in the wizard was stuck backing out tap by tap.
- The seal's own `Back` — `SealFooter`'s — is the same one-stage step the arrow is, said again at the bottom where the thumb is. Not a third semantic.

**The forward action is not up here** (jakob 2026-09-01). Next and Sign live at the foot of the content column, so the top-right corner keeps one meaning for the whole flow; an author trained on a corner that once held Next will hit the X when it moves. The corner carries only passive things: `stageLabel` for the stage's name, `help` for the screen's one "?" — pass its aria-label, the words the dialog behind it explains. Both together draw the seal's familiar pair; `help` alone draws a bare dot, which is what the edits want. Reach for the generic `action` slot only for something neither of those covers.
