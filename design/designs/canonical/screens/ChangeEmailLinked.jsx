/* THE NEW ADDRESS'S LINK, OPENED — the email change's landing (jakob
   2026-10-01, audit K3.21; auth.md, *Email change*).

   `Verified`'S IDIOM, because it is `Verified`'s moment: a link that is the
   proof, opened from a mail, and the one thing left to say is what it moved.
   The mark is the picture, the line centred under it, the way on a text
   button — nothing here is a commitment to make.

   TWO STATES, ONE CHIP. The change applies only once both sides land, in
   either order, so the link can be the first side or the last. First: the
   new address is confirmed and the code from the old one is still owed, and
   the way on goes where that code is typed. Last: the change has applied,
   and the way on goes back to settings, where the row now reads the new
   address.

   IT NEEDS A SESSION. `confirmEmailChange` is a signed-in call, so a link
   opened on a device that is not signed in lands on
   `ChangeEmailLinkedSignedOut` first. An expired change and an address taken
   in the meantime answer here in copy-voice's words. No back arrow: a mail
   link has no previous screen of ours. */
export const PROPS = { side: { editor: "enum", options: ["first", "last"], default: "first" } };
export const VALS = `linkedTitle: this.props.side === "last" ? "Email changed" : "New address confirmed", linkedBody: this.props.side === "last" ? "You sign in with sol@ferreira.studio from now on, and resets go there too." : "One side left: the code we sent to sol@solferreira.art. Your email moves once it's typed in.", linkedWay: this.props.side === "last" ? "Back to settings" : "Enter the code"`;

export function Screen() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        overflow: "hidden",
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--primary)" }}>
        <Icon name="mark" size={56} />
      </span>
      <h1
        style={{
          margin: "24px 0 0",
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
          textAlign: "center",
        }}
      >
        {"{{linkedTitle}}"}
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          maxWidth: 300,
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          letterSpacing: "var(--text-body-medium--letter-spacing)",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        {"{{linkedBody}}"}
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="text">{"{{linkedWay}}"}</Button>
      </div>
    </div>
  );
}
