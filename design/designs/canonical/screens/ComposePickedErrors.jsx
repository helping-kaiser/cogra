/* The pick step with two files refused (comment video round, 2026-09-02) —
   the post-scale twin of *Reply · files refused*. A post's caps are 10
   pictures at 10 MiB each, or one video at 100 MiB with a cover at 10 MiB.

   What was accepted is in the tray; what was refused is listed under it, each
   with the cap it broke. A refused file never joined the batch, so it cannot
   appear in the Show all sheet — the refusal lives here, at the step that
   asked for the file, and its only way out is Remove it. */
const PICKED = [
  { src: "post-photo.jpg", alt: "The coast road", described: true },
  { src: "gallery-market.jpg", alt: "" },
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
        <p style={{ margin: 0, flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
          Pick one picture, several, or one video.
        </p>
        <Button variant="text" size="sm">Write words instead</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 24px 12px", borderBottom: "1px solid var(--border-hairline)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ flex: 1, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
            Picked · 2
          </span>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--primary)" }}>
            Show all
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {PICKED.map((item) => (
            <MediaThumb key={item.src} src={item.src} alt={item.alt} onRemove={() => {}} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 24px 0" }}>
        <RefusedFile
          src="gallery-honey.jpg"
          message="That picture is too big — a picture can be up to 10 MiB."
        />
        <RefusedFile message="That file isn't a picture or a video CoGra can read." />
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "12px 24px 16px" }}>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
