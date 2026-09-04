/* THE "?" DIALOG (legacy conversion, lane C) — the pattern board for the one
   help affordance a screen is allowed, opened. Captions stay to one short line
   and the full explanation lives behind a small "?", at most one per screen;
   this is what is behind it, drawn on the seal whose "Signed actions" is the
   longest thing the system has to explain.

   IT IS A PLAIN DIALOG, and deliberately the dullest surface in the system: a
   heading naming the thing asked about, prose, and one way out. No links, no
   second action, nothing to decide — a "?" that led somewhere would be a
   navigation the reader did not ask for.

   THE SEAL BENEATH IS DRAWN SHORT, as the hand board drew it: the note, the
   total, and the button. What a modal covers is inert, so these boards
   abbreviate the surface they stand on — preserved exactly as found, a drawing
   question the round leaves open. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="Signed actions" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>
        <ActsCard total="4 signed actions" note="they land together, or none does" />
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Sign and publish</Button>
      </div>

      <DialogSurface ariaLabel="Signed actions" width="21rem">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            Signed actions
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Each piece of a post — the post itself, every topic, every citation — is its own signed action, written in your
            name. They sign together: all of them land, or none does.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            You don't pay for these — a shared community pool covers members' signings. The pool is real and finite, so each
            action still counts.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button>Close</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
