// The actor chip / row and its avatar (design.md §6): the compact
// person-or-group reference every author attribution renders as, opening the
// actor's profile.
//
// The avatar takes a picture when the actor has one and falls back to the
// monogram when they do not — and the monogram is the DESIGNED placeholder
// rather than a gap, so an actor who never sets one is not in an unfinished
// state (D13). Either way it is decorative: the adjacent text names the actor,
// so a second announcement of the same name would be noise.

import Link from "next/link";

import { MonogramAvatar as Avatar } from "@/lib/ui2/monogram-avatar";

const SIZES = { sm: 24, lg: 64 } as const;

/**
 * The circular avatar: the actor's picture, or the first grapheme of their
 * display name (or handle).
 */
export function MonogramAvatar({
  name,
  size = "sm",
  src,
}: {
  name: string;
  size?: keyof typeof SIZES;
  src?: string | null;
}) {
  return <Avatar name={name} src={src} size={SIZES[size]} />;
}

/**
 * A compact actor reference — avatar, display name, handle — that
 * opens the actor's profile.
 */
export function ActorChip({
  handle,
  displayName,
  avatarUrl,
  testId,
}: {
  handle: string;
  displayName: string | null | undefined;
  avatarUrl?: string | null;
  testId?: string;
}) {
  const name = displayName?.trim() ? displayName : handle;
  return (
    <Link
      href={`/u/${handle}`}
      data-testid={testId}
      className="inline-flex min-h-6 items-center gap-2"
    >
      <MonogramAvatar name={name} src={avatarUrl} />
      <span className="text-label-large">{name}</span>
      <span className="text-label-medium text-on-surface-variant">@{handle}</span>
    </Link>
  );
}
