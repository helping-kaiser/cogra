import React from "react";

/* The two upload notices (media slice, 2026-08-31). Upload runs in the
   background from the moment a picture has its crop (the crop happens on the
   device; only the cropped export is uploaded), so most posts never see
   either — these appear only when the author outruns the network.

   `UploadStatusLine` is THE SEAL'S GATE: while it shows, the sign button is
   disabled, because nothing signs until the content it signs exists.
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

export function UploadStatusLine({ done, total, progress }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
      <Ring progress={progress ?? (total ? done / total : 0.5)} />
      <span
        style={{
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          color: "var(--text-secondary)",
        }}
      >
        Uploading {done} of {total} — signing waits for the pictures.
      </span>
    </div>
  );
}

export function UploadErrorLine({ message = "One picture didn't upload.", onRetry, onRemove }) {
  const link = {
    border: 0,
    background: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-label-small)",
    lineHeight: "var(--text-label-small--line-height)",
    fontWeight: "var(--text-label-small--font-weight)",
    letterSpacing: "0.5px",
    color: "var(--primary)",
  };
  return (
    <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px" }}>
      <span style={{ color: "var(--error)" }}>{message}</span>{" "}
      {onRetry && (
        <>
          <button type="button" onClick={onRetry} className="cg-state cg-focus cg-hit" style={link}>
            Retry
          </button>{" "}
          <span style={{ color: "var(--text-secondary)" }}>·</span>{" "}
        </>
      )}
      <button type="button" onClick={onRemove} className="cg-state cg-focus cg-hit" style={link}>
        Remove it
      </button>
    </p>
  );
}
