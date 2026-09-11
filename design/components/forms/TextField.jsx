import React from "react";

/* The house labeled text input. `label-large` label above a field on the
   EXTRA-SMALL rung (4px) — Material's text-field corner — with a 1px `outline`
   border and a transparent fill. `mono` dresses codes and identifiers in the
   platform monospace: the one exception to Figtree (design.md §3), a legibility
   device for strings read character by character.

   SUPPORTING TEXT IS ONE SLOT WITH TWO STATES, which is Material 3's own
   arrangement rather than two independent lines. `hint` is the base: the
   body-small line in `--text-secondary` that says what the field will accept
   ("3–30 characters: a–z, 0–9, _"). `error` is that same line in its error
   state — the outline and the label switch to `--error` with it, and the
   message replaces the hint rather than joining it. A field never carries both
   at once: the rule the reader broke is the rule they needed to read, and two
   lines under one input is where the eye stops knowing which one is live.

   The message is always words (direction-by-words) — this component renders it
   verbatim, no icon.

   THE SUPPORTING LINE IS WIRED TO THE FIELD (jakob's ruling, the slice-2.5
   round), the way the W3C's own forms tutorial wires one: the line carries an
   id and the control names it in `aria-describedby`, so the rule a field will
   accept is read out with the field rather than sitting beside it unreachable.
   In the error state the control adds `aria-invalid` (WCAG technique ARIA21)
   and the line takes `role="alert"`, because a message that appears in answer
   to something the reader just did has to announce itself — a screen reader
   that has moved on never comes back to look. Announcing is uniform: every
   field error, not a judgement per field about which ones would be noticed
   anyway. None of it draws a pixel. */

/* THE LATE COUNTER (jakob's ruling, the caps-affordance round). A capped field
   says NOTHING about its cap while the writer is nowhere near it, and then a
   quiet remaining count appears at the end of the supporting row. It is not a
   persistent counter and it is never a meter: a number that sits under an empty
   field all day turns the act of writing into a budget, and a bar turns a
   sentence into a progress indicator. What the writer needs is a warning in
   time to finish the thought — nothing before that is information, it is
   pressure.

   THE THRESHOLD IS THE LAST TENTH, NEVER FEWER THAN THE LAST 20. The count
   appears once `remaining <= max(20, round(cap / 10))`. The tenth is what makes
   the warning proportional — 500 characters of description warn at 450, 5,000
   of a body at 4,500 — and the floor of 20 is what keeps a short cap from
   warning too late to act on: a tenth of the 50-character display name is five,
   which arrives after the writer has already written the word that will be cut.
   Both halves are drawn in the round: the title (100 → window 20) and the
   display name (50 → window 20) are floor-driven, the description (500 → 50)
   and the body (5,000 → 500) are tenth-driven.

   THE UNIT IS THE UNICODE SCALAR VALUE, which is what every one of the ruled
   caps counts in, and what `[...string]` iterates — never `.length`, which
   counts UTF-16 code units and would tell a writer of emoji or of anything
   outside the BMP that they had spent twice what they had.

   IT IS A THIRD ELEMENT IN THE SUPPORTING ROW, NOT A THIRD STATE OF THE
   SUPPORTING SLOT. Material 3's text field puts supporting text at the start of
   the row under the field and the character count at its end; the slot's own
   two states (hint, error) are untouched by this, and the count sits beside
   whichever one is live. The count is the only thing in the product allowed to
   share that row.

   OVER THE CAP THE COUNT TAKES `--error`, AND THE MESSAGE IS THE SURFACE'S.
   `FieldCount` colours itself from the arithmetic, because the arithmetic is
   the atom's; the words under the field are the board's own `error`, because a
   field error is worded per field and per surface (copy-voice, *Field errors*)
   and an atom that wrote them would flatten "A title is at most 100 characters."
   into one house sentence for every field in the product.

   A SCREEN READER IS TOLD POLITELY, ONCE IT MATTERS. The count carries
   `aria-live="polite"` and joins the field's `aria-describedby`: it appears in
   answer to typing, so a reader who has moved on would otherwise never learn it
   exists, and polite is the right register because the count is never the whole
   message — the error line above it is what takes `role="alert"`. The
   implementation debounces the live region (a count read out on every keystroke
   is unusable); the drawing cannot show a debounce, so it is stated here.

   `used` OVERRIDES THE ARITHMETIC FOR A FIELD DRAWN AS A TAIL. A board showing
   the last fifteen lines of a 5,000-character body cannot carry the other four
   thousand in its fixture, and a count computed from what is drawn would then
   be a lie about what is written. Such a board passes `used` — the whole
   length — and the drawn paragraphs stay the visible tail. Every field whose
   fixture IS its whole content passes nothing and is counted. */

const COUNT_WINDOW_MINIMUM = 20;

function countReading(value, cap, used) {
  if (!cap) return null;
  const spent = used ?? [...String(value ?? "")].length;
  const remaining = cap - spent;
  if (remaining > Math.max(COUNT_WINDOW_MINIMUM, Math.round(cap / 10))) return null;
  return remaining < 0 ? { text: `${-remaining} over`, over: true } : { text: `${remaining} left`, over: false };
}

