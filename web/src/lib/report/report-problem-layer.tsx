"use client";

// THE REPORT OVER THE SURFACE THAT OPENED IT. A seal's bug notice opens the
// same page Settings does (ReportProblem.md:3), and its back arrow returns
// "the surface that opened the report" (ReportProblem.md:31) — the notice with
// its fault, its staged act and its draft. A route change would unmount the
// wizard that holds all of that, so a notice raises the page over itself
// instead and the opener stays mounted beneath; the back arrow lowers it.
//
// A NATIVE MODAL DIALOG, drawn full-screen — the repo's primitive for a
// surface raised over another (`DialogSurface`, `BottomSheet`). `showModal()`
// puts it in the top layer and makes the rest of the page inert, so the opener
// beneath is out of reach of Tab, the pointer and a screen reader, and the
// dialog's first control takes focus (MDN, HTMLDialogElement.showModal()).
// Escape or the system's Back is its `cancel`, read as the back arrow. The
// layer says it covers the surface (`useCoversSurface`), so a clip beneath
// stops. On lowering, focus goes back to the control that raised it — the
// notice's `Report a problem` — as a dialog's close hands focus back (HTML
// Standard, the dialog element's focus restoration); the layer unmounts
// rather than closing, so it hands it back itself.
//
// The layer scrolls on its own (ReportProblem.md:33: the page scrolls when its
// content outgrows the screen). It stands on `SCREEN_LAYER`, a one-field
// surface's geometry (seam 388): with the keyboard up the layer ends at the
// keyboard's top, so `Send by email` is still reached by scrolling.

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { SCREEN_LAYER } from "@/lib/ui2/screen-layer";

import { ReportProblemView } from "./report-problem-view";

function ReportLayer({ onLower }: { onLower: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useCoversSurface(true, "suspend");
  useEffect(() => {
    // The control that raised the layer, still focused as it mounts.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    // Unmounting runs after the dialog has left the DOM, so the opener is reachable again.
    return () => opener?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Report a problem"
      onCancel={(event) => {
        event.preventDefault();
        onLower();
      }}
      data-testid="reportProblem.layer"
      className={`${SCREEN_LAYER} m-0 h-auto max-h-none w-full max-w-none overflow-y-auto border-0 bg-surface px-0 pt-0 text-on-surface`}
    >
      <ReportProblemView onBack={onLower} />
    </dialog>
  );
}

/** `openReport` for a notice's `Report a problem`; `reportLayer` rendered anywhere in the opener. */
export function useReportProblem(): { openReport: () => void; reportLayer: ReactNode } {
  const [open, setOpen] = useState(false);
  return {
    openReport: () => setOpen(true),
    reportLayer: open ? <ReportLayer onLower={() => setOpen(false)} /> : null,
  };
}
