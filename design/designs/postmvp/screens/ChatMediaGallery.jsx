/* MEDIA IN THIS CHAT — the details' door onto every picture and clip the
   chat's messages carry (round B1 of the chats work; jakob's rulings
   2026-09-23).

   A GRID OF THE CHAT'S MEDIA MESSAGES, NEWEST FIRST — the messenger's media
   page, and the one grid in the product: three columns of square tiles at the
   small rung, 4px apart in the list gutter. Every tile is `MediaAttachment`,
   the reading-side master, filled and display-cropped to its square the way a
   comment's inset picture is (the bytes stay whole; the whole frame is a tap
   away). A tile is a message's media, so the grid holds what the thread holds
   and nothing else — no link or file tabs, because a message carries words
   and media and nothing more.

   A TAP OPENS THE MESSAGE, NOT THE VIEWER. The grid is an index into the
   thread: a tile lands on its message in the thread, scrolled to it, where
   the words it came with and the conversation around it stand — and where a
   second tap opens the viewer, exactly as on any bubble.

   THE CLIP TILE CARRIES THE SOUND DISC AND NO DURATION — the lane's reading
   of the drawn grammar, flagged. `MediaThumb`'s play disc and duration pill
   are the COMPOSER's (an author identifying a file among files), and the
   one-duration ruling keeps both off every reading surface: presence on
   screen is the policy, and the one place a reader meets a clip's length is
   the viewer's transport. So the canoe clip is what it is in its bubble —
   muted autoplay under the stage law (one clip plays on a surface at a time;
   the incumbent keeps the stage while it stays past the gate), wearing the
   control ladder's feed rung, the sound disc alone. The motion is what tells
   a clip from a picture; the board, which cannot move, shows the disc.

   ENCRYPTED MEDIA. An encrypted message encrypts its attachments too, and the
   member's device decrypts them with the words — so a member's grid shows
   every picture they hold the key for. A picture sealed before the reader
   joined, whose key they never held, is not drawn this round; nor is whether a
   readable encrypted tile wears the bubble's quiet lock. This fixture is all
   plaintext, and both are flagged in the round's report.

   A NON-MEMBER'S GRID IS THE SAME GRID of what they can open — plaintext is a
   public read. */
export function Screen() {
  const tile = (media) => <MediaAttachment ratio="square" fit="cover" radius="var(--radius-small)" {...media} />;
  return (
    <>
      <PageHeader title="Media in this chat" backHref="#" backLabel="Back to chat details" />
      <div style={{ flex: 1, overflow: "hidden", padding: "8px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {tile({ src: "gallery-honey.jpg", alt: "A pot of dark honey with a wooden dipper resting in it." })}
          {tile({ kind: "video", src: "clip-canoe.mp4", poster: "post-photo.jpg", controls: "sound", alt: "Two canoes crossing a mountain lake." })}
          {tile({ src: "clip-lakeside.jpg", alt: "Someone on the harbour wall, looking across the water at the mountains." })}
          {tile({ src: "gallery-market.jpg", alt: "A crate of strawberries on the market stand." })}
          {tile({ src: "comment-camera.jpg", alt: "Juno behind an old rangefinder camera." })}
          {tile({ src: "gallery-veg.jpg", alt: "A red onion, parsley root and peppercorns on a board." })}
        </div>
      </div>
    </>
  );
}
