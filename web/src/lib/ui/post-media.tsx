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

import {
  fitFor,
  parseAspectRatio,
  tileRatio,
} from "@/lib/ui2/media/aspect";
import { BodyVeil } from "@/lib/ui2/media/body-veil";
import { MediaGallery, type GalleryItem } from "@/lib/ui2/media/media-gallery";
import { RemovedPlaceholder, type RemovalReason } from "@/lib/ui2/media/removed-placeholder";

type Attachment = {
  id: string;
  url: string;
  altText?: string | null;
  status: string;
  options: { aspectRatio?: string | null };
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
  preloadLead = false,
  onOpen,
}: {
  node: Bearer;
  testId?: string;
  bleed?: Bleed;
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
          radius="0px"
          preloadLead={preloadLead}
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
 */
export function BodyRegion({
  children,
  veiled,
  reason,
  testId,
}: {
  children: React.ReactNode;
  veiled: boolean;
  reason?: string | null;
  testId?: string;
}) {
  const body = <div className="flex flex-col gap-2">{children}</div>;
  return veiled ? (
    <BodyVeil radius="0px" reason={reason} testId={testId ? `${testId}-veil` : undefined}>
      {body}
    </BodyVeil>
  ) : (
    body
  );
}

/** Re-exported so a caller reading one attachment does not import three modules. */
export { fitFor, tileRatio };
