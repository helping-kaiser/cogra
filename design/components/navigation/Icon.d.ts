/**
 * The product's Material glyphs, all inlined verbatim from material-design-icons
 * (Apache-2.0), classic filled 24px — no icon font, no external request. 24×24,
 * `currentColor`: colour comes from the parent's text colour.
 */
export interface IconProps {
  /**
   * `graph` is the one Material *Symbols* drawing (outlined, lighter weight) —
   * keep it out of rows with other glyphs. See guidelines/iconography.md.
   * `mark` is CoGra's own mark as a glyph.
   */
  name:
    | "dynamic_feed"
    | "person"
    | "person_outline"
    | "add"
    | "search"
    | "wallet"
    | "settings"
    | "visibility"
    | "visibility_off"
    | "arrow_back"
    | "more_vert"
    | "chat_bubble"
    | "check"
    | "volume_up"
    | "volume_off"
    | "how_to_vote"
    | "inventory_2"
    | "campaign"
    | "sell"
    | "forum"
    | "send"
    | "close"
    | "drag_indicator"
    | "lock"
    | "expand_more"
    | "chevron_right"
    | "arrow_outward"
    | "content_copy"
    | "graph"
    | "mark";
  size?: number;
  /** Only read by `mark`: the pick's fill. Defaults to the loud surface. */
  pickColor?: string;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element | null;
