/* PUSH NOTIFICATIONS · the nine kinds — what the settings row opens
   (docs/implementation/notifications.md; jakob's rulings 2026-09-22).

   THE MASTER AND THE NINE (jakob). One switch for the channel and one per
   kind, the doc's own taxonomy in the doc's own order, unclustered. A
   clustering — "people", "your account" — would be a second taxonomy to keep
   in step with the first, and the first is the one the contract enumerates.

   THE GRANULARITY IS THE STRATEGY, not a refinement of it. A reader who can
   only turn the whole channel off turns the whole channel off; a reader who
   can silence replies keeps comments. So the nine are cheap to reach — one
   row each, one tap each, no sub-pages under this one.

   THE ROWS CARRY NO SECOND LINE, and that is the switch law read rather than
   broken. A switch takes a status line because its label alone cannot say what
   turning it on does; here the group heading supplies the verb and the label
   supplies the object, so the sentence is already whole. Nine status lines
   would be a wall in front of nine choices.

   THE DEFAULTS ARE DRAWN, EXACTLY AS RULED. On: a comment on your post, and
   the three moments an application turns. Off: replies, mentions, citations,
   opinions on you, and someone landing through your invite. What is on is what
   a reader is answerable for; what is off is what the list holds perfectly
   well until they look.

   THE FOOTNOTE FIGHTS THE ONE WRONG BELIEF. Push is delivery of a row that
   already exists, so nothing on this page changes what notifies — and a reader
   who thinks otherwise will never turn a kind off. */
export const FRAME = { width: 390, height: 820 };

export function Screen() {
  return (
    <>
      <PageHeader title="Push notifications" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "24px 24px 32px" }}>
        <SettingsGroup
          ariaLabel="Push notifications"
          footnote="Push delivers rows the list already holds, and never adds one. With it off, everything still arrives in Notifications."
        >
          <SettingsRow
            checked
            label="Push notifications"
            status="Send them to this browser as they happen."
            onOpen={() => {}}
          />
        </SettingsGroup>

        <SettingsGroup label="Sent to this browser">
          <SettingsRow checked label="Comments on your posts" onOpen={() => {}} />
          <SettingsRow checked={false} label="Replies to your comments" onOpen={() => {}} />
          <SettingsRow checked={false} label="Mentions of you" onOpen={() => {}} />
          <SettingsRow checked={false} label="Citations of your posts and comments" onOpen={() => {}} />
          <SettingsRow checked={false} label="Opinions on you" onOpen={() => {}} />
          <SettingsRow checked label="Applicants ready for your approval" onOpen={() => {}} />
          <SettingsRow checked={false} label="People landing through your invites" onOpen={() => {}} />
          <SettingsRow checked label="Your application approved" onOpen={() => {}} />
          <SettingsRow checked label="Your application closed" onOpen={() => {}} />
        </SettingsGroup>
      </div>
    </>
  );
}
