// The media half of a post or comment, shared by the feed card and the detail
// view so both render one gallery rather than two.
//
// THIS IS THE MEDIA-FORCED CHANGE TO THE 1.0 CARD, and no more than that. The
// full card redesign is a later pass; what media itself forces is exactly
// three things:
//
//  · the gallery runs FULL-BLEED to the card's edges, because it is the body
//    and a body inset by 16px reads as an illustration;
//  · the TITLE moves above it, because a title under a picture reads as a
//    caption — and the description under it then reads as a second caption;
//  · the body region — media, words and description together — is what the
//    sensitive veil covers, with the title outside it (D12).
//
// A REDACTED gallery renders the placeholder instead. Which of the two wordings
// it gets is read off the record: a post carrying an `ILLEGAL` verdict was
// removed under the platform's rules, and a redaction without one is the
// author's own. The contract states no removal reason on the asset itself, so
// this is the only honest reading available — and getting it wrong in the other
// direction (an author's choice shown as a platform verdict) is the worse error.

import type React from "react";
import { useState } from "react";

import {
  fitFor,
  parseAspectRatio,
  tileRatio,
} from "@/lib/ui2/media/aspect";
import { BodyVeil } from "@/lib/ui2/media/body-veil";
import { MediaGallery, type GalleryItem, type PlayerSurface } from "@/lib/ui2/media/media-gallery";
import { RemovedPlaceholder, type RemovalReason } from "@/lib/ui2/media/removed-placeholder";
import { isRevealed, rememberReveal, sensitiveSignature } from "@/lib/ui2/media/reveal";

type Attachment = {
  id: string;
  url: string;
  altText?: string | null;
  status: string;
  mimeType?: string | null;
  options: { aspectRatio?: string | null; durationMs?: number | null };
  coverMedia?: {
    url: string;
    status: string;
    options?: { aspectRatio?: string | null } | null;
  } | null;
};

type Bearer = {
  attachments: readonly Attachment[];
  attachmentsStatus: string;
  moderationStatus?: string;
};

export function hasMedia(node: Bearer): boolean {
  return node.attachments.length > 0;
}

export function galleryIsRedacted(node: Bearer): boolean {
  return (
    node.attachmentsStatus === "REDACTED" ||
    node.attachments.some((attachment) => attachment.status === "REDACTED")
  );
}

/** Whether the body region is veiled — one state for media, words and description. */
export function bodyIsSensitive(node: Bearer): boolean {
  return node.attachmentsStatus === "SENSITIVE" || node.moderationStatus === "SENSITIVE";
}

export function removalReason(node: Bearer): RemovalReason {
  return node.moderationStatus === "ILLEGAL" ? "platform" : "author";
}

/** Whether a node's gallery is the moving kind — one clip rather than pictures. */
export function commentHasVideo(node: Bearer): boolean {
  return node.attachments.some((attachment) =>
    (attachment.mimeType ?? "").startsWith("video/"),
  );
}

/**
 * A video's poster, or null.
 *
 * A REDACTED COVER IS NOT A POSTER. The cover answers with its own `status`, so
 * a removed still says so here exactly as it would anywhere else — and the
 * honest rendering is no poster at all: the player's reserved surface shows
 * until the first frame decodes, and the video itself, which was not removed,
 * plays untouched. Standing a "Removed" card over a working video would report
 * the wrong thing removed.
 */
export function posterFor(attachment: Attachment): string | null {
  const cover = attachment.coverMedia;
  if (!cover || cover.status === "REDACTED") return null;
  return cover.url;
}

export function galleryItems(node: Bearer): readonly GalleryItem[] {
  return node.attachments.map((attachment) => {
    const ratio = parseAspectRatio(attachment.options.aspectRatio);
    return {
      src: attachment.url,
      // A picture the author left undescribed is DECORATIVE to a screen reader,
      // not "image": an empty alt is the documented way to say "skip this", and
      // inventing a description would be worse than saying nothing.
      altText: attachment.altText ?? null,
      sourceRatio: ratio,
      mimeType: attachment.mimeType ?? null,
      poster: posterFor(attachment),
      durationMs: attachment.options.durationMs ?? null,
    };
  });
}

