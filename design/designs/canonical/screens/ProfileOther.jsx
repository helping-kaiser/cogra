/* Someone else's profile — the drill-in an author chip opens (profile round,
   item 23). The compact shape: avatar left, name/handle/figures beside it, bio,
   then the stance on the person stretched to the row — the one action, worn
   wide the way a profile's primary action always is. The overflow (mention,
   share) rides the top bar next to the title, the detail-surface idiom; the
   bar still rides below (a read drill-in, Q37), its originating root lit
   (jakob 2026-10-06) — Feed here, where the author chip was tapped.

   The body is a `_shared.jsx` helper: the menu's own board draws this same page
   with the sheet raised over it.

   THE `from` CHIP DRAWS THE WAY BACK'S OTHER ORIGIN (round 45; jakob
   2026-11-12, the re-ask's eighteenth): `feed` the author chip's feed,
   `Back to feed`; `profile` the profile opened from a card on another's
   profile — a person in its references sheet — `Back to the profile`, the
   one rule every page a profile's card opens follows (`Back to your profile`
   from a card on the reader's own).

   THE `name` CHIP DRAWS THE HEAD'S NAME AT ITS EXTREMES (seam 318; jakob
   2026-11-13: "wouldnt this look shitty? please show me"): `sample` @ada's
   name; `two-lines` a 40-character name of three words, wrapping at a
   space onto a second line; `three-lines` the 50-character legal maximum in
   four words, which needs THREE lines at the head's 262px — drawn, not
   capped; `one-word` a 50-character single word, which breaks inside the word
   onto as many lines as it needs — the head's name is always shown whole
   (ruled by jakob 2026-11-13, backlog 213). `three-lines-shrunk` is SHOW-ONLY,
   no rule: the 50-character sample at 19px on a 24px line, the largest whole
   size at which it holds two lines at the head's 262px (jakob's idea,
   backlog 214).

   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061): another
   person's page is the same surface as your own, named by the same body
   names. */
export const NODE = "profile";
export const PROPS = {
  from: { editor: "enum", options: ["feed", "profile"], default: "feed" },
  name: { editor: "enum", options: ["sample", "two-lines", "three-lines", "one-word", "three-lines-shrunk"], default: "sample" },
};
export const VALS = `backLabel: this.props.from === "profile" ? "Back to the profile" : "Back to feed", displayName: this.props.name === "two-lines" ? "Maximiliana Wilhelmina Featherstonehaugh" : this.props.name === "three-lines" || this.props.name === "three-lines-shrunk" ? "Maximiliana Wilhelmina Featherstonehaugh Okonkwoli" : this.props.name === "one-word" ? "MaximilianaWilhelminaFeatherstonehaughOkonkwoLiang" : "Ada Okonkwo", nameSize: this.props.name === "three-lines-shrunk" ? "19px" : "var(--text-title-large)", nameLineHeight: this.props.name === "three-lines-shrunk" ? "24px" : "var(--text-title-large--line-height)"`;
export function Screen() {
  return <ProfileOtherBody backLabel="{{backLabel}}" displayName="{{displayName}}" nameSize="{{nameSize}}" nameLineHeight="{{nameLineHeight}}" />;
}
