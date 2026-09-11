/**
 * The read shell's top-left identity: mark + wordmark on a 48px band. Tab
 * roots wear it; inner surfaces wear `PageHeader` instead.
 */
export interface CograBandProps {
  /** The screen's own working control, between chats and the bell (the feed's
   *  filter trigger, the profile's gear). The band never spends its full width
   *  on identity alone. */
  trailing?: React.ReactNode;
  /**
   * The chats affordance, left of `trailing`. Every tab root's band carries it
   * by default; pass false to opt a band out where messaging cannot apply.
   */
  chats?: boolean;
  /**
   * The notifications bell, right-most on the band. Every bottom-bar root
   * carries it; pass false where nothing can be addressed to the reader (a
   * guest has no account and no list).
   */
  bell?: boolean;
  /** Lights the bell's quiet unread dot, and says so in its accessible name.
   *  Never a count — see `docs/implementation/notifications.md`. */
  unread?: boolean;
  /** Rides below the band in the same non-shrinking block. */
  children?: React.ReactNode;
}

export declare function CograBand(props: CograBandProps): JSX.Element;

/** The band's one icon-control shape: a 48px target, no background, the
 *  secondary text colour, with the shell's unread dot as an option. */
export interface BandIconProps {
  name: import("./Icon.jsx").IconProps["name"];
  /** The accessible name — a glyph control's only wording. */
  label: string;
  size?: number;
  /** Pins the quiet unread marker to the glyph's top-right. */
  dot?: boolean;
}

export declare function BandIcon(props: BandIconProps): JSX.Element;
