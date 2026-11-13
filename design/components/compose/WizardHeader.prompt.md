Use `WizardHeader` on every composer-flow stage — the post wizard, the reply flow, the edits, the profile-picture flow. Never a bare `PageHeader` there: the wizard's two ways out are the point.

```jsx
<WizardHeader title="New post" />
<WizardHeader title="What you sign" help="How signing works" />
<WizardHeader title="Your picture" leaveLabel="Leave" help="Changing your picture" />
<WizardHeader title="Edit comment" leaveLabel="Leave — the edit is discarded" help="Editing" />
```

The semantics (jakob 2026-08-31, fixed):

- **The arrow steps one stage back**, never out of the flow — Details reaches crop with it, and the platform back gesture does the same thing.
- **The X leaves the whole flow, from any stage.** Where a draft is kept, leaving keeps it and nothing asks; the reply wizard, the comment edit and the post edit keep none, so leaving them discards. `leaveLabel` says which of the two this X does. Without the X an author deep in the wizard was stuck backing out tap by tap.
- The seal's own `Back` — `SealFooter`'s — is the same one-stage step the arrow is, said again at the bottom where the thumb is. Not a third semantic.

**The forward action is not up here** (jakob 2026-09-01). Next and Sign live at the foot of the content column, so the top-right corner keeps one meaning for the whole flow; an author trained on a corner that once held Next will hit the X when it moves. The corner carries only passive things: `stageLabel` for a stage's name where one says more than the title (the seals carry none: `What you sign` and its commit already say it is the end, jakob 2026-11-12), `help` for the screen's one "?" — pass its aria-label, the words the dialog behind it explains. `help` alone draws a bare dot. Reach for the generic `action` slot only for something neither of those covers.
