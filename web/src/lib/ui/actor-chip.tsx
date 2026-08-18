// The actor chip / row and its monogram avatar (design.md §6): the
// compact person-or-group reference every author attribution renders
// as, opening the actor's profile. Media avatars arrive with slice
// 2.5; until then the monogram is the designed placeholder.

import Link from "next/link";

/**
 * The circular letter avatar: the first grapheme of the display name
 * (or handle). Decorative — the adjacent text names the actor.
 */
export function MonogramAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "lg";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const box =
    size === "lg"
      ? "h-16 w-16 text-headline-small"
      : "h-6 w-6 text-label-small";
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container`}
    >
      {initial}
    </span>
  );
}

/**
 * A compact actor reference — monogram, display name, handle — that
 * opens the actor's profile.
 */
export function ActorChip({
  handle,
  displayName,
  testId,
}: {
  handle: string;
  displayName: string | null | undefined;
  testId?: string;
}) {
  const name = displayName?.trim() ? displayName : handle;
  return (
    <Link
      href={`/u/${handle}`}
      data-testid={testId}
      className="inline-flex min-h-6 items-center gap-2"
    >
      <MonogramAvatar name={name} />
      <span className="text-label-large">{name}</span>
      <span className="text-label-medium text-on-surface-variant">@{handle}</span>
    </Link>
  );
}
