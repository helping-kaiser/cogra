import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* The authoring-side picture tile (media slice, 2026-08-31): one thumbnail
   anatomy for every composer surface — the pick tray, the details row, the
   Show all sheet, the reply composer, the comment edit. The states it can
   wear are the whole upload story:

   · `cover` — the "Cover" badge, bottom-left. The first picture is the cover;
     the badge travels with reorder, never with a separate control. A CLIP'S
     COVER wears the same badge on a tile of its own beside the clip's
     (`CoverTile`, round 52), so "Cover" is said one way for a post's first
     picture and for a clip's face.
   · `transform` — the picture's framing inside the tile, the way `CoverRow`'s
     own tiles are framed; a cover tile carries the frame that was chosen.
   · `progress` — the upload ring on a scrim. Upload starts AFTER the crop:
     the crop happens on the device and only the cropped export is ever
     uploaded (jakob 2026-08-31 — the original frame can hold what the author
     never meant to share). A comment's pictures pass the comment's square
     crop (`ReplyCrop`) and upload from its Next, as a post's do.
   · `failed` — the picture dims and wears the error badge; the words and the
     Retry · Remove affordances live beside the row (`UploadErrorLine`), not
     crammed into 48px.
   · `onRemove` — the X, top-right, its target grown by cg-hit.
   · `video` — the composer's video preview: the play disc on a scrim and the
     duration on the trailing corner, the anatomy `ComposeCover` drew for the
     post's video (the disc and pill only appear where the tile is big enough
     to carry them). AUTHORING-SIDE ONLY: a reading surface never draws
     play/pause — there, presence on screen is the policy.

   A clip's preview at comment scale (the reply composer's, the comment
   edit's) passes `width`/`height` and `fit="contain"` so the whole frame
   shows inside the tile. A comment's pictures are squares, so their tiles
   are square, filled.

   THE NEUTRAL TILE (video-cover round, 2026-09-10) is the sourceless state:
   where a clip yields no still at all — extraction came back with nothing —
   the tile reserves its space and `label` says what belongs there, the way
   `MediaAttachment`'s reserved region does. Never invent imagery: a clip with
   no face shows the absence rather than a borrowed picture. */

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
  transform,
  progress,
  failed = false,
  video = false,
  duration,
  label,
  onRemove,
  removeLabel = "Remove this picture",
  node,
  nodeKey,
}) {
  const w = width ?? size;
  const h = height ?? size;
  const edge = Math.min(w, h);
  const disc = Math.max(20, Math.min(56, Math.round(edge * 0.26)));
  /* The disc rides a scrim over a frame. With no frame the tile IS the
     absence, and a play control drawn on nothing reads as chrome — the
     duration stays, because the clip's length is known either way. */
  const playable = video && src && !failed && typeof progress !== "number";
  /* THE REMOVE TARGET IS WHOLE (seam 381, 6: "Touch targets never below
     48px" is law, and a board's `overflow: hidden` is never the spec). The
     tile's own clip — the picture and every badge on it, cut to its corners —
     is an inner layer the size of the tile, and the X stands outside that
     layer, so its 48px target may overhang the tile's corner while its glyph
     stays where it is drawn. */
  return (
    <div
      style={{
        position: "relative",
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: radius,
        flex: "none",
        background: "var(--surface-container-high)",
      }}
      data-node={node}
      data-node-key={nodeKey}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          overflow: "hidden",
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
              : transform
                ? { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: failed ? 0.5 : 1, transform }
                : { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: failed ? 0.5 : 1 }
          }
        />
      )}
      {!src && label && (
        <span
          style={{
            fontSize: "var(--text-label-small)",
            fontWeight: "var(--text-label-small--font-weight)",
            lineHeight: "var(--text-label-small--line-height)",
            letterSpacing: "var(--text-label-small--letter-spacing)",
            color: "var(--text-secondary)",
            padding: "0 var(--space-2)",
            textAlign: "center",
          }}
        >
          {label}
        </span>
      )}
      {playable && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: `${disc}px`,
            height: `${disc}px`,
            borderRadius: "var(--radius-full)",
            background: "var(--surface-snackbar, rgba(0,0,0,0.55))",
            color: "var(--on-surface-snackbar, #ffffff)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="play_arrow" size={Math.round(disc * 0.57)} />
        </span>
      )}
      {video && duration && edge >= 80 && (
        <span
          style={{
            position: "absolute",
            right: "6px",
            bottom: "6px",
            padding: "0 6px",
            borderRadius: "var(--radius-small)",
            background: "var(--surface-snackbar, rgba(0,0,0,0.55))",
            color: "var(--on-surface-snackbar, #ffffff)",
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            fontWeight: "var(--text-label-small--font-weight)",
            letterSpacing: "var(--text-label-small--letter-spacing)",
          }}
        >
          {duration}
        </span>
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
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            fontWeight: "var(--text-label-small--font-weight)",
            letterSpacing: "var(--text-label-small--letter-spacing)",
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
            fontSize: "var(--text-label-medium)",
            letterSpacing: "var(--text-label-medium--letter-spacing)",
            lineHeight: "var(--text-label-medium--line-height)",
            fontWeight: 700,
          }}
        >
          !
        </span>
      )}
      </div>
      {onRemove && !failed && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          data-node={node && "remove"}
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
