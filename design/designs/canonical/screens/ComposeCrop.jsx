/* THE POST'S CROP (legacy conversion, the conformance round): one shape for
   the whole post, chosen here and applied to every picture in it.

   ONE CROP MODEL, ON BOTH CLIENTS (jakob 2026-11-11, seam 301: "the instagram
   approach (fixed frame with mooving and zooming image)"). The FRAME is
   fixed: it stands still at the chosen shape, and the PICTURE is what moves
   (drag) and zooms (pinch, or the zoom track) under it. No window ever moves
   over a still picture, and the stage never changes size with the shape.

   THE STAGE IS ONE SIZE UNDER EVERY SHAPE: 390 × 488, the column's full
   width at 4:5. The frame changes shape inside it, the largest of its shape
   the stage holds, centred — Tall 4:5 fills it (390 × 488), Square 1:1 stands
   390 × 390 at top 49, Wide 1.91:1 stands 390 × 204 at top 142 (390 ÷ 1.91 =
   204.2). The `shape` chip draws each. Outside the frame the picture stays in
   view, darkened by the one box shadow `CropViewport` masks with (45 % black,
   its construction); under Tall nothing is outside.

   THE SHAPE CHIPS ARE THE DIFFERENCE FROM THE OTHER TWO CROPS, and the reason
   this board draws its own stage rather than taking `CropViewport`. A profile
   picture is shown in a circle and a video's cover at the clip's ratio, so both
   are cut at a LOCKED shape inside a square stage; a post's shape is the
   author's, so this stage is the tallest shape's and the thirds guides a
   composition decision needs are drawn on the frame.

   THE STRIP IS `MediaThumb`, dressed the way `CoverRow` dresses its frames:
   the framed picture takes the primary outline offset off the tile, the rest
   sit at 65%. Selection by outline and not by badge, for the same reason —
   at 48px a badge covers the thing being chosen.

   THE ZOOM IS ON SCREEN, AND THE PICTURE PANS BY KEY (the K13 round): the
   master's `CropZoom` under the stage, its thumb at this crop's 1.15× between
   the fill (1×) and 10×, on both platforms; the stage takes focus under
   `CropViewport`'s name and its arrow keys move the picture, stopping where an
   edge of the picture meets the frame's — 1 % a press, 10 % with Shift (jakob
   2026-10-05). The line under the zoom says what the crop decides, `One shape
   for the whole post.`, and nothing about how to move it (round 44, the
   removable-text pass: the how-to line goes on every crop).

   REGISTERED under its own `composeCrop` prefix (seam 248): `header`, the
   `shapes` chips (`tallChip`, `squareChip`, `wideChip`, a filter's
   `<value>Chip` naming — drawn once per `shape` value, its chip copies), the
   `viewport`, the `zoom` slider, the `howTo` line, the `pictures` strip with
   one `thumb` per picture keyed by its place, and `next`. */
export const NODE = "composeCrop";
export const PROPS = { shape: { editor: "enum", options: ["tall", "square", "wide"], default: "tall" } };
export const VALS = `tallShown: this.props.shape === "tall" ? "flex" : "none", squareShown: this.props.shape === "square" ? "flex" : "none", wideShown: this.props.shape === "wide" ? "flex" : "none", tallFrame: this.props.shape === "tall" ? "block" : "none", squareFrame: this.props.shape === "square" ? "block" : "none", wideFrame: this.props.shape === "wide" ? "block" : "none"`;

/* The frame per shape inside the 390 × 488 stage: full width, centred. */
const CROP_FRAMES = [
  { shape: "tall", height: 488 },
  { shape: "square", height: 390 },
  { shape: "wide", height: 204 },
];

const THIRDS = "rgba(255,255,255,0.55)";

function CropFrame({ shape, height }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: `{{${shape}Frame}}`,
        position: "absolute",
        left: 0,
        top: (488 - height) / 2,
        width: 390,
        height,
        boxShadow: "0 0 0 400px rgba(0,0,0,0.45)",
      }}
    >
      {/* The rule of thirds, drawn on the frame rather than around it. */}
      <span style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: THIRDS }} />
      <span style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: THIRDS }} />
      <span style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: THIRDS }} />
      <span style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: THIRDS }} />
    </div>
  );
}

export function Screen() {
  return (
    <>
      <WizardHeader title="Crop" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "{{tallShown}}", gap: 8 }} {...chipCopy("shape", "tall")}>
          <div style={{ display: "flex", gap: 8 }} data-node="shapes">
            <Chip label="Tall 4:5" selected onToggle={() => {}} node="tallChip" />
            <Chip label="Square 1:1" onToggle={() => {}} node="squareChip" />
            <Chip label="Wide 1.91:1" onToggle={() => {}} node="wideChip" />
          </div>
        </div>
        <div style={{ display: "{{squareShown}}", gap: 8 }} {...chipCopy("shape", "square")}>
          <div style={{ display: "flex", gap: 8 }} data-node="shapes">
            <Chip label="Tall 4:5" onToggle={() => {}} node="tallChip" />
            <Chip label="Square 1:1" selected onToggle={() => {}} node="squareChip" />
            <Chip label="Wide 1.91:1" onToggle={() => {}} node="wideChip" />
          </div>
        </div>
        <div style={{ display: "{{wideShown}}", gap: 8 }} {...chipCopy("shape", "wide")}>
          <div style={{ display: "flex", gap: 8 }} data-node="shapes">
            <Chip label="Tall 4:5" onToggle={() => {}} node="tallChip" />
            <Chip label="Square 1:1" onToggle={() => {}} node="squareChip" />
            <Chip label="Wide 1.91:1" selected onToggle={() => {}} node="wideChip" />
          </div>
        </div>

        {/* THE STAGE: one size under every shape. The picture covers it at the
            crop's zoom and stays put across a shape switch (its centre and its
            zoom kept); only the frame over it changes. */}
        <div tabIndex={0} role="group" aria-label={CROP_PAN_NAME} className="cg-focus" style={{ position: "relative", width: 390, height: 488, margin: "0 -24px", overflow: "hidden", flex: "none" }} data-node="viewport">
          <img
            src="post-photo.jpg"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scale(1.15)", transformOrigin: "40% 60%" }}
          />
          {CROP_FRAMES.map((frame) => (
            <CropFrame key={frame.shape} {...frame} />
          ))}
        </div>

        <CropZoom scale={1.15} node="zoom" />

        <QuietNote node="howTo">One shape for the whole post.</QuietNote>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }} data-node="pictures">
          <span style={{ display: "inline-flex", flex: "none", borderRadius: "var(--radius-small)", outline: "2px solid var(--primary)", outlineOffset: 1 }}>
            <MediaThumb src="post-photo.jpg" node="thumb" nodeKey="1" />
          </span>
          <span style={{ display: "inline-flex", flex: "none", opacity: 0.65 }}>
            <MediaThumb src="inviter.jpg" node="thumb" nodeKey="2" />
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }} node="next">Next</Button>
      </div>
    </>
  );
}
