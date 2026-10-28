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
// which correction would break. What the action key does is each surface's
// own (`onAction`): the tag picker's stages its first row. The platform's own
// clear (the search input's ×) is not drawn: the master's pill carries none,
// and a pill that grew a second control on typing would not be the drawn one.
//
// `error` IS THE FIELD-ERROR STATE IN THE PILL'S IDIOM (the caps-affordance
// round; `TagPickerRefused`): a 1px `--error` ring drawn INSIDE the pill's own
// box — an inset outline, so nothing moves the moment it arrives — with the
// input `aria-invalid` and its refusal named by `describedBy`. The words are
// the surface's, in the line under the bar.

import type { Ref } from "react";

import { Icon } from "@/lib/ui/icons";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

export function SearchBar({
  query,
  onChange,
  placeholder = "Search",
  ariaLabel = "Search",
  onAction,
  error = false,
  describedBy,
  inputRef,
  node,
}: {
  query: string;
  onChange: (query: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** The keyboard's action key; the field does nothing on it otherwise. */
  onAction?: () => void;
  /** The field refuses what is typed: the error ring, and `aria-invalid`. */
  error?: boolean;
  /** The id of the line that names the refusal. */
  describedBy?: string;
  /** The bound input, for a surface that focuses it as it opens. */
  inputRef?: Ref<HTMLInputElement>;
  /** The registered field; its `glyph` and `input` are its parts. */
  node?: DataNode;
}) {
  return (
    <div className="px-4 pt-1 pb-3">
      <div
        {...testAttributes(node)}
        className={`flex h-12 items-center gap-3 rounded-full bg-surface-container-high px-4 ${
          query === "" ? "text-on-surface-variant" : "text-on-surface"
        } ${error ? "outline outline-1 -outline-offset-1 outline-error" : ""}`}
      >
        <span aria-hidden="true" className="inline-flex text-on-surface-variant" {...testAttributes(part(node, "glyph"))}>
          <Icon name="search" size={20} />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={
            onAction === undefined
              ? undefined
              : (event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onAction();
                }
          }
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...testAttributes(part(node, "input"))}
          className="cg-focus min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-body-large text-inherit outline-none placeholder:text-on-surface-variant [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>
    </div>
  );
}
