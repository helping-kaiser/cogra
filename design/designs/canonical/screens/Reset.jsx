/* Reset your password — the sign-in side of recovery (readme §13, entry).
   THE ANSWER IS THE SAME EITHER WAY: the status line confirms whether or not
   that email has an account, so the screen never enumerates accounts. The
   quiet note under it draws the line the whole entry round rests on — this
   restores the SIGN-IN, never the key; the key comes back with its recovery
   code, on its own screen. The board draws the rest state honestly: before
   the first press the status line is absent (jakob 2026-10-05), and only a
   press's answer puts `If that email has an account, a reset link is on
   its way. …` under the commit. A spent or expired link opens
   `ResetExpired`.

   REGISTERED under the `reset` prefix (round 28, seam 254 A1), the reset
   family's surface with `ResetNew` and `ResetExpired`, as `deleteAccount`
   holds its mail landings: `title`, `body`, the field `email`, the commit
   `commit`, and the quiet note `note`.

   THE ANSWERED STATE (seam 320-7; the `request` chip's `sent`). Once the
   request answers, `status` stands under the commit in the body's own
   type, announced politely, reading the line the tree holds for it
   (copy-voice, *The reset*): `If that email has an account, a reset link is
   on its way. The link works once and expires after 15 minutes.` The field
   keeps the typed address and the commit stays awake. The sent field and commit are drawn copies; the rest ones alone
   carry the names, as `ChangeEmail`'s pending copies do. */
export const NODE = "reset";
export const PROPS = { request: { editor: "enum", options: ["rest", "sent"], default: "rest" } };
export const VALS = `restShown: this.props.request === "sent" ? "none" : "block", sentShown: this.props.request === "sent" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            letterSpacing: "var(--text-headline-small--letter-spacing)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
          data-node="title"
        >
          Reset your password
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            fontWeight: "var(--text-body-medium--font-weight)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
          data-node="body"
        >
          Resetting the password signs out every device.
        </p>

        <div style={{ display: "{{restShown}}" }}>
          <div style={{ marginTop: 32 }}>
            <TextField id="reset-email" label="Email" type="email" autoComplete="email" enterKeyHint="go" value="" node="email" />
          </div>

          <div style={{ marginTop: 24 }}>
            <WaitingCommit id="reset" label="Send reset link" reason="Waiting for your email" node="commit" />
          </div>
        </div>

        <div style={{ display: "{{sentShown}}" }}>
          <div style={{ marginTop: 32 }}>
            <TextField id="reset-email-sent" label="Email" type="email" autoComplete="email" enterKeyHint="go" value="sol@solferreira.art" />
          </div>

          <div style={{ marginTop: 24 }}>
            <WaitingCommit id="reset-sent" label="Send reset link" waiting={false} />
          </div>

          <p
            role="status"
            aria-live="polite"
            style={{
              margin: "16px 0 0",
              fontSize: "var(--text-body-medium)",
              fontWeight: "var(--text-body-medium--font-weight)",
              lineHeight: "var(--text-body-medium--line-height)",
              letterSpacing: "var(--text-body-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
            data-node="status"
          >
            If that email has an account, a reset link is on its way. The link works once and expires after 15 minutes.
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote node="note">
            This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, with your
            recovery code.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
