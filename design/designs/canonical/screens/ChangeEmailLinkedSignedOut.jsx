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
   link has no previous screen of ours. */
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
      >
        Sign in to finish the change
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
        This link confirms sol@ferreira.studio as your new address. It counts once you're signed in.
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="text">Sign in</Button>
      </div>
    </div>
  );
}
