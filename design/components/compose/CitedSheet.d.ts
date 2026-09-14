import type { StagedReferenceProps } from "./StagedReference";

/**
 * The staged citations, managed — the sheet a seal's References row opens once
 * it counts ("N cited") instead of naming the one citation staged.
 * `PickedSheet`'s shape for the same reason: a staged collection is managed in
 * one place. Rows are `StagedReference`, whole; the sheet adds nothing, because
 * citations are staged at the stage that stages them. Builds on `BottomSheet`.
 */
export type CitedSheetItem = StagedReferenceProps;

export interface CitedSheetProps {
  open?: boolean;
  onClose?: () => void;
  items?: readonly CitedSheetItem[];
  onDone?: () => void;
  inline?: boolean;
}

export declare function CitedSheet(props: CitedSheetProps): JSX.Element;
