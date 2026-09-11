import React from "react";
import { InlineAction } from "../core/Button.jsx";

/* THE DELETION BAND (readme §13, the account-deletion round; jakob's ruling
   2026-09-11). A confirmed account deletion runs at a deadline seven days out
   and is reversible until then (`docs/instances/erasure.md` §5), and the band
   is how the product carries that fact around: it says when, and it carries the
   way back, on every logged-in surface for the whole window.

   EVERY SURFACE, WHICH IS WHY IT IS A BAND AND NOT A SCREEN. The reader may
   have confirmed from a mail client on another device, days ago; a state that
   only a settings page confesses is a state most readers would meet at the
   deadline. The band rides the non-shrinking top block directly under whatever
   header the surface has — inside `CograBand`'s children on a tab root, under
   `PageHeader` on an inner one — so no surface can be without it.

   A SIBLING OF `BorrowedViewBand`, NOT THE SAME BAND. The two share a slot and
   a shape, and nothing else: the borrowed view names a vantage point and the
   reader may ignore it forever, while this one is a countdown on the reader's
   own account with an act at its end. So this one is filled and its line is
   `on-surface` where that one is transparent and secondary — the two dials the
   system has for presence, turned once, without reaching for a colour.

   IT IS NOT `--error`, AND THAT IS §4 RATHER THAN RESTRAINT. `error` is for
   failure; this is a thing the reader ASKED FOR, proceeding exactly as asked.
   Colouring a chosen act like a fault would be the surface arguing with the
   decision — the same reason `SettingsRow`'s Sign out takes no error colour,
   and the same reason `EmptyState` refuses it for an absence. The band wears
   `surface-bar`, the shell's own chrome fill, because that is what it is:
   shell, saying what state the account is in.

   THE COUNT IS SPELLED OUT — `in 6 days`, not the ages ladder's `6d`. The
   ladder is a vocabulary for how long ago something happened, read beside
   content in a list where many ages compete for room; this is one sentence in
   a band with room to spare, and `6d` in a forward-looking sentence is the one
   place the ladder's compression can genuinely mislead. AWAITING BLESSING:
   future moments have no ruled vocabulary yet (backlog 54.1).

   `content` SWITCHES THE LINE, not the band. Content-level redaction is the
   request's opt-in, and a reader who chose it is waiting on something larger
   than a reader who did not — so the line names what is going. Nothing else
   about the band changes: two states of one sentence, never two bands. */

export function DeletionBand({ days = 7, content = false, line, actionLabel = "Cancel", onCancel }) {
  const unit = days === 1 ? "day" : "days";
  const text =
    line ??
    (content
      ? `Your account and everything you posted are deleted in ${days} ${unit}.`
      : `Your account is deleted in ${days} ${unit}.`);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--screen-gutter)",
        background: "var(--surface-bar)",
        borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          letterSpacing: "var(--text-body-small--letter-spacing)",
          color: "var(--on-surface)",
        }}
      >
        {text}
      </span>
      <InlineAction size="sm" onClick={onCancel} style={{ flex: "none" }}>
        {actionLabel}
      </InlineAction>
    </div>
  );
}
