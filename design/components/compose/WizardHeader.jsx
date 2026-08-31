import React from "react";
import { PageHeader } from "../navigation/PageHeader.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* The wizard's header (jakob 2026-08-31): TWO ways out, each doing one thing.

   · The ARROW steps ONE STAGE BACK — never out of the flow. Details reaches
     crop with it; the system back gesture does the same.
   · The X LEAVES the whole flow from any stage, draft kept, NO confirmation —
     nothing is lost, because every leave keeps the draft (the return surface
     is the draft prompt). Without it, an author five stages deep was stuck
     backing out tap by tap.

   The X sits between the title and the stage's trailing controls, so Next
   keeps the right edge wherever it is the primary action. */

export function WizardHeader({
  title,
  backHref = "#",
  backLabel = "Back a step",
  onBack,
  onLeave,
  leaveLabel = "Leave — your draft is kept",
  action,
}) {
  return (
    <PageHeader
      title={title}
      backHref={backHref}
      backLabel={backLabel}
      onBack={onBack}
      action={
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            aria-label={leaveLabel}
            onClick={onLeave}
            className="cg-state cg-focus"
            style={{
              height: "48px",
              width: "48px",
              display: "grid",
              placeItems: "center",
              border: 0,
              background: "none",
              borderRadius: "var(--radius-full)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              flex: "none",
              padding: 0,
            }}
          >
            <Icon name="close" />
          </button>
          {action}
        </span>
      }
    />
  );
}
