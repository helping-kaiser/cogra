/* THE EMAIL CHANGE'S LINK, OPENED SIGNED OUT (jakob 2026-10-01, audit
   K3.21).

   THE NEW ADDRESS'S MAIL IS READ WHEREVER THAT ADDRESS IS READ — often not
   on the device that asked for the change. Its proof only counts inside a
   session (`confirmEmailChange` is a signed-in call), so this landing says
   what the link is for and asks for the one thing missing: sign in, and the
   link's side applies. It does not pretend the side has landed already.

   `Verified`'S LAYOUT WITHOUT ITS MARK. The column is the landing's, centred
   and calm; the mark is not, because the mark is spent on the moment
   something worked (`VerifyExpired`'s rule) and nothing has yet. The way on
   is `Verified`'s text button, naming where it goes. No back arrow: a mail
   link has no previous screen of ours.

   A LINK THAT NO LONGER WORKS, OR ONE NOBODY KNOWS (jakob 2026-10-07, ruling
   38; the settings packet's G9 — the `landing` chip's `dead`). Signed out,
   the device holds nothing but the token, and the read it asks answers with
   the change's state and never the account's address; a swept or mistyped
   token answers nothing at all. So every answer but a waiting change lands on
   ONE address-free landing: `VerifyExpired`'s heading, `This link doesn't
   work anymore`, the possibilities said in `ChangeEmailLinked`'s own
   construction (`The change it belonged to …`) without the address clause
   those signed-in bodies end on, and `Sign in` — `VerifyExpired`'s way on
   with no session. One landing for all of them, as `VerifyExpired` answers a
   used link and an expired one alike: nothing a signed-out reader could act
   on differs between them. Signing in holds no link here; the signed-in
   settings say where the email stands. The body is drafted for jakob.

   REGISTERED under the `changeEmail` prefix (design ⇄ impl seam 082, the
   settings packet): `title`, `body` and the way on `onward`, as
   `ChangeEmailLinked` names them. The `landing` chip changes their words and
   draws no element twice, so nothing is keyed. */
export const NODE = "changeEmail";
export const PROPS = { landing: { editor: "enum", options: ["pending", "dead"], default: "pending" } };
export const VALS = `signedOutTitle: this.props.landing === "dead" ? "This link doesn't work anymore" : "Sign in to finish the change", signedOutBody: this.props.landing === "dead" ? "The change it belonged to may have run out, been canceled or already happened — this link can't move your email anymore." : "This link confirms sol@ferreira.studio as your new address. It counts once you're signed in."`;

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
      <h1
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
          textAlign: "center",
        }}
        data-node="title"
      >
        {"{{signedOutTitle}}"}
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
        {"{{signedOutBody}}"}
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="text" node="onward">Sign in</Button>
      </div>
    </div>
  );
}
