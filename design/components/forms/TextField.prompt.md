Use `TextField` for every labeled input and, with `rows`, for every composer textarea.

```jsx
<TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
<TextField label="What do you want to publish?" rows={8} value={body} onChange={setBody} />
<TextField label="Type or paste the code to confirm" mono value={typed} onChange={setTyped} />
```

The label is always visible and always `label-large` — there is no floating-label or placeholder-as-label pattern in this product. The field sits on the **extra-small (4px)** rung with a 1px `outline` border and no fill. `mono` is only for content read character by character.
