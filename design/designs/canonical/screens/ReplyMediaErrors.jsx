/* The reply composer with two files refused (comment video round,
   2026-09-02). A comment's caps are 4 pictures at 10 MiB each, or one video
   at 50 MiB with a cover at 10 MiB; a file over its cap, or one nothing here
   can read, never joins the composer.

   The refusal is drawn WHERE THE FILE WAS OFFERED — the media row of the
   composer that asked for it — never in a dialog, never in a snackbar
   (Snackbar confirms what happened; errors sit on the surface they happened
   on). Nothing was attached, so the composer is still words-only and both
   kinds can be refused on the same screen without breaking the pictures-OR-
   video grammar. The caps are named only here, at the moment they bite:
   nothing announces them in advance. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
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
          I have the whole walk on film somewhere — let me find something shorter.
          <span style={{ display: "inline-block", width: 2, height: 20, background: "var(--primary)", verticalAlign: "text-bottom", marginLeft: 1 }} />
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <RefusedFile
            src="comment-camera.jpg"
            video
            message="That video is too big — a comment's video can be up to 50 MB."
          />
          <RefusedFile message="That file isn't a picture or a video CoGra can read." />
        </div>

        <Button variant="text" size="sm" selfStart>+ Add pictures</Button>

        <div style={{ flex: 1 }} />

        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Words first — pictures can join them.
        </p>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
