"use client";

// THE DOOR TO A COMMENT'S EDIT FROM OFF ITS THREAD (CommentMenuOwn.md:11-13,
// HistoryCommentMenuOwn.md:7, ProfileCommentsMenuOwn.md:7; round 41). The own
// comment's menu row is the one way into the edit on every host it stands on —
// History, Saved, the profile's Comments tab, a feed — and the edit opens over
// the surface the menu was opened on.
//
// A CONTEXT, NOT A PROP AND NOT AN IMPORT, the way a kept pick's anchor opens
// its review (`kept-picks-route.tsx`): the card lives in `lib/`, the editor in
// `app/`, and `lib/` never imports `app/`. The shell provides the editor
// component and hosts the one edit surface, outside the scrolling column, so a
// card asks "edit this comment" and the shell answers. The thread mounts its
// own editor, whose return is the thread's (`comments-sheet.tsx`).

import type { CommentFieldsFragment } from "@/__generated__/graphql";
import { createContext, useCallback, useContext, useState, type ComponentType, type ReactNode } from "react";

/** The settling line an edit's signing ends on, in the thread and off it. */
export const COMMENT_SETTLING = "Signed — it's in the thread now, still settling.";

/** What the edit surface needs, and where its two exits land. */
export type CommentEditRequest = {
  readonly comment: CommentFieldsFragment;
  /** The comment this one answers, or null when it answers the post. */
  readonly parentId: string | null;
  /** The post whose thread it is. */
  readonly postId: string;
  /** What the comment is on, for the editor's lede. */
  readonly targetLabel: string;
  /** Back to where the edit was opened, nothing kept. */
  readonly onLeave: () => void;
  /** The signing was taken. */
  readonly onSigned: () => void;
};

type Open = (request: CommentEditRequest) => void;

const Door = createContext<Open | null>(null);

/**
 * The shell's half: it mounts `editor` for whichever card asked, and drops it
 * on either exit before handing the exit back to the card.
 */
export function CommentEditDoor({
  editor: Editor,
  children,
}: {
  editor: ComponentType<CommentEditRequest>;
  children: ReactNode;
}) {
  const [request, setRequest] = useState<CommentEditRequest | null>(null);
  const open = useCallback<Open>((asked) => setRequest(asked), []);
  return (
    <Door.Provider value={open}>
      {children}
      {request !== null && (
        <Editor
          key={request.comment.id}
          {...request}
          onLeave={() => {
            setRequest(null);
            request.onLeave();
          }}
          onSigned={() => {
            setRequest(null);
            request.onSigned();
          }}
        />
      )}
    </Door.Provider>
  );
}

/** Opens a comment's edit over wherever the reader stands; null outside a door. */
export function useOpenCommentEdit(): Open | null {
  return useContext(Door);
}
