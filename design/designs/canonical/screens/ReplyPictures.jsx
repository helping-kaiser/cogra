/* The reply composer with pictures attached (media slice): words first, the
   uncropped tiles join them — whole frames in MediaThumb, one still
   uploading (comment pictures upload at pick; there is no crop). Four is the
   cap. Comments have no pick stage: "+ Add" opens the platform's own picker
   (Android's photo-picker sheet here; the browser's file dialog on the
   ReplyPicturesWeb board).

   A PICTURE THAT DIDN'T UPLOAD FAILS THE COMPOSE WAY (jakob 2026-10-05, the
   collected brief's P17 — the 136 round's ruling 2, mirrored onto the reply).
   The tile wears `MediaThumb`'s failed badge, and `One picture didn't
   upload.` stands under the row with `Retry · Remove it`: the file was fine
   and the network wasn't, so the fault offers Retry, as `ReplyVideoFailed`
   does for a clip. `Next` is disabled while the picture is failed — the seal
   can only wait on an upload that is running (`ReplyVideoFailed`'s ruling,
   audit K6.2) — and the line above it is the reason and the two ways on;
   "they upload while you write" goes with the upload it described. The
   `upload` chip draws it at `failed`; `uploading` is the drawing as it
   stands, the second tile's ring running. */
export const PROPS = { upload: { editor: "enum", options: ["uploading", "failed"], default: "uploading" } };
export const VALS = `runningShown: this.props.upload === "failed" ? "none" : "flex", failedShown: this.props.upload === "failed" ? "flex" : "none", errorShown: this.props.upload === "failed" ? "block" : "none", noteShown: this.props.upload === "failed" ? "none" : "block", nextShown: this.props.upload === "failed" ? "none" : "block", nextFailedShown: this.props.upload === "failed" ? "block" : "none"`;

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

        <div style={{ display: "{{runningShown}}", gap: 8, alignItems: "flex-start" }}>
          <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" width={70} height={88} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" alt="" width={117} height={88} fit="contain" progress={0.65} />
        </div>
        <div style={{ display: "{{failedShown}}", gap: 8, alignItems: "flex-start" }}>
          <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" width={70} height={88} fit="contain" onRemove={() => {}} />
          <MediaThumb src="gallery-market.jpg" alt="" width={117} height={88} fit="contain" failed />
        </div>
        <div style={{ display: "{{errorShown}}" }}>
          <UploadErrorLine onRetry={() => {}} onRemove={() => {}} />
        </div>

        <DescribeCounter described={0} total={2} onDescribe={() => {}} />

        <InlineAction size="sm" selfStart>+ Add pictures · 2 of 4</InlineAction>

        <div style={{ flex: 1 }} />

        <div style={{ display: "{{noteShown}}" }}>
          <QuietNote>Words first — pictures can join them, and they upload while you write.</QuietNote>
        </div>
        <div style={{ display: "{{nextShown}}" }}>
          <Button style={{ width: "100%" }}>Next</Button>
        </div>
        <div style={{ display: "{{nextFailedShown}}" }}>
          <Button style={{ width: "100%" }} disabled>
            Next
          </Button>
        </div>
      </div>
    </>
  );
}