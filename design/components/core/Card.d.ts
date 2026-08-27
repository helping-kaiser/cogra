/**
 * Material's filled card: the one raised surface the product uses.
 */
export interface CardProps {
  children?: React.ReactNode;
  /** The element to render. `section` by default; `li` inside a list. */
  as?: "section" | "article" | "div" | "li";
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): JSX.Element;
