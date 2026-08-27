/** A labeled password input with a show/hide toggle. */
export interface PasswordFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  id?: string;
}

export declare function PasswordField(props: PasswordFieldProps): JSX.Element;
