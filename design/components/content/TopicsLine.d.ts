/**
 * The topics-and-citations line a content card wears — shared by `PostCard`
 * and `CommentCard`. One line, the citation count riding its end; the count
 * opens the topics-and-references sheet.
 */
export interface TopicsLineProps {
  /** Topic names, with or without the `#`. */
  topics?: readonly string[];
  /** The citation count at the line's end. */
  references?: number;
  /** The detail variant wraps the full set; the summary line clips. */
  wrap?: boolean;
  /** Makes the count a control opening the topics-and-references sheet. */
  onOpenReferences?: () => void;
}

export declare function TopicsLine(props: TopicsLineProps): JSX.Element | null;
