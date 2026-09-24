/* ASKING TO JOIN, WITH A MESSAGE — what `Ask to join` opens (round B3 of the
   chats work, the integration round; jakob 2026-09-24: the join request's
   optional message is B3's composer).

   `Ask to join` NO LONGER SENDS ON ONE TAP. Round A's request signed on the
   tap; the Join Request carries an optional message as its payload
   (layer1-interface.md's act payload schema, "request message"), and a field
   for it needs a surface. So the tap opens this small sheet: the request's
   seal, `ChatJoinSeal`'s shape at the same size of act — the title and the
   seal's "?", the acts card (`Asking to join` · the chat · `1 thing,
   signed`), the optional field, the stance read back, one quiet line, and the
   act in words, `Sign and ask`.

   THE FIELD IS THE LEAVE REASON'S PRECEDENT: an optional payload field lives
   on the surface that signs it (`ChatLeaveConfirm`'s `Why?`), labelled by what
   it is and cornered with who reads it. Empty is fine — the request stands on
   its own — and the drawn state is typed, because the quote it becomes is
   what the approver reads on the card (`ChatRequestApprove`) and in the
   notification row (`ChatNotifications`).

   `Your opinion` IS THE REQUEST'S OWN STANCE, AND IT IS SET HERE (jakob's
   ruling, the fix pass): the row holds `StanceControl` itself (`SealStance`),
   defaulted low like every normal act, a tap opening the ordinary pad over the
   sheet (`ChatJoinSealPad`'s master).

   THE ONE LINE says what a requester cannot guess: the request is public, and
   joining stays theirs — an approval never adds anyone (chats.md §4).

   THE SURFACE BENEATH IS THE THREAD READ FROM OUTSIDE (`ChatThreadReader`),
   whole and inert. The explorer's row and the details' join open the same
   sheet over their own surfaces. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Harbour office" backLabel="Back to all chats" />
      <HarbourOfficeThread />
      <ChatJoinFoot policy="request" />
      <BottomSheet open ariaLabel="What you sign" maxHeight="88%">
        <SheetTitle trailing={<HelpDot ariaLabel="How signing works" />}>What you sign</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 24px" }}>
          <ActsCard rows={[{ label: "Asking to join", value: "Harbour office", count: "1", countNoun: "request" }]} total="1 thing, signed" />
          <TextField label="Message" corner="Optional — the chat can read it" rows={1} value={HARBOUR_REQUEST_MESSAGE} />
          <FactRow label="Your opinion" value={<SealStance target="Harbour office" />} last />
          <QuietNote>Your request is public. Once it's approved, joining is yours to do.</QuietNote>
          <Button style={{ width: "100%" }}>Sign and ask</Button>
        </div>
      </BottomSheet>
    </>
  );
}
