/* The reply composer with pictures attached (media slice): words first, the
   uncropped tiles join them — whole frames in MediaThumb, one still
   uploading (comment pictures upload at pick; there is no crop). Four is the
   cap. Comments have no pick stage: "+ Add" opens the platform's own picker
   (Android's photo-picker sheet here; the browser's file dialog on the
   ReplyPicturesWeb board). */
export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuotedRow
          title="The long way home — @ada"
          snippet="The light does something at the third headland that I have never managed…"
          name="Ada Okonkwo"
          src="ava1.jpg"
        />

        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
          The glovebox camera earns its keep — this is the print from 2019 that almost catches it.
          <Caret />
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" width={70} height={88} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" alt="" width={117} height={88} fit="contain" progress={0.65} />
        </div>

        <DescribeCounter described={0} total={2} onDescribe={() => {}} />

        <Button variant="text" size="sm" selfStart>+ Add pictures · 2 of 4</Button>

        <div style={{ flex: 1 }} />

        <QuietNote>Words first — pictures can join them, and they upload while you write.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
