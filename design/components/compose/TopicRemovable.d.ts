/**
 * A topic staged on a composer — the hash, the word, and the × that takes it
 * back out. Not a `Chip`: a chip changes what the reader is looking at, this
 * is a piece of the thing being authored, shown back to its author.
 */
export interface TopicRemovableProps {
  /** The topic's name, without the hash — the mark is drawn. */
  topic?: string;
  /** The × is the button; the pill stays inert. Named "Remove #<topic>". */
  onRemove?: () => void;
}

export declare function TopicRemovable(props: TopicRemovableProps): JSX.Element;
