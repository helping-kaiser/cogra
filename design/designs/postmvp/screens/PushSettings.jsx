/* PUSH NOTIFICATIONS IN THE SETTINGS PAGE — where the post-MVP push round
   reaches a surface a reader already knows (docs/implementation/notifications.md;
   jakob's rulings 2026-09-22).

   THE GROUP SITS AFTER READING (jakob). Reading is where a reader goes to say
   what the product shows them; push is where they say what reaches them when
   they are not looking, which is the same activity one step further out. The
   board draws Reading above and People below so the placement is the drawing
   rather than a claim about it — the rest of the page is canonical's `Settings`
   and is unchanged.

   ONE ROW, NOT NINE, ON THIS PAGE. The nine kinds are a page of their own
   (`PushKinds`): a settings page is scanned, and nine switches inside a group
   would turn one line of the scan into a screen of it. The row reads its state
   back the way `Default license` and `What your feed shows` read theirs — the
   disclosure grammar, a value and a chevron.

   THE FOOTNOTE SAYS WHAT PUSH IS, because the word invites the wrong belief.
   Push delivers a row the list already holds; it is not a second channel with
   its own content, and nothing about turning it off changes what notifies. A
   reader who thinks switching this off means missing things will never switch
   it off, and will switch the whole channel off instead. */
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
        footnote="Push delivers rows the list already holds, and never adds one. What reaches you here is the same whether it is on or off."
      >
        <SettingsRow label="Push notifications" value="On" onOpen={() => {}} />
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
