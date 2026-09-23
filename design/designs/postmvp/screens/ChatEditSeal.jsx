/* THE CHAT EDIT'S SEAL — what `Save` on `ChatEdit` opens (round B1 of the
   chats work; jakob's rulings 2026-09-23).

   `ProfileEditSeal`'S PRECEDENT, AND ITS ANATOMY: `WizardHeader` with its two
   ways out, the stage named `Last step` and the seal's "?", the thing being
   changed shown back at the top, the acts card, one quiet true line, and
   `SealFooter` with `Sign the change`. The founding's seal (`ChatCreateSeal`)
   wears the same parts, so a chat's two signed moments read as one family.

   ONE THING SIGNED (jakob): the change, in the reader's name. The acts card
   has one row — the chat, and what is new about it — because what a reader
   decides here is one decision.

   HOW THE CHANGE LANDS — THE SUCCESSION, EXECUTED FOR THE CHAT. A chat's
   metadata never changes in place: the new state is a succession, a new
   lineage head whose founding payload carries the whole new version, and it
   is always authored by the chat's own system actor, executing the chat's
   passed decision (chats.md §3, §5, §8). What the reader signs is that
   decision. Where their own voice suffices under the chat's governance map —
   this fixture: the founder and admin under the default map — it passes the
   moment it lands (governance.md: the first epoch whose tally crosses), the
   system actor executes, and the details show the new version
   with the old one kept in the edit history. Where the map needs more voices,
   the same `Sign the change` leaves the change waiting: a quiet pending card
   in the thread and a row under `Open decisions`. That multi-voice face is
   round B2's, and the graph carries it as an intended gap on this seal's act.

   MESSENGER CLOTHES, EVEN HERE. Nothing on the seal says proposal, ballot or
   tally: the reader changes their chat's description, and the machinery that
   makes it a community's decision stays underneath (the chats round's
   charter). The "?" is the seal's own, `How signing works`.

   THE ONE LINE says what a reader from any other messenger cannot guess: the
   change is public, and the old version stays readable. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ChatDisc image="post-photo.jpg" size={64} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Coast walkers
            </span>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              Name, picture and description — one signed change.
            </span>
          </span>
        </div>

        <ActsCard rows={[{ label: "Chat", value: "A new description", count: "1", countNoun: "chat change" }]} total="1 thing, signed" />

        <QuietNote>The change is public, and the chat's earlier versions stay readable in its edit history.</QuietNote>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign the change" />
      </div>
    </>
  );
}
