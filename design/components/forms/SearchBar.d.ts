/**
 * The Explore tab's search field — M3's search-bar idiom: a 48px pill,
 * leading search glyph, placeholder register. Item 9's port.
 */
export interface SearchBarProps {
  /** The current query; empty shows the placeholder. */
  query?: string;
  placeholder?: string;
  /** Bind a live input; without it the bar renders statically with a caret. */
  onChange?: (query: string) => void;
}

export declare function SearchBar(props: SearchBarProps): JSX.Element;
