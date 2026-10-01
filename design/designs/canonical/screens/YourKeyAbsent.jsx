/* YOUR KEY, WITH THE KEY ELSEWHERE (jakob's ruling 2026-09-10). The second of
   the two settings rows whose screen changes when the key is absent, drawn for
   item 20's review rule: every row that opens something opens a drawn board.

   THE NOTICE IS `WalletKeyAbsent`'s, and the whole anatomy is
   `SettingsBackupKeyAbsent`'s — `NoticePanel` leading the page at `large`,
   the restore button in `Button`'s `inverse`, the one "?" in `HelpDot`'s
   `inverse` naming the key. Two rows of one group reaching the same state draw
   it the same way, or the state reads as two.

   THE CARD IS NOT DRAWN, because the card IS the secret. On the wallet
   everything under the notice stays readable — a balance and a history are
   public — and the honest opposite holds here: this screen's whole body is two
   encodings of one private key, and there is none on this browser to encode.
   Drawing the card empty would promise a container that fills; drawing it with
   a placeholder would put a second way of saying "no key" under the first.

   WHAT STAYS IS THE PARAGRAPH, with one clause changed (the key-loss round).
   It says what the key is, where it lives, and what holding a copy means —
   every word of which is exactly why the screen is empty. `YourKey`'s "lives
   only in this browser" would sit one line under "There is no key on this
   browser to show", two opposite facts a line apart, so here the key lives
   "only on the device it was made on". A reader who arrives here without a
   key learns the thing the screen exists to teach, and the notice above says
   how to see it.

   NO ESCAPE HATCH: nothing is staged, so the back arrow is the whole way
   out. */
export function Screen() {
  return (
    <>
      <PageHeader title="Your key" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 32px", overflow: "hidden" }}>
        <NoticePanel title="Your key isn't on this browser" helpLabel="Your key" corner="large">
          <NoticeLine>There is no key on this browser to show.</NoticeLine>
          <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
        </NoticePanel>

        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          This key signs everything you publish, and it lives only on the device it was made on. Store a copy
          somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can act
          as you.
        </p>
      </div>
    </>
  );
}
