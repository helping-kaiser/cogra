/* The seal, gated on uploads (media slice): the acts card is the master
   ActsCard, the gate is UploadStatusLine, and nothing signs until the content
   it signs exists.

   THE GATE NAMES ITS CONTENT (jakob 2026-10-02, pads 3): pictures read
   `…signing waits for the pictures.`, a clip from `ComposeDetailsVideo`
   `…signing waits for the video.` (`UploadStatusLine`'s `media`).

   THE COMMIT STAYS ENABLED THROUGH THE GATE (jakob 2026-10-02, the fix-fix
   round's 20). `Sign and publish` is drawn as it is at rest, pressable while
   the line shows. Pressed, its label swaps in place to the in-flight word,
   `Signing and publishing…` — the failure pack's label-swap idiom
   (`SealFooter`'s `busy`): inert from the press, the word once the wait
   passes 200ms, never dimmed and no spinner, and from the press Back reads `Close`. Signing proceeds the moment the bytes land; no
   second press is asked. Unpressed, the line goes when the last upload lands
   and the commit stands as it was.

   AN UPLOAD THAT FAILS DROPS A HELD PRESS (jakob 2026-10-02, the residue
   round's Q5). The label reads `Sign and publish` again, the ways out answer
   again and nothing signs; `Retry` re-gates, and the reader presses again.

   THE SLOW LINE COUNTS FROM THE PRESS (jakob 2026-10-02, the residue round's
   Q6): the reader's wait starts at their gesture, so 5s after it the acts
   card's subline swaps to `Still signing — the network is slow right now.`,
   whether the bytes have landed yet or not. 
   THE `state` CHIP'S `signing` IS A PRESS WHILE THE UPLOADS RUN, CLOSED ON
   (round 37, jakob 2026-11-11). The press is the act, held only until the
   bytes land: past 200ms `Signing and publishing…` stands over `Close`, and
   Close, the arrow and the X leave the seal while the uploads finish and the
   signing proceeds. An upload that fails after Close signs nothing, and says
   so where the post would stand, as a failed signing does
   (`SigningAfterClose`); the draft is kept. */

export const PROPS = { state: { editor: "enum", options: ["rest", "signing"], default: "rest" } };
export const VALS = `restFootShown: this.props.state === "signing" ? "none" : "flex", signFootShown: this.props.state === "signing" ? "flex" : "none"`;

export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Sunday at the tide market — 4 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Sunday at the tide market", count: "1", countNoun: "post" },
            {
              label: "Tags",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#tidemarket" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2",
              countNoun: "tag",
            },
          ]}
          total="3 things, signed together"
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value={LICENSE_SUMMARY()} action="Change" />
          <FactRow
            label="Your backing"
            value={<AttachmentReadout pDirected={0.1} />}
            action="Adjust"
          />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <UploadStatusLine done={2} total={4} />

        <div style={{ display: "{{restFootShown}}", flexDirection: "column" }}>
          <SealFooter signLabel="Sign and publish" busyLabel="Signing and publishing…" />
        </div>
        <div style={{ display: "{{signFootShown}}", flexDirection: "column" }}>
          <SealFooter signLabel="Sign and publish" busy busyLabel="Signing and publishing…" />
        </div>
      </div>
    </>
  );
}
