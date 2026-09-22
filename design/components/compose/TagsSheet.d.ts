import type { TopicRemovableProps } from "./TopicRemovable";

/**
 * The staged tags, managed — the sheet a seal's Tags row opens once it counts
 * ("N tags") instead of naming the tags staged. `CitedSheet`'s shape for the
 * same reason: a staged collection is managed in one place, and the seal's two
 * counting rows open the same kind of door. Pills are `TopicRemovable`, whole,
 * in the composer's own wrapping row; the sheet adds nothing, because tags are
 * staged at the stage that stages them. Builds on `BottomSheet`.
 */
export type TagsSheetItem = TopicRemovableProps;

export interface TagsSheetProps {
  open?: boolean;
  onClose?: () => void;
  items?: readonly TagsSheetItem[];
  onDone?: () => void;
  inline?: boolean;
}

export declare function TagsSheet(props: TagsSheetProps): JSX.Element;
