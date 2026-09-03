Use `PasswordField` wherever a password is typed — login, reset, key ceremony.

```jsx
<PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
```

The toggle is the field's trailing `visibility` / `visibility_off` icon button on both platforms, with an `aria-label` of `Show password` / `Hide password` — the label says what the tap will do, not what is on screen.

```jsx
<PasswordField label="Password" value={password} onChange={setPassword} error="At least 12 characters." />
```

`error` mirrors TextField's Material 3 error state (this component duplicates TextField's markup rather than composing it): the outline and label switch to `--error`, and a body-small supporting line in `--error` renders below the field carrying the message verbatim.
