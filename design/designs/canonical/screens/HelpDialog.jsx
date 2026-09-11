/* THE "?" DIALOG (legacy conversion, lane C) — the pattern board for the one
   help affordance a screen is allowed, opened. Captions stay to one short line
   and the full explanation lives behind a small "?", at most one per screen;
   this is what is behind it, drawn on the seal whose "How signing works" is the
   longest thing the system has to explain.

   IT IS A PLAIN DIALOG, and deliberately the dullest surface in the system: a
   heading naming the thing asked about, prose, and one way out. No links, no
   second action, nothing to decide — a "?" that led somewhere would be a
   navigation the reader did not ask for.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a modal covers is inert, not shortened: the reader
   opened the "?" from a surface they can still see, and a stand-in for it would
   be the one thing on the board that is not true. */
export function Screen() {
  return (
    <>
      <ComposeSealBody />

      <DialogSurface ariaLabel="How signing works" width="21rem">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            How signing works
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Each piece of a post — the post itself, every tag, every citation — is signed on its own, in your name. They
            sign together: all of them land, or none does.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            You don't pay for these — a shared community pool covers members' signings. The pool is real and finite, so each
            one still counts.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button>Close</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
