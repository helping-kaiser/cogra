// The two upload notices (design/components/compose/UploadNotice).
//
// Upload runs in the background from the moment a picture has its crop, so most
// posts never see either of these — they appear only when the author outruns
// the network.
//
// `UploadStatusLine` IS THE SEAL'S GATE: while it shows, the sign button is
// disabled, because nothing signs until the content it signs exists.
// `UploadErrorLine` is the failure's words — the tile wears the badge, this
// line carries the ways out: error colour for the fact, primary for the exits.

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
  testId = "upload-status",
}: {
  done: number;
  total: number;
  progress?: number;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      // The seal's gate is a status, not an alert: it says why the button is
      // held without interrupting what the reader is doing.
      role="status"
      className="flex items-center justify-center gap-2"
    >
      <Ring progress={progress ?? (total > 0 ? done / total : 0.5)} />
      <span className="text-body-medium text-on-surface-variant">
        Uploading {done} of {total} — signing waits for the pictures.
      </span>
    </div>
  );
}

export function UploadErrorLine({
  message = "One picture didn't upload.",
  onRetry,
  onRemove,
  testId = "upload-error",
}: {
  message?: string;
  onRetry: () => void;
  onRemove: () => void;
  testId?: string;
}) {
  const link = "cg-state cg-focus cursor-pointer border-0 bg-transparent p-0 text-label-small text-primary";
  return (
    <p data-testid={testId} className="m-0 text-label-small">
      <span className="text-error">{message}</span>{" "}
      <button type="button" data-testid={`${testId}-retry`} onClick={onRetry} className={link}>
        Retry
      </button>{" "}
      <span className="text-on-surface-variant">·</span>{" "}
      <button type="button" data-testid={`${testId}-remove`} onClick={onRemove} className={link}>
        Remove it
      </button>
    </p>
  );
}
