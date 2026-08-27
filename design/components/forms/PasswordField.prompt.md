Use `PasswordField` wherever a password is typed — login, reset, key ceremony.

```jsx
<PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
```

The toggle is a text button reading `Show` / `Hide` with an `aria-label` of `Show password` / `Hide password`. On Android it is the field's trailing `visibility` / `visibility_off` icon; keep the words on web until the icon set is self-hosted.
