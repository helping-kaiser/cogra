Use `TextField` for every labeled input and, with `rows`, for every composer textarea.

```jsx
<TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
<TextField label="What do you want to publish?" rows={8} value={body} onChange={setBody} />
<TextField label="Type or paste the code to confirm" mono value={typed} onChange={setTyped} />
```

The label is always visible and always `label-large` — there is no floating-label or placeholder-as-label pattern in this product. The field sits on the **extra-small (4px)** rung with a 1px `outline` border and no fill. `mono` is only for content read character by character.

```jsx
<TextField label="Email" type="email" value={email} onChange={setEmail} error="That doesn't look like an email address." />
```

```jsx
<TextField label="Handle" value={handle} onChange={setHandle} hint="3–30 characters: a–z, 0–9, _" />
```

**Supporting text is one slot with two states**, Material 3's own arrangement. `hint` is the base: a body-small line in `text-secondary` under the field, saying what it will accept. `error` is that line in its error state — the 1px outline and the label switch to `--error` with it, and the message **replaces** the hint rather than joining it. Never pass both expecting two lines: the rule the reader broke is the rule they needed to read, and two lines under one input is where the eye stops knowing which is live. The message is always words (direction-by-words) — TextField renders it verbatim, no icon.
