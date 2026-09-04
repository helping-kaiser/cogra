/* THE REPLY'S SEAL WITH A REFERENCE STAGED (readme §13, the menus round).
   Referencing from inside a comment lives inside the comment's own wizard: the
   seal already carries "+ Add a topic" and "+ Cite something" side by side,
   because in a two-stage wizard the seal IS the stage where a comment's
   topics and references are named. This is what that surface looks like once
   the picker has handed one back.

   A STAGED REFERENCE IS AN ACT, so it joins the acts card rather than sitting
   beside it — the total counts it, and the all-or-nothing subline appears the
   moment a signature carries more than one thing. A references block floating
   below the card would let the count and the content disagree.

   IT IS AN ENTRY, NOT A DESTINATION: the picker's result row lands back in the
   composer it was opened from, so nothing navigates here. `PostLicense` is the
   same shape — a state of a surface, drawn because it is designed, declared as
   an entry because no tap reaches it. */

/* The card's own affordance rows — a primary word where a value would sit, so
   what you could still add lines up with what you have already added. It is
   `InlineAction`'s small rung, left-aligned and held to one line, and it does
   NOT clip itself (jakob's ruling): the acts row's value slot already ends a
   long value in an ellipsis, and a second `overflow: hidden` on the word only
   cut the atom's 48px hit overlay back to the ink. Truncation belongs to the
   row; the target belongs to the word. */
function AddRow({ children }) {
  return (
    <InlineAction size="sm" style={{ textAlign: "left", whiteSpace: "nowrap" }}>
      {children}
    </InlineAction>
  );
}

export function Screen() {
  return (
    <>
      <WizardHeader
        title="What you sign"
        leaveLabel="Leave — the reply is discarded"
        stageLabel="Last step"
        help="Signed actions"
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Reply to "The long way home" — 89 characters.</QuietNote>

        <ActsCard
          rows={[
            { label: "Comment", value: "Reply to @ada's post", count: "1 action" },
            {
              label: "Reference",
              value: (
                <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Tide tables and the third headland — @juno</span>
                  <button
                    type="button"
                    aria-label="Remove Tide tables and the third headland"
                    className="cg-state cg-focus"
                    style={{ flex: "none", display: "grid", placeItems: "center", height: 32, width: 32, border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </span>
              ),
              count: "1 action",
            },
            { label: "", value: <AddRow>+ Add a topic</AddRow>, count: "1 more action" },
            { label: "", value: <AddRow>+ Cite something</AddRow>, count: "1 more action" },
          ]}
          total="2 signed actions"
          note="they land together, or none does"
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow
            label="Toward what you answer"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
          />
          <FactRow label="License" value="Public domain — your default" action="Change" />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign comment" />
      </div>
    </>
  );
}
