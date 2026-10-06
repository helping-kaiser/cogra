/**
 * The designed empty state a list surface owes the reader (readme §7, *Intentional additions*).
 * Never scolding, never selling, never `error` colouring.
 */
export interface EmptyStateProps {
  /** One calm sentence: "Nothing here yet — write the first post." */
  title: string;
  /** A custom action node, when the default outlined button is not right. */
  action?: React.ReactNode;
  /** The one action that fills the list, if there is one. */
  actionLabel?: string;
  onAction?: () => void;
  /** The data-node name its placer gives this state (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `title`, and the default button as `action` (a custom `action` is named by its own placer). */
  node?: string;
}

export declare function EmptyState(props: EmptyStateProps): JSX.Element;

/** The loading line. Text, not a spinner or a skeleton. */
export interface LoadingStateProps {
  label?: string;
}

export declare function LoadingState(props: LoadingStateProps): JSX.Element;
