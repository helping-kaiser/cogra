/* A MEMBER'S ROLE — what a role word on the details opens (round B2 of the
   chats work, the governance round; jakob 2026-09-23: role readouts are doors
   to `decision:change_role`'s face).

   A SHEET OF THE THREE ROLES, THE CURRENT ONE MARKED. `Admin`, `Moderator`,
   `Member` — the default map's roles in the reader's words — as `SettingsRow`
   choice rows, the founding's own `Who can join` idiom for "one of a few", the
   current role wearing the filled dot. The rows carry no lines saying what a
   role does: under the default map a role is a weight in the chat's decisions
   and, for admins and moderators, the approval of requests, and a sheet that
   printed weights would be the one place the count convention's quiet broke.
   Titled by the person, because the sheet covers the row it came from.

   CHOOSING IS THE PROPOSAL. Picking a role other than the current one opens
   the role change's seal — `ChatEditSeal`'s anatomy with the nouns swapped
   (`Change` · `Juno Baptiste — Moderator`, `Member` · `Juno Baptiste`, `Your
   opinion` · `For the change`, `3 things, signed together`), NOT DRAWN AGAIN:
   the same three records, the same card, the same pass — the lane's call,
   flagged. Then one of two outcomes, and the quiet line under the rows says
   both without naming the machinery:
   · INSTANT where the reader's say clears the gate (> 50% of the cast, a 30%
     quorum, the subject left out). In this fixture it does: the reader is
     Coast walkers' admin and weighs 5 of the 11 that decide about Juno — 45%,
     past the 3.3 the quorum asks — so the change is made and Juno's row reads
     `Moderator`.
   · A PENDING CARD where it does not — a member proposing, say — worded
     `{name} wants to make Juno Baptiste a moderator` in the thread and under
     `Open decisions`, the reader's own card counting only
     (`ChatThreadDecisions`).
   THE READER'S OWN ROLE IS NEVER THEIRS ALONE: the map leaves the subject out
   of the tally, so a change to the reader's own role always waits for others.

   Choosing the current role changes nothing and signs nothing. The scrim
   closes the sheet, nothing signed.

   THE SURFACE BENEATH IS THE MEMBER'S DETAILS, whole and inert — Coast
   walkers, where every role word is a door. */
export function Screen() {
  return (
    <>
      <ChatDetailsBody />
      <BottomSheet open ariaLabel="Juno Baptiste's role">
        <SheetTitle>Juno Baptiste's role</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 8px 24px" }}>
          <SettingsGroup ariaLabel="Roles" bare>
            <SettingsRow name="chat-role" selected={false} label="Admin" />
            <SettingsRow name="chat-role" selected={false} label="Moderator" />
            <SettingsRow name="chat-role" selected label="Member" />
          </SettingsGroup>
          <div style={{ padding: "0 16px" }}>
            <QuietNote>The chat decides roles together. If your say is enough, the change is made at once; if not, it waits in the chat until enough members agree.</QuietNote>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
