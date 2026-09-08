/* COMPOSE OPENED WITH A DRAFT ALREADY ON THE DEVICE (legacy conversion, the
   conformance round). The wizard keeps what was started — leaving it never
   asks, because nothing is lost — so the next opening has to say so and offer
   both ways: back into the draft, or past it.

   THE DRAFT IS A `Card`, and it LEADS. It is the answer to a question the
   author has not asked yet ("where did that go?"), so it sits above the fresh
   start rather than beside it, and the pick step goes on underneath at 55% —
   present, clearly not the subject, and the thing Discard hands the author
   back.

   THE FRESH-START LINE IS NOT `PickPrompt`. That master pairs the instruction
   with the way out of the media path, and both halves are required; here there
   is no escape to offer — the draft's own pair is the choice on this board —
   so the line is spelled at the master's caption values and nothing else. */

const TILE = { position: "relative", width: 125, height: 125 };
const FILL = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const SHADES = [
  "var(--surface-container-low)",
  "var(--surface-container)",
  "var(--surface-container-high)",
  "var(--surface-container-highest)",
  "var(--surface-container)",
  "var(--surface-container-highest)",
  "var(--surface-container-low)",
];

export function Screen() {
  return (
    <>
      <WizardHeader title="New post" />

      <Card style={{ flex: "none", margin: "8px 24px" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
          Your draft is here
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MediaThumb src="post-photo.jpg" size={40} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
              Salt maps of the coast road
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              2 pictures — kept on this device
            </span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Discard</Button>
          <Button>Continue</Button>
        </div>
      </Card>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 24px" }}>
        <p style={{ margin: 0, flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
          Or start fresh — pick one picture, several, or one video.
        </p>
      </div>

      {/* The roll, waiting. Inert in this state: the draft's own pair is the
          choice, and a grid that took picks under it would make two. */}
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, padding: "4px 4px 0", overflow: "hidden", alignContent: "flex-start", opacity: 0.55 }}>
        <div style={{ ...TILE, overflow: "hidden" }}>
          <img src="post-photo.jpg" alt="" style={FILL} />
        </div>
        <div style={{ ...TILE, overflow: "hidden" }}>
          <img src="inviter.jpg" alt="" style={FILL} />
        </div>
        {SHADES.map((background, index) => (
          <div key={index} style={{ ...TILE, background }} />
        ))}
      </div>
    </>
  );
}
