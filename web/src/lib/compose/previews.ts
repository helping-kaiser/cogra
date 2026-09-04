"use client";

// Object URLs for the picked bytes, created once per asset and revoked when the
// asset leaves the draft.
//
// This exists because the alternative leaks. A `URL.createObjectURL` call holds
// its blob alive until it is revoked, so building the URL inline in a render —
// the obvious thing — mints a new one on every keystroke in the title field and
// pins ten phone photos in memory ten times over.

import { useEffect, useMemo, useRef } from "react";

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

// One object URL per blob, minted at most once.
//
// The mint is memoized on the blob itself so that computing the map is
// IDEMPOTENT: React invokes a render — and a `useMemo` factory — more than once
// in Strict Mode and may throw a render's result away, and a mint that ran
// twice would hold two blobs alive where one was handed out. Revoking drops the
// memo with the url, so a blob that comes back is minted afresh rather than
// handed a dead one.
const mintedFor = new WeakMap<Blob, string>();

function urlFor(file: Blob): string {
  const existing = mintedFor.get(file);
  if (existing !== undefined) return existing;
  const url = URL.createObjectURL(file);
  mintedFor.set(file, url);
  return url;
}

function release(file: Blob | undefined, url: string): void {
  if (file !== undefined) mintedFor.delete(file);
  URL.revokeObjectURL(url);
}

export function usePreviewUrls(assets: readonly PickedAsset[]): Readonly<Record<string, string>> {
  // DERIVED, not stored. Writing this map into state from an effect is the
  // cascading render React's own guidance warns about ("You Might Not Need an
  // Effect"), and the mint that used to sit inside the `setUrls` updater broke
  // the rule that a state updater is pure — Strict Mode calls it twice, so
  // every newly picked asset minted two urls and only the second was ever
  // revoked.
  const urls = useMemo(() => {
    const next: Record<string, string> = {};
    for (const asset of assets) next[asset.id] = urlFor(asset.file);
    return next;
  }, [assets]);

  // The release half, which is what an effect is genuinely for: it runs after
  // the render that dropped those assets has committed, so nothing still on
  // screen loses its src.
  const outstanding = useRef<{ urls: Record<string, string>; files: Map<string, Blob> }>({
    urls: {},
    files: new Map(),
  });

  useEffect(() => {
    const held = outstanding.current;
    for (const [id, url] of Object.entries(held.urls)) {
      if (urls[id] === undefined) release(held.files.get(id), url);
    }
    outstanding.current = {
      urls,
      files: new Map(assets.map((asset) => [asset.id, asset.file])),
    };
  }, [assets, urls]);

  useEffect(() => {
    const held = outstanding;
    return () => {
      for (const [id, url] of Object.entries(held.current.urls)) {
        release(held.current.files.get(id), url);
      }
      held.current = { urls: {}, files: new Map() };
    };
  }, []);

  return urls;
}
