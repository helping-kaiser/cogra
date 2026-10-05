Use `TextField` for every labeled input and, with `rows`, for every composer textarea.

```jsx
<TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
<TextField label="What do you want to publish?" rows={8} value={body} onChange={setBody} />
<TextField label="Type or paste the code to confirm" mono value={typed} onChange={setTyped} />
```

**`rows` is a minimum, and a multi-line field grows.** A field given `rows` opens at that many lines and takes another whenever the writing needs one — `rows={1}` is a field that starts as one line and grows, which is what the comment composer and the sensitive sheet's reason are. A sheet holding such a field is content-sized and grows with it up to the **tallest-sheet ceiling** (`BottomSheet`), and from there the field scrolls inside itself while the Done row stays in reach. Never state a maximum in lines: the bound is viewport minus chrome, so the same rule holds on both platforms and neither caps the growth at a line count. A sheet already pinned at the ceiling gives the field its room out of the list above it (the comments thread). Boards draw the minimum — growth is behaviour, and a drawing is one state.

**What each field asks of the keyboard** (the K13 round, ruled). A field's `kind` decides its keyboard, capitalization, correction and autofill — `FIELD_KINDS` is the table both clients read; `type="email"` and `mono` name their kinds, and a field with neither is prose. The Android names are `KeyboardOptions` and Compose's autofill `ContentType`.

| Kind | Fields | Keyboard (web · Android) | Caps | Autocorrect | Autofill (web · Android) |
|---|---|---|---|---|---|
| `prose` | Title, Description, Words, Bio, Why?, What happened | `text` · `Text` | sentences | on | off · none |
| `name` | Display name | `text` · `Text` | words | off | off · none |
| `email` | Email, New email | `email` · `Email` | none | off | `email` · `EmailAddress` — `username` · `Username` on a credential form |
| `handle` | Handle, New handle | `text` · `Ascii` | none | off | `nickname` · none — never `username` |
| `url` | Invite link, Website | `url` keyboard (type stays `text`) · `Uri` | none | off | off, `url` on Website · none |
| `code` (= `mono`) | Recovery code, Current recovery code | `text` · `Ascii` | characters | off | `one-time-code` · `SmsOtpCode` |
| `digits` (drawn `mono`) | Confirmation code — the email change's 6-digit single-use code | `numeric` · `Number` | none | off | `one-time-code` · `SmsOtpCode` |
| password (`PasswordField`) | Password, Current password, New password | password · `Password` | none | off | `current-password` / `new-password` · `Password` / `NewPassword` |

**The return key follows the form, not the kind.** A single-line field reads `next` (`ImeAction.Next`) while another field follows it; the form's last one passes `enterKeyHint="go"` (`ImeAction.Go`) and submits as the form's commit does — HTML's implicit submission — never while the commit is disabled. A multi-line field's Enter is a new line, on a soft keyboard and a hardware one alike, and never submits.

**Arrival focus, one line per composer** (the K13 round). A stage that is one field opens with it focused and the keyboard up; a stage of several fields lands focus on its title (readme §10) and the keyboard waits for the reader's tap.

| Composer | On arrival |
|---|---|
| `ComposeWords`, `EditWords` — the words stage | the body, caret at its end, keyboard up |
| `ReplyCompose` — the reply | the body, keyboard up |
| `TagPicker` — Add a tag | the name field, keyboard up |
| `ReferencePicker` — Cite something | the search field, keyboard up |
| `ComposeDetails`, `EditCompose`, `CommentEdit`, `ProfileEdit` | the title; no keyboard until a field is tapped |

The label is always visible and always `label-large` — there is no floating-label or placeholder-as-label pattern in this product. The field sits on the **extra-small (4px)** rung with a 1px `outline` border and no fill. `mono` is only for content read character by character.

```jsx
<TextField label="Email" type="email" value={email} onChange={setEmail} error="That doesn't look like an email address." />
```

```jsx
<TextField label="Handle" value={handle} onChange={setHandle} hint="3–30 characters: a–z, 0–9, _" />
```

`FieldLabel` is that label row on its own, for a composer caption whose section is a tray or a list rather than an input — Pictures, Video, Cover, Topics, References. `TextField` renders the same component over its own field, so the two can never drift apart.

```jsx
<FieldLabel>Tags</FieldLabel>
```

Pass no `htmlFor` there and it renders a `span`: a `<label>` with no `for` names nothing (HTML Living Standard §4.10.4), and a topic tray is not a labelable control. A caption whose section **is** a field belongs in `TextField`'s `label` and `corner` instead — never a `FieldLabel` above a bare input.

**Supporting text is one slot with two states**, Material 3's own arrangement. `hint` is the base: a body-small line in `text-secondary` under the field, saying what it will accept. `error` is that line in its error state — the 1px outline and the label switch to `--error` with it, and the message **replaces** the hint rather than joining it. Never pass both expecting two lines: the rule the reader broke is the rule they needed to read, and two lines under one input is where the eye stops knowing which is live. The message is always words (direction-by-words) — TextField renders it verbatim, no icon.

**A capped field says nothing until the writer is near the cap.** Pass `cap` and the field carries the late counter: silent while there is room, then a quiet remaining count at the end of the supporting row, `--error` once it is past.

```jsx
<TextField label="Title" corner="Optional" cap={100} value={title} onChange={setTitle} />
<TextField label="Description" corner="Optional" rows={3} cap={500} value={description} error="A description is at most 500 characters." />
```

The count appears once `remaining <= max(20, round(cap / 10))` — the last tenth, never fewer than the last 20 — and it counts **Unicode scalar values**, the unit every ruled cap is stated in, never `.length`. It is never persistent and never a meter. The count sits at the end of the same row as the supporting line (M3's own arrangement) and does not disturb that slot's two states. Over the cap the atom colours the count and the **board** words the message: a field error is worded per field and per surface. A field drawn as the tail of a longer body passes `used` for the whole length; everything else is counted from `value`. `FieldCount` is the same reading on its own, for a field that is not a `TextField`.

**The line is wired to the field, and errors announce.** The supporting line carries an id the control names in `aria-describedby`, so it is read with the field instead of sitting beside it; in the error state the control adds `aria-invalid` and the line takes `role="alert"`, which is how a message that answers what the reader just did reaches someone who has already moved on. Uniform across every field — the caller passes `error` and gets all of it. Nothing here draws a pixel.
