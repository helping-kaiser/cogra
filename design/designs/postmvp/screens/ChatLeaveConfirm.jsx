/* LEAVING A CHAT — the think-twice dialog behind the details' `Leave this
   chat` (round B1 of the chats work; jakob's rulings 2026-09-23).

   LEAVE IS UNILATERAL AND UNCONDITIONAL (jakob; chats.md §4, *Leaving*). No
   vote, no approval, no membership precondition — one Leave record in the
   reader's name. So the dialog asks once and nothing stands between the
   answer and the act.

   `RemoveConfirm`'S ANATOMY, `VersionRemoveConfirm`'S PRECEDENT: the dialog
   surface, the heading as the question, the body saying what happens, the
   safe answer filled on the right and the act a text button beside it — and
   no error colour, because a reader leaving a chat is doing what they meant
   to. `Stay` is the safe answer's word: it says what staying keeps.

   WHAT THE BODY HAS TO SAY. That the chat leaves their list — and that it
   does not leave the world: a chat is public, so they can read it on as
   anyone can, but not write in it, and what the members encrypt from now on
   is closed to them (a leave rotates the key, chats.md §7; what they could
   already read stays theirs). Then that the leaving is itself a public record
   in the chat's history. It promises nothing about coming back: whether a
   leaver's return needs a fresh invitation turns on the backing clause
   (chats.md §4 — an earlier Invitation may still back a new Participant),
   and a dialog that guessed would be wrong for someone.

   THE OPTIONAL PARTING REASON (jakob: the Leave record carries one as its
   payload). ITS LEGITIMACY IS ON RECORD: layer1-interface.md's act payload
   schema (``tbl:nodes:act-payload-schema``) names the Leave act's canonical
   payload a "parting reason", and jakob kept the field on the fix pass
   against his own first instinct — "if the interface says so then the L1
   author intended it to exist" (2026-09-23). One field, the sensitive sheet's `Why?` exactly — `TextField` at
   `rows={1}`, its corner saying it is optional and where it will be read —
   and it GROWS by the growth law: a reason that runs past one line takes a
   second and the dialog's body grows with it. With the keyboard up on a short
   phone the dialog keeps its heading and its answers in view and scrolls what
   stands between them — the sheet's short-viewport clause, read for a dialog
   (the lane's reading, flagged). Drawn at its minimum, empty: the state the
   dialog opens in. Where one is given it stands in the chat's edit history,
   quoted under `left` (`ChatHistory`).

   THE OPINION DOOR IS NOT OFFERED HERE — the lane's call from the dialog
   grammar, flagged. The docs pair a rage-quit with a negative opinion on the
   chat (chats.md §4), and that pairing is already one glance away: the chat's
   own opinion control stands on the details under this scrim. A third answer
   in a think-twice dialog would turn one decision into two, and an opinion
   prompt at the moment of leaving would read as the product asking the
   reader to be angry. The opinion is theirs to give or not, as before.

   THE SURFACE BENEATH IS THE DETAILS, whole and inert (`HelpDialog`'s rule). */
export function Screen() {
  return (
    <>
      <ChatDetailsBody />
      <DialogSurface ariaLabel="Leave Coast walkers?">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            Leave Coast walkers?
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            It leaves your chats. You can still read it the way anyone can, but you can't write in it, and what its members encrypt from now on stays closed to you.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Leaving is signed, and it shows in the chat's history.
          </p>
          <TextField label="Why?" corner="Optional — shown in the chat's history" rows={1} value="" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Leave</Button>
            <Button>Stay</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
