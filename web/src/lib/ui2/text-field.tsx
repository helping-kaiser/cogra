// The 2.0 text field, as the details screen draws it: a `label-large` label
// with an "Optional" note pushed to the far end of the same line, then the
// field itself — 1px `outline` border at the extra-small (4px) rung, 10px/12px
// padding, `body-large` for the value.
//
// Two shapes, one component: a single line and a multi-line box, because the
// canvas draws them identically apart from height. Material's floating label is
// deliberately not used — the canvas puts the label above the box, which keeps
// the "Optional" note readable and stops the label from covering the value.

import { useId, type ReactNode } from "react";

/**
 * The box itself, without the label above it.
 *
 * Exported because one composer draws its own: the reply's words are the
 * screen and carry no label (the target sits above them and names what is
 * being answered — `ReplyCompose`), but the BOX is not theirs to redraw. The
 * master's own note about the same escape hatch,
 * `design/designs/canonical/screens/ComposeWords.jsx:7-13`: spell the box "at
 * `TextField`'s own values" rather than invent one, and never drop it —
 * a borderless field says nothing about where the writing goes.
 */
export const FIELD_BOX =
  "cg-focus box-border w-full rounded-extra-small border border-outline bg-transparent px-3 py-2.5 text-body-large text-on-surface placeholder:text-on-surface-variant disabled:opacity-[var(--state-disabled)]";

const FIELD = FIELD_BOX;

/**
 * THE GROWTH LAW, AS A BOX (jakob 2026-09-22).
 *
 * A multi-line field takes a line per line written and stops at the room its
 * sheet has left, from where the words scroll INSIDE the box — so nothing
 * below it, least of all Done, is ever pushed off the screen. A fixed `rows`
 * box is the cap this replaces: it never grew, so a description longer than
 * its three lines was written through a slot.
 *
 * NO MEASUREMENT AND NO EFFECT. The box is a one-cell grid holding the
 * textarea and an invisible replica of the same words in the same font; the
 * cell is as tall as the taller of the two, which IS the text's height, and
 * the browser recomputes it on every keystroke without React hearing about
 * it. The trailing newline is what keeps the replica a line ahead when the
 * writer ends on one, so the box grows as the caret does. `rows` stays the
 * MINIMUM — the drawn line count a field starts at.
 *
 * WHERE THE MAXIMUM COMES FROM: nowhere in here. The box shrinks (`min-h-0`,
 * and flex's own `flex-shrink: 1`) while everything the sheet stacks around
 * it does not, so the room left over IS the cap — derived by the layout, the
 * same way Android's `weight(1f, fill = false)` derives it.
 */
export const GROWING_FIELD =
  "col-start-1 row-start-1 resize-none overflow-hidden border-0 bg-transparent p-0 [font:inherit] text-on-surface outline-none placeholder:text-on-surface-variant";

/**
 * What the box draws AROUND its lines: `py-2.5` on both edges (0.625rem
 * each, so 1.25rem) and the 1px border on both (2px), as FIELD spells them.
 * It is written out once here because the floor below is a `min-height` and
 * FIELD is a border box — a floor of N lines that did not clear the chrome
 * would land inside the text instead of under it. Summed rather than left as
 * `0.625rem * 2` because that is how a style declaration serialises, and a
 * constant that does not read back as it was written is one a test has to
 * spell a second way.
 */
const FIELD_CHROME = "calc(1.25rem + 2px)";

function GrowingBox({
  value,
  minRows,
  disabled,
  children,
}: {
  value: string;
  minRows: number;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="growing-box"
      data-min-rows={minRows}
      // `rows` IS THE MINIMUM, AND THE LAYOUT HAS TO SAY SO (jakob's
      // round-three hand test, 2026-09-22). `minRows` reached this box as a
      // data attribute and nothing else, so the floor existed only in the
      // prose above: the box is a scroll container, which makes its automatic
      // minimum size zero (CSS Flexbox §4.5 — the `min-height: auto` floor
      // applies only where `overflow` is `visible`), and `min-h-0` says the
      // same thing again. Measured in chromium against the deployed
      // stylesheet, a sheet with no room left shrank this box to a 20px
      // window inside a 24px line — a field drawn UNDER one line, which is
      // the "it never grows, the words just scroll" reading. The floor is a
      // style rather than a class because `minRows` is a prop and Tailwind
      // scans source TEXT for class names, the same reason `SHEET_CEILING`
      // is a style (`bottom-sheet.tsx:52-57`).
      //
      // The cap above it is untouched: the box still shrinks from its grown
      // height down to this line, and the words still scroll INSIDE it.
      //
      // `lh` is the line-height as an absolute length (MDN, CSS `<length>`),
      // so the floor follows whichever type role the box reads instead of
      // restating its leading. An engine too old to know the unit drops the
      // whole `calc()` and lands back on today's behaviour — the floor is the
      // enhancement, never what the field depends on to draw.
      style={{ minHeight: `calc(${minRows}lh + ${FIELD_CHROME})` }}
      // The ring belongs to the drawn box, and the box is now this wrapper
      // rather than the control inside it — `cg-focus-within` is the same
      // ring, taken from the edge the reader sees. The dimming moves with it
      // for the same reason: `disabled:` is a state of the CONTROL, and the
      // control is no longer what carries the border (the sensitive sheet's
      // reason is greyed out until its mark is on).
      className={`${FIELD} cg-focus-within grid min-h-0 overflow-y-auto ${
        disabled ? "opacity-[var(--state-disabled)]" : ""
      }`}
    >
      <span
        aria-hidden="true"
        data-testid="growing-box-replica"
        className="col-start-1 row-start-1 invisible break-words whitespace-pre-wrap [font:inherit]"
      >
        {`${value}\n`}
      </span>
      {children}
    </div>
  );
}

