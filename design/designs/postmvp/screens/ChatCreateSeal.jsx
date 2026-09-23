/* THE FOUNDING'S SEAL — what `Next` on the new group chat opens (would-like
   #3; jakob 2026-09-23).

   THE PROFILE SAVE'S PRECEDENT: a form, then a seal. `ProfileEditSeal`'s
   anatomy — `WizardHeader` with its two ways out, the stage named `Last step`
   and the seal's "?", the thing being signed shown back at the top, the acts
   card, one quiet true line, and `SealFooter` at the foot.

   WHAT IS SIGNED IS THE RECORD'S OWN SHAPE (chats.md §3–§4). Founding is the
   founder's own Participant act, and its payload carries the name, the
   description, the picture and the chat's rules; each picked person is invited
   by an Invitation of their own — a public vouch that they fit — and becomes a
   member only when they accept. So the acts card has two rows, the chat and
   the invitations, counted like every other seal's rows, and the batch lands
   whole or not at all.

   THE RULES ARE NOT READ BACK. The governance map rides the founding payload,
   and it ships its default silently (jakob): the seal names who can join,
   which the founder chose, and nothing about who decides.

   THE ONE LINE SAYS WHAT A FOUNDER FROM ANY OTHER MESSENGER CANNOT GUESS: the
   chat is public, and so is who is in it (chats.md §1).

   Sealing opens the new chat's thread, empty but for its founding, with the
   invitations on their way. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave — nothing is started" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden="true"
            style={{ flex: "none", width: 64, height: 64, display: "grid", placeItems: "center", borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)" }}
          >
            <Icon name="forum" size={28} />
          </span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Low-tide walks
            </span>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              A new group chat — invite only.
            </span>
          </span>
        </div>

        <ActsCard
          rows={[
            { label: "Chat", value: "Low-tide walks", count: "1", countNoun: "chat" },
            { label: "Invitations", value: "Ada Okonkwo, Tobias Lindqvist", count: "2", countNoun: "invitation" },
          ]}
          total="3 things, signed together"
          note="They land together, or none does."
        />

        <FactRow label="Who can join" value="Invite only" last />

        <QuietNote>A chat is public: its name, who is in it and who talks to whom are there for anyone to read.</QuietNote>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign and start the chat" />
      </div>
    </>
  );
}
