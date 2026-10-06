/**
 * The search field of Explore and the two pickers — M3's search-bar idiom: a 48px pill,
 * leading search glyph, placeholder register. Item 9's port.
 */
export interface SearchBarProps {
  /** The current query; empty shows the placeholder. */
  query?: string;
  placeholder?: string;
  /** The field's accessible name, per use: `Search` (Explore, the default), `Name a tag` (the tag picker), `Cite something` (the citation picker). Never the placeholder, which leaves when the reader types. */
  ariaLabel?: string;
  /** Bind a live input; without it the bar renders statically with a caret. */
  onChange?: (query: string) => void;
  /** The field-error state: an inset `--error` ring. The refusal's words belong
   *  to the surface under the bar — the tag picker's naming line. */
  error?: boolean;
  /** The id of the line carrying that refusal, named by the bound input. */
  describedBy?: string;
  /** The data-node name its placer gives this field's pill (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `glyph`, and the query's text as `input` — the bound input in the product, the static board's searchbox. The static caret is never named. */
  node?: string;
}

export declare function SearchBar(props: SearchBarProps): JSX.Element;
