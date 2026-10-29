"use client";

// THE POSTS VIEW (design/designs/canonical/ProfilePosts.dc.html;
// behavior/ProfilePosts.md). The profile's Posts tab lists the person's posts
// as POST CARDS, never as chronicle entries (ProfilePosts.md:3) — the feed's
// own card, unchanged and fully live: the author chip, the age and the ⋮, the
// words or the media, the tags and references, the opinion, the Feed score,
// the comment count and share. Newest first, the order the read serves.
//
// What the card's doors open, from here (graph.json `ProfilePosts`):
// - a portrait clip opens the stream over this list (Reel.md:3), its back
//   disc naming the profile (ProfilePosts.md:43-45);
// - any other media, and the words, open the post, its back arrow naming the
//   profile (:47-49);
// - the Feed score opens its trace, the same name on its back arrow (:39-41),
//   and reads the figure the latest fetch of the post found (:37) — the
//   standing store every score slot reads (`score-slot.tsx`);
// - the author chip is the page it stands on, so it is inert (:25);
// - the ⋮ and the comment count raise the feed's two hosted sheets over the
//   profile, as History does.
//
// THE STAGE LAW (ProfilePosts.md:7-11): the list is one scroll surface with
// one stage (`StageHost`), which re-elects at the hard top.

import { useMemo, useRef, useState } from "react";

import { CommentsSheet } from "@/app/comments/comments-sheet";
import type { PostView } from "@/lib/api/content-api";
import { SEEN_ATTRIBUTE, useSeenTracker } from "@/lib/history/seen-tracker";
import { streamHref } from "@/lib/reel/stream-origin";
import type { Notify } from "@/lib/saved/save-row";
import type { TraceOrigin } from "@/lib/score/trace-session";
import { ANCHOR_ATTRIBUTE } from "@/lib/ui/scroll-pin";
import { PostCard } from "@/lib/ui/post-card";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { LINK_COPIED } from "@/lib/ui/share";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { PostMenuHost } from "@/lib/ui2/post-menu-host";

/** The posts view's list and its cards (unregistered: ProfilePosts exports no NODE). */
export const POSTS_NODE = "profile.posts";

export function ProfilePostsList({
  posts,
  from,
  scoreOrigin,
  notify,
  onOpenStream,
  onRemoved,
  tailIndex,
  tailRef,
}: {
  posts: readonly PostView[];
  /** The `from` a card's post carries: `profile` from your own root, `u:<handle>` otherwise. */
  from: string;
  /** What a card's score names on the trace's back arrow. */
  scoreOrigin: TraceOrigin;
  notify: Notify;
  /** A portrait clip's tap: the stream over this list, opened on that clip. */
  onOpenStream: (startId: string) => void;
  /** The author's own Remove from a card's ⋮: the card stands as its mark in place. */
  onRemoved: (removed: PostView) => void;
  /** The card the next page is asked for at (`infinite-list.ts`). */
  tailIndex: number;
  tailRef: (node: Element | null) => void;
}) {
  // The feed's own two hosted sheets: a card's menu, and the thread its
  // comment count raises — over the profile, as over the feed.
  const [menuPost, setMenuPost] = useState<PostView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsPost, setCommentsPost] = useState<PostView | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<{ id: string; total: number } | null>(null);
  const href = (id: string) => `/posts/${id}?from=${encodeURIComponent(from)}`;
  // A PROFILE'S POSTS JOIN HISTORY ONLY AS THE READER SCROLLS EACH FULLY INTO
  // VIEW (History.md:11) — the profile itself joined when it opened. Nothing
  // is reported while a sheet covers the list.
  const host = useScrollHost();
  const listRef = useRef<HTMLUListElement>(null);
  const ids = useMemo(() => posts.map((post) => post.id), [posts]);
  useSeenTracker({ root: host, list: listRef, ids, suspended: menuOpen || commentsOpen });

  return (
    <>
      <StageHost>
        <ul ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0" data-testid="profile-posts">
          {posts.map((post, index) => (
            <li
              key={post.id}
              {...{ [ANCHOR_ATTRIBUTE]: post.id, [SEEN_ATTRIBUTE]: post.id }}
              ref={index === tailIndex ? tailRef : undefined}
            >
              <PostCard
                post={post}
                // Each card keyed by its post, as the feed keys its cards.
                node={{ path: `${POSTS_NODE}.card`, key: post.id }}
                scoreOrigin={scoreOrigin}
                href={href(post.id)}
                shareHref={`/posts/${post.id}`}
                stream={{ href: streamHref(post.id), onOpen: () => onOpenStream(post.id) }}
                authorHere
                testId={`profile-post-${post.id}`}
                authorTestId={`profile-post-author-${post.id}`}
                stanceTestId={`profile-post-stance-${post.id}`}
                comments={liveComments?.id === post.id ? liveComments.total : post.comments.totalCount}
                onOpenComments={() => {
                  setCommentsPost(post);
                  setCommentsOpen(true);
                }}
                onLinkCopied={() => notify(LINK_COPIED)}
                onOpenMenu={() => {
                  setMenuPost(post);
                  setMenuOpen(true);
                }}
                menuOpen={menuOpen && menuPost?.id === post.id}
              />
            </li>
          ))}
        </ul>
      </StageHost>
      <PostMenuHost
        post={menuPost}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        testId="profile-post-menu"
        notify={notify}
        onRemoved={onRemoved}
      />
      {commentsPost !== null && (
        <CommentsSheet
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          post={commentsPost}
          onCount={(total) => setLiveComments({ id: commentsPost.id, total })}
        />
      )}
    </>
  );
}
