/* CHANGE YOUR EMAIL — the confirmation (readme §13, the settings round;
   jakob's review 2026-09-09). Where `ChangeEmail` lands once the two messages
   have gone out, and where a reader who closed the app comes back to.

   THE SHIPPED LINE IS WRONG AND THIS BOARD DOES NOT KEEP IT. Both apps say
   *Check both inboxes — either message's code confirms the change*, which tells
   the reader one message is enough. `auth.md` and `api-spec.md` agree it is
   not: the change applies only once BOTH sides have landed. The mutation takes
   either side's proof, in either order — which is what "either" was reaching
   for — but a screen that says one message finishes the job leaves a reader
   staring at an unchanged address believing they are done.

   THE TWO SIDES ARE NOT THE SAME ERRAND, and the copy stops pretending they
   are. The current address gets a CODE, typed here, proving the account as it
   stands; the new address gets a LINK, clicked there, proving it is reachable.
   One field, because only one of them is something to type.

   BOTH SIDES ARE DRAWN, AND THE ONE THAT IS NOT A FIELD IS THE REASON. A screen
   showing only what it can take input for shows one errand and implies there is
   one; the link waiting in the other inbox is invisible precisely where a reader
   most needs it, and they leave believing a filled field finished the job. So
   the pair is drawn as a pair, each side naming its address and saying it is
   still outstanding — `LicenseTerms`' quiet inset, which exists for the same
   reason: two readings a reader has to act on, aligned so neither can be missed.

   THE COMMITMENT ANSWERS ONE SIDE AND SAYS SO. `Confirm the code` is what
   pressing it does; `Confirm email change` is what the reader would have
   believed it did. A control says what will happen, and what happens here is
   half of a change that applies when the other half lands.

   THE FIELD IS MONO, like the recovery gate's: a code is transcribed
   character by character, and the shape of what has been typed is part of
   reading it back.

   NO BACK TRAP. Nothing is lost by leaving — the change is live on the server
   for its window and this screen is reachable again from the row — so the
   arrow stays and goes where the others go. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Confirm the change
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
          Two messages, two different errands — a code to type here, and a link to open at the new
          address. Your email moves when both have been answered, in either order.
        </p>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-medium)",
            padding: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              fontWeight: "var(--text-label-small--font-weight)",
              letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
              color: "var(--text-secondary)",
            }}
          >
            Both have to land
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", columnGap: "var(--space-2)", rowGap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
              Code
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)" }}>
              sol@solferreira.art — still waiting
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
              Link
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)" }}>
              sol@ferreira.studio — still waiting
            </span>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <TextField
            id="email-change-code"
            label="Confirmation code"
            mono
            value=""
            hint="From the message to sol@solferreira.art."
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Confirm the code</Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote>
            Until both sides land your account keeps the address it has, and a reset still goes
            there.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
