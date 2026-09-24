/* OPINIONS ON THIS MESSAGE — what a reaction trace and the message menu's
   `Opinions on this` open (round B3 of the chats work, the integration
   round's fix pass; jakob 2026-09-24: both undrawn destinations of the
   message menu, drawn on real masters).

   THE OPINIONS SHEET'S GRAMMAR, AT MESSAGE SCALE. The post's sheet
   (`OpinionsRowDoors`, canonical's `PostOpinions`) pointed at one message: a
   sheet over the thread titled by what it lists, and one `StanceRow` per
   person — the face, the name, the pair in geek mode — each row split the
   change-histories way, the person opening their profile and the value
   opening how that opinion built. Nothing is drawn by hand.

   THE ROWS ARE THE TRACE, READ WHOLE. Mira's `Six it is` wears `😊😍🤩 5`;
   this is those five people, the reader among them. The trace shows the three
   most-worn faces; the sheet shows every person and the exact face each
   holds — the one place the aggregate can be checked, which is the rule every
   count in this product answers to.

   THE THREAD BENEATH IS `ChatThreadReactions`, whole and inert. */
export function Screen() {
  return (
    <>
      <ReactionsThreadBody />
      <BottomSheet open ariaLabel="Opinions on this message" maxHeight="88%">
        <SheetTitle>Opinions on this message</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {MIRA_SIX_HOLDERS.map((holder) => (
            <StanceRow key={holder.handle} {...holder} onOpen={() => {}} onOpenHistory={() => {}} />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
