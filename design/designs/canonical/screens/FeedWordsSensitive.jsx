/* THE FEED, A WORDS-ONLY POST MARKED SENSITIVE (the check round's Q5, jakob
   2026-10-06). `Feed` itself, its second card marked by its author.

   THE VEIL NAMES ITS SOURCE HERE TOO. The source line is unconditional (readme
   §9, Q47) — an unnamed source reads as the other one — and a words-only post
   has no media face to carry it. So the text veil carries it on its own plate:
   the words blurred in place with their `Show`, and under them the quiet line
   `The author's warning`, in the media face's own words. A reason, where the
   author gave one, follows after an em dash; this author left none, which is
   the line at its shortest.

   EVERYTHING ELSE IS THE STANDING VEIL. The words keep their exact space under
   the blur, and revealing takes away only the veil's own line; the frame — author, timestamp, the
   opinion, the score, the comments and the share — stays readable, so choosing
   to look is informed; one `Show` reveals the whole post, and the reveal lasts
   the session (`SensitiveVeil`). */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} sensitive={{ source: "author" }} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
