/* DELETE ACCOUNT — the explain-and-request screen (readme §13, the
   account-deletion round; jakob's rulings 2026-09-11, and the mechanics in
   `docs/instances/erasure.md` §2 and §5).

   THE TASK-FLOW COLUMN, which is `Restore`'s and the three credential screens':
   heading, the consequence, the one choice, one commitment, the thing to know
   last. No bottom bar — this is a task the reader leaves — and the back arrow
   goes where they came from.

   WHAT GOES AND WHAT STAYS ARE DRAWN AS A PAIR, because the second half is the
   half a reader cannot guess and the half this product owes them. Deleting an
   account here does not unmake a record: the husk keeps authoring everything it
   authored (`erasure.md` §3), and a screen that only listed what disappears
   would let a reader press the commitment believing their comments would leave
   other people's threads. The pair is `ChangeEmailConfirm`'s inset, for the
   reason that board reached for it — two readings a reader has to hold at once,
   aligned so neither can be missed.

   THE CONTENT SWEEP IS AN OPT-IN AND IT IS A CHECKBOX, NOT A SWITCH. `erasure.md`
   §2 makes identity-level the default and content-level the choice, and the
   system's own distinction settles the control: a switch takes effect the moment
   it is pressed, and nothing here takes effect until the emailed link is opened.
   This is a form, so it takes the form control. Off is the drawn state because
   off is the default, and the default is the ruling.

   NO TYPED CONFIRMATION, NO PASSWORD, NO "ARE YOU SURE". The friction this act
   gets is the one `erasure.md` §5 specifies: a link sent to the account's own
   address, which is also the check against a compromised session — the thing a
   typed handle cannot do. Adding a second ceremony on top would be theatre, and
   theatre here reads as the product trying to talk the reader out of it.

   THE COMMITMENT SAYS WHAT THE PRESS DOES. `Send the confirmation link` — the
   register's own rule, and `Reset`'s `Send reset link` is the same sentence for
   the same mechanism. `Delete my account` would be a lie about a button that
   sends an email. */

const INSET = {
  marginTop: 24,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-medium)",
  padding: "var(--space-3)",
};

const CAPTION = {
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
  color: "var(--text-secondary)",
};

const LINE = {
  margin: 0,
  fontSize: "var(--text-body-small)",
  lineHeight: "var(--text-body-small--line-height)",
  letterSpacing: "var(--text-body-small--letter-spacing)",
};

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
          Delete account
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
          This takes your name off CoGra. What you signed stays on the graph, because it is other
          people's record as much as yours — what goes is everything that says it was you.
        </p>

        <div style={INSET}>
          <span style={CAPTION}>What goes</span>
          <p style={LINE}>Your profile — display name, bio, picture and cover.</p>
          <p style={LINE}>The link between you and this account. Nothing left here points back to you.</p>
          <p style={LINE}>Your sessions, and what this account kept for you alone: saved items, hidden accounts, what you have read.</p>
        </div>

        <div style={INSET}>
          <span style={CAPTION}>What stays</span>
          <p style={LINE}>
            Everything you signed, and everything others signed about you. Your posts still route and
            still credit their author; what is removed leaves a mark saying so.
          </p>
          <p style={LINE}>Your wallet and its address. They are held by your key, never by CoGra, so nothing here can touch them.</p>
        </div>

        <div style={{ marginTop: 24 }}>
          <Checkbox id="delete-content" label="Also remove what I posted" />
          <p style={{ ...LINE, marginTop: "var(--space-1)", paddingLeft: 30, color: "var(--text-secondary)" }}>
            The words and pictures go out of your posts, comments and messages, each leaving its mark.
            Leave this off and they stay as you wrote them.
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Send the confirmation link</Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote>
            Nothing is deleted until you open that link. After that it runs in seven days, and you can
            cancel from any device until it does.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
