/** The house labeled text input — and, with `rows`, the house textarea. */
export interface TextFieldProps {
  label: string;
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
}

export declare function TextField(props: TextFieldProps): JSX.Element;
