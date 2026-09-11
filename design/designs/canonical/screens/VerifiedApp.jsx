/* Email verified · in the app — what App Links open (readme §13, the audit
   states; jakob 2026-09-09, item 20).

   THE SAME LANDING, ONE SENTENCE DIFFERENT. `Verified` is the browser's: it
   tells a reader standing in a browser tab that the app already knows, and
   sends them back to it. When App Links hand the same URL to CoGra, that
   sentence is addressed to somebody who is not there — the reader IS in the
   app — so the board that says it cannot be the board Android shows.

   LINKS ONLY. There is no field here and there is none on the applicant's
   feed either: the link is the proof, and a surface asking the reader to
   copy the link's own secret across by hand is a surface that exists only
   because this board did not. Android ships that field today; this is what
   replaces it.

   THE WAY ON NAMES ITS DESTINATION. `Verified`'s way out is `Back to CoGra`
   because it leads out of a browser; in the app the reader is already here,
   and what is left of the application rides the feed as task cards. */
export function Screen() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        overflow: "hidden",
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--primary)" }}>
        <Icon name="mark" size={56} />
      </span>
      <h1
        style={{
          margin: "24px 0 0",
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
          textAlign: "center",
        }}
      >
        Email verified
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          maxWidth: 300,
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          letterSpacing: "var(--text-body-medium--letter-spacing)",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        Your application moved a step. The rest of it is waiting for you on the feed.
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="text">Go to the feed</Button>
      </div>
    </div>
  );
}
