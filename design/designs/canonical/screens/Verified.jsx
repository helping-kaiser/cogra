/* Email verified — the board the verification mail opens (readme §13, entry).
   It is a landing, not a step: the application already moved, and the one
   thing left to say is that the app knows. So the mark is the whole picture,
   the line is centered under it, and the way on is a text button — nothing
   here is a commitment to make. */
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
        Email verified
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
        Your application moved a step. You can go back to the app — it already knows.
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="text">Back to CoGra</Button>
      </div>
    </div>
  );
}
