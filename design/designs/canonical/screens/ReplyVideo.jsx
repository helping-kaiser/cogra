/* The reply composer's VIDEO state (comment video round, 2026-09-02): a
   comment carries up to four pictures OR one video and its cover, never both
   kinds — the post's grammar at comment caps. Entry is unchanged: "+ Add"
   opens the platform's own picker and a video pick lands here, so there is no
   pick stage and no crop; the video uploads at pick like a comment's
   pictures do.

   The frame is the comment pager's fixed square at comment scale (220px), the
   whole frame fitted inside it — a comment never turns into a post. The cover
   row is ComposeCover's ("The video's face") scaled down and inlined: the
   comment composer is one screen, so the face is picked here rather than in a
   stage of its own. Its markup is screen-local because the frame strip is one
   picture framed three ways, which no component draws.

   WEB TAKES THIS BOARD 1:1 (jakob 2026-09-02): the file dialog and the
   composer's drop-anywhere path play the picker's part, and nothing else about
   the state differs, so no web board is drawn — the avatar flow's blessing,
   again.

   A VIDEO TAKES ONE DESCRIPTION for the whole clip (jakob 2026-09-02) — the
   same counter row a comment's pictures wear, reading the video instead. The
   cover takes none of its own: it is the video's face, not a second picture. */

function CoverRow() {
  const tile =
    "width: 56px; height: 56px; border-radius: var(--radius-small); overflow: hidden; flex: none;";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          fontWeight: "var(--text-label-large--font-weight)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
        }}
      >
        Cover
      </span>
      <Raw
        html={`<div style="display: flex; gap: 8px;">
          <div class="cg-cover-frame" style="${tile} outline: 2px solid var(--primary); outline-offset: 1px;"><img src="comment-camera.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block;"></div>
          <div class="cg-cover-frame" style="${tile} opacity: 0.65;"><img src="comment-camera.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1.4);"></div>
          <div class="cg-cover-frame" style="${tile} opacity: 0.65;"><img src="comment-camera.jpg" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1.8) translateY(6%);"></div>
          <div class="cg-cover-own" style="width: 56px; height: 56px; border-radius: var(--radius-small); border: 1px dashed var(--border-field); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); box-sizing: border-box; flex: none;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"></path></svg>
          </div>
        </div>`}
      />
      <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
        A frame, or a picture of your own.
      </p>
    </div>
  );
}

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
          Eighteen seconds of the same headland, if the light comes through at all.
          <span style={{ display: "inline-block", width: 2, height: 20, background: "var(--primary)", verticalAlign: "text-bottom", marginLeft: 1 }} />
        </p>

        <MediaThumb
          src="comment-camera.jpg"
          alt="A person holding a film camera up to the light."
          width={220}
          height={220}
          fit="contain"
          video
          duration="0:18"
          onRemove={() => {}}
          removeLabel="Remove this video"
        />

        <DescribeCounter subject="video" described={0} total={1} onDescribe={() => {}} />

        <CoverRow />

        <div style={{ flex: 1 }} />

        <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          Words first — a video can join them, and it uploads while you write.
        </p>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
