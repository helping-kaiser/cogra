/* THE FEED, JUST AFTER HIDING SOMEONE (jakob 2026-09-11, the review round;
   the ruling itself is round 1's "no confirm on hide — rows vanish, snackbar
   with Undo").

   THE BOARD EXISTS BECAUSE THE ACT IS INVISIBLE OTHERWISE. Hiding takes no
   dialog and leaves no mark anywhere: the only thing a reader ever sees of it
   is a feed with fewer rows in it and one line saying why. That line and that
   feed ARE the design, so they get drawn — the menus round drew the sheet the
   tap is made in, and this is the other half of the same tap.

   THE ROWS ARE GONE AND THE FEED HAS CLOSED OVER THEM. @ada's post led this
   feed a moment ago; here the ranker's next posts have simply moved up, which
   is the whole truth of what hiding does — it is a read-side comfort, not a
   removal. Nothing marks the space where her card was: a "hidden post" rail
   would keep her on the screen the reader just asked to be rid of her on, and
   the graph is untouched either way (her profile still opens, her comments
   still stand under other people's posts).

   THE SNACKBAR SAYS HOW FAR IT REACHES. `@ada is hidden — their posts stay out
   of your feed.` — the second clause is the one that matters, because the
   thing a reader wonders after hiding someone is whether they have done
   something TO that person. `Undo` beside it: hiding is a comfort, the reader
   may have meant it for one post rather than for a person, and the way back
   costs nothing (`Snackbar`'s one action).

   IT IS THE FEED BECAUSE THE FEED IS WHERE THE TAP WAS MADE. A card's ⋮ opens
   the reader's post menu (the master sheet `ReaderPostMenu` draws), so the
   whole gesture — ⋮, Hide @ada, the sheet closing — happens over this surface,
   and the snackbar lands on it. Hidden from the post detail or from her
   profile instead, the reader stays where they were and the feed looks like
   this the next time they open it, minus the line.

   IT IS `Feed` WITH ONE CARD REPLACED, not a fourth kind of feed board. The
   band, the filter, the cards and the bar are the feed's, drawn once — the
   deletion round's `DeleteAccountCanceled` is the same shape, a read surface
   with the snackbar the act fired over it. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} />
      </FeedList>
      <Snackbar message="@ada is hidden — their posts stay out of your feed." action="Undo" offset={80} />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
