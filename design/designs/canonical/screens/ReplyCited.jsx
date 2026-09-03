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

function SealRow({ label, value, action, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderTop: "1px solid var(--border-hairline)", borderBottom: last ? "1px solid var(--border-hairline)" : undefined }}>
      <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap" }}>{label}</span>
      {value}
      <button
        type="button"
        className="cg-state cg-focus cg-hit"
        style={{ border: 0, background: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", letterSpacing: "var(--text-label-large--letter-spacing)", color: "var(--primary)", flex: "none" }}
      >
        {action}
      </button>
    </div>
  );
}

/* The card's own affordance rows — a primary word where a value would sit, so
   what you could still add lines up with what you have already added. */
function AddRow({ children }) {
  return (
    <button
      type="button"
      className="cg-state cg-focus"
      style={{ border: 0, background: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {children}
    </button>
  );
}

export function Screen() {
  return (
    <>
      <WizardHeader
        title="What you sign"
        leaveLabel="Leave — the reply is discarded"
        action={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Last step</span>
            <SystemHelpDot ariaLabel="Signed actions" />
          </span>
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Reply to "The long way home" — 89 characters.
        </p>

        <ActsCard
          rows={[
            { label: "Comment", value: "Reply to @ada's post", count: "1 action" },
            { label: "Reference", value: "Tide tables and the third headland — @juno", count: "1 action" },
            { label: "", value: <AddRow>+ Add a topic</AddRow>, count: "1 more action" },
            { label: "", value: <AddRow>+ Cite something — a post, a person, a comment, an item</AddRow>, count: "1 more action" },
          ]}
          total="2 signed actions"
          note="they land together, or none does"
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <SealRow
            label="Toward what you answer"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
          />
          <SealRow label="License" value={<span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Public domain — your default</span>} action="Change" />
          <SealRow label="Sensitive" value={<span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>Not marked</span>} action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button style={{ width: "100%" }}>Sign comment</Button>
          <Button variant="text" style={{ width: "100%" }}>Back</Button>
        </div>
      </div>
    </>
  );
}
