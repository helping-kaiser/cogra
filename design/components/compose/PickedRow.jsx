import React from "react";
import { InlineAction } from "../core/Button.jsx";
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
   video's face, not a second picture.

   THE REASON RIDES UNDER THE ROW (jakob 2026-09-03), permanently: an optional
   field with no stated purpose reads as a chore, and the one thing that makes
   it worth writing — someone is listening to it — was behind a "?" nobody
   opens. Same words as the sheet's own sub-line, so the row and the sheet it
   opens say one thing.

   The word takes its size from the sentence rather than re-declaring it: the
   paragraph is already set in `label-small`, which is exactly the `sm` rung's
   own type, so `inherit` and the rung's tokens are the same measurement said
   two ways. The counting half of the line is a plain span — it is not
   pressable, and only the verb is. */
export function DescribeCounter({ described, total, onDescribe, subject = "pictures" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px" }}>
        <InlineAction size="sm" onClick={onDescribe} style={{ fontSize: "inherit", lineHeight: "inherit" }}>
          Describe the {subject}
        </InlineAction>{" "}
        <span style={{ color: "var(--text-secondary)" }}>
          · {described} of {total} described
        </span>
      </p>
      <p style={{ margin: 0, fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
        Read aloud to people who can&apos;t see it.
      </p>
    </div>
  );
}
