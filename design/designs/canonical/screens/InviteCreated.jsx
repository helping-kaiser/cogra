/* THE LINK IS READY — the create sheet's second stage. One sheet, two stages:
   the reader decided, and now the one job left is to send the thing. Closing
   to the list instead would make them hunt for the row they just made.

   THE CARD IS THE WALLET'S, and that is the point of reusing it. An invite
   link and a payout address are the same reading problem — a long string no
   reader can check by eye, which must be held whole rather than truncated,
   with a copy control and its own quiet facts around it. `PayoutAddress` is
   already that card and every word on it was already a prop; only the copy
   button's accessible name had to be opened up, because a button announcing
   "Copy the address" over an invite link lies to the one reader who depends
   on it.

   SHARE IS THE PRIMARY AND IT TAKES THE COLUMN. A sheet's `Done` sits in the
   trailing corner because it is the way out; this is the act the sheet exists
   for, so it is the full width of the words above it. It hands off to the
   platform's own sheet — `ShareButton`'s ruling, one tap and no surface of our
   own — and where a platform has none, the link is copied and the snackbar
   says `Link copied`.

   THE CODE IS THE SAME INVITE SAID AGAIN, so it is not a second card. The id
   in the link IS the invite code (`auth.md`, *Link URLs*), and the door takes
   either — a pasted URL or the bare id, which is what the product's own
   `extractInviteId` already reads. Drawing it in its own `surface-card`
   container would claim a second thing exists; drawing it on the sheet's own
   ground says it is the first thing with the link taken off. That is
   `PayoutAddress` with `bare` — the shape `SettingsGroup` already has for
   exactly this reason, and the rejected applicant's ask link is the second
   surface that asked for it.

   MONO AND WHOLE, both of them. A UUID read aloud or typed by hand is checked
   character by character, and the one place this system allows truncation is
   the wallet's at-rest row, which is an entry point rather than a checking
   surface. Neither of these is.

   THE WORD "token" NEVER APPEARS. The record calls this a link capability and
   the API calls the field an id; on screen it is a link and a code. */
export function Screen() {
  return (
    <>
      <InvitesBody />

      <BottomSheet open ariaLabel="Your invite link">
        <SheetTitle>Your invite link</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px" }}>
          <PayoutAddress
            label="Single use · not used yet"
            address={SOL_INVITE_LINK}
            onCopy={() => {}}
            copyLabel="Copy the link"
            caption="Expires in 7 days · 22.09.2026"
          />

          <Button style={{ width: "100%" }}>Share link</Button>

          <PayoutAddress
            bare
            label="Invite code"
            address={SOL_INVITE_ID}
            onCopy={() => {}}
            copyLabel="Copy the code"
            caption="The same invite with the link taken off — the door takes either."
          />
        </div>
      </BottomSheet>
    </>
  );
}
