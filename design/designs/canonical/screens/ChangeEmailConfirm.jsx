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
          A code went to sol@solferreira.art and a link to sol@ferreira.studio. Both have to be
          answered, in either order, before your email moves.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField
            id="email-change-code"
            label="Confirmation code"
            mono
            value=""
            hint="From the message to sol@solferreira.art."
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Confirm email change</Button>
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
