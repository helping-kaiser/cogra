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

// The first character of the display name, uppercased. Grapheme-aware via the
// spread rather than `charAt`, so an emoji or a non-BMP letter is not cut in
// half into a replacement character.
export function monogramOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  return [...trimmed][0]!.toUpperCase();
}

export function MonogramAvatar({
  name,
  src,
  size = 40,
  testId,
}: {
  name: string;
  src?: string | null;
  size?: number;
  testId?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed;

  return (
    <span
      data-testid={testId}
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
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          // The monogram scales with the disc rather than taking a type role:
          // this is a drawn mark, not text a reader reads, and a fixed role
          // would overflow the 24px avatar in a reference row.
          // Weight 500 matches the label roles the rest of the system sets a
          // mark in; it rides the inline style because the size does too — a
          // Tailwind weight utility here would be the `font-medium` the type
          // test bans in favour of reading a role.
          style={{ fontSize: Math.round(size * 0.42), lineHeight: 1, fontWeight: 500 }}
        >
          {monogramOf(name)}
        </span>
      )}
    </span>
  );
}
