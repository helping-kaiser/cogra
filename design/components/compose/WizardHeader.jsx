import React from "react";
import { HelpDot } from "../core/HelpDot.jsx";
import { PageHeader } from "../navigation/PageHeader.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* The wizard's header (jakob 2026-08-31): TWO ways out, each doing one thing.

   · The ARROW steps ONE STAGE BACK — never out of the flow. Details reaches
     crop with it; the system back gesture does the same.
   · The X LEAVES the whole flow from any stage. Where a draft is kept — the
     post wizard, the post edit, the profile picture — the leave keeps it and
     nothing asks, because nothing is lost (the return surface is the draft
     prompt). The reply wizard and the comment edit keep no draft, so leaving
     them discards: a non-empty composer asks first, through the discard
     confirm; an empty one leaves silently. `leaveLabel` says which of the
     two this X does. Without it, an author five stages deep was stuck
     backing out tap by tap.

   The header carries ONLY the ways out (jakob 2026-09-01): the stage's
   forward action — Next, Sign — always lives at the bottom of the content
   column, never up here, so the top-right corner keeps one meaning through
   the whole flow. (It used to hold Next on early stages; an author trained
   on that corner hit the X once Next moved down.) `action` remains for
   passive trailing info only — a stage label, the help dot.

   WHICH IS WHY `stageLabel` AND `help` ARE SLOTS OF THEIR OWN (item 17, the
   conformance round). "Passive trailing info" turned out to be one thing in
   practice: on every seal in the system — the post's, the reply's, the
   picture's, the profile's, the address's, the wallet change's — it is the
   stage's name and the screen's one "?", in that order. Six boards were
   assembling that pair by hand through the generic slot, which is six chances
   for the gap, the colour or the wrap to drift. The header now names it.

   THE ROW EXISTS ONLY WHEN THERE IS SOMETHING TO SPACE. `help` on its own —
   what the comment and post edits carry, where the screen has a "?" but no
   stage to name — is the dot and nothing around it. A flex row with one child
   in it is a wrapper pretending to be a layout.

   `action` stays, and stays generic, for whatever neither of those covers. A
   board that passes both gets the pair first and its own node after. */

export function WizardHeader({
  title,
  backHref = "#",
  backLabel = "Back a step",
  onBack,
  onLeave,
  leaveLabel = "Leave — your draft is kept",
  stageLabel,
  help,
  onHelp,
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
          {stageLabel ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                {stageLabel}
              </span>
              {help && <HelpDot ariaLabel={help} onOpen={onHelp} />}
            </span>
          ) : (
            help && <HelpDot ariaLabel={help} onOpen={onHelp} />
          )}
          {action}
        </span>
      }
    />
  );
}
