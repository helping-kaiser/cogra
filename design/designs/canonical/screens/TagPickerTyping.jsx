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

   THE GATE IS STATED, NOT DISCOVERED. A legal name is exactly an L1 identifier
   atom — ASCII letters, digits, `.`, `_`, `-`, 1 to 128 bytes
   (hashtag.md §1, layer1-interface.md §8.1) — and a string outside it names no
   Type and is refused at the field. The rule sits under the field permanently,
   the way the describe sheet's reason does, because a reader who is told the
   shape up front never meets the refusal at all. Nothing here is punycoded or
   percent-encoded into legality: hashtag.md refuses that outright — encoding
   changes what a name means while leaving it looking the same, in the one
   identifier meant to stay human-legible.

   IT IS THE SAME BOARD AS `TagPicker`, ONE STATE ON. Only the field, the
   preview line and the list narrow; the header, the footnote and the row shape
   do not move, because they are the same picker.

   A STRING OUTSIDE THE GATE IS REFUSED AT THE FIELD, and `TagPickerRefused` is
   that state: the bar takes the error ring and this line carries the refusal
   instead of the rule. The two boards are one picker at two moments, the way
   this one and `TagPicker` are. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Add a tag" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="#SaltMaps" placeholder="Name a tag" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 24px 8px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Signs as <strong style={{ fontWeight: "var(--text-title-medium--font-weight)" }}>#saltmaps</strong>
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
            Letters, digits, dot, dash and underscore. Capitals become lowercase.
          </p>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="topic" name="saltmaps" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <div style={{ flex: 1 }} />
        <p style={{ margin: 0, padding: "8px 24px 16px", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
          Any name works, used or not — nobody owns a tag. It is yours the moment you sign.
        </p>
      </div>
    </>
  );
}
