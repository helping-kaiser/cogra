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
  maxLength,
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
  maxLength?: number;
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;

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
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} resize-none`}
        />
      ) : (
        <input
          id={id}
          data-testid={testId}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} min-h-11`}
        />
      )}
      {/* `error` is the one place the failure role is spent. A validation
          message is a failure; nothing else on this surface is. */}
      {error && (
        <span id={errorId} role="alert" className="text-body-small text-error">
          {error}
        </span>
      )}
    </div>
  );
}
