/**
 * A topic staged on a composer — the hash, the word, and the × that takes it
 * back out. Not a `Chip`: a chip changes what the reader is looking at, this
 * is a piece of the thing being authored, shown back to its author.
 */
export interface TopicRemovableProps {
  /** The topic's name, without the hash — the mark is drawn. */
  topic?: string;
  /**
   * The pair the tag signs, drawn only where it deviates from the contract's
   * default — a row of pills each carrying two numbers is a clipped parade.
   */
  pair?: string;
  /** The × is its own button, named "Remove #<topic>". */
  onRemove?: () => void;
  /**
   * Opens the tag's pair editor. Given it, the pill becomes a button named
   * "#<topic> — set how it relates"; without it the pill is inert.
   */
  onEdit?: () => void;
}

export declare function TopicRemovable(props: TopicRemovableProps): JSX.Element;
