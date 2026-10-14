"use client";

// The search field — `design/components/forms/SearchBar.jsx`: M3's search-bar
// idiom rather than a text field, a full 48px pill on the container surface,
// a leading search glyph, the placeholder's register until a query exists.
//
// ITS NAME IS THE USE'S, NOT THE PLACEHOLDER (the K13 round): a placeholder
// leaves when the reader types, so `ariaLabel` names the field per use.
//
// ITS KEYBOARD IS THE SEARCH KEYBOARD: the `search` return key, no capitals
// guessed and nothing corrected — a query carries handles and tag names,
// which correction would break.

import { Icon } from "@/lib/ui/icons";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

export function SearchBar({
  query,
  onChange,
  placeholder = "Search",
  ariaLabel = "Search",
  node,
}: {
  query: string;
  onChange: (query: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** The registered field; its `glyph` and `input` are its parts. */
  node?: DataNode;
}) {
  return (
    <div className="px-4 pt-1 pb-3">
      <div
        {...testAttributes(node)}
        className={`flex h-12 items-center gap-3 rounded-full bg-surface-container-high px-4 ${
          query === "" ? "text-on-surface-variant" : "text-on-surface"
        }`}
      >
        <span aria-hidden="true" className="inline-flex text-on-surface-variant" {...testAttributes(part(node, "glyph"))}>
          <Icon name="search" size={20} />
        </span>
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={ariaLabel}
          {...testAttributes(part(node, "input"))}
          className="cg-focus min-w-0 flex-1 border-0 bg-transparent p-0 text-body-large text-inherit outline-none placeholder:text-on-surface-variant"
        />
      </div>
    </div>
  );
}
