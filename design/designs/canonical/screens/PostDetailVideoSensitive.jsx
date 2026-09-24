/* THE SENSITIVE VARIANT OF THE VIDEO POST'S DETAIL VIEW (jakob 2026-09-24,
   the pinned clip's veil face). Reached the same two ways as `PostDetailVideo`
   — the stream's score element, or an ordinary tap on a clip that is not
   portrait — but the post itself is sensitive and unrevealed.

   THE VEIL COVERS THE BODY AS ONE. Title and topics stay readable — that is
   `SensitiveVeil`'s own law, not something this board re-decides — while the
   pinned clip and the card's own body sit behind their veil faces.

   ONE `SensitiveScope` spans the pinned clip and the card: the reveal is per
   post, so the one tap that answers for the card's own body is meant to answer
   for the clip pinned above it too. The unveil tap reveals the pinned clip and
   the card together, and the screen becomes `PostDetailVideo`. */

const SENSITIVE_MIRA_CLIP = { reason: "One rubbing includes a dead seabird." };

export function Screen() {
  const { media, ...post } = MIRA_CLIP_POST;
  return (
    <SensitiveScope>
      <DetailHeader items={READER_POST_MENU} />
      <PinnedClip item={media[0]} elapsed="0:14" duration="0:41" progress={0.34} sensitive={SENSITIVE_MIRA_CLIP} />
      <DetailColumn>
        <PostCard {...post} variant="detail" sensitive={SENSITIVE_MIRA_CLIP} onOpenOpinions={() => {}} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </SensitiveScope>
  );
}
