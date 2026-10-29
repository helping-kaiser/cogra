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
   bounds the batch — ten references (`ComposeSealCited`) — and how the list
   reads once the tenth is in is not drawn yet.

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
   reference (the composer's name and key for it), one `result` per row keyed
   by its place (Explore's rule), the `announcement` and `done`.

   THE `state` CHIP DRAWS THE PICKER'S UNDRAWN STATES (seam 248, GAPS A–C).
   `filter` is the trigger's sheet open: KINDS ONLY — `ExploreFilter`'s kinds
   section and its foot, holding the three kinds a citation can point at,
   Posts, Comments and Profiles — because a citation has no order to choose
   and no other narrowing to make; it is `filterSheet`, its `kinds` and its
   `foot`. `cap` is the picker with the batch at its ten (`ComposeSealCited`):
   `Up to 10 citations per post.` stands above the results, and the rows
   under it are dimmed and take no tap — a true refusal, so it dims — while
   the staged rows' × still un-stage, which is how room comes back; from a
   reply's composer it reads `per comment`. `fault` is the results' read
   that got no answer, nothing loaded: the house line, `Can't reach the
   server. Check your connection and try again.`, where the rows were, the
   field still holding the query, a changed query reading again. An empty
   result and the read in flight stay SILENT — the list is simply empty
   until rows arrive, the field already saying what was asked. */
export const NODE = "referencePicker";
export const PROPS = { state: { editor: "enum", options: ["picking", "filter", "cap", "fault"], default: "picking" } };
export const VALS = `filterShown: this.props.state === "filter" ? "block" : "none", capShown: this.props.state === "cap" ? "block" : "none", faultShown: this.props.state === "fault" ? "block" : "none", rowsShown: this.props.state === "fault" ? "none" : "flex", rowsOpacity: this.props.state === "cap" ? "var(--state-disabled)" : "1"`;
const CITABLE_KINDS = FEED_KINDS.filter((kind) => kind.value !== "topics");
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Cite something" action={<HelpDot ariaLabel="Citing" node="help" />} node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar query="salt" ariaLabel="Cite something" node="searchField" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What the search shows" node="filterTrigger" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px 8px" }} data-node="staged">
          <StagedReference kind="post" name="Salt maps of the coast road" sub="@sol · 3d" src="post-photo.jpg" onRemove={() => {}} node="stagedReference" nodeKey="1" />
        </div>
        <PickAnnouncement said="Added — in the staged list." node="announcement" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "{{capShown}}" }} data-node-chip="state" data-node-key="cap">
          <p style={PICKER_NOTE} data-node="cap">
            Up to 10 citations per post.
          </p>
        </div>
        <div style={{ display: "{{faultShown}}", padding: "8px 24px" }} data-node-chip="state" data-node-key="fault">
          <div data-node="fault">
            <TransportError />
          </div>
        </div>
        <div style={{ display: "{{rowsShown}}", flexDirection: "column", opacity: "{{rowsOpacity}}" }}>
          <ReferenceRow kind="person" name="Sal Torres" sub="@saltorres" trailing={<Icon name="add" size={20} />} onOpen={() => {}} node="result" nodeKey="1" />
        </div>
      </div>
      <div style={{ flex: "none", padding: "8px 24px 24px" }}>
        <Button style={{ width: "100%" }} node="done">Done</Button>
      </div>

      <div style={{ display: "{{filterShown}}" }} data-node-chip="state" data-node-key="filter">
        <BottomSheet open ariaLabel="What the search shows" node="filterSheet">
          <SheetTitle node="title">What the search shows</SheetTitle>
          <FilterSection label="Kinds" hint="Combine as many as you like. All, until you narrow it." node="kinds">
            {CITABLE_KINDS.map((kind) => (
              <Chip key={kind.value} label={kind.label} selected={false} node={`${kind.value}Chip`} />
            ))}
          </FilterSection>
          <FilterFoot node="foot" />
        </BottomSheet>
      </div>
    </>
  );
}
