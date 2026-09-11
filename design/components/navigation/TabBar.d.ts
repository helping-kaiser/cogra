/**
 * The full-width tab row: equal cells under a hairline, the chosen one in
 * primary with a 2px underline. A cell with an `icon` is a glyph cell and
 * takes its name from `label`; a cell without one shows `label` as words.
 */
export interface Tab {
  id?: string;
  /** A glyph name makes this a glyph cell; omit it for a cell of words. */
  icon?: string;
  /** The glyph cell's accessible name, or the word cell's visible text. */
  label?: string;
}

export interface TabBarProps {
  tabs?: Tab[];
  /** The selected tab's `id`. */
  value?: string;
  /** What the row chooses between — "Which direction", "What the chronicle shows". */
  ariaLabel?: string;
  onSelect?: (id: string) => void;
  iconSize?: number;
}

export declare function TabBar(props: TabBarProps): JSX.Element;
