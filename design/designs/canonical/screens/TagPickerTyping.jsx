/* THE TAG PICKER, MID-NAME (readme §13, the tag round). The state where the
   naming service is visible doing its work, which no other board shows.

   THE NAME IS CANONICALIZED LIVE, AND THE READER IS TOLD. L1 compares Type
   names by byte equality and nothing else, so `#SaltMaps` and `#saltmaps`
   would be two unrelated nodes; canonicalization — one leading `#` stripped,
   ASCII-lowercased — is CoGra's own job (hashtag.md §1). That is not a
   detail to hide behind a field: the reader is picking a public, permanent
   endpoint, and a name that quietly becomes a different name is the kind of
   surprise §9 exists to prevent. The preview says what will actually be
   signed, before it is.

   THE PREVIEW IS THE LIST'S FIRST ROW, AND THE ACTION KEY STAGES IT (jakob's
   ruling, 2026-09-30, the V1.0 audit's K14.1). The first row is always the
   canonicalized typed name, drawn as the `ReferenceRow` every row is, with
   `Signs as #saltmaps` as its second line — so the promise about the record
   and the gesture that makes it are one thing. A tap on it stages it, and so
   does the name field's keyboard action key — and either way the picker stays
   open (jakob, 2026-10-01; `TagPicker`): the row moves up into the staged
   section with its × and the name stays in the field, so the stage is seen
   right under where it was made — and heard, `PickAnnouncement`'s `Added — in
   the staged list.` — and the reader clears the field to name the next tag.
   Nothing is staged on this board yet, so the status message is mounted and
   silent. Here the typed name is also a
   name in use, and it is that one row: a name is never listed twice. Rows the
   index matches sit under it (`TagPicker`).

   THE GATE IS STATED, NOT DISCOVERED. A legal name is exactly an L1 identifier
   atom — ASCII letters, digits, `.`, `_`, `-`, 1 to 128 bytes
   (hashtag.md §1, layer1-interface.md §8.1) — and a string outside it names no
   Type and is refused at the field. The rule sits under the field permanently,
   the way the describe sheet's reason does, because a reader who is told the
   shape up front never meets the refusal at all. Nothing here is punycoded or
   percent-encoded into legality: hashtag.md refuses that outright — encoding
   changes what a name means while leaving it looking the same, in the one
   identifier meant to stay human-legible.

   IT IS THE SAME BOARD AS `TagPicker`, ONE STATE ON. Only the field, the rule
   line and the list narrow; the header, the footnote and the row shape do not
   move, because they are the same picker.

   A STRING OUTSIDE THE GATE IS REFUSED AT THE FIELD, and `TagPickerRefused` is
   that state: the bar takes the error ring and this line carries the refusal
   instead of the rule. The two boards are one picker at two moments, the way
   this one and `TagPicker` are.

   `Done` IS THE HEADER BACK'S AFFIRMATIVE TWIN (jakob, 2026-10-01; `TagPicker`):
   the same leave to the composer, every staged tag kept. Neither stages the
   typed name: leaving is navigation, and only a pick adds. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Add a tag" action={<HelpDot ariaLabel="Tagging" />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="#SaltMaps" placeholder="Name a tag" ariaLabel="Name a tag" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 24px 8px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
            Letters, digits, dot, dash and underscore. Capitals become lowercase.
          </p>
        </div>
        <PickAnnouncement />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="topic" name="saltmaps" sub="Signs as #saltmaps" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <div style={{ flex: 1 }} />
        <p style={{ margin: 0, padding: "8px 24px 16px", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
          Any name works, used or not — nobody owns a tag. It is yours the moment you sign.
        </p>
      </div>
      <div style={{ flex: "none", padding: "0 24px 24px" }}>
        <Button style={{ width: "100%" }}>Done</Button>
      </div>
    </>
  );
}
