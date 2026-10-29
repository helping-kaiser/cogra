// The two upload notices (design/components/compose/UploadNotice).
//
// Upload runs in the background from the moment a picture has its crop, so most
// posts never see either of these — they appear only when the author outruns
// the network.
//
// `UploadStatusLine` IS THE SEAL'S GATE: nothing signs until the content it
// signs exists, so while it shows a press of the commit is HELD and signs the
// moment the bytes land (jakob 2026-10-02) — the commit stays enabled. Only a
// failed upload disables it, and then the line's failed form says why.
// `UploadErrorLine` is the failure's words — the tile wears the badge, this
// line carries the ways out: error colour for the fact, primary for the exits.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { InlineAction } from "../inline-action";

function Ring({ progress, size = 18 }: { progress: number; size?: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true" className="flex-none">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--border-hairline)" strokeWidth="3" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.02, Math.min(1, progress)) * c} ${c}`}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

export function UploadStatusLine({
  done,
  total,
  progress,
  media = "pictures",
  failed = false,
  message = "One picture didn't upload.",
  failedCount = 1,
  onRetry,
  testId = "upload-status",
  node,
}: {
  done: number;
  total: number;
  progress?: number;
  /** What signing waits for: the pictures (a gallery), the video, or a cover. */
  media?: "pictures" | "video" | "cover";
  /**
   * A failed upload: the only time the commit is disabled, so the line says
   * why and offers Retry (`UploadNotice.jsx`'s failed form).
   */
  failed?: boolean;
  message?: string;
  /** How many failed: past one the gate says signing waits for THEM (round 22). */
  failedCount?: number;
  onRetry?: () => void;
  testId?: string;
  /**
   * The registered gate on a registered screen (`postEdit.gate`): in flight its
   * `line`; failed its `message`, `wait` and `retry`. It names them instead of
   * `testId`.
   */
  node?: DataNode;
}) {
  if (failed) {
    return (
      <p {...testAttributes(node, testId)} role="status" className="m-0 text-center text-body-medium">
        <span className="text-error" {...testAttributes(part(node, "message"))}>
          {message}
        </span>{" "}
        <span className="text-on-surface-variant" {...testAttributes(part(node, "wait"))}>
          {failedCount > 1 ? "Signing waits for them." : "Signing waits for it."}
        </span>{" "}
        {onRetry && (
          <InlineAction testId={`${testId}-retry`} node={part(node, "retry")} onClick={onRetry}>
            Retry
          </InlineAction>
        )}
      </p>
    );
  }
  // STRICTLY THE IN-FLIGHT UPLOAD GATE (design/components/compose/
  // UploadNotice.prompt.md lines 1, 11): "most posts never show either" and
  // it exists to hold the sign button while bytes are still moving. An empty
  // batch has nothing moving, so this must never render for one — a caller
  // bug that reaches here with `total <= 0` draws nothing rather than a
  // nonsense "Uploading 0 of 0".
  if (total <= 0) return null;
  const waitsFor = media === "video" || media === "cover" ? media : total === 1 ? "picture" : "pictures";
  return (
    <div
      {...testAttributes(node, testId)}
      // The seal's gate is a status, not an alert: it says why the commit
      // waits without interrupting what the reader is doing.
      role="status"
      className="flex items-center justify-center gap-2"
    >
      <Ring progress={progress ?? (total > 0 ? done / total : 0.5)} />
      <span className="text-body-medium text-on-surface-variant" {...testAttributes(part(node, "line"))}>
        Uploading {done} of {total} — signing waits for the {waitsFor}.
      </span>
    </div>
  );
}

/**
 * A failure's words, and the ways out of it.
 *
 * TWO FORMS, and the difference is whether a retry could possibly help. An
 * upload that failed is worth trying again — the network moves. A file that was
 * REFUSED is not: retrying cannot make a file smaller or a format readable, so
 * the refusal form offers only "Remove it" (design/backlog.md item 31, round
 * 2). Omitting `onRetry` is what selects it.
 */
export function UploadErrorLine({
  message = "One picture didn't upload.",
  onRetry,
  onRemove,
  removeLabel,
  count = 1,
  testId = "upload-error",
  node,
}: {
  message?: string;
  onRetry?: () => void;
  onRemove: () => void;
  /**
   * How many the line stands for: past one its way out is `Remove them`, each
   * failed one leaving (ComposeUploading.md, round 22).
   */
  count?: number;
  /** The spoken name of Remove it, where the line stands under a count rather than the thing it names. */
  removeLabel?: string;
  testId?: string;
  /**
   * The registered line on a registered screen (`postEdit.body.uploadError`):
   * its `message`, `retry` and `remove`. It names them instead of `testId`.
   */
  node?: DataNode;
}) {
  const link = "cg-state cg-focus cursor-pointer border-0 bg-transparent p-0 text-label-small text-primary";
  // The line takes label-small's size at the ground's weight (`UploadNotice.jsx`);
  // its two words are the master's small InlineActions.
  return (
    <p
      {...testAttributes(node, testId)}
      className="m-0 text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)]"
    >
      <span className="text-error" {...testAttributes(part(node, "message"))}>
        {message}
      </span>{" "}
      {onRetry && (
        <>
          <button
            type="button"
            {...testAttributes(part(node, "retry"), `${testId}-retry`)}
            onClick={onRetry}
            className={link}
          >
            Retry
          </button>{" "}
          <span className="text-on-surface-variant">·</span>{" "}
        </>
      )}
      <button
        type="button"
        {...testAttributes(part(node, "remove"), `${testId}-remove`)}
        aria-label={removeLabel}
        onClick={onRemove}
        className={link}
      >
        {count > 1 ? "Remove them" : "Remove it"}
      </button>
    </p>
  );
}
