/* A STANCE, READ AS THE HISTORY IT ALREADY IS — every record ever cast from
   one person toward another, newest first (jakob's rulings 2026-09-22).

   THERE IS NOTHING NEW TO STORE. A bundle is not a number that gets
   overwritten; it is the fold of a list of signed records, and this sheet reads
   that list off the record mirror. The content chronicles had to be drawn; this
   one only had to be opened.

   THE HEADER SAYS THE SUM IN WORDS BECAUSE THE FOLD CLIPS. A raw sum of +27.40
   reads +1.00 the moment it passes the cap, so a reader looking at a standing
   cannot tell one gentle pick from twenty-seven years of them — and that
   accumulated conviction is exactly what a person wants to know about somebody.
   The sentence carries it; the digits ride `cg-exact` and paint only in geek
   mode, the way every number in this product does.

   SEVERANCE IS A ROW, NOT AN ABSENCE. Walking an opinion back signs a
   counter-record like any other, so it stands in the list at its own date
   wearing the system's own word for it. A timeline that quietly dropped it
   would be doing the one thing this surface exists to prevent — and the picks
   below it would then look like they had never been answered.

   IT IS PUBLIC TO EVERYONE, SIGNED OUT INCLUDED. Every record here is a public
   act already; the gates in this product are on acting, and there is nothing to
   act on in a list of what has happened.

   IT SITS OVER THE OPINIONS PAGE because that is the door drawn beside it
   (`ProfileStancesDoors`). The pad's own line opens the same sheet from
   wherever the pad is parked — a sheet drawn over one of those surfaces would
   make a cross-cutting overlay look like that surface's own, which is the
   argument `PadStanding` settled for the pad. */
export function Screen() {
  return (
    <>
      <ProfileStancesExcerpt onOpenHistory={() => {}} />
      <TimelineSheet title="@tobias on @ada" ariaLabel="Every opinion @tobias has signed on @ada">
        <TimelineHeader
          pDirected={1}
          pInterest={1}
          sum="Built from 27 picks over three years — more weight than the dial can show."
          exact="+27.40 / +26.10 before the cap"
          spoken="Raw sum before the cap: For or against +27.40, How much reaches you +26.10"
        />
        <TimelineRecords />
      </TimelineSheet>
    </>
  );
}
