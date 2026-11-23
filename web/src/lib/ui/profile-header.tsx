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
// own). They count BUNDLES, never records — open-questions.md Q35, ruled by
// jakob 2026-11-10: the posts published (a removed and a still-settling
// one included, never an edit), the people holding an opinion on the person, and the people
// they hold one on (`ProfileFigures`). While they fit the column
// beside the avatar they stand under the name; where they do not, they move
// under the avatar-and-name block — a container query on the header's own
// width, 96px of avatar and gap plus the labels' width in rem.
//
// THE ROW HOLDS TWO DOORS AND A FACT (ProfileHeader.jsx `onCounts`, J-A;
// Profile.md:13, ProfileOther.md:9): `Opinions on …` opens the opinions page
// on its On state, `Opinions by …` on By, and `Posts` is no door. The row
// itself is no target. Each door is spoken as its figure's number and visible
// words and nothing more (copy-voice, *The profile's figures, spoken*):
// `1,204 Opinions on them`, `7 Opinions by you`. A door is a link here, the
// web's element for a door that navigates; the master draws a button for the
// canvas's own click.
//
// THE NAME IS WHOLE ON AT MOST TWO LINES (Profile.md:85-87, round 47): at the
// role's 22px on 28px it wraps at its spaces and a too-wide word breaks
// inside; a name that would take more lines takes the largest whole size from
// 22 down that holds two (`nameFitSize`), measured in the browser before the
// paint (`useNameFit`). Nothing is cut and nothing else in the head changes.
//
// THE AVATAR CHANGES WITHOUT THE EDIT SCREEN (ProfileHeader.jsx, jakob
// 2026-09-01): one's own avatar wears a change badge, the door to the
// picture's own crop and seal (Profile.md:47). The avatar itself is not
// tappable — the badge is the door, the picture is a picture — and the 28px
// badge answers to 48px through `cg-hit` without moving a pixel.

import Link from "next/link";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import type { OpinionDirection } from "@/lib/profile/opinions-route";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { useMeasureEffect } from "@/lib/ui/measure-effect";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";
import { WRITTEN } from "./written";

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

/**
 * One figure: its number in title-medium, its label quiet beneath it, never
 * wrapping. Each sets its role whole, tracking included (`ProfileHeader.jsx`,
 * round 27). Given `href` it is a door onto the opinions page, spoken as its
 * number and words alone, its 48px target grown by `cg-hit` without moving a
 * pixel of the drawing (ProfileHeader.jsx, *Every door answers to 48px*);
 * the door adds no border and no padding, the same column.
 */
function Figure({
  value,
  label,
  node,
  href,
}: {
  value: number;
  label: string;
  node?: DataNode;
  href?: string;
}) {
  const figure = FIGURE_FORMAT.format(value);
  const content = (
    <>
      <span {...testAttributes(part(node, "value"))} className="text-title-medium">
        {figure}
      </span>
      <span
        {...testAttributes(part(node, "label"))}
        className="whitespace-nowrap text-label-small text-on-surface-variant"
      >
        {label}
      </span>
    </>
  );
  if (href === undefined) {
    return (
      <div {...testAttributes(node)} className="flex min-w-0 flex-col">
        {content}
      </div>
    );
  }
  return (
    <Link
      href={href}
      aria-label={`${figure} ${label}`}
      {...testAttributes(node)}
      className="cg-state cg-focus cg-hit flex min-w-0 flex-col rounded-small text-left font-sans text-on-surface no-underline"
    >
      {content}
    </Link>
  );
}

type Figures = {
  readonly posts: number | null;
  readonly opinionsOn: number | null;
  readonly opinionsBy: number | null;
};

/** The name's size and leading, in whole pixels. */
export type NameFit = { readonly size: number; readonly lineHeight: number };

/** The title-large role's own size and leading, where every name starts. */
const ROLE_SIZE = 22;
const ROLE_LEADING = 28;

/**
 * THE NAME'S TWO-LINE RULE (ProfileHeader.jsx `nameFitSize`; Profile.md:87):
 * the largest whole-pixel size from 22 down, in steps of 1, at which the name
 * takes at most two lines, its leading round(size × 28 / 22) px, half up.
 * `lines` counts the name's lines at a size and leading. No smallest size is
 * ruled: two lines are the hard cap.
 */
export function nameFitSize(lines: (size: number, lineHeight: number) => number): NameFit {
  for (let size = ROLE_SIZE; size > 1; size -= 1) {
    const lineHeight = Math.round((size * ROLE_LEADING) / ROLE_SIZE);
    if (lines(size, lineHeight) <= 2) return { size, lineHeight };
  }
  return { size: 1, lineHeight: 1 };
}

/**
 * The fitted size of the name heading, as `[nameRef, fit]`: hand `nameRef`
 * to the heading, which always renders; `fit` is null while the name holds
 * two lines at the role's own size, else the size the rule gives it.
 *
 * THE BROWSER COUNTS THE LINES. The heading is a block whose height is its
 * lines times its leading, so each candidate size is set on it and its height
 * read (MDN, `Element.getBoundingClientRect`), all before the paint
 * (`useMeasureEffect`; react.dev, *useLayoutEffect*: "measure layout before
 * the browser repaints the screen"), and the inline size it had is put back
 * for React to render the result. The fit follows the line's width (MDN,
 * `ResizeObserver`) and the web font's arrival (MDN, `FontFaceSet.ready`).
 */
