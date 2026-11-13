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

   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061): another
   person's page is the same surface as your own, named by the same body
   names. */
export const NODE = "profile";
export const PROPS = { from: { editor: "enum", options: ["feed", "profile"], default: "feed" } };
export const VALS = `backLabel: this.props.from === "profile" ? "Back to the profile" : "Back to feed"`;
export function Screen() {
  return <ProfileOtherBody backLabel="{{backLabel}}" />;
}
