/* PUSH NOTIFICATIONS · refused — the settings group after the platform has
   said no (docs/implementation/notifications.md; jakob's rulings 2026-09-22).

   THE ONE STATE WORTH DRAWING on the far side of the ask. A refusal is not the
   reader turning push off: the switch is theirs and this is not, which is why
   the row reads its state back and says whose decision it is rather than
   offering to change it.

   THE STATUS LINE CARRIES IT, which is the settings law rather than an
   exception to it — a second line on a settings row is status, and "this
   browser is not letting them through" is exactly that. The footnote says the
   only way back, because a reader who taps a row that cannot act is a reader
   the page has wasted.

   IT SAYS THE ASK IS SPENT. On native a refusal is sticky and the app cannot
   raise the sheet again; saying so is what stops a reader waiting for a prompt
   that will never come. The platform noun is the browser's here and the app's
   in the app, the one line rendered twice.

   THE NEIGHBOURS ARE DRAWN for the same reason `PushSettings` draws them: the
   group's place in the page is part of what is being reviewed, and a state
   board that lost its surroundings would be reviewing a card. */
export const FRAME = { width: 390, height: 700 };

export function Screen() {
  return (
    <SettingsExcerpt>
      <SettingsGroup
        label="Reading"
        footnote="Every feed starts from what it shows, and a change made inside a feed lasts until you change it back. Both choices stay on this device."
      >
        <SettingsRow label="What your feed shows" value="Posts" onOpen={() => {}} />
        <SettingsRow
          checked={false}
          label="Show exact values"
          status="The number pairs behind the faces."
          onOpen={() => {}}
        />
      </SettingsGroup>

      <SettingsGroup
        label="Notifications"
        footnote="Only this browser's own settings can let them through again. CoGra cannot ask a second time once it has been refused."
      >
        <SettingsRow
          label="Push notifications"
          status="This browser is not letting them through."
          value="Off"
          onOpen={() => {}}
        />
      </SettingsGroup>

      <SettingsGroup
        label="People"
        footnote="Hiding someone clears your own feed of them. Nothing changes for them, and their profile still opens if you go looking."
      >
        <SettingsRow label="Hidden accounts" value="3" onOpen={() => {}} />
      </SettingsGroup>
    </SettingsExcerpt>
  );
}
