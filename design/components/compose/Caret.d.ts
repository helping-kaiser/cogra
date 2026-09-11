/**
 * The composer's text cursor, standing still: 2px of primary at the end of the
 * words, so a board's body reads as being written rather than already said.
 * Decoration only — the real surfaces put a `<textarea>` here and the platform
 * draws its own blinking cursor. It takes no props and belongs inside the
 * paragraph, after the last word.
 */
export declare function Caret(): JSX.Element;
