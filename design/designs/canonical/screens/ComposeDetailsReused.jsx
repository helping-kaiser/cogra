/* THE DETAILS STAGE, ITS MEDIA ALREADY PUBLISHED (the check round's Q4, jakob
   2026-10-06; the duplicate-media ruling, jakob 2026-09-30). `ComposeDetails`
   itself, in the state an author meets when a picture they attached already
   stands in one of their own published posts.

   REUSING MEDIA NEVER BLOCKS. The composer marks it instead: one soft line
   under the media row, `Already in your post from 12 September.`, in the
   honesty-marker ink `Edited` wears and in its tappable form — `EditedMarker`
   with its door, underlined, quiet, `cg-hit`. The tap opens the post the line
   names, the earliest match where several do; nothing asks a question — no
   dialog, no confirm step, no gate — and `Next` stays exactly as live as on
   the stage at rest.

   THE DATE IS THE MATCHED POST'S PUBLICATION DATE, in the chronicle's dateline
   words (copy-voice, *The already-published marker*): day and month, the year
   only when it is not the current one. So the line never leans on that post
   having a title.

   THE DOOR'S NAME IS ITS LINE. A control's accessible name keeps the visible
   words (readme §10, K13.11), so the door is named by the sentence it reads.

   Only the author's own published posts count: a match in drafts alone, or in
   someone else's post, draws nothing — that is `ComposeDetails` at rest. */
export function Screen() {
  return <ComposeDetailsBody publishedOn="12 September" />;
}
