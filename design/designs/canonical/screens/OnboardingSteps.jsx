/* INTRO 1 OF 5 — THE FEED IS YOUR OWN STEPS (jakob's ruling, the batch-rulings
   round; backlog item 74). His sketch: "some graph steps with a post sitting at
   their end". The drawing is the whole teaching — nothing picks for you, what
   arrives arrives along the steps you made — so the words stay at a headline
   and one line.

   THREE FACES, TWO STEPS, ONE POST. Two steps are the fewest that read as a
   PATH rather than as a pair, and the post hangs off the far one so the card is
   plainly the end of the walk and not a fourth node in it. Each face is the
   real `MonogramAvatar`; the card is a likeness at `PostCard`'s own fill,
   corner and author line (`_shared.jsx`, the intro block's note).

   NO NUMBERS ANYWHERE ON IT. A step's weight is a real thing the product can
   show (the score's drill-down does), and showing it here would make the first
   screen a reader ever sees the one that introduced arithmetic. */

const STAGE = { width: 342, height: 336 };

export function Screen() {
  return (
    <IntroFrame
      step={1}
      headline="Your feed follows your own steps"
      lines={["Nothing is picked for you. What reaches you comes along the connections you made, one step at a time."]}
    >
      <IntroStage {...STAGE}>
        <IntroLines {...STAGE}>
          <path d="M 87 44 H 143" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="143,39 153,44 143,49" fill="var(--border-field)" />
          <path d="M 197 44 H 253" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="253,39 263,44 253,49" fill="var(--border-field)" />
          <path d="M 281 66 C 281 104, 171 92, 171 118" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="166,118 176,118 171,128" fill="var(--border-field)" />
        </IntroLines>
        <IntroFace x={61} y={44} name="Sol Ferreira" />
        <IntroFace x={171} y={44} name="Ada Okonkwo" src="comment-camera.jpg" />
        <IntroFace x={281} y={44} name="Tobias Lindqvist" />
        <IntroCaption x={61} y={72}>you</IntroCaption>
        <IntroCaption x={171} y={72}>@ada</IntroCaption>
        <IntroCaption x={281} y={72}>@tobias</IntroCaption>
        <div style={{ position: "absolute", left: 0, top: 130, width: "100%" }}>
          <IntroPostCard
            author={TOBIAS}
            title="Low tide at six tomorrow — anyone walking the flats?"
            timestamp="1h"
            src="post-photo.jpg"
            height={130}
          />
        </div>
      </IntroStage>
    </IntroFrame>
  );
}
