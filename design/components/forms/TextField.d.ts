/**
 * The label row, assigned once: `TextField` renders it over its own field, and
 * the composer's captions over sections that are not fields (Pictures, Video,
 * Cover, Topics, References) render it over a tray or a list.
 */
export interface FieldLabelProps {
  children: React.ReactNode;
  /** The id of the control this word names. With one the row is a `<label>`;
   *  without one it is a `<span>`, because a `<label>` with no `for` names
   *  nothing. */
  htmlFor?: string;
  /** A quiet fact right-aligned beside the label — "Optional". */
  corner?: string;
  /** Truthy puts the word in `--error`; `TextField` passes its own message. */
  error?: string;
}

export declare function FieldLabel(props: FieldLabelProps): JSX.Element;

/** The late counter: the quiet remaining count a capped field shows only once
 *  the writer is near its cap. Renders nothing at all until
 *  `remaining <= max(20, round(cap / 10))`, then `"12 left"`; past the cap
 *  `"9 over"` in `--error`. Counts Unicode scalar values, the unit every ruled
 *  cap is stated in. `TextField` renders it for its own field; a field that is
 *  not a `TextField` — the growing body box — renders it directly. */
export interface FieldCountProps {
  /** The field's whole content. Counted unless `used` is given. */
  value?: string;
  /** The cap, in Unicode scalar values. Without one nothing renders. */
  cap?: number;
  /** The whole length, for a field drawn as the visible tail of a longer body.
   *  Overrides counting `value`. */
  used?: number;
  id?: string;
}

export declare function FieldCount(props: FieldCountProps): JSX.Element | null;

/** The house labeled text input — and, with `rows`, the house textarea. */
export interface TextFieldProps {
  label: string;
  /** A quiet fact right-aligned beside the label — "Optional" on the details fields. */
  corner?: string;
  value: string;
  onChange?: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  /** The platform monospace: recovery codes, key ids, seed entry. Nothing else. */
  mono?: boolean;
  placeholder?: string;
  /** Renders a textarea instead of an input. */
  rows?: number;
  id?: string;
  /** The supporting line under the field, in `text-secondary` — what the field
   *  will accept ("3–30 characters: a–z, 0–9, _"). */
  hint?: string;
  /** The same supporting line in M3's error state: error outline, error label,
   *  the message in `--error`, always words. It REPLACES `hint` — a field never
   *  carries both. Over the cap this is where the surface's own refusal goes:
   *  the atom colours the count, the board words the message. */
  error?: string;
  /** The field's cap in Unicode scalar values. The late counter appears at the
   *  end of the supporting row once `remaining <= max(20, round(cap / 10))`,
   *  and not one character sooner. */
  cap?: number;
  /** The whole length, where the field is drawn as the tail of a longer body. */
  used?: number;
}

export declare function TextField(props: TextFieldProps): JSX.Element;
