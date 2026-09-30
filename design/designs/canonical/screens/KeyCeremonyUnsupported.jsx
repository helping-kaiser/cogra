/* Your key · this browser can't hold one — the ceremony's refusal (the
   key-loss round; web.md, the browser floor). The ceremony probes WebCrypto
   Ed25519 before it mints anything, and a browser without it cannot hold a
   CoGra key at all. Reading needs none of it, so nothing else about the app
   changes: only custody is refused, and the refusal says where custody works.

   IT WEARS THE KEY-ABSENT NOTICE, NEVER `error` (readme §13, the pattern
   boards): a `tertiary-container` panel, because nothing failed — this is a
   fact about the browser, and the way on is somewhere else. It has no "?":
   the notice already says everything a dialog would.

   NO COMMITMENT, so nothing is drawn that cannot be done. The ceremony's two
   paragraphs and its two buttons all describe a key made on this browser;
   the notice takes their place, and the back arrow is the whole way out —
   back to the task card, which stays until the key is made somewhere that
   can hold it. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Your key
        </h1>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-large)", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
            This browser can&apos;t hold a key
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Open CoGra in a current Chrome, Firefox or Safari, or in the Android app.
          </p>
        </div>
      </div>
    </>
  );
}
