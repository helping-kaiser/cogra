"use client";

// ReplyCompose / ReplyPicturesWeb — the reply's one composing screen.
//
// THE TWO BOARDS ARE ONE SCREEN. ReplyCompose is this stage with an empty tray
// and ReplyPicturesWeb is the same stage once pictures have landed; there is no
// pick screen between them, because "+ Add pictures" opens the browser's own
// file dialog. Drawing them as one component is what makes that true rather
// than merely claimed.
//
// THE DROP TARGET IS THE WHOLE COMPOSER, drawn nowhere. ReplyPicturesWeb's one
// addition over the app board is the quiet "…or drop them here." beside Add —
// the hint is the only thing drawn, and the surface that accepts the drop is
// this whole column. A dashed rectangle belongs to the post wizard's pick
// screen, where a grid had to be replaced; at comment scale it would be a box
// around nothing.

import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { PillButton } from "@/lib/ui2/pill-button";
import {
  CommentAttachments,
  commentDropHandlers,
} from "@/lib/ui2/compose/comment-attachments";
import { isVideoReply, type ReplyState, type ReplyTarget } from "@/lib/compose/reply-wizard";
import type { PickRefusal } from "@/lib/compose/pick";

/** What the reply answers, pinned above the words so it stays in sight. */
export function ReplyTargetChip({ target }: { target: ReplyTarget }) {
  return (
    <div
      data-testid="reply-target"
      className="flex min-h-14 flex-none items-center gap-2 rounded-small bg-surface-container-highest px-3 py-2"
    >
      <MonogramAvatar name={target.authorName} src={target.avatarUrl} size={32} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label-large">
          {target.label} — @{target.authorHandle}
        </span>
        <span className="truncate text-label-small text-on-surface-variant">{target.snippet}</span>
      </span>
    </div>
  );
}

export function ReplyComposeStep({
  state,
  previews,
  framePreviews,
  capturing,
  durationMs,
  refusals,
  onWords,
  onPick,
  onRemove,
  onRetry,
  onDescribe,
  onPickFrame,
  onPickCover,
  onDismissRefusal,
  onNext,
}: {
  state: ReplyState;
  previews: Readonly<Record<string, string>>;
  framePreviews: readonly string[];
  capturing: boolean;
  durationMs: number;
  refusals: readonly PickRefusal[];
  onWords: (words: string) => void;
  onPick: (files: readonly File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onDescribe: () => void;
  onPickFrame: (index: number) => void;
  onPickCover: (file: File) => void;
  onDismissRefusal: (id: string) => void;
  onNext: () => void;
}) {
  const video = isVideoReply(state);
  const hasPictures = !video && state.media.length > 0;

  return (
    <div
      data-testid="reply-compose"
      {...commentDropHandlers(onPick)}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-2"
    >
      <ReplyTargetChip target={state.target} />

      {/* The words carry no label box: the screen is titled "Reply" and the
          target sits directly above, so a second naming would be noise. The
          accessible name says it instead. */}
      <textarea
        data-testid="reply-words"
        aria-label={`Your reply to ${state.target.label}`}
        value={state.words}
        rows={4}
        onChange={(event) => onWords(event.target.value)}
        className="cg-focus w-full resize-none border-0 bg-transparent p-0 text-body-large text-on-surface outline-none placeholder:text-on-surface-variant"
        placeholder="Your reply"
      />

      <CommentAttachments
        media={state.media}
        previews={previews}
        cover={state.cover}
        framePreviews={framePreviews}
        capturing={capturing}
        durationMs={durationMs}
        refusals={refusals}
        onPick={onPick}
        onRemove={onRemove}
        onRetry={onRetry}
        onDescribe={onDescribe}
        onPickFrame={onPickFrame}
        onPickCover={onPickCover}
        onDismissRefusal={onDismissRefusal}
        testIdPrefix="reply"
      />

      <div className="flex-1" />

      {/* The foot line names what CAN still join, so it changes with the body:
          a video says so in the singular, and once one is in there is nothing
          more to add. */}
      <p className="m-0 text-body-small text-on-surface-variant">
        {video
          ? "Words first — a video can join them, and it uploads while you write."
          : hasPictures
            ? "Words first — pictures can join them, and they upload while you write."
            : "Words first — pictures can join them."}
      </p>

      <PillButton testId="reply-next" full onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}
