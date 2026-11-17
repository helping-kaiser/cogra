/* The reply composer with pictures on the WEB (comment-media round,
   2026-08-31): comments have no pick stage on either platform — "+ Add"
   opens the platform's own picker (Android's photo-picker sheet; the
   browser's file dialog here), so nothing of the post wizard's grid or its
   web substitution appears at comment scale. The one web addition is the
   drop path: the composer accepts files dropped anywhere on it, and the
   quiet hint beside Add says so — costs nothing on a phone. What the dialog
   or the drop brings passes the comment's square crop (`ReplyCrop`) before
   it joins the tray, as on the phone. Everything else is the app's board
   unchanged. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuotedRow
          title="The long way home — @ada"
          snippet="The light does something at the third headland that I have never managed…"
          name="Ada Okonkwo"
          src="comment-camera.jpg"
        />

        <WordsBody rows={REPLY_WORDS_ROWS} cap={REPLY_WORDS_CAP} paragraphs={["The glovebox camera earns its keep — this is the print from 2019 that almost catches it."]} />

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" size={88} onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" alt="" size={88} progress={0.65} />
        </div>

        <DescribeCounter described={0} total={2} onDescribe={() => {}} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <InlineAction size="sm">+ Add pictures · 2 of 4</InlineAction>
          <span style={{ fontSize: "var(--text-label-small)", fontWeight: "var(--text-label-small--font-weight)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
            …or drop pictures or a video here.
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <QuietNote>Words first — pictures can join them, and they upload while you write.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
