/* The reply composer with pictures on the WEB (comment-media round,
   2026-08-31): comments have no pick stage on either platform — "+ Add"
   opens the platform's own picker (Android's photo-picker sheet; the
   browser's file dialog here), so nothing of the post wizard's grid or its
   web substitution appears at comment scale. The one web addition is the
   drop path: the composer accepts files dropped anywhere on it, and the
   quiet hint beside Add says so — costs nothing on a phone. Everything
   else is the app's board unchanged. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 56, padding: "8px 12px", borderRadius: "var(--radius-small)", background: "var(--surface-container-highest, var(--surface-container-high))" }}>
          <img src="ava1.jpg" alt="" style={{ width: 32, height: 32, borderRadius: "var(--radius-full)", objectFit: "cover", flex: "none" }} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              The long way home — @ada
            </span>
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              The light does something at the third headland that I have never managed…
            </span>
          </span>
        </div>

        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
          The glovebox camera earns its keep — this is the print from 2019 that almost catches it.
          <span style={{ display: "inline-block", width: 2, height: 20, background: "var(--primary)", verticalAlign: "text-bottom", marginLeft: 1 }} />
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" width={70} height={88} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" alt="" width={117} height={88} fit="contain" progress={0.65} />
        </div>

        <DescribeCounter described={0} total={2} onDescribe={() => {}} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Button variant="text" size="sm">+ Add pictures · 2 of 4</Button>
          <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
            …or drop them here.
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Words first — pictures can join them, and they upload while you write.
        </p>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
