/* THE REPLY'S SEAL (legacy conversion, lane C): the comment wizard's last
   stage, where everything the signature commits is read back before it is
   given. Two stages, so this is also the stage where a comment's topics and
   references are named — which is why the card carries two add-rows where a
   post's seal carries none.

   IT IS `ReplyCited` WITHOUT THE REFERENCE. That board is this one after the
   picker hands a citation back: same header slots, same acts card, same three
   facts, same foot — with the staged reference as a row of its own, the total
   at two, and the all-or-nothing subline that a second act brings. Two boards,
   one anatomy, and now one source for it: the add-rows are `_shared.jsx`'s,
   and everything else here is the system's own masters.

   THE CITE ROW SAYS "+ Cite something". The hand board spelled it out — "a
   post, a person, a comment, an item" — while the staged twin said the short
   form, so one surface said two things depending on whether a reference had
   landed. The picker's own screen is where the kinds are enumerated. */
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

        {/* One act signed, so no all-or-nothing subline: it appears the moment a
            signature carries more than one thing (`ActsCard`'s rule). */}
        <ActsCard
          rows={[
            { label: "Comment", value: "Reply to @ada's post", count: "1 action" },
            { label: "", value: <AddRow>+ Add a topic</AddRow>, count: "1 more action" },
            { label: "", value: <AddRow>+ Cite something</AddRow>, count: "1 more action" },
          ]}
          total="1 signed action"
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
