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

   THE INSET IS DRAWN HERE, because the two masters it resembles do not fit it.
   `SectionLabel` carries the screen gutter itself, for a scroll column of
   full-bleed rows; this caption sits inside a padded inset that already carries
   its own. `FactRow emphasis="ledger"` is a full-width ruled row whose value
   right-aligns away from its label; these two are a compact reading pair, the
   address beside the errand that names it, on one narrow block with nothing to
   rule off.

   THE COMMITMENT ANSWERS ONE SIDE AND SAYS SO. `Confirm the code` is what
   pressing it does; `Confirm email change` is what the reader would have
   believed it did. A control says what will happen, and what happens here is
   half of a change that applies when the other half lands.

   THE FIELD IS MONO, like the recovery gate's: a code is transcribed
   character by character, and the shape of what has been typed is part of
   reading it back. The code is 6 digits, single-use (auth.md, *Email change*;
   jakob 2026-10-05), so the field is the `digits` kind: the numeric keyboard
   and the platform's one-time-code fill. At rest `Confirm the code` waits on
   it, disabled, its reason above it (`WaitingCommit`).

   NO BACK TRAP. Nothing is lost by leaving — the change is live on the server
   for its window and this screen is reachable again from the row — so the
   arrow stays and goes where the others go.

   THE PENDING CHANGE CAN BE SENT AGAIN, AND CALLED OFF (jakob 2026-10-01,
   audit K3.21). `Resend` sits on the pair it re-sends — both messages go
   out again, for the reader whose mail never came — and `Cancel the change`
   stands last, after the line that says what the account keeps, because
   calling a change off is the quiet end of this page and not its point.
   Neither asks first: a resend costs nothing, and a cancelled change is
   started again from the row.

   EVERY HALF-DONE AND FAILED STATE IS A LINE ON THIS PAGE. A side that has
   landed reads `— confirmed` where `— still waiting` stood; the link side
   lands from `ChangeEmailLinked`. A wrong code takes the field's error line
   in `Restore`'s words. A change past its window, or an address registered
   by someone else before both sides landed (`EMAIL_IN_USE`, which keeps
   answering until the window closes, so a freed address still applies),
   takes a form-level fault line above the commitment, `SignInError`'s
   placement — the words are copy-voice's.

   REGISTERED under the `changeEmail` prefix (design ⇄ impl seam 082, the
   settings packet). The inset is `pair`: its `label` and `resend`, then each
   side's caption and reading — `codeLabel` / `codeSide`, `linkLabel` /
   `linkSide`. The field is `code`, the commit with its reason `commit`, the
   line under it `note`, and `Cancel the change` is `cancel`. */
export const NODE = "changeEmail";
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
          data-node="title"
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
          data-node="body"
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
          data-node="pair"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span
              style={{
                fontSize: "var(--text-label-small)",
                lineHeight: "var(--text-label-small--line-height)",
                fontWeight: "var(--text-label-small--font-weight)",
                letterSpacing: "var(--text-label-small--letter-spacing, 0.5px)",
                color: "var(--text-secondary)",
              }}
              data-node="label"
            >
              Both have to land
            </span>
            <InlineAction size="sm" onClick={() => {}} node="resend">
              Resend
            </InlineAction>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", columnGap: "var(--space-2)", rowGap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }} data-node="codeLabel">
              Code
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)" }} data-node="codeSide">
              sol@solferreira.art — still waiting
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }} data-node="linkLabel">
              Link
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)" }} data-node="linkSide">
              sol@ferreira.studio — still waiting
            </span>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <TextField
            id="email-change-code"
            label="Confirmation code"
            mono
            kind="digits"
            enterKeyHint="go"
            value=""
            hint="From the message to sol@solferreira.art."
            node="code"
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <WaitingCommit id="email-change-code" label="Confirm the code" reason="Waiting for the code" node="commit" />
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote node="note">
            Until both sides land your account keeps the address it has, and a reset still goes
            there.
          </QuietNote>
        </div>

        <div style={{ marginTop: 16 }}>
          <InlineAction size="sm" onClick={() => {}} node="cancel">
            Cancel the change
          </InlineAction>
        </div>
      </div>
    </>
  );
}
