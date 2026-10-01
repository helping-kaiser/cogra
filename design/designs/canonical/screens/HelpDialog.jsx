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

      <DialogSurface
        onScrimPress={() => {}}
        title="How signing works"
        body={[
          "Each piece of a post — the post itself, every tag, every citation — is signed on its own, in your name. They sign together: all of them land, or none does.",
          "Each signing is paid for — the cost is real, so each one still counts.",
        ]}
        actions={<Button>Close</Button>}
      />
    </>
  );
}