/**
 * THE LATE COUNTER (jakob's ruling, the caps-affordance round,
 * `design/components/forms/TextField.jsx:32-93`). A capped field says
 * nothing about its cap until the writer is within the last tenth of it,
 * never fewer than the last 20 scalar values — the count appears at
 * `remaining <= max(20, round(cap / 10))`, reads "N left" while there is
 * still room and "N over" past it. The unit is the Unicode scalar value
 * (`[...string]`), which is what the write side's own caps count in and
 * what `.length`'s UTF-16 code units are not — an emoji would otherwise
 * read as spent twice.
 *
 * `used` overrides the arithmetic for a fixture that draws only a tail of a
 * longer value; every live field passes nothing and is counted whole.
 */
const COUNT_WINDOW_MINIMUM = 20;

export type FieldCountReading = { text: string; over: boolean };

export function countReading(
  value: string,
  cap?: number,
  used?: number,
): FieldCountReading | null {
  if (!cap) return null;
  const spent = used ?? [...String(value ?? "")].length;
  const remaining = cap - spent;
  if (remaining > Math.max(COUNT_WINDOW_MINIMUM, Math.round(cap / 10))) return null;
  return remaining < 0 ? { text: `${-remaining} over`, over: true } : { text: `${remaining} left`, over: false };
}

/**
 * The count itself — a third element in the supporting row, not a third
 * state of it (`FieldSupport`'s own note): `hint`/`error` keep their two
 * states untouched and this sits beside whichever is live, pushed to the
 * row's far end so it reads beside a short error or alone under an empty
 * one. `aria-live="polite"` because it answers something the writer just
 * did — the field's own error line is what takes the assertive `alert`.
 *
 * Exported so a capped field that is NOT this `TextField` — the composer's
 * growing body box — draws the same geometry instead of its own
 * (`design/components/forms/TextField.jsx:117-122`).
 */
export function FieldCount({
  id,
  value,
  cap,
  used,
}: {
  id?: string;
  value: string;
  cap?: number;
  used?: number;
}) {
  const reading = countReading(value, cap, used);
  if (!reading) return null;
  return (
    <span
      id={id}
      aria-live="polite"
      className={`ml-auto flex-none whitespace-nowrap text-body-small ${
        reading.over ? "text-error" : "text-on-surface-variant"
      }`}
    >
      {reading.text}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  testId,
  optional = false,
  optionalLabel = "Optional",
  placeholder,
  disabled = false,
  // A description takes the taller box; a title takes the single line.
  multiline = false,
  rows = 3,
  cap,
  used,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  testId: string;
  optional?: boolean;
  optionalLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  /** The line count the box STARTS at — its minimum, never its cap. */
  rows?: number;
  /** The field's ruled length cap, in Unicode scalar values — drives the late counter. */
  cap?: number;
  /** Overrides the counter's own count, for a fixture drawing only a tail of the value. */
  used?: number;
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const reading = countReading(value, cap, used);
  const described =
    [error ? errorId : null, reading ? countId : null].filter(Boolean).join(" ") || undefined;

  return (
    // `min-h-0` on the field and `flex-none` on the rows around it is the
    // growth law in miniature: when the sheet runs out of room it is the BOX
    // that yields, never the label or the line that says what is wrong.
    <div className="flex min-h-0 flex-col gap-1">
      <div className="flex flex-none items-baseline gap-2">
        <label htmlFor={id} className="flex-1 text-label-large text-on-surface">
          {label}
        </label>
        {optional && (
          // Some corners say more than "Optional" — where the words land is
          // what makes them worth writing (the sensitive sheet's reason).
          <span className="text-body-small text-on-surface-variant">{optionalLabel}</span>
        )}
      </div>
      {multiline ? (
        <GrowingBox value={value} minRows={rows} disabled={disabled}>
          <textarea
            id={id}
            data-testid={testId}
            value={value}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
            onChange={(event) => onChange(event.target.value)}
            className={GROWING_FIELD}
          />
        </GrowingBox>
      ) : (
        <input
          id={id}
          data-testid={testId}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} min-h-11`}
        />
      )}
      {/* `error` is the one place the failure role is spent. A validation
          message is a failure; nothing else on this surface is. The count
          is a third element in this row, never a third state of it — it
          sits beside whichever of hint/error is live, or alone. */}
      {(error || reading) && (
        <div className="flex flex-none items-baseline gap-2">
          {error && (
            <span id={errorId} role="alert" className="text-body-small text-error">
              {error}
            </span>
          )}
          <FieldCount id={countId} value={value} cap={cap} used={used} />
        </div>
      )}
    </div>
  );
}
