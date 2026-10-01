/* Your key · this browser can't hold one — the ceremony's refusal (the
   key-loss round; web.md, the browser floor). The ceremony probes WebCrypto
   Ed25519 before it mints anything, and a browser without it cannot hold a
   CoGra key at all. Reading needs none of it, so nothing else about the app
   changes: only custody is refused, and the refusal says where custody works.

   IT WEARS THE KEY-ABSENT NOTICE, NEVER `error` (readme §13, the pattern
   boards): `NoticePanel` at a page's `large` corner, because nothing failed
   — this is a fact about the browser, and the way on is somewhere else. It
   has no "?": the notice already says everything a dialog would.

   NO COMMITMENT, so nothing is drawn that cannot be done. The ceremony's two
   paragraphs and its two buttons all describe a key made on this browser;
   the notice takes their place, and the back arrow is the way back — to the
   task card, which stays until the key is made somewhere that can hold it.

   THE APP IS A REAL DOOR, NOT A NAME (jakob, the key-loss round's review). The
   web login landing already serves the APK — `/downloads/app-debug.apk`, a
   plain download anchor reading `On Android? Download the app (APK)` — so the
   notice carries that same link in the same words, underlined in the panel's
   own ink: it leaves the app for the browser's download, which is a link's
   job, not a button's. Both are replaced together when CoGra is served from
   a real host. */
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
        <div style={{ height: 16 }} />
        <NoticePanel title="This browser can't hold a key" corner="large">
          <NoticeLine>Open CoGra in a current Chrome, Firefox or Safari, or in the Android app.</NoticeLine>
          <a
            href="/downloads/app-debug.apk"
            download
            className="cg-state cg-focus"
            style={{ alignSelf: "flex-start", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "inherit", textDecoration: "underline" }}
          >
            On Android? Download the app (APK)
          </a>
        </NoticePanel>
      </div>
    </>
  );
}
