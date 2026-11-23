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
   name. Two lines are the hard cap: the size has no floor (jakob 2026-11-13).

   THE PROFILE LANDS ON POSTS (jakob 2026-11-13, the android hand test): the
   `tab` chip draws `posts`, the landing, and `everything`, the chronicle the
   tab opens (`ProfileTabs`).

   A REMOVED POST ON EVERYTHING (round 58; jakob 2026-11-18, C1 "as rec") is
   the `chronicle` chip's `removed`: the 5d post's act, removed as
   `ProfilePosts`' `removed` draws its 5d post, its second line `Removed by
   its author` where the words were, the card still the door to the post's
   detail (`ChronicleAct`). A PENDING ACT ON EVERYTHING (round 61; jakob
   2026-11-19, B2 (a)) is the same chip's `settling`: the newest act, the
   long way home's, signed and not yet landed, its age `now` and `Still
   settling` under it, as the own tab draws it — at the head, the list
   newest first.

   AN OPINION ON AN ACCOUNT SINCE DELETED (round 59, the proposal to jakob
   2026-11-18) is the `aside` chip's `deleted`: the opinion's act names its
   target `on a deleted account`, the pointers' own naming, the handle never
   printed. `mentioned-deleted` and `vouched-deleted` (round 62; jakob
   2026-11-23, B3 (a)) draw the two verbs that take the person bare on the
   same act: `Mentioned` `a deleted account`, the reserved disc in the
   picture's place, and `Vouched for` `a deleted account`, the record's face.
   A GUEST (round 62, seam 404.3) is the `reader` chip's `guest`: the wide
   anchor reads `@genesismod's opinion` beside the hollow face, the handle
   cut first where it outgrows the anchor (`READER_CHIP`).
   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061): another
   person's page is the same surface as your own, named by the same body
   names. */
export const NODE = "profile";
export const PROPS = {
  from: { editor: "enum", options: ["feed", "profile"], default: "feed" },
  name: { editor: "enum", options: ["sample", "two-lines", "fifty", "one-word", "widest"], default: "sample" },
  ...TAB_CHIP,
  ...CHRONICLE_CHIP,
  aside: { editor: "enum", options: ["handle", "deleted", "mentioned-deleted", "vouched-deleted"], default: "handle" },
  ...READER_CHIP,
};
export const VALS = `backLabel: this.props.from === "profile" ? "Back to the profile" : "Back to feed", displayName: this.props.name === "two-lines" ? "Maximiliana Wilhelmina Featherstonehaugh" : this.props.name === "fifty" ? "Maximiliana Wilhelmina Featherstonehaugh Okonkwoli" : this.props.name === "one-word" ? "MaximilianaWilhelminaFeatherstonehaughOkonkwoLiang" : this.props.name === "widest" ? "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" : "Ada Okonkwo", nameSize: this.props.name === "fifty" ? "19px" : this.props.name === "one-word" ? "20px" : this.props.name === "widest" ? "10px" : "var(--text-title-large)", nameLineHeight: this.props.name === "fifty" ? "24px" : this.props.name === "one-word" ? "25px" : this.props.name === "widest" ? "13px" : "var(--text-title-large--line-height)", ${TAB_VALS}, ${CHRONICLE_VALS}, asideHandle: this.props.aside === "handle" ? "contents" : "none", asideDeleted: this.props.aside === "deleted" ? "contents" : "none", asideMentioned: this.props.aside === "mentioned-deleted" ? "contents" : "none", asideVouched: this.props.aside === "vouched-deleted" ? "contents" : "none", ${READER_VALS}`;
export function Screen() {
  return <ProfileOtherBody backLabel="{{backLabel}}" displayName="{{displayName}}" nameSize="{{nameSize}}" nameLineHeight="{{nameLineHeight}}" tab="chip" chronicle={CHRONICLE_REMOVED} aside vantageHoles={READER_HOLES} />;
}
