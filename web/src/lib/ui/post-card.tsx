// The shared post card (design.md §6): author, title/snippet linking
// to the detail, the pending marker, the topic chip row, and the
// stance control. Extracted so the feed listing and the topic page's
// `taggedContent` list render the same card (roadmap "Slice 2.3 —
// Topics" web plan: "taggedContent list reusing existing post-card
// components").

import Link from "next/link";

import { isPending, type PostView } from "@/lib/api/content-api";
import { referenceChipEntries } from "@/lib/references/claims";
import { ActorChip } from "./actor-chip";
import { Card } from "./card";
import { PendingMarker } from "./pending-marker";
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
  return (
    <Card>
      {post.author && (
        <ActorChip
          handle={post.author.handle}
          displayName={post.author.displayName.value}
          testId={`${prefix}-author-${post.id}`}
        />
      )}
      <Link href={`/posts/${post.id}`} data-testid={testId} className="flex flex-col gap-1">
        {post.title.value && <h2 className="text-title-medium">{post.title.value}</h2>}
        <p className="line-clamp-4 text-body-medium">{post.content.value}</p>
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
