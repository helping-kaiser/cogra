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
 * One object URL for one blob — the cover, and the frames offered beside it.
 *
 * Keyed on the blob itself rather than on an id: a cover has no identity beyond
 * its bytes, and choosing a different frame replaces the blob, which is exactly
 * when the old URL should be revoked.
 */
export function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (blob === null) {
      setUrl(null);
      return;
    }
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return url;
}

/** The same, for a list that is replaced wholesale rather than edited. */
export function useBlobUrls(blobs: readonly Blob[]): readonly string[] {
  const [urls, setUrls] = useState<readonly string[]>([]);
  useEffect(() => {
    const made = blobs.map((blob) => URL.createObjectURL(blob));
    setUrls(made);
    return () => {
      for (const one of made) URL.revokeObjectURL(one);
    };
  }, [blobs]);
  return urls;
}

export function usePreviewUrls(assets: readonly PickedAsset[]): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // The map is mirrored in a ref so the unmount cleanup can revoke what is
  // actually outstanding without listing state as a dependency.
  const live = useRef<Record<string, string>>({});

  useEffect(() => {
    setUrls((current) => {
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
      live.current = next;
      return changed ? next : current;
    });
  }, [assets]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(live.current)) URL.revokeObjectURL(url);
      live.current = {};
    };
  }, []);

  return urls;
}
