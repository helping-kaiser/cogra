"use client";

// THE COMMENTS VIEW (design/designs/canonical/ProfileComments.dc.html;
// behavior/ProfileComments.md; screens/ProfileComments.jsx). The profile's
// Comments tab lists the person's comments as COMMENT CARDS, each in reach of
// its thread (ProfileComments.md:3) — `CommentCard` in the shape a comment
// wears listed away from its thread (`shape="line"`): the pointer to what it
// answers leading (:5), the author chip, the age and the ⋮, the words whole,
// the opinion and the thread's text Reply, and the "View n replies" line under
// the card. Newest first, the order the read serves.
//
// What the card's doors open, from here (graph.json `ProfileComments`):
// - the pointer, Reply and the replies line open the thread the comment lives
//   in (:23-27), its back arrow naming the profile; Reply aims its composer at
//   the comment, and an applicant's Reply answers in the snackbar instead (:29);
// - the author chip is the page it stands on, so it is inert (:21);
// - the ⋮ is the comment's menu, the own comment's with Remove among its acts
//   (:31-33) — each card hosts its own, as on Feed, History and Saved.

import { useMemo, useRef } from "react";

import type { ProfileCommentView } from "@/lib/api/profile-api";
import type { Removal } from "@/lib/api/removal-api";
import { SEEN_ATTRIBUTE, useSeenTracker } from "@/lib/history/seen-tracker";
import type { Notify } from "@/lib/saved/save-row";
import { CommentFeedCard, type LineReply } from "@/lib/ui/comment-feed-card";
import { ANCHOR_ATTRIBUTE } from "@/lib/ui/scroll-pin";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { LINK_COPIED } from "@/lib/ui/share";

/** The comments view's list and its cards (`profile.comments.commentCard[commentId]`, design round 27). */
export const COMMENTS_NODE = "profile.comments";

export function ProfileCommentsList({
  comments,
  from,
  reply,
  notify,
  onRemoved,
  tailIndex,
  tailRef,
}: {
  comments: readonly ProfileCommentView[];
  /** The `from` a card's doors carry: `profile` from your own root, `u:<handle>` otherwise. */
  from: string;
  /** What a card's Reply does for this reader. */
  reply: LineReply;
  notify: Notify;
  /** The author's own Remove from a card's ⋮: the card stands as its mark in place. */
  onRemoved: (id: string, removal: Removal) => void;
  /** The card the next page is asked for at (`infinite-list.ts`). */
  tailIndex: number;
  tailRef: (node: Element | null) => void;
}) {
  // A PROFILE'S CONTENT JOINS HISTORY ONLY AS THE READER SCROLLS IT FULLY INTO
  // VIEW (History.md:11, :13) — the profile itself joined when it opened —
  // as a tag page's comments do.
  const host = useScrollHost();
  const listRef = useRef<HTMLUListElement>(null);
  const ids = useMemo(() => comments.map((comment) => comment.id), [comments]);
  useSeenTracker({ root: host, list: listRef, ids });

  return (
    <ul ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0" data-testid="profile-comments">
      {comments.map((comment, index) => (
        <li
          key={comment.id}
          {...{ [ANCHOR_ATTRIBUTE]: comment.id, [SEEN_ATTRIBUTE]: comment.id }}
          ref={index === tailIndex ? tailRef : undefined}
          // The card and its replies line, 12px apart (`CommentCard`'s `<li>`).
          className="flex flex-col gap-3"
        >
          <CommentFeedCard
            comment={comment}
            shape="line"
            from={from}
            // Each card keyed by its comment: every card here is the same
            // author's, so the handle the thread keys by names none apart.
            node={{ path: `${COMMENTS_NODE}.commentCard`, key: comment.id }}
            testId={`profile-comment-${comment.id}`}
            authorHere
            reply={reply}
            replyCount={comment.replyCount}
            onNotify={notify}
            onRemoved={(removal) => onRemoved(comment.id, removal)}
            onLinkCopied={() => notify(LINK_COPIED)}
          />
        </li>
      ))}
    </ul>
  );
}
