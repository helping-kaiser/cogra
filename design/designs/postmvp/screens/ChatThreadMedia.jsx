/* A CHAT WITH PICTURES AND CLIPS — the message's media variants (would-like
   #3; jakob 2026-09-23).

   COMMENT SCALE, NOT POST SCALE. A message is words first and its media joins
   them, the comment's own rule (the compose flow; readme §13): inset at the
   medium rung inside the bubble, above the words, held to 220px, filled not
   fitted. A picture message and a clip message are drawn, each at its own
   true shape clamped the way every surface clamps it — the square picture
   whole, the wide clip at its 16:9.

   THE CLIP CARRIES THE SOUND DISC AND NOTHING ELSE. The control ladder's
   feed-card rung (the reel round): no play/pause, no timeline, no transport in
   a bubble. A tap on either piece of media opens the fullscreen viewer, where
   the transport lives. Playback in a thread follows the stage law — one clip
   plays at a time, the incumbent keeps the stage while it stays past the gate
   (the feed-video rulings).

   A BUBBLE WITH MEDIA TAKES ITS FULL WIDTH (78% of the column), so a frame is
   never narrower than the words under it.

   THE FOOT IS THE ORDINARY ONE; the reader has already sent, so no first-send
   line. The picture arrived from Mira, the clip from Tobias; the reader's own
   reply sits between them. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="07:52" media={{ src: "gallery-honey.jpg", ratio: "square", alt: "A pot of dark honey with a wooden dipper resting in it." }}>
          This morning's pull from the headland hives.
        </ChatBubble>
        <ChatBubble own when="07:58">
          Save me a jar.
        </ChatBubble>
        <ChatBubble
          author={CHAT_TOBIAS}
          when="08:21"
          media={{ kind: "video", src: "clip-canoe.mp4", poster: "post-photo.jpg", ratio: "landscape", alt: "Two canoes crossing a mountain lake." }}
        >
          Crossing to the far shore — calm as glass.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}
