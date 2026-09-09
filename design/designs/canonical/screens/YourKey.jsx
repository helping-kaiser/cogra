/* YOUR KEY — the key export, revealed (readme §13, the settings round). Both
   apps have shipped this screen since slice 1 and no board had ever drawn it.

   THE BOARD DRAWS THE REVEALED STATE, because the thing no other surface shows
   is what a key export looks like: two encodings of one secret, each named
   exactly. What precedes it is a gate, and the gate is the platform's — the
   phone's own unlock on Android, and on the web either nothing (the seed is
   still in this browser, so a prompt would prove nothing) or the current
   recovery code (the seed sits behind the backup blob).

   THE FORMATS ARE NAMED IN FULL, and that is §3's stated exception to keeping
   implementation vocabulary off the screen: PEM, PKCS#8, hex, Ed25519. An
   export nobody can feed to another tool is not an export. Plain language
   frames the block; the precise label sits on it.

   THE WARNING IS THE BODY, not a banner. "Anyone who has a copy can act as
   you" is a fact about what the reader is looking at, said calmly and once —
   the honesty register, not an alarm, and no `error` colour anywhere near it.

   EACH BLOCK'S COPY NAMES WHAT IT COPIES. Two controls reading "Copy" a
   thumb's width apart tell a listener the verb and not the object, the same
   reason the share control is "Share this post". */

function SecretBlock({ label, value, copyLabel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-label-large)",
            lineHeight: "var(--text-label-large--line-height)",
            fontWeight: "var(--text-label-large--font-weight)",
            letterSpacing: "var(--text-label-large--letter-spacing)",
          }}
        >
          {label}
        </span>
        <InlineAction ariaLabel={copyLabel} onClick={() => {}}>
          Copy
        </InlineAction>
      </div>
      <p
        style={{
          margin: 0,
          padding: "12px",
          border: "1px solid var(--border-field)",
          borderRadius: "var(--radius-extra-small)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          wordBreak: "break-all",
          color: "var(--text-body)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader title="Your key" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 32px", overflow: "hidden" }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          This key signs everything you publish, and it lives only in this browser. Store a copy
          somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can act
          as you.
        </p>

        <Card ariaLabel="Your actor key">
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-title-medium)",
              lineHeight: "var(--text-title-medium--line-height)",
              fontWeight: "var(--text-title-medium--font-weight)",
            }}
          >
            Your actor key
          </h2>
          <SecretBlock
            label="PEM (PKCS#8)"
            copyLabel="Copy the PEM block"
            value={"-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIHq2ZP9c1sVe0mQ4bT8xLp3RkA6yNfW5jChD7uXsG2vB\n-----END PRIVATE KEY-----"}
          />
          <SecretBlock
            label="Raw hex — Ed25519 private key"
            copyLabel="Copy the raw hex"
            value="7ab664ff5cd6c55ed264386d3f312e9dd1900eb235f5b98c2843eee5ec1b6bc1"
          />
        </Card>

        <QuietNote>Nothing here is sent anywhere — the key is read from this browser and shown.</QuietNote>
      </div>
    </>
  );
}
