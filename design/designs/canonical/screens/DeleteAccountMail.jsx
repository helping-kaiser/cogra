/* DELETE ACCOUNT · CHECK YOUR MAIL — where the request lands (readme §13, the
   account-deletion round; `docs/instances/erasure.md` §5 step 2).

   THE CONFIRMATION IS THE EMAILED LINK, so the request screen cannot be the end
   of the flow and this state has to exist. `erasure.md` is explicit that the API
   records the request and mails a link, and that the seven days start at the
   CONFIRMATION rather than the request — so the one thing this board owes the
   reader is that nothing is scheduled yet. A reader who leaves here believing
   they are done would come back in a week to an account still standing, which
   is the friendlier of the two ways to be wrong and still a lie.

   IT IS THE ENTRY FLOW'S MAIL-SENT IDIOM. `Reset` says the same thing in a
   status line under its own field because the reader is still standing on the
   form; here the form is spent, so it is a board — `VerifyExpired`'s column and
   its foot, the outlined act that might be needed over nothing else. The
   heading is the errand, the paragraph is the address and what the link does.

   THE ADDRESS IS NAMED, NOT DESCRIBED — the settings round's own rule, from
   `ChangeEmail`: a reader who mistyped their address last year finds out here,
   and only if the screen prints it.

   NO EXPIRY IS CLAIMED. The reset link states its fifteen minutes because
   `auth.md` gives it fifteen minutes; `erasure.md` sets no window on this one,
   and a screen that invented one would be drawing a mechanic the product does
   not have. `Resend the link` covers the mail that never arrived.

   NO DELETION BAND. Nothing is confirmed, so there is nothing to count down —
   the band begins at the confirmation and not a moment earlier. */
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
          Check your mail
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
          We sent a link to sol@solferreira.art. Opening it confirms the deletion and starts the seven
          days.
        </p>

        <div style={{ marginTop: 24 }}>
          <QuietNote>
            Until you open it nothing is scheduled and nothing has changed. Closing this screen
            changes nothing either — the link is the whole of it.
          </QuietNote>
        </div>

        <div style={{ flex: 1 }} />

        <Button variant="outline" style={{ width: "100%" }}>
          Resend the link
        </Button>
      </div>
    </>
  );
}
