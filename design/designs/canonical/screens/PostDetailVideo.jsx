/* A VIDEO POST'S DETAIL VIEW — and what the squish morph leaves behind (readme
   §13, the reel round). Reached two ways, and it is the same screen both times:
   the score element on the stream's rail, where the clip SHRINKS to the top
   still playing and the body rises beneath it; or the ordinary tap on a clip
   that is not portrait, from any card.

   THE CLIP STANDS ABOVE THE CARD, not inside it — which is why the author chip
   leads the card rather than the screen. On every other surface the chip sits
   above the content; here the content the reader is already watching sits
   above everything, and the card beneath it is the post as it always reads.

   THE CLIP SCROLLS WITH THE PAGE (readme §13, the clip detail rulings). It is
   the head of the detail's column, flush on the card, and the board draws the
   page at its top. Opening the detail started it — the open is the gate, so it
   is drawn playing — and scrolled out of view it plays on.

   THE TRANSPORT IS REAL HERE: play/pause and a timeline that takes a tap
   anywhere or a drag along it, uniform for every clip. The chrome auto-hides and
   a tap on the video reveals it — drawn revealed, because a board of the hidden
   state is a board of a video.

   TAPPING THE CLIP: back to the stream if that is where the reader came from,
   the reader's place in it held; otherwise the fullscreen viewer. One gesture,
   two returns, and both of them are back to watching. */
export function Screen() {
  const { media, ...post } = MIRA_CLIP_POST;
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <DetailClip item={media[0]} elapsed="0:14" duration="0:41" progress={0.34} />
          <PostCard {...post} variant="detail" onOpenOpinions={() => {}} />
        </div>
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
