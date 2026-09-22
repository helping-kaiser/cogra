/* INTRO 4 OF 5 — NOTHING IS LOST (jakob's ruling, the batch-rulings round;
   backlog item 74). His sketch: "a post created from layers (maybe more images
   joining into the inital post)", and his reason for the card existing at all:
   "the one thing these four are missing is the layering and i think it is quite
   important.. people are not used to histories of posts, comments and their
   connections to things".

   TWO PICTURES JOIN A POST THAT ALREADY HAD ONE. Two is the fewest that reads
   as "more kept arriving" rather than as one swap, and the card below shows all
   three still there — the layering is only legible if the after-state still
   holds the before-state.

   THE STACK BEHIND THE CARD IS THE HISTORY. Two plates peeking above the card's
   own edge, at the card's corner and a quieter fill: the post is the top layer
   of something, not a single flat thing. It says what the drawing needs without
   putting a number on a first screen.

   NO REMOVAL ANYWHERE ON IT. The graph never deletes (`layers.md` §5), so a
   drawing that showed a picture leaving would teach the one thing this card
   exists to deny. */

const STAGE = { width: 342, height: 306 };

const PLATE = {
  position: "absolute",
  height: 40,
  borderRadius: "var(--radius-medium)",
  border: "1px solid var(--border-hairline)",
};

export function Screen() {
  return (
    <IntroFrame
      step={4}
      headline="Nothing is lost"
      lines={["Posts and comments keep every layer they were built from. Pictures added, words changed — the whole history stays readable."]}
    >
      <IntroStage {...STAGE}>
        <img
          src="gallery-honey.jpg"
          alt=""
          style={{ position: "absolute", left: 44, top: 0, width: 100, height: 76, objectFit: "cover", borderRadius: "var(--radius-small)", display: "block" }}
        />
        <img
          src="gallery-grapes.jpg"
          alt=""
          style={{ position: "absolute", left: 198, top: 0, width: 100, height: 76, objectFit: "cover", borderRadius: "var(--radius-small)", display: "block" }}
        />
        <IntroLines {...STAGE}>
          <path d="M 94 84 C 94 102, 140 96, 140 104" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="135,104 145,104 140,114" fill="var(--border-field)" />
          <path d="M 248 84 C 248 102, 202 96, 202 104" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="197,104 207,104 202,114" fill="var(--border-field)" />
        </IntroLines>

        <div style={{ ...PLATE, left: 28, top: 120, width: 286, background: "var(--surface-container)" }} />
        <div style={{ ...PLATE, left: 14, top: 130, width: 314, background: "var(--surface-container-high)" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 140,
            width: 342,
            boxSizing: "border-box",
            borderRadius: "var(--radius-medium)",
            background: "var(--surface-card)",
            border: "1px solid var(--border-hairline)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "10px var(--space-3)" }}>
            <MonogramAvatar name="Mira Voss" src="inviter.jpg" />
            <span style={{ flex: 1, fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              @mira
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>4h</span>
          </div>
          <div style={{ padding: "0 var(--space-3) 10px", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Sunday at the tide market
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <img src="gallery-market.jpg" alt="" style={{ width: "33.34%", height: 88, objectFit: "cover", display: "block" }} />
            <img src="gallery-honey.jpg" alt="" style={{ width: "33.33%", height: 88, objectFit: "cover", display: "block" }} />
            <img src="gallery-grapes.jpg" alt="" style={{ width: "33.33%", height: 88, objectFit: "cover", display: "block" }} />
          </div>
        </div>
      </IntroStage>
    </IntroFrame>
  );
}
