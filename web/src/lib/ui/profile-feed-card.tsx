"use client";

// THE PROFILE CARD — a person met in a feed (`_shared.jsx` `ProfileFeedCard`;
// FeedProfileShapes.md, FeedKinds.md). The top of their profile at card
// scale: the picture beside the name in a title's weight and the handle under
// it, the bio in the quiet colour below — so a person reads as their page
// arriving, never as a text post with only a body. The card opens the
// profile.
//
// THE ROW READS OPINION · SCORE · SHARE (FeedKinds.md): the kind's own act is
// the chat glyph, and its slot waits for chats. The score slot waits with the
// post card's (`post-card.tsx`): no field carries a card's score until the
// ranker's figure reaches the contract.
//
// ITS ⋮ IS THE PROFILE'S OWN MENU, less the share row the row already carries
// (`ProfileMenu`'s `feed` placement).
//
// A DELETED ACCOUNT STILL STANDS (FeedProfileShapes.md): the disc keeps its
// space and fills with nothing, the name's place reads `Deleted account` in
// the system's voice, and no handle and no bio stand under it.

import Link from "next/link";

import { useComfortLine } from "@/lib/saved/comfort-line";
import type { Notify } from "@/lib/saved/save-row";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { ProfileMenu } from "@/lib/ui2/profile-menu";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";
import { Card } from "./card";
import { part, testAttributes, type DataNode } from "./data-node";
import { RowLine } from "./row-line";
import { ScoreSlot } from "@/lib/score/score-slot";
import type { TraceOrigin } from "@/lib/score/trace-session";
import { personCover } from "@/lib/score/cover";
import { ShareButton } from "./share-button";
import { StanceControl } from "./stance-control";

type Moderated = { readonly value: string | null; readonly status: string } | null;

/** The person the card draws — the profile read's own fields. */
export type ProfileCardPerson = {
  readonly id: string;
  readonly handle: string;
  readonly displayName: Moderated;
  readonly bio: Moderated;
  readonly avatar: { readonly url: string; readonly status: string } | null;
  readonly viewerBookmarkedAt?: string | null;
};

function shown(field: Moderated): string | null {
  if (field === null || field.status === "REDACTED") return null;
  const value = field.value?.trim() ?? "";
  return value === "" ? null : value;
}

export function ProfileFeedCard({
  person,
  href,
  testId,
  node,
  onNotify,
  onLinkCopied,
  scoreOrigin,
}: {
  person: ProfileCardPerson;
  /** Where the card stands, for its score slot's trace; absent, no score is drawn. */
  scoreOrigin?: TraceOrigin;
  /** The profile's own route, with the origin its back arrow names. */
  href: string;
  testId: string;
  /** The registered card (`saved.profileCard`); its parts carry the design's ids. */
  node?: DataNode;
  /** The host's snackbar, for the menu's aftermath. */
  onNotify: Notify;
  onLinkCopied: () => void;
}) {
  const viewerId = useActiveAccountId();
  const signedIn = useAuthPhase() === "signedIn";
  const comfort = useComfortLine(person.id);
  const deleted = person.displayName?.status === "REDACTED";
  const name = deleted ? REDACTED_ACTOR_NAME : (shown(person.displayName) ?? person.handle);
  const bio = deleted ? null : shown(person.bio);
  const avatar = person.avatar !== null && person.avatar.status !== "REDACTED" ? person.avatar.url : null;
  const label = deleted ? "this account" : `@${person.handle}`;

  return (
    <Card testId={testId} node={node}>
      <div className="flex items-center justify-between gap-2">
        {/* THE CARD OPENS THE PROFILE: one link over the face, so there is one
            tab stop to it; the row and the ⋮ keep their own meanings. */}
        <Link href={href} data-testid={`${testId}-link`} className="flex min-w-0 items-center gap-4">
          <MonogramAvatar
            name={name}
            src={avatar}
            size={56}
            redacted={deleted}
            node={part(node, "avatar")}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              {...testAttributes(part(node, "name"), `${testId}-name`)}
              className={`truncate text-title-medium ${deleted ? "text-on-surface-variant" : ""}`}
            >
              {name}
            </span>
            {!deleted && (
              <span
                {...testAttributes(part(node, "handle"), `${testId}-handle`)}
                className="truncate text-body-small text-on-surface-variant"
              >
                @{person.handle}
              </span>
            )}
          </span>
        </Link>
        <div className="flex flex-none items-center">
          <ProfileMenu
            kind={deleted ? "deleted" : viewerId === person.id ? "own" : "other"}
            profile={person}
            signedIn={signedIn}
            notify={onNotify}
            feed={{ trigger: part(node, "menu"), testId: `${testId}-menu` }}
          />
        </div>
      </div>
      {bio !== null && (
        <p
          {...testAttributes(part(node, "bio"), `${testId}-bio`)}
          className="line-clamp-2 text-body-medium text-on-surface-variant"
        >
          {bio}
        </p>
      )}
      <div
        {...testAttributes(part(node, "actionRow"), `${testId}-affordances`)}
        className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2"
      >
        <StanceControl
          target={{ id: person.id, kind: "profile", label }}
          testIdPrefix={`${testId}-stance`}
          node={part(node, "actionRow.stance")}
        />
        {/* OPINION, THEN THE SCORE, THEN SHARE (FeedKinds.md:5): the act's slot waits for chats. */}
        {scoreOrigin !== undefined && (
          <ScoreSlot
            targetId={person.id}
            kind="person"
            pending={false}
            cover={() =>
              personCover({ handle: person.handle, displayName: { value: name }, avatar: avatar === null ? null : { url: avatar } })
            }
            origin={scoreOrigin}
            node={part(node, "actionRow.score")}
            testId={`${testId}-score`}
          />
        )}
        <ShareButton
          href={`/u/${person.handle}`}
          targetLabel={label}
          onCopied={onLinkCopied}
          testId={`${testId}-share`}
          node={part(node, "actionRow.share")}
        />
      </div>
      {/* THE ROW LINE, under the face (RowSigning.md): a save or unsave of this
          person that did not go through. */}
      {comfort !== null && <RowLine state={comfort} testId={`${testId}-row-line`} />}
    </Card>
  );
}
