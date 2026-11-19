// TEXT A PERSON WROTE, SHOWN ON MORE THAN ONE LINE, NEVER RUNS OFF ITS BOX
// (jakob's hand test 2026-11-19: "if the word is genuinely longer than this
// then we just need to continue in the next line"; NamesLong.md: a card's
// title and body wrap, wrapping text is never ellipsized as a whole). A word
// wider than the line breaks inside the word; a line clamp still clamps, on
// the wrapped lines. One-line places keep their drawn ellipsis instead.
//
// `anywhere`, not `break-word`: the two lay a line out the same, but MDN
// `overflow-wrap` notes that only `anywhere`'s soft wrap opportunities count
// toward min-content sizes, so a flex item or an `auto` grid track holding
// the word is not widened past its box by it (the replica in `text-field.tsx`
// learned this on 2026-11-18).
//
// It is inherited, so it sits on the box that holds the words; a handle in
// the text stays one `white-space: nowrap` unit (`nameInText`), which no
// wrap opportunity can split.

/** The class every multi-line box of person-written text wears. */
export const WRITTEN = "[overflow-wrap:anywhere]";
