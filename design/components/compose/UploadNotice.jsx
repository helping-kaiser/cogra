import React from "react";
import { InlineAction } from "../core/Button.jsx";

/* The two upload notices (media slice, 2026-08-31). Upload runs in the
   background from the moment a picture has its crop (the crop happens on the
   device; only the cropped export is uploaded), so most posts never see
   either — these appear only when the author outruns the network.

   `UploadStatusLine` is THE SEAL'S GATE: nothing signs until the content it
   signs exists. The sign button stays enabled while it runs — a press waits
   for the bytes in the commit's in-flight word, then signs (jakob 2026-10-02)
   — and is disabled only at the line's failed reading.
   `UploadErrorLine` is the failure's words — the tile wears the badge
   (`MediaThumb failed`), this line carries Retry and Remove, in error colour
   for the fact and primary for the ways out. Direction-by-words, as always.

   THE WAYS OUT FOLLOW THE FAILURE. A network failure can be retried, so it
   offers both. A file the surface refuses — too big for its cap, or a format
   nothing here can read — cannot be retried into working, so it offers only
   Remove it: `onRetry` omitted drops the link rather than dangling a control
   that would fail the same way twice. */

function Ring({ progress = 0.55, size = 18 }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true" style={{ flex: "none" }}>
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

/* THE GATE HAS A FAULT READING (jakob's ruling, the night batch 2026-10-01 —
   audit K6.2). An upload that fails while the seal waits on it leaves the gate
   closed for a reason the running line cannot say: `failed` swaps the ring and
   the count for the failure's fact in error ink, the gate's consequence in the
   quiet voice, and `Retry` — a fault, so the way out is to ask again, the way
   every transport fault in the product does. No `Remove it` here: the seal reads
   back, and what the reply carries is changed one stage back. The sign button
   is disabled at this reading only (jakob 2026-10-05); the running reading
   keeps it enabled. A clip's fault reads `The video didn't upload.` through
   `message`; a failed cover keeps `One picture didn't upload.`, the cover
   being one picture.

   THE GATE NAMES WHAT IT WAITS FOR, PER KIND (jakob 2026-10-02, pads 3: "per
   content of course"). `media` is the body's kind: pictures by default, and a
   clip reads `…signing waits for the video.` An edit that changed a clip's
   cover waits for that one picture by its name, `…signing waits for the
   cover.` (`media="cover"` — the edit's gate is jakob's, 2026-10-05).

   THE PICTURES' NOUN COUNTS (jakob 2026-10-05, the 136 round's 5b). A gate
   waiting on one picture says so: at a `total` of one the line reads
   `…signing waits for the picture.`, and `the pictures` from two up. The
   video and the cover are one thing already, so their nouns never change. */
/* `node` is the data-node name its placer gives the line (seam 248): the line
   takes it, and names its parts — uploading, `line`; failed, `message`,
   `wait` and `retry`. Given none, it renders exactly as before. */
export function UploadStatusLine({ done, total, progress, media = "pictures", failed = false, message = "One picture didn't upload.", onRetry, node }) {
  if (failed) {
    return (
      <p style={{ margin: 0, textAlign: "center", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }} data-node={node}>
        <span style={{ color: "var(--error)" }} data-node={node && "message"}>{message}</span>{" "}
        <span style={{ color: "var(--text-secondary)" }} data-node={node && "wait"}>Signing waits for it.</span>{" "}
        <InlineAction size="lg" onClick={onRetry} style={{ display: "inline" }} node={node && "retry"}>
          Retry
        </InlineAction>
      </p>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }} data-node={node}>
      <Ring progress={progress ?? (total ? done / total : 0.5)} />
      <span
        data-node={node && "line"}
        style={{
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          color: "var(--text-secondary)",
        }}
      >
        Uploading {done} of {total} — signing waits for the {media === "video" || media === "cover" ? media : total === 1 ? "picture" : "pictures"}.
      </span>
    </div>
  );
}

/* `node` names the line where its placer gives one (seam 248): `message`,
   `retry` and `remove` inside it. */
export function UploadErrorLine({ message = "One picture didn't upload.", onRetry, onRemove, node }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)" }} data-node={node}>
      <span style={{ color: "var(--error)" }} data-node={node && "message"}>{message}</span>{" "}
      {onRetry && (
        <>
          <InlineAction size="sm" onClick={onRetry} node={node && "retry"}>
            Retry
          </InlineAction>{" "}
          <span style={{ color: "var(--text-secondary)" }}>·</span>{" "}
        </>
      )}
      <InlineAction size="sm" onClick={onRemove} node={node && "remove"}>
        Remove it
      </InlineAction>
    </p>
  );
}
