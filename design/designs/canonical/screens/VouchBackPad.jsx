/* The first vouch — the MASTER pad, parked open over the vouch card. The card,
   its readouts, the "?" and the buttons are all StanceControl's own anatomy;
   this screen contributes only the one-time coaching lines (`padNote`) and the
   wash.

   `PadLine` LIVES IN `_shared.jsx` (the invites round): the approval pad on
   the other side of this same handshake draws the identical line, and a pad's
   own voice written twice is a pad's own voice that drifts. The card beneath
   the wash is `VouchBackCard`, `VouchBack`'s own, in its olive register.

   REGISTERED under the feed's own prefix (design ⇄ impl seam 086), the shell
   beneath named as on `VouchBack` and the stance control `stance`, as on
   `VouchAskPad`. The open pad carries `StanceControl`'s pad anatomy (jakob
   2026-10-07, ruling 40) under `feed.vouchCard.stance.pad`, the coaching
   lines as its `note`; the wash stays unnamed — no registered board names a
   scrim yet. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band">
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view — your first opinion starts your own."
          node="borrowedViewBand"
        />
      </CograBand>
      <FeedList>
        <VouchBackCard
          body="Vouch back to open the way from your side — your opinion toward @mira, and your feed grows from it."
          node="vouchCard"
          actions={
            <>
              <Button variant="text" style={{ color: "var(--on-tertiary-container)" }} node="dismiss">
                Got it
              </Button>
              <StanceControl
                node="stance"
                targetLabel="@mira"
                helpLabel="Your vouch back"
                help={YOUR_VOUCH_BACK_HELP}
                defaultOpen
                defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
                padInset={80}
                padNote={
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }} data-node="note">
                    <PadLine>Your vouch back. The pad is how you shape what reaches you — for or against, and how much.</PadLine>
                    <PadLine>
                      Later, tap the small face under a post to open this — press and hold it instead and a gentle{" "}
                      <span aria-hidden="true">🙂</span>
                      <ExactTail exact=" (+0.10 / +0.10)" spoken="Nice, For or against +0.10, How much reaches you +0.10" />{" "}
                      is signed on the spot.
                    </PadLine>
                    <PadLine>Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.</PadLine>
                  </div>
                }
              />
            </>
          }
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays sharp. */}
      <div style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
