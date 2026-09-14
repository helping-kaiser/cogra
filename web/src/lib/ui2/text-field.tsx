// The 2.0 text field, as the details screen draws it: a `label-large` label
// with an "Optional" note pushed to the far end of the same line, then the
// field itself — 1px `outline` border at the extra-small (4px) rung, 10px/12px
// padding, `body-large` for the value.
//
// Two shapes, one component: a single line and a multi-line box, because the
// canvas draws them identically apart from height. Material's floating label is
// deliberately not used — the canvas puts the label above the box, which keeps
// the "Optional" note readable and stops the label from covering the value.

import { useId } from "react";

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
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
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
          className={`${FIELD} resize-none`}
        />
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
        <div className="flex items-baseline gap-2">
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
