/* SAVED, THE MOMENT AFTER A ROW IS UNSAVED (jakob 2026-09-11: unsaving gets
   the same treatment as hiding).

   THE BOARD EXISTS BECAUSE THE ACT IS INVISIBLE OTHERWISE. The unsave takes no
   dialog and leaves no mark: the only thing a reader ever sees of it is a list
   with one row fewer and one line saying so. That line and that list ARE the
   design, so they get drawn — `Saved` draws the control, and this is the other
   half of the same tap.

   THE ROW IS GONE AND THE LIST HAS CLOSED OVER IT. `The long way home` led this
   list a moment ago; here the rows behind it have simply moved up. Nothing
   marks the space it was in: a struck-through row would keep the thing on the
   screen the reader just asked to be rid of it on, and nothing has happened to
   the post itself — it still stands in its author's chronicle, still ranks,
   still opens. Saving is private, and so is losing a save.

   THE LINE SAYS WHAT HAPPENED, NOT WHAT WAS LOST. `Removed from Saved.` names
   the list rather than the thing, because the row that went is the one the
   reader just pressed and naming it back to them says nothing they do not
   already know — while the LIST is the fact they may want reversed. `Undo`
   beside it (`Snackbar`'s one action): the glyph sits in the same slot on every
   row, a mis-press is the cheapest mistake in the product, and the way back
   should cost what the mistake cost.

   THE SAME LINE RIDES `SavedEmpty`, when the row that went was the last one
   (jakob 2026-09-12). The snackbar belongs to the ACT, not to how many rows are
   left behind it, so the empty board takes the same words over the same seconds
   and the empty line reads underneath them. Recorded rather than drawn: this
   board is the demonstration, and a second one differing only in what sits
   under the snackbar would spend a canvas entry on a reader learning nothing.

   IT IS `Saved` WITH ONE ROW REMOVED, not a second kind of Saved board. The
   header, the rows, the controls and the bar are that board's, drawn once;
   `FeedHidden` is the same shape one surface over, a read surface with the
   snackbar the act fired over it. Three rows are left and all three kinds are
   still in them — a comment, a person, a post — so the list goes on reading as
   the one mixed list it is.

   REGISTERED under the `saved` prefix, named as `Saved` names it (seam 059/061,
   the Saved packet); the snackbar is `snackbar`. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" node="header" />
      <ChronicleList node="list">
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="chat_bubble"
          title="The third headland light is real"
          titleAside="@tobias"
          second="on The long way home"
          trailing="3d"
          action={<Unsave name="The third headland light is real" node="unsave" />}
          onOpen={() => {}}
          node="entry"
          nodeKey="the-third-headland-light-is-real"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="Mira Voss"
          titleAside="@mira"
          second="Runs the stand by the sea wall — honey from the headland hives."
          trailing="5d"
          action={<Unsave name="Mira Voss" node="unsave" />}
          onOpen={() => {}}
          node="entry"
          nodeKey="mira-voss"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Sunday at the tide market"
          titleAside="@mira"
          second="Everything the flats give up in one morning."
          trailing="7d"
          action={<Unsave name="Sunday at the tide market" node="unsave" />}
          onOpen={() => {}}
          node="entry"
          nodeKey="sunday-at-the-tide-market"
        />
      </ChronicleList>
      <Snackbar message="Removed from Saved." action="Undo" offset={80} node="snackbar" />
      <BottomNav active={null} slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
