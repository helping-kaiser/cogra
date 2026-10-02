/* THE DETAILS STAGE ON THE WORDS PATH (jakob 2026-10-02, curate 2). Where
   `ComposeWords`' Next lands: the body is already written, and this is where
   the post gets its title, its tags and its references. The same stage as the
   picture path's (`ComposeDetails`) — same wizard header, same fields, same
   blocks — minus the two things a words post has no use for: the media row
   (and the describe row under it), and the Description (jakob 2026-10-01, the
   audit's K8.1: a words post carries no description).

   ONE MARKUP, NOT A COPY. The board is `_shared.jsx`'s `ComposeDetailsBody`
   with `words`, so the two stages cannot drift about the header, the tags,
   the references or the foot; the picture stage is the same body with its
   media.

   `ComposeCited` IS THIS STAGE ARRIVED AT WITH A REFERENCE RIDING ALONG and
   nothing else written yet; this board is the stage in the ordinary walk, a
   title typed and tags and a citation staged on it. Next leads to the seal,
   as the picture stage's does — the words path never waits on uploads. */
export function Screen() {
  return <ComposeDetailsBody words />;
}
