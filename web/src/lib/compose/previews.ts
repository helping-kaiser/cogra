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

/**
 * An object URL for one optional blob outside `assets` — the video's cover,
 * which is its own asset (`CoverAsset`) rather than an attachment, so it
 * needs the same mint-once/revoke-on-change treatment as `usePreviewUrls`
 * without the array bookkeeping that hook exists for.
 *
 * THE SAME STRICT-MODE GUARD APPLIES: the pairing is kept in a ref so a
 * Strict Mode double-invoke of the effect sees its own first pass already
 * landed and mints nothing twice.
 */
export function useObjectUrl(file: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const live = useRef<{ file: Blob; url: string } | null>(null);

  useEffect(() => {
    const current = live.current;
    if (!file) {
      if (current === null) return;
      URL.revokeObjectURL(current.url);
      live.current = null;
      setUrl(null);
      return;
    }
    if (current !== null && current.file === file) return;
    if (current !== null) URL.revokeObjectURL(current.url);
    const next = URL.createObjectURL(file);
    live.current = { file, url: next };
    setUrl(next);
  }, [file]);

  useEffect(() => {
    return () => {
      if (live.current !== null) URL.revokeObjectURL(live.current.url);
      live.current = null;
    };
  }, []);

  return url;
}

export function usePreviewUrls(assets: readonly PickedAsset[]): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // What is actually outstanding, mirrored in a ref so the unmount cleanup can
  // revoke it without listing state as a dependency — and so the effect below
  // reconciles against the object-URL table rather than against a render's
  // value.
  const live = useRef<Record<string, string>>({});

  useEffect(() => {
    // MINTED AND REVOKED HERE, not inside a `setUrls` updater. React's rules
    // require a state updater to be pure and Strict Mode calls it twice to
    // surface violations, so every newly picked asset used to mint two object
    // URLs — the second went into the map, the first was never revoked and
    // pinned its blob for the life of the tab.
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
    // THE RULE IS DISABLED DELIBERATELY, and this is the case it exempts: the
    // object-URL table is an external system. These urls cannot be derived
    // during render — minting one is a side effect, and a render may run twice
    // or be thrown away — so reflecting the table's keys into state is the only
    // honest way to read it. Deriving them in a `useMemo` instead was tried and
    // is worse: the memo survives Strict Mode's simulated unmount while the
    // revocation does not, so the second mount renders urls already revoked.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
