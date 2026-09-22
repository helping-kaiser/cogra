/* INTRO 2 OF 5 — OPINIONS HAVE A SHAPE (jakob's ruling, the batch-rulings
   round; backlog item 74). His sketch: "the pad and maybe a bit of graph
   spreading out from you with different emojis on the edges".

   THE PAD IS THE PAD. `StancePad` itself, at its own geometry, because this is
   the one card that shows a control rather than a consequence — and the knob
   sits on the same pair the first edge below carries, so the two halves of the
   drawing are one sentence: you place a point, and the point becomes the link.

   THE EMOJI ON AN EDGE IS THE EDGE (jakob's ruling, verbatim: an emoji is a
   representation of the two numbers, "every edge transports sentiments from one
   node to another… that is literally the graph"). §3 admits emoji in exactly one
   place, the twenty-anchor readout, and these are that readout: every face here
   is `STANCE_ANCHORS`' own glyph for the pair beside it, with the anchor's own
   words carried for a screen reader. They are not decoration and there is no
   sixth glyph invented for the drawing.

   FOUR DIFFERENT THINGS, FOUR DIFFERENT FACES. A person, a post, a topic and a
   person again — an opinion is given on anything — and one of the four is
   negative, because a drawing where every edge is warm teaches that the product
   only counts approval. */

const STAGE = { width: 342, height: 392 };

/* The anchor pairs this card draws, in the order the fan reads. Glyph and words
   are `STANCE_ANCHORS`', never spelled here. */
const INTRO_EDGES = [
  { emoji: "😍", label: "Love this", x: 40 },
  { emoji: "👀", label: "Show me more", x: 127 },
  { emoji: "😌", label: "Good, but not in my world", x: 215 },
  { emoji: "😕", label: "Not for me", x: 302 },
];

/* The glyph rides its OWN edge's midpoint — the hub is at x 171, the node at
   `x`, so the face lands halfway along the line it belongs to and masks it. A
   glyph parked above its node would read as a label on the node instead, which
   is the one thing this card must not say: the sentiment is the edge. */
function EdgeFace({ emoji, label, x }) {
  return (
    <span
      style={{
        position: "absolute",
        left: (171 + x) / 2 - 16,
        top: 287,
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-full)",
        background: "var(--surface)",
        fontSize: 20,
        lineHeight: "20px",
      }}
    >
      <span aria-hidden="true">{emoji}</span>
      <span style={SR_ONLY}>{label}</span>
    </span>
  );
}

export function Screen() {
  return (
    <IntroFrame
      step={2}
      headline="Your opinions have a shape"
      lines={["Give one with the pad: how much you are for it, and how much of it you want reaching you."]}
    >
      <IntroStage {...STAGE}>
        <div style={{ position: "absolute", left: 31, top: 0, width: 280 }}>
          <StancePad value={{ pDirected: 0.9, pInterest: 0.25 }} />
        </div>
        <IntroLines {...STAGE}>
          <path d="M 171 268 L 40 337" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <path d="M 171 268 L 127 337" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <path d="M 171 268 L 215 337" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <path d="M 171 268 L 302 337" stroke="var(--border-field)" strokeWidth="2" fill="none" />
        </IntroLines>
        <IntroFace x={171} y={250} size={36} name="Sol Ferreira" />
        <IntroCaption x={171} y={212}>you</IntroCaption>
        {INTRO_EDGES.map((edge) => (
          <EdgeFace key={edge.emoji} {...edge} />
        ))}
        <IntroFace x={40} y={352} size={30} name="Ada Okonkwo" src="comment-camera.jpg" />
        <img
          src="post-photo.jpg"
          alt=""
          style={{ position: "absolute", left: 112, top: 337, width: 30, height: 30, borderRadius: "var(--radius-small)", objectFit: "cover", display: "block" }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 200,
            top: 337,
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-small)",
            background: "var(--surface-container-highest)",
            color: "var(--text-secondary)",
            fontSize: "var(--text-label-large)",
          }}
        >
          #
        </span>
        <IntroFace x={302} y={352} size={30} name="Tobias Lindqvist" />
        <IntroCaption x={40} y={370} width={80}>@ada</IntroCaption>
        <IntroCaption x={127} y={370} width={80}>a post</IntroCaption>
        <IntroCaption x={215} y={370} width={80}>#coastroad</IntroCaption>
        <IntroCaption x={302} y={370} width={80}>@tobias</IntroCaption>
      </IntroStage>
    </IntroFrame>
  );
}
