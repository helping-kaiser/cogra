/* THE CRASH SURFACE (round 35, jakob 2026-11-11, T11 — seam 256-B-22). What
   stands when the app itself breaks and no surface is left to carry a notice:
   one line in the bug notice's voice and one way on, `Reload` — jakob took the
   recommendation, "one line in the bug notice's voice plus Reload".

   THE WORDS ARE THE BUG NOTICE'S OWN (`SealFaultBug`; copy-voice, *Faults by
   code*): `This shouldn't have happened`, the system telling on itself. Its
   other sentences are left out — a crash cannot promise that nothing was
   signed or spent, and the page carries no report door for "telling us helps".
   Review-pending: jakob blesses the exact words when he sees them.

   THE PAGE IS THE PLAIN LANDING (`VerifyExpired`'s form): no header, no bar —
   nothing of the app that broke is assumed to stand — the line as the page's
   title and the one action under it at the column's width.

   REGISTERED under its own prefix, `crash`: the page's `title` and `reload`. */
export const NODE = "crash";
export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          letterSpacing: "var(--text-headline-small--letter-spacing)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
        data-node="title"
      >
        This shouldn't have happened
      </h1>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="outline" style={{ width: "100%" }} node="reload">
          Reload
        </Button>
      </div>
    </div>
  );
}
