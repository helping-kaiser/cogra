// THE STREAM'S PLATE (`design/components/media/ReelRail.jsx` `ReelPlate`; jakob
// 2026-10-12, the slice-3 round: RL-G4, RL-G8, RL-G13).
//
// "A line the stream owes the reader — a hold that did not sign, the load that
// did not come, the last clip — has no row to stand on over a clip, so it
// stands on the wash's own black, a pill at 60 %, the one surface a word can
// be read on over any frame. It is a line and not a snackbar: it stands until
// it is answered and never fades on a timer (the row line's law). The words
// keep their own registers — the failure ink, the quiet secondary, the bare
// `Retry` — the plate only gives them ground." (ReelRail.jsx:50-57)
//
// So nothing here times anything out: a plate is taken down by whoever put it
// up, when the line is answered (Reel.md:69).

import type { CSSProperties, ReactNode } from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

/**
 * The plate's dress (ReelRail.jsx:60-78), shared with the row line's stream
 * form (`row-line.tsx` `plate`), so the two can never draw two plates. The
 * black is a literal like the washes it continues: it reads over any frame in
 * either theme.
 */
export const PLATE_STYLE: CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 10px",
  borderRadius: "9999px", // `--radius-full`
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  whiteSpace: "nowrap",
  textShadow: "none",
};

/** The plate's type: label-medium (ReelRail.jsx:71-73). */
export const PLATE_CLASS = "text-label-medium";

export function ReelPlate({
  children,
  role = "status",
  node,
  testId,
}: {
  children: ReactNode;
  /** `status` for a notice, `alert` for a failure (ReelRail.d.ts `ReelPlateProps`). */
  role?: "status" | "alert";
  node?: DataNode;
  testId?: string;
}) {
  return (
    <p role={role} {...testAttributes(node, testId)} className={PLATE_CLASS} style={PLATE_STYLE}>
      {children}
    </p>
  );
}
