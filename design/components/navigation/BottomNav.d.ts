/** The app's bottom bar: the frame every read surface wears. */
export interface BottomNavProps {
  /** The selected destination, or null on a surface that is neither tab root. */
  active?: "feed" | "search" | "profile" | "wallet" | null;
  /**
   * Which slots exist. The product ships ["feed", "compose", "profile"]; the bar
   * grows toward five as search and wallet arrive. Do not add a slot whose
   * surface does not exist. The `search` slot reads "Explore" on screen.
   */
  slots?: readonly ("feed" | "search" | "compose" | "wallet" | "profile")[];
  onSelect?: (slot: string) => void;
  /** Render in flow rather than fixed to the viewport, for specimens. */
  inline?: boolean;
  /**
   * Overrides a slot's glyph, keyed by slot name. Merged over the defaults;
   * `profile` still switches `person`/`person_outline` on selection unless
   * overridden here.
   */
  glyphs?: Partial<Record<"feed" | "search" | "wallet" | "profile", string>>;
}

export declare function BottomNav(props: BottomNavProps): JSX.Element;

/** The five slots the bar is growing toward: feed, search, compose, wallet, profile. */
export declare const ALL_SLOTS: readonly ("feed" | "search" | "compose" | "wallet" | "profile")[];
