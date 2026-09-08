import React from "react";
import { NodeMark } from "../content/ReferenceRow.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* A reference already staged in a composer (item 17, the conformance round):
   the citation the author has committed to, shown back to them — the kind's
   mark, what it points at, the pair signed on the act, and the × that takes it
   back out.

   THE MARK IS `NodeMark`, so a person arrives as a circle and everything else
   as its tile. Citing a post and mentioning a person stage the same fact, and a
   row that drew them differently would deny it — which is the whole point of
   the menus round.

   IT IS THE COMPOSER'S TWIN OF `ReferenceRow`, not a variant of it. The reading
   row is a way in: it is pressable, it navigates, and it has no ×. This one
   navigates nowhere — the author is holding it, not following it — and its one
   affordance is taking it back off. Two jobs, two rows, one mark. */

export function StagedReference({ kind = "post", name, sub, src, value, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "8px 12px", borderRadius: "var(--radius-small)", background: "var(--surface-container-highest)", boxSizing: "border-box" }}>
      <NodeMark kind={kind} name={name} src={src} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {sub && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{sub}</span>}
      </span>
      {value && (
        <span style={{ flex: "none", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{value}</span>
      )}
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="cg-state cg-focus"
        style={{ flex: "none", display: "grid", placeItems: "center", height: 32, width: 32, border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
