import React from "react";
import { MediaThumb } from "./MediaThumb.jsx";

/* The picked-pictures row (media slice, 2026-08-31): the composer's summary of
   the body — thumbnails and the count, one tappable row.

   THE ROW CARRIES NO "Crop" OR "Edit" LINKS (jakob 2026-08-31: "none"). The
   whole row is the affordance and it opens the Show all sheet — the
   per-picture manager (`PickedSheet`: reorder, first = cover, remove,
   describe). The crop step needs no second entrance: the wizard is linear and
   Back reaches it, and a duplicate entrance to the same step is the two-menus
   pattern the system refuses elsewhere. */

export function PickedRow({ items = [], caption, onManage, manageLabel = "Manage the pictures" }) {
  return (
    <button
      type="button"
      onClick={onManage}
      aria-label={manageLabel}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        border: 0,
        background: "none",
        padding: 0,
        minHeight: "48px",
        width: "100%",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
      }}
    >
      {items.map((item, index) => (
        <MediaThumb key={item.src ?? index} {...item} size={48} />
      ))}
      {caption && (
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-label-small)",
            lineHeight: "var(--text-label-small--line-height)",
            letterSpacing: "0.4px",
            color: "var(--text-secondary)",
          }}
        >
          {caption}
        </span>
      )}
    </button>
  );
}

/* "Describe the pictures · 1 of 3 described" — the details step's entry into
   per-picture descriptions, with the quiet count beside it. Alt text is
   authored, optional, never invented; a described set is a choice made
   visible, not a chore bar.

   A VIDEO TAKES ONE DESCRIPTION for the whole clip (jakob 2026-09-02), so the
   row reads "Describe the video · 0 of 1 described" — same anatomy, `subject`
   naming what is being described. The cover takes none of its own: it is the
   video's face, not a second picture. */
export function DescribeCounter({ described, total, onDescribe, subject = "pictures" }) {
  return (
    <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px" }}>
      <button
        type="button"
        onClick={onDescribe}
        className="cg-state cg-focus cg-hit"
        style={{
          border: 0,
          background: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "inherit",
          lineHeight: "inherit",
          fontWeight: "var(--text-label-small--font-weight)",
          letterSpacing: "0.5px",
          color: "var(--primary)",
        }}
      >
        Describe the {subject}
      </button>{" "}
      <span style={{ color: "var(--text-secondary)" }}>
        · {described} of {total} described
      </span>
    </p>
  );
}
