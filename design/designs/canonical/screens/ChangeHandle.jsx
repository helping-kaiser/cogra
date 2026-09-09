/* CHANGE YOUR HANDLE (readme §13, the settings round; jakob's review
   2026-09-09). What the Credentials group's Handle row opens — `Settings/12`.

   THE SHAPE IS THE FAMILY'S, and this is its shortest member: one field, one
   commitment, and two facts around them. Nothing is proved again — `auth.md`
   makes `changeHandle` an ordinary authenticated mutation, and asking for a
   password where the server does not would be theatre.

   THE FIRST LINE IS REASSURANCE, AND IT IS TRUE. A handle is L2 account state —
   the mention namespace — not graph structure and not profile payload, so
   nothing signed moves when it changes. A reader about to rename themselves in
   public is entitled to know that before they do it, and the honest register
   says the calm part out loud rather than leaving it to be feared.

   THE LAST LINE IS THE COST, AND IT IS NOT SOFTENED. A freed handle is
   immediately claimable, and links to the old one resolve to nothing — or to
   whoever takes it. That is the system being honest rather than the design
   being alarming, so it takes no `error` colour: §4 keeps that for failure.

   THE RULES SIT ON THE FIELD, not in a paragraph. Length and charset are what
   the reader needs while typing, which is what a hint is for; the fold to
   lowercase is said because a reader who types capitals will otherwise think
   the field ate them. */
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
          Change your handle
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
          @sol is how people mention and find you. Everything you have published stays yours — the
          handle is a name, not the account.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField
            id="new-handle"
            label="New handle"
            autoComplete="username"
            value=""
            hint="3 to 30 characters: letters, numbers and underscore. Handles are always lowercase."
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Change handle</Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote>
            Links to your old handle stop working the moment you change it, and anyone can claim it
            afterwards.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
