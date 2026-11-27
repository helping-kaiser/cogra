"use client";

// THE REPORT OVER THE SURFACE THAT OPENED IT. A seal's bug notice opens the
// same page Settings does (ReportProblem.md:3), and its back arrow returns
// "the surface that opened the report" (ReportProblem.md:27) — the notice with
// its fault, its staged act and its draft. A route change would unmount the
// wizard that holds all of that, so a notice raises the page over itself
// instead and the opener stays mounted beneath; the back arrow lowers it.
//
// The layer is the whole screen and scrolls on its own (ReportProblem.md:31:
// the page scrolls when its content outgrows the screen).

import { useState, type ReactNode } from "react";

import { ReportProblemView } from "./report-problem-view";

/** `openReport` for a notice's `Report a problem`; `reportLayer` rendered anywhere in the opener. */
export function useReportProblem(): { openReport: () => void; reportLayer: ReactNode } {
  const [open, setOpen] = useState(false);
  const reportLayer = open ? (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface text-on-surface" data-testid="reportProblem.layer">
      <ReportProblemView onBack={() => setOpen(false)} />
    </div>
  ) : null;
  return { openReport: () => setOpen(true), reportLayer };
}
