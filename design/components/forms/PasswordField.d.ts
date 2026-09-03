/** A labeled password input with a show/hide toggle. */
export interface PasswordFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  id?: string;
  /** M3 text-field error state, mirrored from TextField: error outline,
   *  error label, error supporting text below the field. Always words. */
  error?: string;
}

export declare function PasswordField(props: PasswordFieldProps): JSX.Element;
