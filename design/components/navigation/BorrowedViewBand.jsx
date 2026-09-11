import React from "react";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { buttonStyle, BUTTON_CLASS } from "../core/Button.jsx";

/* The borrowed-view band (readme §13). A guest or applicant feed shows a
   borrowed vantage point, because a viewer with no outgoing stances has no
   view of their own. The vantage resolves to the most specific actor the
   arrival carries — the inviter's for an invite-link visitor, their own
   inviter's for an applicant, and the genesis moderator's for a bare arrival,
   strictly as the fallback. The borrowed view is ALWAYS named, and this band
   is the naming: it rides the collapsing top in place of the guest notice
   (which it subsumes), says whose view this is, and carries the one
   sign-in-or-join entry. The label is what makes the borrowed view honest
   (§9); it exposes nothing the public record does not already carry.

   `action` drops away for the signed-in applicant, where the line changes
   ("… while your application lands.") but the vantage point does not.

   Naming a vantage needs no ranker, so the band stands from the start and the
   feed beneath it reads newest like every other until slice 3. The borrowed
   *order*, the invite-link vantage and the contract field it needs, and the
   band's own line about ranking are what wait for it. */

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
