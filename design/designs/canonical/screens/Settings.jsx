/* SETTINGS — the whole surface (readme §13, the settings round; backlog item
   20, jakob's rulings 2026-09-09). Reached from your own profile's gear.

   ONE SCROLLING PAGE, AND IT IS DRAWN WHOLE. The board exports a tall `FRAME`
   because the ruling this round exists to record is an ORDER — eight groups
   ranked most- to least-used — and an order cut off at 844px is an order
   nobody can review. It is the same reason the flow maps draw their own size:
   a board's frame is the state it draws, and this one's state is the page.

   NO BOTTOM BAR. Settings is a task the reader leaves, not a place they live
   in — the way the wizards and the ceremonies are drawn. The way out is the
   back arrow, and it goes where the gear was.

   THE ORDER IS FREQUENCY, NOT TAXONOMY (jakob): theme, stance, writing,
   reading, key backup, sessions, credentials, sign out. A taxonomist would put
   credentials near the top with identity; a reader reaches for the theme far
   more often than they change their email.

   THE ANATOMY IS `SettingsGroup` + `SettingsRow`, minted this round. Heading
   above, filled card of rows, footnote under — so a row stays one line of
   status and the fact a group owes the reader is said once, under it, rather
   than inside every row.

   NO LEADING ICONS, and that is §5 rather than taste. This page would want
   eight glyphs — brightness, palette, key, devices, logout — and the system
   has none of them. Icons here are exported from Material's set, never drawn,
   so the honest page is the one without them: grouping and headings do the
   scanning work, which is what an inset grouped list does anyway.

   THEME IS DRAWN INLINE, not behind a row that opens a picker. It is the one
   setting whose effect is the surface the reader is standing on — a chooser
   that covered the page would hide the very thing it changes. Three one-word
   readings need no explaining, so they take the segmented control; the stance
   input's three need a line each, so they stay rows.

   CREDENTIALS ARE ROWS, NOT FORMS. Both apps stack three whole forms — six
   fields and three commitments — on the settings page itself, which is the
   shape this round was called to leave behind. Each is a row showing where it
   stands and a chevron; the three screens behind them are gaps, honestly
   named.

   SIGN OUT KEEPS THE FORGET SWITCH (jakob): setting "don't remember" only on
   the login form makes the reader sign in and out again to reach it. It sits
   here, with the act it changes, and stays on the login form too. It takes no
   `error` colour — leaving is not a failure. */

export const FRAME = { width: 390, height: 1774 };

export function Screen() {
  return (
    <>
      <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, padding: "8px 24px 32px" }}>
        <SettingsGroup
          bare
          label="Theme"
          footnote="Auto follows your device's own setting, and the choice stays on this device."
        >
          <div>
            <SegmentedFilter
              block
              ariaLabel="Theme"
              value="auto"
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "auto", label: "Auto" },
              ]}
            />
          </div>
        </SettingsGroup>

        <SettingsGroup
          label="Taking a stance"
          footnote="A tap always adds a small positive one. This is what a longer press opens, everywhere."
        >
          <SettingsRow
            name="settings-stance-input"
            selected
            label="The pad"
            status="Press and hold, then drift to where you stand."
          />
          <SettingsRow
            name="settings-stance-input"
            selected={false}
            label="Sliders"
            status="One slider per side of the stance."
          />
          <SettingsRow
            name="settings-stance-input"
            selected={false}
            label="Typed values"
            status="Type both numbers exactly."
          />
        </SettingsGroup>

        <SettingsGroup
          label="Writing"
          footnote="Every signed action is paid for separately. A post's license is settled when it is first signed and never changes."
        >
          <SettingsRow
            checked
            label="Confirm multi-action submits"
            status="Ask first when one submit signs more than one action."
            onOpen={() => {}}
          />
          <SettingsRow label="Default license" value="Public domain" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Reading"
          footnote="Every feed starts from this. A change made inside a feed lasts until you change it back, on that device only."
        >
          <SettingsRow label="What your feed shows" value="Posts" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Key backup"
          footnote="Your key signs everything you publish and lives only in this browser. Your recovery code is the only way back."
        >
          <SettingsRow label="Recovery code" status="Last created 12 August" onOpen={() => {}} />
          <SettingsRow label="Your key" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Sessions"
          footnote="A device you sign out can stay signed in for up to 15 minutes."
        >
          <SettingsRow label="Firefox on Ubuntu" status="This browser" inert />
          <SettingsRow
            label="Pixel 8"
            status="Last used 2 days ago"
            inert
            trailing={<InlineAction onClick={() => {}}>Revoke</InlineAction>}
          />
          <SettingsRow
            label="Unnamed device"
            status="Last used 12 August"
            inert
            trailing={<InlineAction onClick={() => {}}>Revoke</InlineAction>}
          />
          <SettingsRow action label="Sign out everywhere else" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup
          label="Credentials"
          footnote="Changing your password signs out every other device."
        >
          <SettingsRow label="Password" status="Changed 3 weeks ago" onOpen={() => {}} />
          <SettingsRow label="Handle" value="@sol" onOpen={() => {}} />
          <SettingsRow label="Email" value="sol@solferreira.art" onOpen={() => {}} />
        </SettingsGroup>

        <SettingsGroup ariaLabel="Sign out">
          <SettingsRow
            checked={false}
            label="Don't remember this account on this device"
            status="Your key and your draft are cleared from this browser when you sign out."
            onOpen={() => {}}
          />
          <SettingsRow action label="Sign out" onOpen={() => {}} />
        </SettingsGroup>
      </div>
    </>
  );
}
