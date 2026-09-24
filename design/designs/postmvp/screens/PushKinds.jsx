/* PUSH NOTIFICATIONS · the kinds — what the settings row opens
   (docs/implementation/notifications.md; jakob's rulings 2026-09-22, and the
   chats integration round's revision 2026-09-24).

   THE MASTER AND THE KINDS (jakob). One switch for the channel and one per
   kind, the doc's own taxonomy in the doc's own order, unclustered. A
   clustering — "people", "your account" — would be a second taxonomy to keep
   in step with the first, and the first is the one the contract enumerates.

   THE GRANULARITY IS THE STRATEGY, not a refinement of it. A reader who can
   only turn the whole channel off turns the whole channel off; a reader who
   can silence replies keeps comments. So the kinds are cheap to reach — one
   row each, one tap each, no sub-pages under this one.

   THE ROWS CARRY NO SECOND LINE, and that is the switch law read rather than
   broken. A switch takes a status line because its label alone cannot say what
   turning it on does; here the group heading supplies the verb and the label
   supplies the object, so the sentence is already whole.

   THE DEFAULTS ARE DRAWN, EXACTLY AS RULED. On: a comment on your post, and
   the three moments an application turns. Off: replies, mentions, citations,
   opinions on you, and someone landing through your invite. What is on is what
   a reader is answerable for; what is off is what the list holds perfectly
   well until they look.

   THE CHATS REVISION (the integration round, 2026-09-24):
   · THE THREE CHAT KINDS JOIN THE LIST'S GROUP, in the list's order, because
     each is a notification row like the nine (`ChatNotifications`): an
     invitation, a request awaiting your approval, your request approved.
     THEIR DEFAULTS ARE THE LANE'S, BY ANALOGY, FLAGGED — all three on: a
     request waiting on you is `Applicants ready for your approval` one surface
     over, an approval of yours is `Your application approved`, and an
     invitation is addressed to one person and waits on them.
   · CHAT MESSAGES ARE THEIR OWN GROUP, AND ON. The push round's forward note,
     drawn: "a message addressed to one person and waiting is the clearest case
     the on-set has". It is the ONE KIND WITH NO ROW IN THE LIST — messages
     never write bell rows (ruled; the chats icon's dot carries unread) — so
     push here delivers what the THREAD already holds, and its tap lands in the
     thread on the message. The title is the chat's name (the sender's alone in
     a 1:1), the body the preview row's words — `Mira Voss: Six it is.` —
     decrypted on the device where the key is held, `An encrypted message`
     where it is not. That is the push round's law (push says what the drawn
     row says) with the thread's preview standing in for a bell row.
   · PER-CHAT MUTE SITS UNDER IT. `Mute this chat` (the details, the row menu)
     silences one chat's messages here; the group's footnote says so, because a
     reader looking for a quiet chat looks on this page first.
   · STILL UNDECIDED, AND NOT DRAWN: whether messages split into buckets —
     1:1 chats versus groups, each with its own switch. It is the one
     refinement every messenger offers and the one this page has not been
     asked for; one switch stands until it is.

   THE FOOTNOTE FIGHTS THE ONE WRONG BELIEF. Push is delivery of what already
   exists, so nothing on this page changes what notifies — and a reader who
   thinks otherwise will never turn a kind off. */
export const FRAME = { width: 390, height: 1180 };

export function Screen() {
  return (
    <>
      <PageHeader title="Push notifications" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "24px 24px 32px" }}>
        <SettingsGroup
          ariaLabel="Push notifications"
          footnote="With push off, nothing is lost — everything still waits in Notifications."
        >
          <SettingsRow
            checked
            label="Push notifications"
            status="Announce new notifications the moment they arrive."
            onOpen={() => {}}
          />
        </SettingsGroup>

        <SettingsGroup label="Announced right away">
          <SettingsRow checked label="Comments on your posts" onOpen={() => {}} />
          <SettingsRow checked={false} label="Replies to your comments" onOpen={() => {}} />
          <SettingsRow checked={false} label="Mentions of you" onOpen={() => {}} />
          <SettingsRow checked={false} label="Citations of your posts and comments" onOpen={() => {}} />
          <SettingsRow checked={false} label="Opinions on you" onOpen={() => {}} />
          <SettingsRow checked label="Applicants ready for your approval" onOpen={() => {}} />
          <SettingsRow checked={false} label="People landing through your invites" onOpen={() => {}} />
          <SettingsRow checked label="Your application approved" onOpen={() => {}} />
          <SettingsRow checked label="Your application closed" onOpen={() => {}} />
          <SettingsRow checked label="Invitations to chats" onOpen={() => {}} />
          <SettingsRow checked label="Requests to join your chats" onOpen={() => {}} />
          <SettingsRow checked label="Your requests to join approved" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup label="Chats" footnote="A muted chat stays quiet here — mute one from its details or by holding its row.">
          <SettingsRow checked label="New messages" onOpen={() => {}} />
        </SettingsGroup>
      </div>
    </>
  );
}
