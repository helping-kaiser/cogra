/* INVITING INTO A CHAT · the seal — what `Next` on `ChatInvitePicker` opens
   (round B2 of the chats work, the governance round; jakob 2026-09-23).

   THE FOUNDING SEAL'S ANATOMY, one step later in a chat's life
   (`ChatCreateSeal`, and `ProfileEditSeal` before it): `WizardHeader` with its
   two ways out, the stage named `Last step` and the seal's "?", the chat shown
   back at the top, the acts card, one quiet true line, and `SealFooter`.

   ONE INVITATION PER PERSON, AND THE CARD COUNTS THEM (chats.md §2, §4). Each
   is an Invitation record — Actor → Chat → Profile — a public, priced vouch
   that the person fits here, so two people are two records, `2 things, signed
   together`, landing whole or not at all. It is the founding seal's
   `Invitations` row without the chat beside it: the chat already exists.

   AN INVITATION IS THE INVITER'S OWN ACT, NEVER A CHAT DECISION. No proposal
   rides it, so no pending card follows and nobody else's voice is asked: the
   seal's act lands the invitations, and the details list each person as
   `Invited — hasn't joined yet` until they sign their own join
   (`ChatThreadInvited`). The thread's quiet line for the same fact is a state
   of the drawn thread (the details round), not a board.

   WITHDRAWING YOUR OWN INVITATION EXISTS IN THE DOCS — a De-invite from its
   own author withdraws their Invitation (chats.md §2) — and is a later surface,
   not drawn in this round.

   THE INVITATION'S OWN MESSAGE (the chats integration round, 2026-09-24) — the
   record's payload, "invitation message" in layer1-interface.md's act payload
   schema — is an optional field ON THIS SEAL, under the acts card. The lane's
   placement, flagged, from the sheet grammar's one precedent for an optional
   payload line: the Leave's parting reason lives in the confirm that signs it
   (`ChatLeaveConfirm`), and the request's message in the request's own sheet
   (`ChatAskSheet`), so the invitation's lives on the surface that signs the
   invitations — no extra step, and nothing typed before the reader has seen
   what they sign. ONE MESSAGE RIDES EVERY INVITATION IN THE BATCH; its corner
   says so, and that it is public like the invitation. The invitee meets it
   quoted at the foot of the chat (`ChatThreadInvited`) and as the second line
   of the notification row (`ChatNotifications`). The founding's seal takes no
   such field — its invitations are founding invitations, and a message there
   is a question this round does not open.

   THE ONE LINE says what a reader from any other messenger cannot guess: an
   invitation is public, it vouches, and it adds no one by itself. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" leaveLabel="Leave — nobody is invited" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ChatDisc image="post-photo.jpg" size={64} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              Coast walkers
            </span>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              Inviting two people into the chat.
            </span>
          </span>
        </div>

        <ActsCard
          rows={[{ label: "Invitations", value: "Wren Aliyev, Nadia Rask", count: "2", countNoun: "invitation" }]}
          total="2 things, signed together"
          note="They land together, or none does."
        />

        <TextField label="Message" corner="Optional — public, with each invitation" rows={1} value="Walks leave from the harbour office — come along on Friday." />

        <QuietNote>An invitation is public and vouches that they belong here. They join only if they accept.</QuietNote>

        <div style={{ flex: 1 }} />

        <SealFooter signLabel="Sign and invite" />
      </div>
    </>
  );
}
