/* DELETE ACCOUNT · CONFIRMED — what the emailed link opens (jakob
   2026-10-01, audit K3.22; `docs/instances/erasure.md` §5 step 2,
   `ConfirmAccountDeletionInput.includeContent`).

   OPENING THE LINK IS THE CONFIRMATION, as `DeleteAccountMail` promised, so
   this page states what that started: the deadline, in the band's own
   sentence with the day count it has on its first day, and the date beside
   it — a far date spelled out, the forward ladder's rule. What holds until
   then is said once more, because it is the fact a reader most needs at the
   moment the clock starts: nothing changes yet, and any device can cancel.

   THE SECOND MOMENT FOR THE CONTENT SWEEP. Canon allows the sweep to be
   chosen at the request or at the confirmation, and this page is the
   confirmation's, so when the request left it off the page offers it again —
   `DeleteAccount`'s own checkbox and its own line, word for word, since it is
   the same choice, and a commitment to add it, because a checkbox takes
   effect only when committed (`DeleteAccount`'s reason for the control).
   Added, the heading takes the band's longer sentence and the block goes,
   with a snackbar. When the sweep was chosen at the request the block is not
   drawn and the heading is the longer sentence from the start. It is never
   offered the other way: the election is opt-in only. The checkbox is purely
   that opt-in: committed with the box unticked, the deletion stands
   confirmed account-only, exactly as the link left it (jakob 2026-10-02).

   A MAIL-LINK LANDING. No back arrow — a mail link has no previous screen of
   ours — and `VerifyExpired`'s left column rather than `Verified`'s centred
   one, because this landing carries a form control. The way on is the plain
   text button. Signed out the confirmation applies all the same, since the
   link is the proof, and the page says so in one quiet line above the way
   on, which then reads `Sign in`.

   REGISTERED under the `deleteAccount` prefix (design ⇄ impl seam 080, the
   deletion packet): the request screen's sweep, its checkbox and its line,
   keep their names here, and the way on is `onward`.

   THE LINK THAT GETS NO ANSWER (round 27, seam 252; the `answer` chip). The
   landing states a confirmation, so with no answer there is nothing to state:
   the page holds the fault family's one shape in its place (round 25,
   `ProfileUnreachable`, the pickers, `Notifications`) — the house line's noun
   form, `Can't reach the server — the deletion can't be confirmed right
   now.`, over an OUTLINED control, sized to its word and leading the column.
   Its word is `Try again`, not the reads' `Retry`, because the act is the
   link's confirm checked again, not a read (copy-voice, *No answer at all*);
   the shape is the family's, since the word is the only thing this surface's
   register changes. `limited` is the confirm refused by its budget: `Too many
   tries. Wait a little, then try again.` in the line's place, over the same
   control. Neither starts the grace. Named `fault` and its `retry`, as the
   pickers' are; each copy keyed by the chip's value. */
export const NODE = "deleteAccount";
export const PROPS = { answer: { editor: "enum", options: ["confirmed", "fault", "limited"], default: "confirmed" } };
export const VALS = `confirmedShown: this.props.answer === "confirmed" ? "flex" : "none", faultShown: this.props.answer === "fault" ? "block" : "none", limitedShown: this.props.answer === "limited" ? "block" : "none"`;
const FAULT = (message) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-3)" }} data-node="fault">
    <TransportError message={message} />
    <Button variant="outline" size="sm" selfStart node="retry">
      Try again
    </Button>
  </div>
);
export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <div style={{ display: "{{faultShown}}" }} data-node-chip="answer" data-node-key="fault">
        {FAULT("Can't reach the server — the deletion can't be confirmed right now.")}
      </div>
      <div style={{ display: "{{limitedShown}}" }} data-node-chip="answer" data-node-key="limited">
        {FAULT("Too many tries. Wait a little, then try again.")}
      </div>
      <div style={{ display: "{{confirmedShown}}", flexDirection: "column" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
        data-node="title"
      >
        Your account is deleted in 7 days
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          letterSpacing: "var(--text-body-medium--letter-spacing)",
          color: "var(--text-secondary)",
        }}
        data-node="body"
      >
        That's 08.10.2026. Until then nothing changes, and you can cancel from any device.
      </p>

      <div style={{ marginTop: 24 }}>
        <Checkbox id="delete-content" label="Also remove what I posted" node="sweep" />
        <p
          style={{
            margin: "var(--space-1) 0 0",
            paddingLeft: 30,
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
          data-node="sweepHint"
        >
          The words and pictures go out of your posts and comments, each leaving its mark. Leave this off and they stay
          as you wrote them.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <Button variant="outline" style={{ width: "100%" }} node="add">
          Add it to the deletion
        </Button>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button variant="text" style={{ width: "100%" }} node="onward">
          Go to the feed
        </Button>
      </div>
      </div>
    </div>
  );
}
