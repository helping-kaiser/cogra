/* THE PROFILE CARD, THREE ANATOMIES — a working board for jakob's pick (the
   feed-cards rework, 2026-10-01). jakob: "the profile card just looks like a
   text post that only has a body."

   It does, for a measurable reason: today's lead is the size of any post's
   author chip, and the bio stands where a post's words stand, in the words'
   own colour. Both options turn that over. The person leads at a size no
   author chip takes, the bio drops to the quiet colour under them, and the
   opinion is worn the way the profile page wears it — the wide anchor, with
   its words — because a card that stands for a person is a card whose one act
   is the opinion on them. The options differ in the identity's register: the
   profile header's compact shape, or a portrait.

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, because each column
   is a card a reader would meet on `FeedKinds`, which carries the wiring.
   Every door stays the same door — the card opens the profile, the ⋮ the
   profile's menu, the score the trace. */

export const FRAME = optionFrame(3, 420);

const PERSON = {
  person: MIRA,
  src: "inviter.jpg",
  bio: "Runs the stand by the sea wall — honey from the headland hives.",
  score: "11.70",
};

export function Screen() {
  return (
    <>
      <OptionColumn
        label="A · Today's card, with its score"
        note="The baseline. A feed row's small picture and name, the bio in the words' own colour where a post's body stands. The shape jakob read as a text post with only a body."
      >
        <ProfileFeedCard {...PERSON} />
      </OptionColumn>
      <OptionColumn
        label="B · The top of their profile"
        note="The profile header's compact shape at card scale: a large picture, the name in a title's weight, the handle under it, the bio quiet below. The opinion is the profile page's wide anchor. Reads as the person's page arriving in the feed."
      >
        <ProfileFeedCardOption shape="contact" {...PERSON} />
      </OptionColumn>
      <OptionColumn
        label="C · A portrait"
        note="The picture centred over the name, the shape a someone-you-might-know tile has everywhere — the one silhouette in the feed that cannot be a post. The opinion is the same wide anchor. Taller than B, and the most unmistakably a person."
      >
        <ProfileFeedCardOption shape="portrait" {...PERSON} />
      </OptionColumn>
    </>
  );
}
