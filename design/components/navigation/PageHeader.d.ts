/** The house page header — back arrow, title, optional trailing action. */
export interface PageHeaderProps {
  /** Omit when the surface renders its own heading below the header. */
  title?: string;
  /** Omit on a tab root — tabs carry no back arrow. */
  backHref?: string;
  /** Accessible name for the arrow-only link, e.g. "Back to feed". */
  backLabel?: string;
  onBack?: (event: React.MouseEvent) => void;
  /** A trailing action: a text-variant link or button. */
  action?: React.ReactNode;
}

export declare function PageHeader(props: PageHeaderProps): JSX.Element;
