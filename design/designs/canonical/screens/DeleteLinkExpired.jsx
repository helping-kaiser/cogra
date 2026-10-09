/* Deletion link · already used or replaced — what a dead deletion
   confirmation link opens (jakob 2026-10-07, ER-G1; drawn 2026-10-09 with
   the dead-link family, item 98's round).

   `ResetExpired`'S CONSTRUCTION, the product's dead-mail-link landing: the
   failure said out loud in the blessed heading, the possibilities and the
   way forward in the paragraph, the way on following the words. No mark, no
   arrow, no error colour, for that board's reasons — a mail link has no
   previous screen of ours, and the dead link is not the reader's failure.

   NO RESEND (ER-G1). A fresh deletion link is not this landing's to offer:
   the request lives in settings, where asking again records a new request
   with its own content-sweep choice — so the paragraph points there and the
   board carries one control. The deletion mail claims no expiry
   (`DeleteAccountMail`), so the paragraph claims none either: a dead link
   here was used already or replaced by a newer request.

   THE WAY ON IS SESSION-DEPENDENT, the G9/38 family's construction
   (`VerifyExpired`'s rule): `Back to settings` with a session — settings is
   where the deletion's state lives — and `Sign in` without one. The
   `session` chip swaps the one label and draws no element twice.

   NOTHING IS SAID ABOUT THE ACCOUNT. A spent token says nothing about whose
   it was, and the screen must not enumerate accounts or name an address —
   the family's address-free rule. The body is drafted for jakob.

   REGISTERED under the `deleteAccount` prefix (the deletion family's own):
   `title`, `body` and the way on `onward`, as the other landings name
   theirs. */
export const NODE = "deleteAccount";
export const PROPS = { session: { editor: "enum", options: ["in", "out"], default: "in" } };
export const VALS = `deadWay: this.props.session === "out" ? "Sign in" : "Back to settings"`;

export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
        data-node="title"
      >
        This link doesn't work anymore
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
        It may have been used already, or a newer request replaced it. If you still mean to delete your account, ask
        again from settings.
      </p>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="text" style={{ width: "100%" }} node="onward">
          {"{{deadWay}}"}
        </Button>
      </div>
    </div>
  );
}
