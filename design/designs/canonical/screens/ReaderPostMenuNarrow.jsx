/* THE READER'S MENU ON A PHONE TOO NARROW FOR FOUR ACTIONS (the reel round's
   rule, drawn 2026-09-14). The action row's order — opinion, score, comment,
   share — is also its queue, and share is the first to move into the ⋮ when the
   row cannot hold everything. The rule has been written since the reel round;
   no board drew the menu it moves into, so the one state where this product's
   ⋮ holds a row the wide phone reaches in one tap existed only as a sentence.

   THE BOARD IS NARROW, BECAUSE THE WIDTH IS THE STATE. Drawn at 320 — the
   narrowest phone this system draws for — the way `ViewerLandscape` is drawn
   rotated: the one thing the state changes is the one thing the frame changes,
   and a 390 board with a row missing would be a claim about this phone made on
   a different phone. The card below the sheet shows the row it leaves behind:
   opinion · score · comment, three where there were four.

   SHARE LEADS THE SHEET. Every other row here is a menu row by nature — save,
   cite, hide, the license — and share is the one row that was a one-tap control
   a moment ago, on a wider screen. A reader who opens this ⋮ to share came for
   the row that moved, so it takes the position their thumb was already aiming
   at; appending it would put the displaced control furthest from the hand that
   lost it, and the row's own rule already refuses growth by arrival order. The
   four below keep their order exactly, the license closing the sheet as it
   closes every other.

   NOTHING ELSE MOVES. Same master, same rows, same words — this is the reader's
   menu with one row visiting, not a second menu. The wide phone's board stays
   the master, and the day an action ranks above share the queue takes it first
   and this board follows.

   THE BREAKPOINT IS 360px OF VIEWPORT WIDTH — at or under it, share moves into
   this sheet and the card drops its own (`showShare={false}`); above it, the
   wide board is the state (backlog item 100, ruled the batch-rulings round).
   The board is drawn at 320 because that is the narrowest phone this system
   draws for, not because 320 is the threshold. jakob's register for this whole
   width: small phones are rare but real, and everything must WORK on them —
   masterful is not yet owed. So the rule is one number and a row that moves,
   and no second design language for narrow screens. */
export const FRAME = { width: 320, height: 568 };

const NARROW_MENU = [{ label: "Share", onSelect: () => {} }, ...READER_POST_MENU];

export function Screen() {
  return (
    <>
      <DetailHeader items={NARROW_MENU} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" showShare={false} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Post actions">
        {NARROW_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
