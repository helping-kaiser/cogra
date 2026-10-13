/* THE NEW ADDRESS'S LINK, OPENED — the email change's landing (jakob
   2026-10-01, audit K3.21; auth.md, *Email change*).

   `Verified`'S IDIOM, because it is `Verified`'s moment: a link that is the
   proof, opened from a mail, and the one thing left to say is what it moved.
   The mark is the picture, the line centred under it, the way on a text
   button — nothing here is a commitment to make.

   FOUR STATES, ONE CHIP. The change applies only once both sides land, in
   either order, so the link can be the first side or the last. First: the
   new address is confirmed and the code from the old one is still owed, and
   the way on goes where that code is typed. Last: the change has applied,
   and the way on goes back to settings, where the row now reads the new
   address.

   A LINK THAT OUTLIVED ITS CHANGE (jakob 2026-10-06, contract recon EC4).
   Opened after the change was canceled, or again after it already applied,
   the link moves nothing and the landing says why in `VerifyExpired`'s
   heading, `This link doesn't work anymore`, with the address the account
   has now and `Back to settings` — the chip's `canceled` and `applied`.

   A LINK NOBODY KNOWS, SIGNED IN (jakob 2026-10-09, item 98 — one family
   with ruling 38's signed-out landing). A mistyped or long-swept token
   answers nothing at all, so the read can tie it to no change and no
   address: the landing takes the dead-link heading over a body naming no
   address — the signed-out G9 construction met with a session — and
   `Back to settings`, the signed-in way on. The chip's `unknown`; its body
   is drafted for jakob.

   IT NEEDS A SESSION. `confirmEmailChange` is a signed-in call, so a link
   opened on a device that is not signed in lands on
   `ChangeEmailLinkedSignedOut` first. An expired change and an address taken
   in the meantime answer here in copy-voice's words. No back arrow: a mail
   link has no previous screen of ours.

   REGISTERED under the `changeEmail` prefix (design ⇄ impl seam 082, the
   settings packet): `mark`, `title`, `body`, and the way on `onward`, as the
   other landings name theirs. The `landing` chip changes their words and
   draws no element twice, so nothing is keyed. */
export const NODE = "changeEmail";
export const PROPS = { landing: { editor: "enum", options: ["first", "last", "canceled", "applied", "unknown"], default: "first" } };
export const VALS = `linkedTitle: this.props.landing === "last" ? "Email changed" : this.props.landing === "canceled" || this.props.landing === "applied" || this.props.landing === "unknown" ? "This link doesn't work anymore" : "New address confirmed", linkedBody: this.props.landing === "last" ? "You sign in with sol@ferreira.studio from now on, and resets go there too." : this.props.landing === "canceled" ? "The change it belonged to was canceled. Your email is still sol@solferreira.art." : this.props.landing === "applied" ? "The change it belonged to already happened. Your email is now sol@ferreira.studio." : this.props.landing === "unknown" ? "It isn't a link CoGra knows — it may be mistyped, or from a change long gone. Your email stays as it is." : "One side left: the code we sent to sol@solferreira.art. Your email moves once it's typed in.", linkedWay: this.props.landing === "first" ? "Enter the code" : "Back to settings"`;

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
      <span style={{ display: "inline-flex", color: "var(--primary)" }} data-node="mark">
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
        data-node="title"
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
        data-node="body"
      >
        {"{{linkedBody}}"}
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="text" node="onward">{"{{linkedWay}}"}</Button>
      </div>
    </div>
  );
}
