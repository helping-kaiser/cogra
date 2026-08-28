/**
 * The topics-and-citations line a content card wears — shared by `PostCard`
 * and `CommentCard`. One line on every variant: at most two chips, then the
 * counts in words ("· 23 topics · 3 references"); the topics-and-references
 * sheet is the full set's home.
 */
export interface TopicsLineProps {
  /** Topic names, with or without the `#`. */
  topics?: readonly string[];
  /** The citation count at the line's end. */
  references?: number;
  /**
   * Detail surfaces: the WHOLE LINE becomes one control opening the
   * topics-and-references sheet, the chips inert inside it.
   */
  onOpen?: () => void;
  /** Without `onOpen`: chips navigate, and only the counts open the sheet. */
  onOpenReferences?: () => void;
}

export declare function TopicsLine(props: TopicsLineProps): JSX.Element | null;
