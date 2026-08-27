Use `JoinPrompt` when an anonymous reader taps something that needs an account — the compose action, the profile tab, a stance target. Never redirect them: the read stays where it was behind the scrim.

```jsx
<JoinPrompt open={prompting} onClose={() => setPrompting(false)} onSignIn={goToLogin} />
```

`DialogSurface` is the shared shell for every dialog in the product: `surfaceContainerHigh`, extra-large (28px) rung, 24px padding, scrim at 50%. Dialog headings are `headline-small`, body `body-medium` on `--text-secondary`, actions right-aligned with the affirmative last.

**The affirmative here is filled, not text.** Joining is the one committing action on this surface, and §6 gives the filled button to exactly that — two identically-weighted text buttons made "keep browsing" and "sign in" read as equal options, which they are not. `Keep browsing` stays a text button and stays first, so a reader who wants to be left alone is never nudged into signing by thumb position. It is still an ask: dismissing costs nothing and the read they were in the middle of is still behind it.

This is the one dialog whose affirmative is filled. A **destructive** dialog inverts it instead — the safe action takes the emphasis (see `SeveranceConfirm`).
