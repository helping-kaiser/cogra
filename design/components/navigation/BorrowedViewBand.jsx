import React from "react";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";

/* The borrowed-view band (readme §13). A guest or applicant feed is ranked
   from a borrowed vantage point — the inviter's for an invite-link arrival,
   the genesis moderator's for a bare one, and still the inviter's through the
   applicant days — because a viewer with no outgoing stances has no view of
   their own. The borrowed view is ALWAYS named, and this band is the naming:
   it rides the collapsing top in place of the guest notice (which it
   subsumes), says whose view this is, and carries the one sign-in-or-join
   entry. The label is what makes borrowed ranking honest (§9); it exposes
   nothing the public record does not already carry.

   `action` drops away for the signed-in applicant, where the line changes
   ("… while your application lands.") but the vantage point does not. */

export function BorrowedViewBand({ handle, displayName, avatarSrc, line, actionLabel, onAction }) {
  const text = line ?? `Browsing from @${handle}'s view — join to build your own.`;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "0 var(--screen-gutter) var(--space-3)",
      }}
    >
      <MonogramAvatar name={displayName ?? handle} src={avatarSrc} />
      <span
        style={{
          flex: 1,
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          letterSpacing: "var(--text-body-small--letter-spacing)",
          color: "var(--text-secondary)",
        }}
      >
        {text}
      </span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className={BUTTON_CLASS}
          style={{ ...buttonStyle({ variant: "text", size: "sm" }), flex: "none" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
