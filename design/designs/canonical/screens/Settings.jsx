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
   reading, people, key backup, sessions, credentials, sign out. A taxonomist
   would put credentials near the top with identity; a reader reaches for the
   theme far more often than they change their email. People sits next to
   Reading because hiding someone is a reading comfort — and in a group of its
   own because Reading's footnote promises its choices stay on this device,
   which a hidden account does not.

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
   `error` colour — leaving is not a failure.

   THE PAGE ITSELF IS `SettingsBody`, in `_shared.jsx`. Two of its rows open
   sheets that cover it, and those boards draw the page they cover rather than a
   hand-made few rows of it: the order is the ruling, and a second drawing of it
   is a second order. This board is the page whole; those are the page under a
   sheet.

   DELETING THE ACCOUNT IS THE PAGE'S LAST ROW (jakob, the account-deletion
   round), in a group of its own after the sign-out group: leaving and ending
   are neighbours, and ending is last. It is drawn quiet — a navigating row with
   a chevron, no `error` colour and no `action` emphasis — because the weight of
   that act belongs to the flow it opens, not to a page a reader came to for the
   theme. */

export const FRAME = { width: 390, height: 2163 };

export function Screen() {
  return <SettingsBody />;
}
