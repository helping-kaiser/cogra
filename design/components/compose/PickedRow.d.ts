import type { MediaThumbProps } from "./MediaThumb";

/**
 * The composer's picked-pictures summary row: thumbnails + the count caption,
 * ONE tappable row opening the Show all sheet (`PickedSheet`). It carries no
 * "Crop" or "Edit" links (2026-08-31 ruling: none) — the crop step is one
 * Back away in the linear wizard, and a second entrance to the same step is
 * the duplicate-affordance pattern the system refuses.
 */
export interface PickedRowProps {
  items?: readonly MediaThumbProps[];
  /** e.g. "3 pictures — the body". */
  caption?: string;
  /** Opens the Show all sheet. */
  onManage?: () => void;
  manageLabel?: string;
  /** The data-node name its placer gives this row (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `thumb` per picture, keyed by its position from 1; `caption`. */
  node?: string;
}

export declare function PickedRow(props: PickedRowProps): JSX.Element;

/** "Describe the pictures · 1 of 3 described" — the details step's entry into per-picture descriptions. */
export interface DescribeCounterProps {
  described: number;
  total: number;
  onDescribe?: () => void;
  /**
   * What is being described — "pictures" (default) or "video". A video takes
   * ONE description for the whole clip; its cover takes none of its own.
   */
  subject?: "pictures" | "video";
  /** The data-node name its placer gives this row (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `describe`, `count`, `reason`. */
  node?: string;
}

export declare function DescribeCounter(props: DescribeCounterProps): JSX.Element;
