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

export function MonogramAvatar({
  name,
  src,
  size = 40,
  tier,
  testId,
  node,
  redacted = false,
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
      {showPhoto ? (
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
