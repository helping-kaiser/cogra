/* Describe the video (video conform round, 2026-09-03): the describe sheet's
   other shape, over the reply composer's video state.

   ONE ENTRY, NOT A WALK. A set of pictures is described one tile at a time
   and the counter keeps the score; a clip is one thing, so the sheet has one
   field and the counter that opens it reads "0 of 1". The cover is never
   offered a field of its own — it is the video's face, and describing it
   would ask twice about one thing.

   The reason rides under the title on both shapes, permanently: someone
   deciding whether to write a description needs to know who is listening at
   the moment of deciding, not behind a "?" they will not open. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ padding: "12px 24px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
          Eighteen seconds of the same headland, if the light comes through at all.
        </p>
        <MediaThumb src="comment-camera.jpg" alt="" width={160} height={160} fit="contain" video duration="0:18" />
      </div>
      <div style={{ flex: 1 }} />

      <DescribeSheet
        open
        video
        src="comment-camera.jpg"
        value="A camera held up against the light on a headland, the sea moving behind it."
        onClose={() => {}}
      />
    </>
  );
}
