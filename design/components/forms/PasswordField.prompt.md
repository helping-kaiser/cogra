Use `PasswordField` wherever a password is typed — login, reset, key ceremony.

```jsx
<PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
```

The toggle is the field's trailing `visibility` / `visibility_off` icon button on both platforms, with an `aria-label` of `Show password` / `Hide password` — the label says what the tap will do, not what is on screen.

```jsx
<PasswordField label="Password" value={password} onChange={setPassword} error="At least 12 characters." />
```

`hint` and `error` mirror TextField's supporting-text slot (this component duplicates TextField's markup rather than composing it): one body-small line under the field — `text-secondary` for what the field will accept, `--error` for the message when it is refused, which also takes the outline and the label. The error replaces the hint; a field never carries both.
