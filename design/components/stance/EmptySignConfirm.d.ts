/** The empty-sign ask: a pick landing exactly (0, 0) while nothing stands. */
export interface EmptySignConfirmProps {
  /** Already in the reader's words — "this post", "@ada", "#saltmaps". */
  targetLabel: string;
  /** The opinion vouches its target in (approving, a vouch asked for): the first line warns that they start cut off. */
  vouchIn?: boolean;
  /** The signing is in flight (past 200ms): the act reads `Setting…` and goes inert, never dimmed. */
  busy?: boolean;
  /** The signing did not go through; the dialog stays open, says so, and the act's slot reads `Retry`. */
  failed?: boolean;
  /** The write rule refused the sign: the quiet line `WRITE_RULE_WORDS.dialog`, `Set it anyway` dimmed, no Retry — `SeveranceConfirm`'s state. */
  writeRule?: boolean;
  /** `Set it anyway` — signs the one empty record. */
  onConfirm?: () => void;
  /** `Keep it`, the scrim, Escape and Back — the pad beneath keeps its pick. */
  onCancel?: () => void;
  inline?: boolean;
}

/** The dialog's words, one place for both clients. */
export declare const EMPTY_SIGN_WORDS: {
  title: string;
  effect: (targetLabel: string) => string;
  vouchIn: (targetLabel: string) => string;
  cost: string;
  confirm: string;
  busy: string;
  keep: string;
};

export declare function EmptySignConfirm(props: EmptySignConfirmProps): JSX.Element;
