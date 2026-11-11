/* Citing — the reference explorer, wearing the search UI (readme §13): the
   same bar, the same worded trigger, the same rows. No Sky entry — citing is a
   task, not the tab. The rows' edge is the ADD mark: the whole row's tap picks
   the reference; ranking still orders the list.

   IT OFFERS POSTS, COMMENTS AND PROFILES (readme §13, the V1.0 scope cut,
   2026-09-25): a V1.0 reference points at a person, a post or a comment — the
   contract's `ReferenceTarget` union, read as the ruling — so no row offers a
   kind that cannot be cited, and its filter holds those three kinds.

   A PICK STAGES AND THE PICKER STAYS OPEN (jakob, 2026-10-01, the shared
   anatomy's law — `TagPicker`). A tap on a row stages that citation in the
   composer at once and the reader goes on picking, and the row moves out of
   the results into the staged section above them, a `StagedReference` with
   its × — the post-MVP chat pickers' idiom (jakob, 2026-10-01): here the post
   is in and the person is still to add. The × un-stages the citation on the
   spot; the composer's own × still removes it too. Both moves are spoken as
   well as seen — `PickAnnouncement`, `Added — in the staged list.` and
   `Removed from the staged list.`, the shared anatomy's polite status
   message (`TagPicker`). The composer's cap still
   bounds the batch — ten references (`ComposeSealCited`).

   THE STAGED ROWS ARE THE LIST'S FIRST ROWS, AT MOST THREE (jakob
   2026-11-10 and 2026-11-11; the shared anatomy, `TagPicker`): below the
   fixed head one list scrolls, the three newest staged on top of it, newest
   first, then the results. Past three, the pick tray's `Show all` stands
   under them and opens the sheet that holds every staged citation, the one
   the seals open (`CitedSheet`, `ComposeCitations`); nothing unfolds in
   place.

   `Done` AND THE HEADER BACK ARE ONE LEAVE (jakob, 2026-10-01, carried here by
   the shared anatomy `TagPicker` names). Both return to the composer the
   picker was opened from, every staged reference kept — back is navigation,
   never an undo; `Done` is the affirmative twin, because a back arrow reads as
   an abort to a reader who has finished citing. It is the full-width foot
   every wizard stage wears (`ReplyDraft`'s `Next`).

   THE ARROW NAMES THE COMPOSER, THE "?" ITS DIALOG (the K13 round; the
   shared anatomy, `TagPicker`): `Back to the post` from a post's composer or
   its edit — drawn — and `Back to the comment` from a reply's composer or a
   comment's edit; the "?" is `Citing`. */
/* REGISTERED under its own `referencePicker` prefix (seam 248): `header`
   (its "?" `help`), the field `searchField` as Explore names its own, the
   `filterTrigger`, the `staged` section with one `stagedReference` per staged
   reference shown (the composer's name and key for it) and its `door`,
   one `result` per row keyed
   by its place (Explore's rule), the `announcement` and `done`.

   THE `state` CHIP DRAWS THE PICKER'S UNDRAWN STATES (seam 248, GAPS A–C).
   `filter` is the trigger's sheet open: KINDS ONLY — `ExploreFilter`'s kinds
   section and its foot, holding the three kinds a citation can point at,
   Posts, Comments and Profiles — because a citation has no order to choose
   and no other narrowing to make; it is `filterSheet`, its `kinds` and its
   `foot`. `picking` is one citation staged; `none` nothing staged; `seven`
   more than three, the three newest and `Show all`, the door to
   `ComposeCitations`' sheet. `cap` is the picker with the batch at
   its ten (`ComposeSealCited`): the three newest and `Show all`, `Up to 10
   citations per post.` standing in the head under the filter, and the
   result rows dimmed and taking no tap — a true refusal, so it dims — while
   the staged rows' × still un-stage, which is how room comes back; from a
   reply's composer it reads `per comment`. `fault` is the results' read
   that got no answer, nothing loaded: the house line's noun form, `Can't
   reach the server — results can't load right now.`, over an outlined
   `Retry`, where the rows were — the fault family's one shape
   (`TagPicker`) — the field still holding the query, a changed query
   reading again as well. An empty
   result and the read in flight stay SILENT — the list is simply empty
   until rows arrive, the field already saying what was asked. */
export const NODE = "referencePicker";
export const PROPS = { state: { editor: "enum", options: ["picking", "filter", "cap", "fault", "none", "seven"], default: "picking" } };
export const VALS = `filterShown: this.props.state === "filter" ? "block" : "none", capShown: this.props.state === "cap" ? "block" : "none", faultShown: this.props.state === "fault" ? "block" : "none", rowsShown: this.props.state === "fault" ? "none" : "flex", rowsOpacity: this.props.state === "cap" ? "var(--state-disabled)" : "1", pickingShown: this.props.state === "picking" ? "flex" : "none", filterRowShown: this.props.state === "filter" ? "flex" : "none", faultRowShown: this.props.state === "fault" ? "flex" : "none", sevenShown: this.props.state === "seven" ? "flex" : "none", tenShown: this.props.state === "cap" ? "flex" : "none"`;
export function Screen() {
  return <ReferencePickerBody />;
}
