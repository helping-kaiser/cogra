"use client";

// Object URLs for the picked bytes, created once per asset and revoked when the
// asset leaves the draft.
//
// This exists because the alternative leaks. A `URL.createObjectURL` call holds
// its blob alive until it is revoked, so building the URL inline in a render —
// the obvious thing — mints a new one on every keystroke in the title field and
// pins ten phone photos in memory ten times over.

import { useEffect, useRef, useState } from "react";

import type { PickedAsset } from "./wizard";

/**
 * Revoke a set of URLs when the set is replaced, and on unmount.
 *
 * The URLs themselves are minted where their bytes are produced — in the
 * callback that captured the frames — rather than in an effect that would have
 * to write them into state and re-render for it. This is only the release half,
 * which is the half an effect is genuinely for.
 */
export function useRevokeOnChange(urls: readonly string[]): void {
  useEffect(() => {
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [urls]);
}

export function usePreviewUrls(assets: readonly PickedAsset[]): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // The map is mirrored in a ref so the unmount cleanup can revoke what is
  // actually outstanding without listing state as a dependency. It is also what
  // the effect below reconciles against, rather than the state value: a state
  // updater must be pure (React's Rules of Hooks — "Keep components and hooks
  // pure"), and Strict Mode calls it twice in development, which minting an
  // object URL inside one would turn into two blobs held for the tab's life.
  const live = useRef<Record<string, string>>({});

  useEffect(() => {
    const current = live.current;
    const next: Record<string, string> = {};
    let changed = false;
    for (const asset of assets) {
      const existing = current[asset.id];
      if (existing !== undefined) {
        next[asset.id] = existing;
      } else {
        next[asset.id] = URL.createObjectURL(asset.file);
        changed = true;
      }
    }
    for (const [id, url] of Object.entries(current)) {
      if (next[id] === undefined) {
        URL.revokeObjectURL(url);
        changed = true;
      }
    }
    if (!changed) return;
    live.current = next;
    setUrls(next);
  }, [assets]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(live.current)) URL.revokeObjectURL(url);
      live.current = {};
    };
  }, []);

  return urls;
}
