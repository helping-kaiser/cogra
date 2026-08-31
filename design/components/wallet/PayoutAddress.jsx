import React from "react";

/* The witnessed payout address (item 12): where payouts and tips land — the
   Registration guild-key field, public and actor-attributed (ledger.md
   "Keys"). The address is the one surface where the format IS the content
   (copy-voice: codes and keys keep their precise form), so it renders whole,
   in mono, wrapped — never truncated: a clipped address cannot be checked
   against a wallet, and checking is the point of showing it. Changing it is
   a signed act; every earlier address stays on the public record. */

export function PayoutAddress({ address, label = "Payouts land at", onChange, changeLabel = "Change" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-label-medium)",
            lineHeight: "var(--text-label-medium--line-height)",
            fontWeight: "var(--text-label-medium--font-weight)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
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
    </div>
  );
}
