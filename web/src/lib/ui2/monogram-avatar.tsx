"use client";

// The avatar. A monogram circle in `secondaryContainer` is the DESIGNED
// placeholder, not a gap waiting for a photo — which is why it stays the
// fallback now that media avatars exist rather than being replaced by a
// spinner or a grey disc.
//
// A photo simply takes its place when there is one, and a BROKEN image falls
// back to the monogram silently: a reader does not need to be told that
// someone's picture failed to load, and a broken-image glyph in a feed of
// twenty rows is noise. That silent fallback is why this is a client component
// — it needs the `onError` event.

import Image from "next/image";
import { useState } from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

// The first character of the display name, uppercased. Grapheme-aware via the
// spread rather than `charAt`, so an emoji or a non-BMP letter is not cut in
// half into a replacement character.
export function monogramOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  return [...trimmed][0]!.toUpperCase();
}

/** The master's named discs (`ActorChip.jsx` `MonogramAvatar` `size`): 24, 32 and 64px. */
export type MonogramTier = "sm" | "md" | "lg";

/**
 * The monogram's type role (`ActorChip.jsx` `MonogramAvatar`): a named disc
 * takes its role whole — `sm` label-small, `md` label-medium, `lg`
 * headline-small; a disc sized by number takes label-large below 56px and
 * headline-small from 56. The weight is the master's one-part override, 500
 * on every disc.
 */
export function monogramRole(size: number, tier?: MonogramTier): string {
  if (tier === "sm") return "text-label-small";
  if (tier === "md") return "text-label-medium";
  if (tier === "lg" || size >= 56) return "text-headline-small";
  return "text-label-large";
}

// THE COGRA MARK AS AN ACCOUNT'S PICTURE IS THE BRAND'S ORANGE TILE CLIPPED
// ROUND (jakob 2026-11-24, "(a) orange tile"; design/readme.md §4 *Imagery*;
// round 67's `ActorChip.jsx` `MarkTile`). `design/assets/icon.svg` — the tile,
// its geometry and its three fills copied verbatim, never redrawn — fills the
// disc and is clipped by the disc's own circle, at every size and the same in
// light and dark: the tile's colours, not the theme's. The circle falls wholly
// inside the tile's rounded square, so no corner of the ground shows. This is
// the web's one copy of the tile's path data.
function MarkTile() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" className="block">
      <rect width="100" height="100" rx="22" fill="#EF6C1A" />
      <circle cx="50.00" cy="40.21" r="18.94" fill="none" stroke="#4F1D00" strokeWidth="13.17" />
      <path
        d="M68.937 22.447 L68.937 60.574 C68.879 61.179 68.786 63.012 68.576 64.198 C68.357 65.392 68.063 66.586 67.642 67.713 C67.213 68.840 66.675 69.958 66.028 70.967 C65.372 71.985 64.598 72.952 63.732 73.784 C62.866 74.625 61.865 75.365 60.831 75.988 C59.805 76.602 58.670 77.098 57.526 77.501 C56.391 77.905 55.197 78.182 54.003 78.384 C52.809 78.586 51.589 78.670 50.378 78.721 C49.167 78.771 47.948 78.746 46.737 78.679 C45.526 78.620 43.710 78.401 43.113 78.342"
        fill="none"
        stroke="#4F1D00"
        strokeWidth="13.17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="52.97" cy="37.24" r="7.16" fill="#FFF8F6" />
    </svg>
  );
}

export function MonogramAvatar({
  name,
  src,
  size = 40,
  tier,
  testId,
  node,
  redacted = false,
  mark = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  /** The master's named disc this one is, which picks its type role (`monogramRole`). */
  tier?: MonogramTier;
  testId?: string;
  /** The registered node this avatar is, which then names it instead of `testId`. */
  node?: DataNode;
  /**
   * A DELETED ACCOUNT'S DISC (`ActorChip.jsx`, `erasure.md` §2–3): it keeps its
   * space and fills with nothing — no picture, no letter, the reserved surface
   * a redaction mark wears — because there is no name left to take one from.
   */
  redacted?: boolean;
  /**
   * The CoGra mark as the account's picture (`MarkTile` above). It wins over
   * `src` and yields to `redacted` (round 67's `ActorChip.jsx` `MonogramAvatar`).
   */
  mark?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed && !redacted;

  if (redacted) {
    return (
      <span
        {...testAttributes(node, testId)}
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="relative flex flex-none overflow-hidden rounded-full bg-surface-container-high select-none"
      />
    );
  }

  return (
    <span
      {...testAttributes(node, testId)}
      style={{ width: size, height: size }}
      className="relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-secondary-container text-on-secondary-container select-none"
    >
      {mark ? (
        <MarkTile />
      ) : showPhoto ? (
        <Image
          src={src as string}
          // The avatar repeats a name that is already beside it on every
          // surface it appears on, so it is decorative and takes the empty
          // alt the HTML spec asks for. A second reading of the same name is
          // noise in a screen reader, not information.
          alt=""
          fill
          // The rendered box is `size` CSS pixels wide and never responsive,
          // so the browser is told exactly that instead of assuming 100vw and
          // downloading a feed-sized image for a 40px disc.
          sizes={`${size}px`}
          // Same rule as the media tile: served media is display-ready by
          // construction, so the optimizer adds nothing and refuses the dev
          // topology's private-IP origin.
          unoptimized
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          // The disc's role whole (`monogramRole`), at the master's 500.
          className={`${monogramRole(size, tier)} [font-weight:500]`}
        >
          {monogramOf(name)}
        </span>
      )}
    </span>
  );
}
