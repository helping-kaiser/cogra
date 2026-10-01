/* REPORT A PROBLEM (the support stack, jakob 2026-10-01) — what Settings'
   `Report a problem` row opens, and the door the seal's bug register offers
   (`SealFaultBug`). One screen for both: the report carries the reader's
   words, never the place it was opened from.

   ONE FIELD, IN THE READER'S OWN WORDS. `What happened`, a multi-line field
   that opens at four lines and grows — `rows` is a minimum (the growth law,
   readme §13, *The sheets-and-video round*). No category picker and no
   severity: the reader says what happened, and sorting it is ours to do.

   YOU SEE EXACTLY WHAT TRAVELS — the honesty register. The send goes out
   through the reader's own mail (a `mailto:` on the web, the system's send
   on the app), so before it is pressed the screen reads back everything that
   goes with the words, in `FactRow`'s seal list — the list a reader checks
   before putting their name on something: where it goes, the version, what
   it is running on, and the time. Nothing else is attached — no account, no
   key, nothing posted — and the line under the list says so, and says the
   one thing the mail itself adds: the reader's own address, so we can write
   back.

   THE ADDRESS IS A PLACEHOLDER until CoGra is on a server (jakob: "we have
   placeholders until we have a server"), the APK path's way: real-shaped,
   on the repo's own `.local` domain, swapped when the address exists.

   THE COMMIT SAYS WHERE IT GOES. `Send by email`, because the press opens
   the reader's mail with all of this filled in and nothing leaves until they
   send it there; a bare `Send` would promise a delivery this screen does not
   make. The words are platform-independent, one string for app and web.

   THE FIXTURE is a report written from the bug register, so the two boards
   read as one moment; the platform value is the settings page's own session
   fixture. A TASK PAGE: the back arrow and no bottom bar. */
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
          Report a problem
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
          Say what happened, in your own words. Sending opens your email with everything below filled in — nothing goes
          until you send it there.
        </p>

        <div style={{ marginTop: 24 }}>
          <TextField
            id="report-what-happened"
            label="What happened"
            rows={4}
            value="I tried to post with a citation and the seal said this shouldn't have happened. Try again said the same thing."
          />
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column" }}>
          <FactRow label="To" value={REPORT_ADDRESS} />
          <FactRow label="Version" value={RUNNING_VERSION} />
          <FactRow label="Running on" value="Firefox on Ubuntu" />
          <FactRow label="Time" value="01.10.2026, 14:32" last />
        </div>

        <div style={{ marginTop: 12 }}>
          <QuietNote>
            That's all that goes with your words — no account, no key, nothing you've posted. It's sent from your own email,
            so we can write back.
          </QuietNote>
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Send by email</Button>
        </div>
      </div>
    </>
  );
}
