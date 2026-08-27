/** The sticky, scroll-aware top region: the header plus any must-act banner. */
export interface CollapsingTopProps {
  children?: React.ReactNode;
  /**
   * A scroll container other than the window — pass a ref when the surface
   * scrolls inside a frame rather than the page.
   */
  scrollHost?: React.RefObject<HTMLElement | null>;
}

export declare function CollapsingTop(props: CollapsingTopProps): JSX.Element;
