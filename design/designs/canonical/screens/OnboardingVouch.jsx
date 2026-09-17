/* INTRO 5 OF 5 — SOMEONE BRINGS YOU IN (jakob's ruling, the batch-rulings
   round; backlog item 74). His sketch: "your new node (dot) with a friends node
   pointing at you (super cool would be if it was always the avatar of the
   person who actually invited you...)".

   THE INVITER'S FACE IS PERSONALIZED BY THE CLIENT — an implementation relay,
   not a drawn state. The board draws the canvas's own inviter, @mira, exactly
   as `Join` does, and the contract is: at run time this face is the ACTUAL
   link-issuer's avatar, falling back to the monogram `MonogramAvatar` already
   draws when there is no photo. One face changes; nothing else on the card
   moves with it.

   YOU ARE A DOT, AND THAT IS THE POINT. The reader has no avatar yet and no
   history behind them; drawing them as a face would promise a profile they have
   not made. The ring around the dot is the one thing said about it — this is
   new — and the arrow runs INTO it, because the direction is the whole
   teaching: somebody pointed at you first.

   THE APPLICANT LINE IS THE CARD'S SECOND DUTY (jakob's draft, polished). The
   intro fires from applicant on, and an applicant who does not know that a
   human still has to let them in reads the empty days as a broken product. It
   sits as a `QuietNote` under the words rather than in them: it is a task, not
   a principle, and the four cards before it were principles.

   THE LAST BUTTON READS `Start reading` — sentence case, the reader's own next
   act, and never "Done" or "Finish", which name the tour instead of the
   product. */

const STAGE = { width: 342, height: 160 };

export function Screen() {
  return (
    <IntroFrame
      step={5}
      cta="Start reading"
      headline="Someone brings you in"
      lines={["You are here because @mira vouched for you. Her link to you is where your own reach starts."]}
      note={
        <div style={{ paddingTop: 12 }}>
          <QuietNote>The friend who sent you this invite has to let you in. Ask them once you have verified your email.</QuietNote>
        </div>
      }
    >
      <IntroStage {...STAGE}>
        <IntroLines {...STAGE}>
          <path d="M 132 80 H 222" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="222,74 234,80 222,86" fill="var(--border-field)" />
        </IntroLines>
        <IntroFace x={80} y={80} size={88} name="Mira Voss" src="inviter.jpg" />
        <IntroCaption x={80} y={130}>@mira</IntroCaption>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 242,
            top: 52,
            width: 56,
            height: 56,
            boxSizing: "border-box",
            borderRadius: "var(--radius-full)",
            border: "1px dashed var(--border-field)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 258,
            top: 68,
            width: 24,
            height: 24,
            borderRadius: "var(--radius-full)",
            background: "var(--primary)",
          }}
        />
        <IntroCaption x={270} y={130}>you</IntroCaption>
      </IntroStage>
    </IntroFrame>
  );
}
