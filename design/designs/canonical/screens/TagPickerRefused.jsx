/* THE TAG PICKER REFUSING A NAME (readme §13, the caps-affordance round;
   backlog 46.3). The state `TagPickerTyping` names the rule for: a string
   outside the identifier atom denotes no Type, so the field says so where the
   typing is.

   THE FIELD-ERROR STATE, IN THE SEARCH BAR'S IDIOM. The pill takes the
   `--error` ring and the line under it carries the refusal in words — the same
   two things a `TextField` does, on the one capped field in the product that is
   a search bar rather than an input. Nothing new is invented for it: the ring
   replaces the outline, the line replaces the label, the message sits where the
   naming rule sat.

   THE PREVIEW GOES, BECAUSE NOTHING WOULD BE SIGNED. `Signs as #saltmaps` is a
   promise about the record the tap will make; a name that cannot be a name has
   no such record, and leaving the line there showing some cleaned-up guess
   would be the product inventing a name the reader did not type. The rule line
   turns into the refusal and the preview simply is not there.

   AND THE LIST IS EMPTY WITHOUT SAYING SO. The candidate rows answer a name; an
   illegal string has none, and an empty-list message here would be a second
   voice saying the same thing the field already said. The footnote stays: it is
   about tags, not about this string.

   A SPACE IS THE REFUSAL DRAWN because it is the one a reader reaches by
   habit — names are written with spaces everywhere else in the product. The
   other half of the gate is length (128), which refuses in the same line. */
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
    </>
  );
}
