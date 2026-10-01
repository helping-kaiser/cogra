/* SETTINGS · A DELETION IN ITS GRACE (jakob 2026-10-01, audit K3.22;
   `docs/instances/erasure.md` §5).

   THE ROW READS THE DEADLINE. Once the emailed link is opened the deletion
   is scheduled, and the page's last row stops being a door to a request: it
   reads `Deletion in 6 days`, the band's own forward ladder, and opens
   `DeleteAccountPending`, where the deletion can be cancelled. The group's
   footnote goes with the request it described — "nothing is deleted here,
   the next screen says what goes" is a promise about a request not yet made.

   THE BAND RIDES THIS PAGE TOO, under the header, as it rides every
   logged-in surface (`FeedDeleting`); its `Cancel` and the row's screen are
   two ways to the same act, one in passing and one on purpose.

   IT IS AN EXEMPLAR OF `Settings` (readme §13, Canvas pages and flows): the
   page is `SettingsBody` whole; the band's Cancel and the Delete-account row
   are this board's own and carry numbers, every other row is wired on
   `Settings`. */
export const FRAME = { width: 390, height: 2660 };

export function Screen() {
  return <SettingsBody deleting />;
}