function useNameFit(name: string): [nameRef: RefObject<HTMLHeadingElement | null>, fit: NameFit | null] {
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [fit, setFit] = useState<NameFit | null>(null);

  useMeasureEffect(() => {
    const element = nameRef.current;
    if (element === null) return;
    const measure = () => {
      const { fontSize, lineHeight } = element.style;
      const next = nameFitSize((size, leading) => {
        element.style.fontSize = `${size}px`;
        element.style.lineHeight = `${leading}px`;
        return Math.round(element.getBoundingClientRect().height / leading);
      });
      element.style.fontSize = fontSize;
      element.style.lineHeight = lineHeight;
      setFit((previous) => {
        if (next.size === ROLE_SIZE) return null;
        return previous?.size === next.size && previous.lineHeight === next.lineHeight ? previous : next;
      });
    };
    measure();

    // Only a change of the line's WIDTH refits: the fit's own height change
    // is the observer's echo, never a reason to measure again.
    let width = element.getBoundingClientRect().width;
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const now = element.getBoundingClientRect().width;
            if (now === width) return;
            width = now;
            measure();
          });
    observer?.observe(element);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [name]);

  return [nameRef, fit];
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
  figuresHref,
  own = false,
  onAvatarChange,
  node,
  children,
}: {
  /** One's own avatar's change badge; absent, no badge is drawn. */
  onAvatarChange?: () => void;
  /** The three record counts; a null count is not drawn, and none at all draws no cell. */
  figures?: Figures | null;
  /** Where each opinion figure opens the opinions page, by its direction; absent, no figure is a door. */
  figuresHref?: (direction: OpinionDirection) => string;
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
  const [nameRef, nameFit] = useNameFit(name);
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
          {own && !redacted && onAvatarChange && (
            <button
              type="button"
              aria-label="Change your picture"
              onClick={onAvatarChange}
              {...testAttributes(part(node, "changeBadge"), "profile-change-badge")}
              // Placed inline, as the master places it: `cg-state` sets
              // `position: relative` outside Tailwind's layers, so an
              // `absolute` utility loses to it and the badge drops below
              // the avatar (measured by the conformance harness).
              style={{ position: "absolute", right: -2, bottom: -2 }}
              className="cg-state cg-focus cg-hit grid size-7 cursor-pointer place-items-center rounded-full border-2 border-solid border-surface bg-secondary-container p-0 text-on-secondary-container"
            >
              <Icon name="photo_camera" size={16} />
            </button>
          )}
        </div>
        <div className={`flex min-w-0 flex-col gap-0.5 self-end [grid-area:name] ${own ? UNDER_OWN_NAME : UNDER_OTHER_NAME}`}>
          <h1
            ref={nameRef}
            {...testAttributes(part(node, "name"), "profile-display-name")}
            style={nameFit === null ? undefined : { fontSize: nameFit.size, lineHeight: `${nameFit.lineHeight}px` }}
            className={`m-0 text-title-large [overflow-wrap:break-word] [word-break:normal] ${redacted ? "text-on-surface-variant" : ""}`}
          >
            {name}
          </h1>
          {/* The handle line is a ONE-LINE PLACE (ProfileHeader.jsx, round 40):
              it never wraps, and a handle too long for it is cut with "…". */}
          {showHandle && !redacted && (
            <span
              {...testAttributes(part(node, "handle"), "profile-handle")}
              className="truncate text-body-small text-on-surface-variant"
            >
              @{handle}
            </span>
          )}
        </div>
        {figuresShown && (
          // The row itself is no target: its two opinion figures are the doors
          // (ProfileHeader.jsx, *The row holds two doors and a fact*).
          <div
            {...testAttributes(part(node, "figures"), "profile-figures")}
            className={`mt-1.5 flex w-fit max-w-full gap-5 self-start text-on-surface [grid-area:figures] ${own ? UNDER_OWN_FIGURES : UNDER_OTHER_FIGURES}`}
          >
            {figures && figures.posts !== null && (
              <Figure value={figures.posts} label="Posts" node={part(node, "figures.posts")} />
            )}
            {figures && figures.opinionsOn !== null && (
              <Figure
                value={figures.opinionsOn}
                label={own ? "Opinions on you" : "Opinions on them"}
                node={part(node, "figures.stancesOn")}
                href={figuresHref?.("on")}
              />
            )}
            {figures && figures.opinionsBy !== null && (
              <Figure
                value={figures.opinionsBy}
                label={own ? "Opinions by you" : "Opinions by them"}
                node={part(node, "figures.stancesTaken")}
                href={figuresHref?.("by")}
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
          <p {...testAttributes(part(node, "bio"), "profile-bio")} className={`m-0 text-body-medium ${WRITTEN}`}>
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

/**
 * The website row: a block in the header's column, so it spans the column's
 * width as the master's row does (ProfileHeader.jsx: no `alignSelf`, the
 * column's stretch), its words in primary.
 */
function Website({ value, node }: { value: string; node?: DataNode }) {
  const href = websiteHref(value);
  const className = "text-body-medium text-primary no-underline [overflow-wrap:anywhere]";
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
