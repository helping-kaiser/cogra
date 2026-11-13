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

   THE `name` CHIP DRAWS THE HEAD'S NAME BY ITS TWO-LINE RULE (seam 318; jakob
   2026-11-13: "i prefer the shrunk 2 line version over the 3 liner"): the
   name is always shown whole on at most two lines, shrunk to the largest
   whole pixel that holds two where it would take more, its leading
   round(size × 28 / 22) (`ProfileHeader`'s `nameFitSize`). Each value carries
   the size the rule gives its sample, measured at the head's 262px:
   `sample` @ada's name, one line at 22px; `two-lines` 40 characters, two
   lines at 22px; `fifty` the 50-character name in four words, 19px on 24px;
   `one-word` a 50-character unbroken name, broken inside the word, 20px on
   25px; `widest` 50 × W without a space, 10px on 13px — the widest legal
   name. A smallest size is not ruled (backlog 215).
   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061): another
   person's page is the same surface as your own, named by the same body
   names. */
export const NODE = "profile";
export const PROPS = {
  from: { editor: "enum", options: ["feed", "profile"], default: "feed" },
  name: { editor: "enum", options: ["sample", "two-lines", "fifty", "one-word", "widest"], default: "sample" },
};
export const VALS = `backLabel: this.props.from === "profile" ? "Back to the profile" : "Back to feed", displayName: this.props.name === "two-lines" ? "Maximiliana Wilhelmina Featherstonehaugh" : this.props.name === "fifty" ? "Maximiliana Wilhelmina Featherstonehaugh Okonkwoli" : this.props.name === "one-word" ? "MaximilianaWilhelminaFeatherstonehaughOkonkwoLiang" : this.props.name === "widest" ? "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" : "Ada Okonkwo", nameSize: this.props.name === "fifty" ? "19px" : this.props.name === "one-word" ? "20px" : this.props.name === "widest" ? "10px" : "var(--text-title-large)", nameLineHeight: this.props.name === "fifty" ? "24px" : this.props.name === "one-word" ? "25px" : this.props.name === "widest" ? "13px" : "var(--text-title-large--line-height)"`;
export function Screen() {
  return <ProfileOtherBody backLabel="{{backLabel}}" displayName="{{displayName}}" nameSize="{{nameSize}}" nameLineHeight="{{nameLineHeight}}" />;
}
