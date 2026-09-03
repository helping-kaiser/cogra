/* Restore — brings a signing key onto a device that doesn't have it
   (readme §13, entry): reached from KeyElsewhere, the wallet's key-absent
   states, and the pad's key-absent state. The wording chip flips the body
   copy between the browser and the installed app, same as KeyElsewhere. */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = `restoreBody: this.props.wording === "app" ? "Enter your recovery code to bring your signing key into this app." : "Enter your recovery code to bring your signing key onto this browser."`;

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
          Restore your key
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
          {"{{restoreBody}}"}
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="recovery-code" label="Recovery code" mono placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX" value="" />
        </div>

        <div style={{ marginTop: 16 }}>
          <Checkbox label="Don't remember this account on this device" />
        </div>

        <div style={{ marginTop: 16 }}>
          <Button style={{ width: "100%" }}>Restore the key</Button>
        </div>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          This is the only way to restore your key. If the code is gone too, the key can't be brought back — your sign-in still works.
        </p>
      </div>
    </>
  );
}
