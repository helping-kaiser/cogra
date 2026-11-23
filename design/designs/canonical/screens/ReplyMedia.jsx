/* Comments carrying media, and the author's own comment (media slice,
   2026-08-31): square is the comment scale's shape (readme §13, the reel
   round), so a single picture is the square its author framed in the
   comment's crop (`ReplyCrop`), multiples share the square pager,
   and the viewer's own
   comment wears — once edited — the Edited marker, its Edit a row in its ⋮. The sheet is the
   comments sheet of readme §13, unchanged.

   A COMMENT'S VIDEO PLAYS LIKE A POST'S (jakob 2026-09-02): muted autoplay
   while it is on screen, in the comment pager's square frame, wearing the one
   control a video ever wears — sound, on the global sticky decision every
   video shares. No play/pause and no duration pill: presence on screen is the
   policy on a reading surface, exactly as on a post's card.

   THE TALL FRAME IS THE DRAWING (round 60; jakob 2026-11-19, C4: "we can make
   the board taller in the canvas for my inspection but we can't grow the
   bottom sheet"). Since a comment's media stands square at the column's
   width (round 58), the second comment's two-picture pager fell below an
   844 frame, and a state drawn under the fold is a state nobody can check —
   `FeedCommentShapes`' reason for its own tall frame. So the board is drawn
   whole: 1309, the second comment's last row ending at 1194 with one 12px
   list gap above the composer foot. The sheet on a phone does not grow: it stands at its maximum height,
   the phone's 844 less the sheet's 72px ceiling, and the thread scrolls
   inside it; only this drawing gives the sheet the frame's height.

   REGISTERED under the `postDetail` prefix (round 60, seam 380 / 381): the
   detail beneath is `ThreadDetail`'s, named as `CommentMenu` names it, and
   the sheet is the thread, `threadSheet`, each comment `commentCard` keyed by
   its id — so a thread comment's media registers here, `commentCard.media`
   with a `frame` per item, its clip's `soundDisc` and the pager's `dots`,
   `CommentCard`'s own names. */
export const NODE = "postDetail";
export const FRAME = { width: 390, height: 1309 };
export function Screen() {
  return (
    <>
      <ThreadDetail />

      <CommentsSheet node="threadSheet">
        <CommentCard
          id="69155950-5cc8-4aef-9581-6f55ca1a0693"
          author={TOBIAS}
          content="Eighteen seconds of the same headland, if the light comes through at all."
          timestamp="30m"
          media={REPLY_MEDIA_CLIP}
          bundle={mkBundle(0.1, 0.1)}
          onReply={() => {}}
          license={{ attribution: 0, provenance: 0 }}
          menuItems={readerCommentCardMenu("tobias")}
          node="commentCard"
        />
        <CommentCard
          id="8c3e5a71-4d2b-4f9e-b6a0-2d7c9e1f4b36"
          author={SOL}
          content="Two from the stand by the sea wall, before the crowd came."
          timestamp="1h"
          media={REPLY_MEDIA_PICTURES}
          edited
          onReply={() => {}}
          license={{ attribution: 0, provenance: 0 }}
          menuItems={OWN_COMMENT_CARD_MENU}
          node="commentCard"
        />
      </CommentsSheet>
    </>
  );
}
