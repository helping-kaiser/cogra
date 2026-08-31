import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* The witnessed payout address (item 12 round 2): a proper HOME, not text
   thrown on the page — a quiet container with the label, the copy button,
   and Change as real affordances, the address whole inside. Mono, wrapped,
   never truncated: checking it against a wallet is the point of showing it.
   The address is the Registration guild-key field — public, actor-attributed;
   changing it is a signed act and every earlier address stays witnessed. */

export function PayoutAddress({ address, label = "Payouts land at", onCopy, onChange, changeLabel = "Change", caption }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-label-medium)",
            lineHeight: "var(--text-label-medium--line-height)",
            fontWeight: "var(--text-label-medium--font-weight)",
            letterSpacing: "var(--text-label-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        {onCopy && (
          <button
            type="button"
            aria-label="Copy the address"
            onClick={onCopy}
            className="cg-state cg-focus cg-hit"
            style={{
              width: "32px",
              height: "32px",
              display: "grid",
              placeItems: "center",
              border: 0,
              background: "none",
              borderRadius: "var(--radius-full)",
              color: "var(--text-secondary)",
              padding: 0,
              cursor: "pointer",
              flex: "none",
            }}
          >
            <Icon name="content_copy" size={18} />
          </button>
        )}
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            className="cg-state cg-focus cg-hit"
            style={{
              border: 0,
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label-large)",
              lineHeight: "var(--text-label-large--line-height)",
              fontWeight: "var(--text-label-large--font-weight)",
              letterSpacing: "var(--text-label-large--letter-spacing)",
              color: "var(--primary)",
              flex: "none",
            }}
          >
            {changeLabel}
          </button>
        )}
      </div>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          overflowWrap: "anywhere",
          wordBreak: "break-all",
          color: "var(--on-surface)",
        }}
      >
        {address}
      </code>
      {caption && (
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          {caption}
        </span>
      )}
    </div>
  );
}
