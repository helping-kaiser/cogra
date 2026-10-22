"use client";

// THE PROFILE HEADER (design/components/people/ProfileHeader.jsx): the top of
// a profile, your own or someone else's — the one surface whose subject is a
// person. Not a card: it sits on the page ground.
//
// THE SHAPE IS THE COMPACT ONE (jakob 2026-09-01): avatar left, the name (and,
// on your own page, the handle) in the column beside it, the bio below, then
// the one actions row. A summary, not a hero. The handle repeats only where
// the screen's own bar does not already carry it (`showHandle`).
//
// A DELETED ACCOUNT KEEPS THIS WHOLE HEADER (`redacted`, the redacted-actor
// law, jakob 2026-09-11): the reserved disc, `Deleted account` in the system's
// quiet voice, no handle, and the redaction mark standing where the bio's
// words were — a space kept, not a space lost (`RedactedContent`, reason
// `account`). The shells never go.
//
// THE ROW IS THE PAGE'S: the header hands it its node and the page places the
// controls, each named by its own registered part — the wide opinion, Message
// and the ⋮ on someone else's; Edit profile, Invites and the ⋮ on your own.
//
// NOT DRAWN YET (handed to Fable, the profile conformance lane): the figures
// (Q35 is still open and the read carries no count) and the avatar's change
// badge (the crop and seal live only inside the edit screen).

import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";

/** `RedactedContent`'s `account` reason (SensitiveVeil.jsx), the mark in the bio's place. */
export const ACCOUNT_REMOVAL_LINE = "Deleted by the person whose account it was";
export const ACCOUNT_REMOVAL_DETAIL =
  "Their name and profile are gone. What they signed stays on the graph and still credits them.";

/**
 * Where the website link goes. The stored value is what its owner typed —
 * `solferreira.art` reads as a page RELATIVE to this one in an href — so a
 * bare host gains `https://`, and a scheme other than http(s) gets no link.
 */
export function websiteHref(value: string): string | null {
  const trimmed = value.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (scheme === null) return `https://${trimmed}`;
  return /^https?$/i.test(scheme[1] ?? "") ? trimmed : null;
}

export function ProfileHeader({
  handle,
  displayName,
  avatarSrc,
  bio,
  website,
  redacted = false,
  showHandle = true,
  node,
  children,
}: {
  handle: string;
  displayName?: string | null;
  avatarSrc?: string | null;
  /** Their own words, body-medium, unclamped. Omit when there are none. */
  bio?: string | null;
  website?: string | null;
  /** A deleted account: the identity placeholdered, the shells kept. */
  redacted?: boolean;
  /** Off where the screen's own bar already carries `@handle`. */
  showHandle?: boolean;
  /** `profile.identity`; its parts are named under it. */
  node?: DataNode;
  /** The actions row's controls, in the page's order. */
  children: ReactNode;
}) {
  const name = redacted
    ? REDACTED_ACTOR_NAME
    : displayName?.trim()
      ? displayName
      : handle;
  return (
    <header
      {...testAttributes(node, "profile-identity")}
      className="flex flex-col gap-3 pb-1 pt-3"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 [grid-template-areas:'avatar_name''avatar_figures']">
        <div className="relative flex-none [grid-area:avatar]">
          <MonogramAvatar
            name={name}
            size={80}
            src={redacted ? null : avatarSrc}
            redacted={redacted}
            node={part(node, "avatar")}
            testId="profile-avatar"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 self-end [grid-area:name]">
          <h1
            {...testAttributes(part(node, "name"), "profile-display-name")}
            className={`m-0 text-title-large [overflow-wrap:anywhere] ${redacted ? "text-on-surface-variant" : ""}`}
          >
            {name}
          </h1>
          {showHandle && !redacted && (
            <span
              {...testAttributes(part(node, "handle"), "profile-handle")}
              className="text-body-small text-on-surface-variant"
            >
              @{handle}
            </span>
          )}
        </div>
      </div>
      {redacted ? (
        // The mark lives where the payload was (ProfileDeleted.md:13), worded
        // so it can never read as a moderation verdict or a dead link.
        <div
          {...testAttributes(part(node, "removalMark"), "profile-removal-mark")}
          className="flex flex-col gap-1 rounded-medium bg-surface-container-high p-4"
        >
          <span {...testAttributes(part(node, "removalMark.line"))} className="text-body-medium text-on-surface">
            {ACCOUNT_REMOVAL_LINE}
          </span>
          <span
            {...testAttributes(part(node, "removalMark.detail"))}
            className="text-body-small text-on-surface-variant [text-wrap:pretty]"
          >
            {ACCOUNT_REMOVAL_DETAIL}
          </span>
        </div>
      ) : (
        bio?.trim() && (
          <p {...testAttributes(part(node, "bio"), "profile-bio")} className="m-0 text-body-medium">
            {bio}
          </p>
        )
      )}
      {!redacted && website?.trim() && <Website value={website} node={part(node, "website")} />}
      <div {...testAttributes(part(node, "actionRow"), "profile-actions")} className="flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}

function Website({ value, node }: { value: string; node?: DataNode }) {
  const href = websiteHref(value);
  const className = "self-start text-body-medium text-primary no-underline [overflow-wrap:anywhere]";
  return href === null ? (
    <span {...testAttributes(node, "profile-website")} className={className}>
      {value}
    </span>
  ) : (
    <a href={href} rel="noreferrer nofollow" {...testAttributes(node, "profile-website")} className={className}>
      {value}
    </a>
  );
}
