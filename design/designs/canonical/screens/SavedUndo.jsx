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

   IT IS `Saved` WITH ONE ROW REMOVED, not a second kind of Saved board. The
   header, the rows, the controls and the bar are that board's, drawn once;
   `FeedHidden` is the same shape one surface over, a read surface with the
   snackbar the act fired over it. Three rows are left and all three kinds are
   still in them — a comment, a person, a post — so the list goes on reading as
   the one mixed list it is. */
export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="chat_bubble"
          title="The third headland light is real"
          titleAside="@tobias"
          second="on The long way home"
          trailing="3d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="Mira Voss"
          titleAside="@mira"
          second="Runs the stand by the sea wall — honey from the headland hives."
          trailing="5d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Sunday at the tide market"
          titleAside="@mira"
          second="Everything the flats give up in one morning."
          trailing="7d"
          action={<Unsave />}
          onOpen={() => {}}
        />
      </ChronicleList>
      <Snackbar message="Removed from Saved." action="Undo" offset={80} />
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