export function FieldCount({ value, cap, used, id }) {
  const reading = countReading(value, cap, used);
  if (!reading) return null;
  return (
    <span
      id={id}
      aria-live="polite"
      style={{
        marginInlineStart: "auto",
        flex: "none",
        whiteSpace: "nowrap",
        fontSize: "var(--text-body-small)",
        lineHeight: "var(--text-body-small--line-height)",
        letterSpacing: "var(--text-body-small--letter-spacing)",
        color: reading.over ? "var(--error)" : "var(--text-secondary)",
      }}
    >
      {reading.text}
    </span>
  );
}

/* THE SUPPORTING ROW, ASSIGNED ONCE — `FieldLabel`'s counterpart under the
   field. `TextField` renders it for its own field, and a capped field that is
   NOT a `TextField` (the composer's growing body box) renders it directly, so
   the two cannot drift about where the message sits or where the count sits
   beside it. It renders nothing at all when there is nothing to say, which is
   the state every field in the product is in at rest. */

export function FieldSupport({ id, countId, hint, error, value, cap, used }) {
  const reading = countReading(value, cap, used);
  if (!error && !hint && !reading) return null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flex: "none" }}>
      {(error || hint) && (
        <span
          id={id}
          role={error ? "alert" : undefined}
          style={{
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: error ? "var(--error)" : "var(--text-secondary)",
          }}
        >
          {error || hint}
        </span>
      )}
      <FieldCount id={countId} value={value} cap={cap} used={used} />
    </div>
  );
}

/* THE LABEL ROW, ASSIGNED ONCE. `TextField` renders it over its own field, and
   the composer's captions over sections that are NOT fields — Pictures, Video,
   Cover, Topics, References — render it over a tray or a list. Those captions
   have always been dressed as field labels; assigning that anatomy here is what
   keeps them from drifting apart. A caption whose section IS a field belongs in
   `TextField`'s `label` and `corner` instead, and every one of them is written
   that way.

   `htmlFor` CHOOSES THE ELEMENT. With one, the word names a control and the row
   is a `<label>`. Without one there is no control to name, so it is a `<span>`:
   a `<label>` with no `for` is a label in name only (HTML Living Standard
   §4.10.4), and a topic tray is not a labelable control. */

export function FieldLabel({ children, htmlFor, corner, error }) {
  const Name = htmlFor ? "label" : "span";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
      <Name
        htmlFor={htmlFor}
        style={{
          flex: 1,
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
          fontWeight: "var(--text-label-large--font-weight)",
          color: error ? "var(--error)" : undefined,
        }}
      >
        {children}
      </Name>
      {/* The corner word — "Optional" on the details fields. A quiet fact
          beside the label, never inside it, so the label stays the name. */}
      {corner && (
        <span
          style={{
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            color: "var(--text-secondary)",
          }}
        >
          {corner}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  corner,
  value,
  onChange,
  type = "text",
  autoComplete,
  mono = false,
  placeholder,
  rows,
  id,
  hint,
  error,
  cap,
  used,
}) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const supportId = `${fieldId}-support`;
  const countId = `${fieldId}-count`;
  const reading = countReading(value, cap, used);
  const described = [error || hint ? supportId : null, reading ? countId : null].filter(Boolean).join(" ") || undefined;
  const shared = {
    borderRadius: "var(--radius-extra-small)",
    border: error ? "1px solid var(--error)" : "1px solid var(--border-field)",
    background: "transparent",
    color: "var(--on-surface)",
    padding: rows ? "8px" : "8px 12px",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: "var(--text-body-large)",
    lineHeight: "var(--text-body-large--line-height)",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  };
  return (
    // A REPLACED ELEMENT CANNOT HOST THE FLOW BADGE'S ::after (shell.mjs) — an
    // <input>/<textarea> paints nothing for a `data-flow` it carries directly,
    // so the badge belongs on the field as a whole instead. `data-field` names
    // that whole for flow-markers.mjs to find and stamp (jakob's ruling A9,
    // backlog item 40), the same way `data-axis` lets it stamp `LicenseAxis`'s
    // row rather than its own hidden radio.
    <div data-field={label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <FieldLabel htmlFor={fieldId} corner={corner} error={error}>
        {label}
      </FieldLabel>
      {rows ? (
        <textarea
          id={fieldId}
          rows={rows}
          value={value}
          placeholder={placeholder}
          aria-describedby={described}
          aria-invalid={error ? "true" : undefined}
          onChange={(event) => onChange && onChange(event.target.value)}
          style={shared}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-describedby={described}
          aria-invalid={error ? "true" : undefined}
          onChange={(event) => onChange && onChange(event.target.value)}
          style={shared}
        />
      )}
      <FieldSupport id={supportId} countId={countId} hint={hint} error={error} value={value} cap={cap} used={used} />
    </div>
  );
}
