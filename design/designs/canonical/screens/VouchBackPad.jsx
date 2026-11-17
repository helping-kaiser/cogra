/* The first vouch — the MASTER pad, parked open over the vouch card. The card,
   its readouts, the "?" and the buttons are all StanceControl's own anatomy;
   this screen contributes only the one-time coaching lines (`padNote`) and the
   wash.

   `PadLine` LIVES IN `_shared.jsx` (the invites round): the approval pad on
   the other side of this same handshake draws the identical line, and a pad's
   own voice written twice is a pad's own voice that drifts. The card beneath
   the wash is `VouchBackCard`, `VouchBack`'s own, in its olive register, its
   row as `VouchBack` draws it: `Got it` leading, then `VouchBackHint`'s line
   against the face the pad bloomed from (jakob 2026-10-13).

   REGISTERED under the feed's own prefix (design ⇄ impl seam 086), the shell
   beneath named as on `VouchBack` and the stance control `stance`, as on
   `VouchAskPad`. The open pad carries `StanceControl`'s pad anatomy (jakob
   2026-10-07, ruling 40) under `feed.vouchCard.stance.pad`, the coaching
   lines as its `note`; the wash stays unnamed — no registered board names a
   scrim yet.

   THE `pad` CHIP'S `help` DRAWS THE PAD'S `?` TAPPED (round 48, seam 323-5):
   the help `Your vouch back` replaces the pad's body in place, its four lines
   `YOUR_VOUCH_BACK_HELP`'s — the in-place grammar's four-line precedent (the
   pad's own four help lines; copy-voice, *The `?` dialogs*) — with Set disabled
   while it shows. The help copy is a drawn copy and carries no names: naming it
   would key every path of the open pad by the chip, a key-rule change. */
export const NODE = "feed";
export const PROPS = { pad: { editor: "enum", options: ["rest", "help"], default: "rest" } };
export const VALS = `restShown: this.props.pad === "help" ? "none" : "contents", helpShown: this.props.pad === "help" ? "contents" : "none"`;
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
        <div style={{ display: "{{restShown}}" }}>
        <VouchBackCard
          body="Vouch back to open the way from your side — your opinion toward @mira, and your feed grows from it."
          node="vouchCard"
          actions={
            <>
              <Button variant="text" style={{ color: "var(--on-tertiary-container)" }} node="dismiss">
                Got it
              </Button>
              <span style={{ flex: 1 }} />
              <VouchBackHint node="hint" />
              <StanceControl
                node="stance"
                targetLabel="@mira"
                helpLabel="Your vouch back"
                help={YOUR_VOUCH_BACK_HELP}
                lineFaceInk="var(--on-tertiary-container)"
                defaultOpen
                defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
                padInset={80}
                padNote={
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }} data-node="note">
                    <PadLine>Your vouch back. The pad is how you shape what reaches you — for or against, and how much.</PadLine>
                    <PadLine>Nothing is signed until Set.</PadLine>
                  </div>
                }
              />
            </>
          }
        />
        </div>
        <div style={{ display: "{{helpShown}}" }}>
        <VouchBackCard
          body="Vouch back to open the way from your side — your opinion toward @mira, and your feed grows from it."
         
          actions={
            <>
              <Button variant="text" style={{ color: "var(--on-tertiary-container)" }}>
                Got it
              </Button>
              <span style={{ flex: 1 }} />
              <VouchBackHint />
              <StanceControl
               
                targetLabel="@mira"
                helpLabel="Your vouch back"
                help={YOUR_VOUCH_BACK_HELP}
                lineFaceInk="var(--on-tertiary-container)"
                defaultOpen
                defaultExplaining="help"
                defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
                padInset={80}
                padNote={
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <PadLine>Your vouch back. The pad is how you shape what reaches you — for or against, and how much.</PadLine>
                    <PadLine>Nothing is signed until Set.</PadLine>
                  </div>
                }
              />
            </>
          }
        />
        </div>
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays sharp. */}
      <div style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
