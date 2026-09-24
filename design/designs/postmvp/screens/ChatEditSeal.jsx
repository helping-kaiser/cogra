/* THE CHAT EDIT'S SEAL — what `Save` on `ChatEdit` opens (round B1 of the
   chats work; jakob's rulings 2026-09-23).

   `ProfileEditSeal`'S PRECEDENT, AND ITS ANATOMY: `WizardHeader` with its two
   ways out, the stage named `Last step` and the seal's "?", the thing being
   changed shown back at the top, the acts card, one quiet true line, and
   `SealFooter` with `Sign the change`. The founding's seal (`ChatCreateSeal`)
   wears the same parts, so a chat's two signed moments read as one family.

   THREE THINGS, SIGNED TOGETHER (jakob 2026-09-23, the fix pass — the
   founding seal's exact precedent). A change to a chat's metadata is always a
   decision, even a solo admin's: the default map's `decision:set:metadata`
   gate is > 50% of the weighted cast with a 10% quorum (chats.md §5), so the
   change is a proposal that passes on its proposer's own ballot. The reader
   therefore signs three records, and the card counts all three:
   · `Change` — the proposal's anchor, carrying the new version as its text;
   · `Chat` — its reference to the subject, the chat it changes;
   · `Your opinion` · `For the change` — the proposer's own +1 ballot, which
     the client signs with the anchor (governance.md: authoring is never a
     vote, so the ballot is its own priced act).
   They land together, or none does.

   THE INSTANT PASS, TRUTHFULLY. In this fixture the reader is the founder and
   admin: their ballot is the only one cast, it is 100% of the cast, and its
   weight clears the 10% quorum, so the tally crosses at the first epoch it
   lands in (governance.md) — to the reader, the change simply happens. What
   follows is not theirs to sign: the chat authority's finalization, and the
   SUCCESSION — a new lineage head whose founding payload carries the whole
   new version — signed by the chat's own system actor (chats.md §3, §8). The
   system actor's record never joins the reader's count. Where the reader's
   voice does NOT carry the tally, the same three records leave the change
   waiting: the reader's own quiet card in the thread, counting people with
   nothing left to press, and a row under `Open decisions`
   (`ChatThreadDecisions`, `ChatDetailsDecisions`). THIS SEAL IS ALSO THE
   MASTER for the governance round's other two proposals — a role change
   (`ChatRoleSheet`) and a version's removal (`ChatVersionRemoveConfirm`) —
   drawn once here and read with the nouns swapped.

   MESSENGER CLOTHES, EVEN HERE. The rows say what a reader recognises — a
   change, the chat, their opinion for it — and never proposal, ballot or
   tally; the count is honest and the vocabulary stays the product's (the
   chats round's charter). The "?" is the seal's own, `How signing works`.

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
              Name, picture and description — one change to the chat.
            </span>
          </span>
        </div>

        <ActsCard
          rows={[
            { label: "Change", value: "A new description", count: "1", countNoun: "change" },
            { label: "Chat", value: "Coast walkers", count: "1", countNoun: "link to the chat" },
            { label: "Your opinion", value: "For the change", count: "1", countNoun: "opinion" },
          ]}
          total="3 things, signed together"
          note="They land together, or none does."
        />

        <QuietNote>The change is public, and the chat's earlier versions stay readable in its edit history.</QuietNote>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign the change" />
      </div>
    </>
  );
}
