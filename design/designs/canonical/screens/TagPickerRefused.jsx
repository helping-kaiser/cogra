/* THE TAG PICKER REFUSING A NAME (readme §13, the caps-affordance round;
   backlog 46.3; the typed-name row, 2026-09-30). The state `TagPickerTyping`
   names the rule for: a string outside the identifier atom denotes no Type,
   so the field says so where the typing is.

   THE FIELD-ERROR STATE, IN THE SEARCH BAR'S IDIOM. The pill takes the
   `--error` ring and the line under it carries the refusal in words — the same
   two things a `TextField` does, on the one capped field in the product that is
   a search bar rather than an input. Nothing new is invented for it: the ring
   replaces the outline, the line replaces the label, the message sits where the
   naming rule sat.

   THE FIRST ROW GOES, BECAUSE NOTHING WOULD BE SIGNED. The list's first row is
   always the canonicalized typed name, `Signs as #saltmaps` on its second line
   — a promise about the record the tap will make; a name that cannot be a name
   has no such record, and leaving a row there showing some cleaned-up guess
   would be the product inventing a name the reader did not type. The rule line
   turns into the refusal and the first row simply is not there — so the name
   field's keyboard action key, which stages the first row, stages nothing.

   AND THE LIST IS EMPTY WITHOUT SAYING SO. The rows answer a name; an illegal
   string has none, and an empty-list message here would be a second voice
   saying the same thing the field already said. The footnote stays: it is
   about tags, not about this string.

   A SPACE IS THE REFUSAL DRAWN because it is the one a reader reaches by
   habit — names are written with spaces everywhere else in the product. The
   other half of the gate is length (128), which refuses in the same line.

   `Done` STILL LEAVES (jakob, 2026-10-01; `TagPicker`). It is the header back's
   affirmative twin, the same leave to the composer with every staged tag kept —
   the tags picked before the refusal included, since a pick stages at once and
   the picker stays open; the refused name stages nothing, so nothing is added
   on the way out. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Add a tag" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="#salt maps" placeholder="Name a tag" error describedBy="tag-name-refusal" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 24px 8px" }}>
          <p
            id="tag-name-refusal"
            role="alert"
            style={{
              margin: 0,
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              letterSpacing: "var(--text-body-small--letter-spacing)",
              color: "var(--error)",
            }}
          >
            A tag name is letters, digits, dot, dash and underscore.
          </p>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
