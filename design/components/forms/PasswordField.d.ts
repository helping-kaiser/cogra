/** A labeled password input with a show/hide toggle. */
export interface PasswordFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  id?: string;
  /** The supporting line under the field, in `text-secondary` — what the field
   *  will accept ("At least 12 characters."). Mirrored from TextField. */
  hint?: string;
  /** The same line in M3's error state: error outline, error label, the message
   *  in `--error`, always words. It REPLACES `hint`. */
  error?: string;
  /** The account's login email, for a credential form that draws no email field (`ChangePassword`, `ResetNew`): rendered as a hidden `autocomplete="username"` input beside the field, so a password manager knows whose password is changing. */
  account?: string;
  /** The return key: `go` by default (a password ends every credential form but one), `next` where a field follows. */
  enterKeyHint?: "next" | "go" | "done";
}

export declare function PasswordField(props: PasswordFieldProps): JSX.Element;
