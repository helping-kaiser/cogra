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
   *  carries both. */
  error?: string;
}

export declare function TextField(props: TextFieldProps): JSX.Element;
