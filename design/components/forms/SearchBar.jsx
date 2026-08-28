import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* The search field (item 9's port) — M3's search-bar idiom rather than a
   TextField variant: a full 48px pill on the container surface, a leading
   search glyph, placeholder register until a query exists. It lives at the top
   of the Explore tab and nowhere else; an inner surface that needs text input
   uses TextField.

   This is a STATIC-RENDER-FRIENDLY control: `query` is the shown text and a
   caret bar stands in for focus on prototype boards; the product binds a real
   input in its place. */

export function SearchBar({ query = "", placeholder = "Search", onChange }) {
  return (
    <div style={{ padding: "4px 16px 12px 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          height: "48px",
          padding: "0 16px",
          borderRadius: "var(--radius-full)",
          background: "var(--surface-container-high)",
          color: query ? "var(--on-surface)" : "var(--text-secondary)",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "inline-flex", color: "var(--text-secondary)" }} aria-hidden="true">
          <Icon name="search" size={20} />
        </span>
        {onChange ? (
          <input
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="cg-focus"
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              background: "none",
              padding: 0,
              color: "inherit",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-large)",
              lineHeight: "var(--text-body-large--line-height)",
              outline: "none",
            }}
          />
        ) : (
          <>
            <span
              style={{
                fontSize: "var(--text-body-large)",
                lineHeight: "var(--text-body-large--line-height)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {query || placeholder}
            </span>
            {query && <span aria-hidden="true" style={{ marginLeft: "auto", width: "2px", height: "22px", background: "var(--primary)", flex: "none" }} />}
          </>
        )}
      </div>
    </div>
  );
}
