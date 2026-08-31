Use `WizardHeader` on every composer-flow stage — the post wizard, the reply flow, the edits, the profile-picture flow. Never a bare `PageHeader` there: the wizard's two ways out are the point.

```jsx
<WizardHeader title="New post" action={<Button size="sm">Next</Button>} />
<WizardHeader title="What you sign" action={<>Last step <HelpDot ariaLabel="Signed actions"/></>} />
<WizardHeader title="Your picture" leaveLabel="Leave" action={<Button size="sm">Next</Button>} />
```

The semantics (jakob 2026-08-31, fixed):

- **The arrow steps one stage back**, never out of the flow — Details reaches crop with it, and the platform back gesture does the same thing.
- **The X leaves the whole flow, from any stage, draft kept — no confirmation.** Nothing is lost: every leave keeps the draft, and the draft prompt is the return surface. Without the X an author deep in the wizard was stuck backing out tap by tap.
- The seal's own `Back` pill is the same one-stage step the arrow is — a second, labeled way to say it on the last stage, not a third semantic.
- The X sits between the title and the stage's trailing controls, so the Next pill keeps the right edge wherever it is the primary action.
