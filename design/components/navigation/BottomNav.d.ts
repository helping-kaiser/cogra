/** The app's bottom bar: the frame every read surface wears. */
export interface BottomNavProps {
  /** The selected destination, or null on a surface that is neither tab root. */
  active?: "feed" | "search" | "profile" | "wallet" | null;
  /**
   * Which slots exist. V1.0 carries all five (`ALL_SLOTS`); the default is the
   * three-slot bar from before V1.0. A slot whose surface is drawn after V1.0
   * keeps its place and opens a coming-soon door (`ComingSoonCard`) — a door
   * belongs to a slot, never to a list. The `search` slot reads "Explore" on
   * screen.
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

/** The five slots of the V1.0 bar: feed, search, compose, wallet, profile. */
export declare const ALL_SLOTS: readonly ("feed" | "search" | "compose" | "wallet" | "profile")[];
