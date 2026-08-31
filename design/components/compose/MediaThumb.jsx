import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* The authoring-side picture tile (media slice, 2026-08-31): one thumbnail
   anatomy for every composer surface — the pick tray, the details row, the
   Show all sheet, the reply composer, the comment edit. The states it can
   wear are the whole upload story:

   · `cover` — the "Cover" badge, bottom-left. The first picture is the cover;
     the badge travels with reorder, never with a separate control.
   · `progress` — the upload ring on a scrim. Upload starts AFTER the crop:
     the crop happens on the device and only the cropped export is ever
     uploaded (jakob 2026-08-31 — the original frame can hold what the author
     never meant to share). Crop-less comment pictures upload at pick.
   · `failed` — the picture dims and wears the error badge; the words and the
     Retry · Remove affordances live beside the row (`UploadErrorLine`), not
     crammed into 48px.
   · `onRemove` — the X, top-right, its target grown by cg-hit.

   Uncropped tiles (a reply's pictures) pass `width`/`height` and
   `fit="contain"` so the whole frame shows inside the tile. */

function Ring({ progress, size = 26 }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true">
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.02, Math.min(1, progress)) * c} ${c}`}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

export function MediaThumb({
  src,
  alt = "",
  size = 48,
  width,
  height,
  fit = "cover",
  radius = "var(--radius-small)",
  cover = false,
  progress,
  failed = false,
  onRemove,
  removeLabel = "Remove this picture",
}) {
  const w = width ?? size;
  const h = height ?? size;
  return (
    <div
      style={{
        position: "relative",
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: radius,
        overflow: "hidden",
        flex: "none",
        background: "var(--surface-container-high)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          aria-hidden={alt ? undefined : "true"}
          style={
            fit === "contain"
              ? { maxWidth: "100%", maxHeight: "100%", display: "block", opacity: failed ? 0.5 : 1 }
              : { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: failed ? 0.5 : 1 }
          }
        />
      )}
      {cover && (
        <span
          style={{
            position: "absolute",
            left: "3px",
            bottom: "3px",
            padding: "0 5px",
            borderRadius: "var(--radius-full)",
            background: "var(--surface-snackbar, rgba(0,0,0,0.55))",
            color: "var(--on-surface-snackbar, #ffffff)",
            fontSize: "10px",
            lineHeight: "14px",
            fontWeight: "var(--text-label-small--font-weight)",
            letterSpacing: "0.5px",
          }}
        >
          Cover
        </span>
      )}
      {typeof progress === "number" && !failed && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label={`Uploading, ${Math.round(progress * 100)}%`}
        >
          <Ring progress={progress} />
        </span>
      )}
      {failed && (
        <span
          aria-label="Didn't upload"
          style={{
            position: "absolute",
            right: "3px",
            top: "3px",
            width: "18px",
            height: "18px",
            borderRadius: "var(--radius-full)",
            background: "var(--error)",
            color: "var(--on-error)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            lineHeight: "16px",
            fontWeight: 700,
          }}
        >
          !
        </span>
      )}
      {onRemove && !failed && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="cg-state cg-focus cg-hit"
          style={{
            position: "absolute",
            right: "3px",
            top: "3px",
            width: "16px",
            height: "16px",
            border: 0,
            padding: 0,
            borderRadius: "var(--radius-full)",
            background: "var(--surface-snackbar, rgba(0,0,0,0.55))",
            color: "var(--on-surface-snackbar, #ffffff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Icon name="close" size={10} />
        </button>
      )}
    </div>
  );
}
