/* Your key — the ceremony's first screen (readme §13, entry). The key is made
   on the device and never leaves it, so the only thing CoGra can offer is the
   recovery code, and this screen exists to say so before asking for anything.
   Both ways out are real: the code now, or Not now — which does not skip the
   ceremony, it opens the board that spells out what declining costs. */
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
          Your key
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-large)",
            lineHeight: "var(--text-body-large--line-height)",
            letterSpacing: "var(--text-body-large--letter-spacing)",
          }}
        >
          Everything you publish is signed with a key that is created on this device and stays in your hands — CoGra never
          holds it and can never reissue it.
        </p>
        <p
          style={{
            margin: "16px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          A recovery code is the one way to bring your key to another device, or back after a loss. It is shown once; you
          keep it somewhere safe.
        </p>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button style={{ width: "100%" }}>Create my recovery code</Button>
          <Button variant="outline" style={{ width: "100%" }}>
            Not now
          </Button>
        </div>
      </div>
    </>
  );
}
