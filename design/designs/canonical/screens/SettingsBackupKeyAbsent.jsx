/* THE SETTINGS BACKUP, WITH THE KEY ELSEWHERE (jakob's ruling 2026-09-10).
   Item 20's review rule reaches its last two rows: every row that opens
   something opens a drawn board, and a row whose screen changes when the key
   is absent owes that state a board too. Otherwise implementation guesses the
   surface behind the row, which is the gap the rule closed everywhere else.

   THE NOTICE IS `WalletKeyAbsent`'s, which is `ComposeKeyAbsent`'s: a
   `tertiary-container` panel, the restore button in `Button`'s `inverse` — the
   filled button taking the panel's own pair turned over rather than a
   `primary` fill arguing with it — and the "?" in `HelpDot`'s `inverse`, ringed
   in the panel's own `currentColor`. It is a waiting state, never an `error`
   one.

   THE NOTICE LEADS, inset to the page's own margins, because it is the odd one
   out and must not split the page's parts (jakob's round-2 correction on the
   wallet). It sits above the heading for that reason, not beside it.

   THE "?" IS THIS SCREEN'S ONE DOT, and it names the key — the dialog blessed
   for the seal and the pad, which is the same fact said here. Neither this
   screen nor its key-present twin spends a dot on anything else.

   NO FIELD AND NO COMMITMENT, so nothing is drawn that cannot be done: making
   a new code re-encrypts the key, and there is no key here to re-encrypt.
   `ComposeKeyAbsent`'s rule — no sign button, because there is nothing to
   commit until the key is here — is the same rule one surface over. What stays
   is what a reader can still act on: the consequence, and when the current
   code was made.

   NO ESCAPE HATCH EITHER. The compose and pad boards end in one because a
   draft or a pick is waiting on the key; nothing is staged here, so the back
   arrow is the whole way out — `WalletKeyAbsent`'s shape. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-large)", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              Your key isn't on this browser
            </h2>
            <HelpDot ariaLabel="Your key" variant="inverse" />
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Making a new code needs the key itself. Your current recovery code keeps working.
          </p>
          <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
        </div>

        <h1
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          A new recovery code
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          A new code re-encrypts your key and replaces the old backup — recovery always uses the
          newest one. Your current code was made on 12 August.
        </p>
      </div>
    </>
  );
}
