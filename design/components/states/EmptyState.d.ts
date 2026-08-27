/**
 * The designed empty state a list surface owes the reader (design.md §6).
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
}

export declare function EmptyState(props: EmptyStateProps): JSX.Element;

/** The loading line. Text, not a spinner or a skeleton. */
export interface LoadingStateProps {
  label?: string;
}

export declare function LoadingState(props: LoadingStateProps): JSX.Element;
