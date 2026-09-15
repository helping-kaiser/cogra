/* THE ASK, ANSWERED — `VouchAsk` once the reader opens the pad (jakob
   2026-09-15: the pad does not open itself when the link lands).

   IT IS A BOARD AND NOT A WIRE TO `ApprovePad`, which is the same pad over a
   different ground. The queue's pad cancels and signs back to `Invites`,
   because that is what is behind it; this one is behind an ask link, opened by
   a member who may have no queue of their own and certainly did not come from
   one. Sending them to the invites list to say "not now" would answer a
   question they never asked. The pad's anatomy is still the master's, numbered
   the way `VouchBackPad` numbers it — what differs is only where the two ways
   out lead.

   EVERYTHING ELSE IS `VouchAsk`, UNTOUCHED. The card, the monogram, the line
   about what a signature does, `Not now` — the pad parks over its own landing
   rather than replacing it, so the reader can still read who they are being
   asked about while they decide how much they mean it.

   THE WASH IS OVER THE SHELL AND THE PAD IS ABOVE IT, the parked-pad drawing
   every other pad board uses; the shell's own controls go inactive under it,
   which is what this board's `scanExempt` line records. */
export function Screen() {
  return (
    <>
      <PageHeader title="A vouch, asked for" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 16px 0", overflow: "hidden" }}>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MonogramAvatar name="noor" size="lg" />
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              @noor is asking to be vouched in
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            They have an account and can read; what they do not have yet is anyone standing for them. Your opinion is what brings them in.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Not now</Button>
            <StanceControl
              targetLabel="@noor"
              helpLabel="How vouching works"
              defaultOpen
              defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
              padNote={<ApprovePadNote handle="@noor" />}
            />
          </div>
        </Card>
        <div style={{ flex: 1 }} />
      </div>

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
