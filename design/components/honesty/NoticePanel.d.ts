/**
 * The notice panel — the `tertiary-container` block a surface wears when the
 * one act it exists for cannot happen right now and nothing failed: nothing
 * staged, nothing signed, nothing spent. A notice, never `error`.
 */
export interface NoticePanelProps {
  /** What is true, in the reader's words — "You can't sign right now". */
  title: React.ReactNode;
  /** The panel's one "?", named for what it opens. Omit when the panel's own
   *  words already say everything a dialog would. */
  helpLabel?: string;
  onHelp?: () => void;
  /** `medium` beside the seal's acts card; `large` where the panel leads a page. */
  corner?: "medium" | "large";
  /** `NoticeLine`s, then what the reader can do — a `Button variant="inverse"`. */
  children?: React.ReactNode;
}

export declare function NoticePanel(props: NoticePanelProps): JSX.Element;

/** The panel's sentence, `body-medium` in the panel's own ink. */
export interface NoticeLineProps {
  children?: React.ReactNode;
}

export declare function NoticeLine(props: NoticeLineProps): JSX.Element;
