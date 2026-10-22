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

import { part, testAttributes, type DataNode } from "./data-node";

const SIZES = { sm: 24, lg: 64 } as const;

/**
 * The circular avatar: the actor's picture, or the first grapheme of their
 * display name (or handle).
 */
export function MonogramAvatar({
  name,
  size = "sm",
  src,
  node,
}: {
  name: string;
  size?: keyof typeof SIZES;
  src?: string | null;
  node?: DataNode;
}) {
  return <Avatar name={name} src={src} size={SIZES[size]} node={node} />;
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
  node,
}: {
  handle: string;
  displayName: string | null | undefined;
  avatarUrl?: string | null;
  testId?: string;
  /** The registered chip node (`….authorChip`); its avatar, name and handle are its parts. */
  node?: DataNode;
}) {
  const name = displayName?.trim() ? displayName : handle;
  // THE ROW NEVER WRAPS AND NEVER CROWDS (`ActorChip.jsx`, jakob's ruling
  // 2026-09-23). A name too long for the room ELLIPSIZES; the handle is the
  // identity and stays whole until it alone cannot fit, and only then
  // ellipsizes too. The chip yields (`min-w-0`) and whatever stands beside it
  // keeps its full width. The two-stage yield is flexbox's own arithmetic: the
  // name's `flex-shrink: 999` absorbs the squeeze ahead of the handle's 1.
  //
  // THE HANDLE IS DRAWN AT LABEL-MEDIUM'S SIZE IN THE READING WEIGHT: the
  // master sets its size alone and leaves the weight to the ground, so the name
  // carries the chip's emphasis and the handle reads beside it, quieter.
  return (
    <Link
      href={`/u/${handle}`}
      {...testAttributes(node, testId)}
      className="cg-state cg-focus inline-flex min-h-6 min-w-0 items-center gap-2 rounded-full text-on-surface"
    >
      <MonogramAvatar name={name} src={avatarUrl} node={part(node, "avatar")} />
      <span
        className="min-w-0 shrink-[999] truncate text-label-large"
        {...testAttributes(part(node, "name"))}
      >
        {name}
      </span>
      <span
        className="min-w-0 shrink truncate text-[length:var(--text-label-medium)] text-on-surface-variant"
        {...testAttributes(part(node, "handle"))}
      >
        @{handle}
      </span>
    </Link>
  );
}
