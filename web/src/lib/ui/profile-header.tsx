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
// THE FIGURES, EACH LABELLED, NEVER MERGED (ProfileHeader.jsx; readme §7):
// `Posts`, then `Opinions on them` and `Opinions by them` (`… you` on one's
// own). They count RECORDS, never a fold — open-questions.md Q35, closed
// toward the drawn figures on 2026-10-28 under the autonomy order, jakob's
// confirmation pending: the posts published (genesis Publish records, never
// an edit), the Opinion records toward the person, and the Opinion records
// they gave toward people (`ProfileFigures`). While they fit the column
// beside the avatar they stand under the name; where they do not, they move
// under the avatar-and-name block — a container query on the header's own
// width, 96px of avatar and gap plus the labels' width in rem.
//
// THE FIGURES ARE NOT YET A DOOR on the web: the opinions page they open
// (`ProfileStances`) is not built here, so they draw as the master's
// `onCounts`-less cell — a gap reported, never a dead button.
//
// NOT DRAWN YET: the avatar's change badge (the crop and seal live only
// inside the edit screen).

import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";

/** `RedactedContent`'s `account` reason (SensitiveVeil.jsx), the mark in the bio's place. */
export const ACCOUNT_REMOVAL_LINE = "Deleted by the person whose account it was";
export const ACCOUNT_REMOVAL_DETAIL =
  "Their name and profile are gone. What they signed stays on the graph and still credits them.";

/*
 * THE FIGURES MOVE UNDER WHEN THEY DO NOT FIT (ProfileHeader.jsx
 * `PROFILE_TOP_CSS`): below 96px of avatar and gap plus 15.5rem of another's
 * labels (14.5rem of one's own), the figures take the second row's full
 * width, the name centres on the avatar and the figures keep the header's
 * own 12px gap. Spelled whole for each case so the class scanner sees them.
 */
const UNDER_OTHER = "@max-[calc(96px+15.5rem)]:[grid-template-areas:'avatar_name''figures_figures']";
const UNDER_OWN = "@max-[calc(96px+14.5rem)]:[grid-template-areas:'avatar_name''figures_figures']";
const UNDER_OTHER_NAME = "@max-[calc(96px+15.5rem)]:self-center";
const UNDER_OWN_NAME = "@max-[calc(96px+14.5rem)]:self-center";
const UNDER_OTHER_FIGURES = "@max-[calc(96px+15.5rem)]:mt-3";
const UNDER_OWN_FIGURES = "@max-[calc(96px+14.5rem)]:mt-3";

/** Figures are grouped the way every figure in the product groups them (copy-voice: `5,000`). */
const FIGURE_FORMAT = new Intl.NumberFormat("en-US");

/** One figure: its number in title-medium, its label quiet beneath it, never wrapping. */
function Figure({ value, label, node }: { value: number; label: string; node?: DataNode }) {
  return (
    <div {...testAttributes(node)} className="flex min-w-0 flex-col">
      <span {...testAttributes(part(node, "value"))} className="text-title-medium">
        {FIGURE_FORMAT.format(value)}
      </span>
      <span
        {...testAttributes(part(node, "label"))}
        className="whitespace-nowrap text-label-small text-on-surface-variant"
      >
        {label}
      </span>
    </div>
  );
}

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
  figures,
  own = false,
  node,
  children,
}: {
  /** The three record counts; a null count is not drawn, and none at all draws no cell. */
  figures?: {
    readonly posts: number | null;
    readonly opinionsOn: number | null;
    readonly opinionsBy: number | null;
  } | null;
  /** One's own profile, whose figures say `you`. */
  own?: boolean;
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
  const figuresShown =
    figures !== null &&
    figures !== undefined &&
    (figures.posts !== null || figures.opinionsOn !== null || figures.opinionsBy !== null);
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
      <div className="@container">
      <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 [grid-template-areas:'avatar_name''avatar_figures'] ${own ? UNDER_OWN : UNDER_OTHER}`}>
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
        <div className={`flex min-w-0 flex-col gap-0.5 self-end [grid-area:name] ${own ? UNDER_OWN_NAME : UNDER_OTHER_NAME}`}>
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
        {figuresShown && (
          <div
            {...testAttributes(part(node, "figures"), "profile-figures")}
            className={`mt-1.5 flex gap-5 self-start [grid-area:figures] ${own ? UNDER_OWN_FIGURES : UNDER_OTHER_FIGURES}`}
          >
            {figures && figures.posts !== null && (
              <Figure value={figures.posts} label="Posts" node={part(node, "figures.posts")} />
            )}
            {figures && figures.opinionsOn !== null && (
              <Figure
                value={figures.opinionsOn}
                label={own ? "Opinions on you" : "Opinions on them"}
                node={part(node, "figures.stancesOn")}
              />
            )}
            {figures && figures.opinionsBy !== null && (
              <Figure
                value={figures.opinionsBy}
                label={own ? "Opinions by you" : "Opinions by them"}
                node={part(node, "figures.stancesTaken")}
              />
            )}
          </div>
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
