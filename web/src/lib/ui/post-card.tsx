// The shared post card (design.md §6): author, title/snippet linking
// to the detail, the pending marker, the topic chip row, and the
// stance control. Extracted so the feed listing and the topic page's
// `taggedContent` list render the same card (roadmap "Slice 2.3 —
// Topics" web plan: "taggedContent list reusing existing post-card
// components").
//
// Media changes three things here and nothing else — see `post-media.tsx` for
// what and why. The one addition media forces beyond the gallery itself is the
// DESCRIPTION: a media post has no `content` at all (D16's XOR), so the words
// beside the picture are the only words there are, and a card that rendered
// `content` alone would show a media post with nothing under it.

import Link from "next/link";

import { isPending, type PostView } from "@/lib/api/content-api";
import { referenceChipEntries } from "@/lib/references/claims";
import { ActorChip } from "./actor-chip";
import { Card } from "./card";
import { PendingMarker } from "./pending-marker";
import { BodyRegion, PostMedia, bodyIsSensitive, hasMedia } from "./post-media";
import { ReferenceChipRow } from "./reference-chip-row";
import { StanceControl } from "./stance-control";
import { TopicChipRow, type TopicChipEntry } from "./topic-chip-row";

function chipEntries(post: PostView): readonly TopicChipEntry[] {
  return post.topics.map((claim) => ({ name: claim.hashtag.name.value ?? "", pending: claim.pending }));
}

export function PostCard({
  post,
  prefix,
}: {
  post: PostView;
  /** e.g. "feed" — testids come out as `${prefix}-post-${post.id}` etc. */
  prefix: string;
}) {
  const testId = `${prefix}-post-${post.id}`;
  const media = hasMedia(post);
  const veiled = bodyIsSensitive(post);

  const title = post.title.value && <h2 className="text-title-medium">{post.title.value}</h2>;

  return (
    <Card>
      {post.author && (
        <ActorChip
          handle={post.author.handle}
          displayName={post.author.displayName.value}
          avatarUrl={post.author.avatar?.url}
          testId={`${prefix}-author-${post.id}`}
        />
      )}
      {/* The title sits OUTSIDE the veil, so choosing to look is informed. On a
          media post it also sits above the gallery, which is why it leaves the
          link block here rather than staying inside it. */}
      {media && title}
      <Link href={`/posts/${post.id}`} data-testid={testId} className="flex flex-col gap-3">
        {!media && title}
        <BodyRegion veiled={veiled} testId={testId}>
          {media && <PostMedia node={post} testId={`${testId}-media`} />}
          {post.description.value && (
            <p className="line-clamp-2 text-body-medium text-on-surface-variant">
              {post.description.value}
            </p>
          )}
          {post.content.value && (
            <p className={`text-body-medium ${media ? "line-clamp-2" : "line-clamp-4"}`}>
              {post.content.value}
            </p>
          )}
        </BodyRegion>
      </Link>
      {/* Shown in full, marked quietly (design.md §9) — a pending post
          is real content whose place in the order is not yet fixed. */}
      {isPending(post) && <PendingMarker testId={`${prefix}-pending-${post.id}`} />}
      <TopicChipRow topics={chipEntries(post)} testIdPrefix={testId} />
      {/* The reference row under the body (D16). A card stays plain —
          the values toggle is a detail-surface affordance. */}
      <ReferenceChipRow
        references={referenceChipEntries(post.references)}
        testIdPrefix={testId}
      />
      {/* Part of the post card's own inventory (design.md §6), outside
          the link: it acts, it does not navigate. */}
      <StanceControl
        target={{ id: post.id, kind: "post", label: "this post" }}
        testIdPrefix={`${prefix}-stance-${post.id}`}
      />
    </Card>
  );
}
