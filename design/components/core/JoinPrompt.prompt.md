Use `JoinPrompt` when an anonymous reader taps something that needs an account — the compose action, the profile tab, a stance target. Never redirect them: the read stays where it was behind the scrim.

```jsx
<JoinPrompt open={prompting} onClose={() => setPrompting(false)} onSignIn={goToLogin} />
```

`DialogSurface` is the shared shell for every dialog in the product: `surfaceContainerHigh`, extra-large (28px) rung, 24px padding, scrim at 50%. **It owns the anatomy as well** (readme §11, *Dialogs*): pass `title`, `body` and `actions` and it lays them out by M3's dialog spec — the heading `headline-small`, the body `body-medium` on `--text-secondary` 16px under it, the actions at the default button size, end-aligned with the affirmative last, 24px under the body. Never hand-build a dialog's heading, body or button row.

```jsx
<DialogSurface
  onScrimPress={keep}
  title="Discard this reply?"
  body="Nothing is kept."
  actions={<><Button variant="text" onClick={discard}>Discard</Button><Button onClick={keep}>Keep writing</Button></>}
/>
```

**The scrim, Escape and Android's Back take the safe answer** — `onScrimPress` is cancel, keep, stay or close, never the destructive act. Focus moves into the dialog, stays inside it, and returns to what opened it (readme §10).

**It is centred at `--dialog-max-width` (20rem) and never closer to the screen edge than `--dialog-inset` (32px)** — a gap wider than the page's own 24px gutter, so the dialog's edges sit inside the column of text behind it and it reads as floating rather than as another block of page. `width` raises or lowers the max for a dialog that genuinely needs a different one; the inset holds regardless, and every dialog in the product today takes the default.

**The affirmative here is filled, not text.** Joining is the one committing action on this surface, and §6 gives the filled button to exactly that — two identically-weighted text buttons made "keep browsing" and "sign in" read as equal options, which they are not. `Keep browsing` stays a text button and stays first, so a reader who wants to be left alone is never nudged into signing by thumb position. It is still an ask: dismissing costs nothing and the read they were in the middle of is still behind it.

This is the one dialog whose affirmative is filled. A **destructive** dialog inverts it instead — the safe action takes the emphasis (see `SeveranceConfirm`).
