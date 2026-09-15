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

   THE SHEET SERVES THE LINK AND NOTHING ELSE (jakob 2026-09-15: "lets stick
   to just serving the link and the link also works when pasted into the code
   field (on the invitation page)... two options for just 1 invite flow is
   confusing"). The id inside the link IS the capability (`auth.md`, *Link
   URLs*) and the door still reads a bare one — `extractInviteId` takes the id
   out of whatever is pasted — but that is a TOLERANCE at the door, not a
   second way to invite somebody. Offering both here made the reader pick
   between two spellings of one thing at the moment they were trying to send
   it, and the pick bought them nothing: whichever they sent, the same door
   opens on the other side. So the capability has one shape on screen, and the
   shape is the link.

   MONO AND WHOLE. A link is checked character by character or not at all, and
   the one place this system allows truncation is the wallet's at-rest row,
   which is an entry point rather than a checking surface. This is not one.

   THE WORD "token" NEVER APPEARS. The record calls this a link capability and
   the API calls the field an id; on screen it is a link. */
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
        </div>
      </BottomSheet>
    </>
  );
}
