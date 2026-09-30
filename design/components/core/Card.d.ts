/**
 * Material's filled card: the one raised surface the product uses.
 */
export interface CardProps {
  children?: React.ReactNode;
  /** The element to render. `section` by default; `li` inside a list. */
  as?: "section" | "article" | "div" | "li";
  ariaLabel?: string;
  style?: React.CSSProperties;
  /** The data-node name its placer gives this card (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
  /** The card's content key when it is a repeated instance. */
  nodeKey?: string;
}

export declare function Card(props: CardProps): JSX.Element;