// How far the gallery has to reach to meet its container's edges. The `Card`
// pads 16px on every side and the detail page pads 24px, so full-bleed is a
// different negative margin on each — stated by the caller rather than guessed,
// because a wrong guess shows as a visible sliver of background.
const BLEED = {
  card: "-mx-4",
  page: "-mx-6",
  none: "",
} as const;

export type Bleed = keyof typeof BLEED;

/**
 * The gallery, run out to its container's edges.
 *
 * The radius drops to zero along with the inset: the media meets the card's
 * straight sides and never its corners, so there is nothing to round.
 */
export function PostMedia({
  node,
  testId,
  bleed = "card",
  radius,
  ratio,
  maxHeight,
  preloadLead = false,
  surface = "full",
  onOpen,
}: {
  node: Bearer;
  /** `reading` is the comment's form — one sound control, no transport bar. */
  surface?: PlayerSurface;
  testId?: string;
  bleed?: Bleed;
  // A comment's pictures are an attachment rather than a body, so they keep the
  // card's rung and a comment-scale cap instead of running to the edges.
  radius?: string;
  ratio?: number;
  maxHeight?: string;
  preloadLead?: boolean;
  onOpen?: (index: number) => void;
}) {
  if (!hasMedia(node)) return null;

  // The test id lives on the bleed wrapper rather than being handed down: a
  // one-picture gallery renders a bare tile with no wrapper of its own, so a
  // caller asking "is there media here" would find nothing for exactly the
  // commonest case.
  return (
    <div data-testid={testId} className={BLEED[bleed]}>
      {galleryIsRedacted(node) ? (
        <RemovedPlaceholder reason={removalReason(node)} />
      ) : (
        <MediaGallery
          items={galleryItems(node)}
          radius={radius ?? "0px"}
          ratio={ratio}
          maxHeight={maxHeight}
          preloadLead={preloadLead}
          surface={surface}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

/**
 * The body region — everything one reveal answers for.
 *
 * It exists as a component rather than an inline conditional because BOTH
 * branches have to lay their children out identically: revealing must not move
 * anything on screen, and a veil that also changed the gap would do exactly
 * that.
 *
 * The decision itself is NOT held here. It belongs to the node, not to the
 * component that happens to be drawing it, so a reveal in the feed is already
 * answered on the detail page and a change to the node's mark takes it back
 * (see `reveal.ts`). A caller that names no node keeps the old lone-body
 * behaviour, which is what the design-system gallery wants.
 */
export function BodyRegion({
  children,
  veiled,
  reason,
  testId,
  nodeId,
  signature,
}: {
  children: React.ReactNode;
  veiled: boolean;
  reason?: string | null;
  testId?: string;
  /** The node the decision is about. */
  nodeId?: string;
  /** Its sensitive state, so an old reveal does not cover a new mark. */
  signature?: string;
}) {
  const body = <div className="flex flex-col gap-2">{children}</div>;
  if (!veiled) return body;
  return (
    <SharedVeil nodeId={nodeId} signature={signature} reason={reason} testId={testId}>
      {body}
    </SharedVeil>
  );
}

function SharedVeil({
  children,
  nodeId,
  signature,
  reason,
  testId,
}: {
  children: React.ReactNode;
  nodeId?: string;
  signature?: string;
  reason?: string | null;
  testId?: string;
}) {
  const shared = nodeId !== undefined && signature !== undefined;
  // The store is not React state, so a reveal made here has to be turned into
  // a render. The counter is that, and nothing else reads it.
  const [, bump] = useState(0);
  const veilId = testId ? `${testId}-veil` : undefined;

  if (!shared) {
    return (
      <BodyVeil radius="0px" reason={reason} testId={veilId}>
        {children}
      </BodyVeil>
    );
  }

  return (
    <BodyVeil
      radius="0px"
      reason={reason}
      testId={veilId}
      revealed={isRevealed(nodeId, signature)}
      onReveal={() => {
        rememberReveal(nodeId, signature);
        bump((n) => n + 1);
      }}
    >
      {children}
    </BodyVeil>
  );
}

/** Re-exported so a caller reading one attachment does not import three modules. */
export { fitFor, tileRatio, sensitiveSignature };
