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
// it gets is read off the node's own mark (`removal.by`, api-spec.md
// `Post.removal`): a passed moderation verdict reads as the platform's rules,
// an author's removal and their account sweep both read as the author's. Where
// a node carries no mark — a single redacted asset, say — the record's
// `ILLEGAL` verdict is the only reading left, and getting it wrong in the other
// direction (an author's choice shown as a platform verdict) is the worse error.

import type React from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";
import { ladderAge } from "@/lib/ui/timestamp";
import { parseAspectRatio, tileRatio } from "@/lib/ui2/media/aspect";
import { BodyVeil, type VeilFace, type VeilSource } from "@/lib/ui2/media/body-veil";
import { MediaGallery, type GalleryItem, type PlayerSurface } from "@/lib/ui2/media/media-gallery";
import { RemovedPlaceholder, type RemovalReason } from "@/lib/ui2/media/removed-placeholder";
import { useAlwaysUnveil } from "@/lib/settings/sensitive-content";
import { rememberReveal, sensitiveSignature, useRevealed } from "@/lib/ui2/media/reveal";

type Attachment = {
  id: string;
  url: string;
  altText?: string | null;
  status: string;
  /**
   * THE CONTRACT'S `String!`, TYPED AS ONE. Every read that carries a
   * gallery selects it, and typing it optional let an omitted selection
   * reach here as `undefined` — which draws an image tile where a player
   * belongs, silently, on exactly the read that forgot the field. Non-null
   * makes that a compile error at the query boundary instead.
   */
  mimeType: string;
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
  /** The node's mark (`Post.removal` / `Comment.removal`); null while it stands. */
  removal?: { readonly at: string; readonly by: string } | null;
};

/** What the mark's wording and date read: the node's mark and its verdict. */
type Marked = Pick<Bearer, "moderationStatus" | "removal">;

/** A bearer plus the authored text fields, which carry their own statuses. */
type Payload = Bearer & {
  title?: { status: string } | null;
  description?: { status: string } | null;
  content?: { status: string } | null;
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

/**
 * Whether the record's payload has been removed.
 *
 * REDACTION IS RECORD-GRANULAR (design/components/content/PostCard.prompt.md,
 * "`redacted` renders the skeleton, not a field"):
 * an illegal verdict removes the payload, so title, description, body, media
 * and the license go at once. There is no redacted title beside a surviving
 * body, and no field is veiled or blanked on its own — the card draws the
 * skeleton instead. Any field answering REDACTED therefore says the whole
 * payload is gone — and so does the node's own mark, which a surface holding
 * the node patches in the moment a removal is taken, before any field is
 * re-read (`withRemoval`).
 */
export function payloadIsRedacted(node: Payload): boolean {
  return (
    (node.removal !== null && node.removal !== undefined) ||
    galleryIsRedacted(node) ||
    node.title?.status === "REDACTED" ||
    node.description?.status === "REDACTED" ||
    node.content?.status === "REDACTED"
  );
}

/** Whether the body region is veiled — one state for media, words and description. */
export function bodyIsSensitive(node: Bearer): boolean {
  return node.attachmentsStatus === "SENSITIVE" || node.moderationStatus === "SENSITIVE";
}

/** What says whose mark a veil is: the author's mark alone, and the author's own line. */
type Sourced = { sensitiveSelfMark?: boolean | null; sensitiveReason?: string | null };

/**
 * WHOSE MARK THE VEIL IS (Q47; LadderStates.md). Every SENSITIVE status is the
 * OR of the author's mark and a moderator's verdict, so no status can say which
 * one a reader met; `sensitiveSelfMark` is the author's mark alone (api-spec.md,
 * "Content authoring"). Where it stands, the veil is the author's warning; a
 * sensitive node without it can only be the platform's verdict.
 *
 * BOTH MAY STAND AT ONCE, and the line then names both (round 27,
 * `veilSourceLine`'s `both`) — but nothing on the wire says a verdict ALSO
 * stands beside the author's mark until the `sensitiveSource` ask lands
 * (seam 253, contract bite B-C1). Until then this reads the author's line
 * alone, as the ruling says, and never answers `both`.
 */
export function veilSource(node: Sourced): VeilSource {
  return node.sensitiveSelfMark === true ? "author" : "platform";
}

/**
 * The reason the veil carries after its source, where there is one: the
 * author's own line (`sensitiveReason`), which rides only their own mark — a
 * verdict reads none. A blank reason is no reason.
 */
export function veilReason(node: Sourced): string | null {
  const reason = node.sensitiveReason?.trim() ?? "";
  return node.sensitiveSelfMark === true && reason !== "" ? reason : null;
}

/**
 * Which wording the mark takes. `removal.by` is the data: MODERATION is the
 * platform's verdict, and AUTHOR and ACCOUNT are both the author's
 * (api-spec.md `RemovalAgent` — "AUTHOR and ACCOUNT both read `Removed by its
 * author`; the data keeps them distinct"). No other branch is taken on `by`.
 */
export function removalReason(node: Marked): RemovalReason {
  if (node.removal !== null && node.removal !== undefined) {
    return node.removal.by === "MODERATION" ? "platform" : "author";
  }
  return node.moderationStatus === "ILLEGAL" ? "platform" : "author";
}

/**
 * The mark's `when`: the removal's own moment in the one age ladder
 * (copy-voice *Ages*; backlog item 45), never the content's age. Undefined
 * where the node carries no mark to date.
 */
export function removalWhen(node: Marked, now: number = Date.now()): string | undefined {
  return node.removal === null || node.removal === undefined
    ? undefined
    : ladderAge(node.removal.at, now);
}

/** Whether a node's gallery is the moving kind — one clip rather than pictures. */
export function hasVideo(node: Bearer): boolean {
  return node.attachments.some((attachment) => attachment.mimeType.startsWith("video/"));
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
      // The clip's identity in the session's clip memory: the record's own
      // attachment id, so one clip shown on a card, in the detail and in the
      // viewer is one clip (`clip-memory.ts`).
      mediaId: attachment.id,
      // A picture the author left undescribed is DECORATIVE to a screen reader,
      // not "image": an empty alt is the documented way to say "skip this", and
      // inventing a description would be worse than saying nothing.
      altText: attachment.altText ?? null,
      sourceRatio: ratio,
      mimeType: attachment.mimeType,
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
  fit,
  maxHeight,
  preloadLead = false,
  surface = "full",
  onOpen,
  dataNode,
}: {
  node: Bearer;
  /**
   * The registered media node (`….media`): it names the wrapper instead of
   * `testId`, and each picture is its `frame`, keyed by its position from 1.
   */
  dataNode?: DataNode;
  /** `reading` is the comment's form — one sound control, no transport bar. */
  surface?: PlayerSurface;
  testId?: string;
  bleed?: Bleed;
  // A comment's pictures are an attachment rather than a body, so they keep the
  // card's rung and a comment-scale cap instead of running to the edges.
  radius?: string;
  ratio?: number;
  /** Overrides the frame's own crop-fitting — see `MediaGallery`'s `fit`. */
  fit?: "contain" | "cover";
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
    <div {...testAttributes(dataNode, testId)} className={BLEED[bleed]}>
      {galleryIsRedacted(node) ? (
        <RemovedPlaceholder reason={removalReason(node)} />
      ) : (
        <MediaGallery
          node={dataNode}
          items={galleryItems(node)}
          radius={radius ?? "0px"}
          ratio={ratio}
          fit={fit}
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
 *
 * THE ACCOUNT'S CHOICE COMES FIRST. This is the one place every body veil
 * passes through — the feed's card, the detail and its pinned clip, the
 * comments sheet — so the veil's predicate is answered here: veiled = the
 * node is sensitive AND the account does not always unveil (settings packet
 * §3.1a; `settings/sensitive-content.ts`). An account that chose `Always
 * unveil sensitive content` reads the body as if it bore no mark.
 */
export function BodyRegion({
  children,
  veiled,
  marks,
  face = "media",
  named = true,
  testId,
  nodeId,
  signature,
}: {
  children: React.ReactNode;
  veiled: boolean;
  /**
   * The node whose mark the veil is — the author's mark alone and the
   * author's line (`veilSource`, `veilReason`): every face names its source,
   * the reason after it where there is one (LadderStates.md, round 26).
   */
  marks?: { sensitiveSelfMark?: boolean | null; sensitiveReason?: string | null };
  /** The face the host's master draws (`SensitiveVeil` `kind`; `BodyVeil`). */
  face?: VeilFace;
  /** A text face names the source only as the post's only face (`BodyVeil`). */
  named?: boolean;
  testId?: string;
  /** The node the decision is about. */
  nodeId?: string;
  /** Its sensitive state, so an old reveal does not cover a new mark. */
  signature?: string;
}) {
  return (
    <VeilPart veiled={veiled} marks={marks} face={face} named={named} testId={testId} nodeId={nodeId} signature={signature}>
      <div className="flex flex-col gap-2">{children}</div>
    </VeilPart>
  );
}

/**
 * ONE PART of a body that veils as one — the media under its face, or one
 * paragraph blurred in place with its `Show` (`PostCard.jsx`: the media's
 * `SensitiveVeil kind="media"`, each caption paragraph's `kind="text"`, all
 * inside one `SensitiveScope`). Every part of a node keys the same reveal
 * (`nodeId` + `signature`, `reveal.ts`), so one tap on any of them lifts
 * them all: one decision, however many faces stand (readme §9; seam 253,
 * the caption veil). It draws no box of its own, so the part lays out where
 * its host puts it, veiled or not.
 */
export function VeilPart({
  children,
  veiled,
  marks,
  face = "media",
  named = true,
  testId,
  nodeId,
  signature,
}: {
  children: React.ReactNode;
  veiled: boolean;
  /** The node whose mark the veil is (`BodyRegion`). */
  marks?: { sensitiveSelfMark?: boolean | null; sensitiveReason?: string | null };
  face?: VeilFace;
  /** A text face names the source only as the post's only face (`BodyVeil`). */
  named?: boolean;
  testId?: string;
  nodeId?: string;
  signature?: string;
}) {
  const alwaysUnveil = useAlwaysUnveil();
  if (!veiled || alwaysUnveil) return <>{children}</>;
  return (
    <SharedVeil
      nodeId={nodeId}
      signature={signature}
      source={veilSource(marks ?? {})}
      reason={veilReason(marks ?? {})}
      face={face}
      named={named}
      testId={testId}
    >
      {children}
    </SharedVeil>
  );
}

function SharedVeil({
  children,
  nodeId,
  signature,
  source,
  reason,
  face,
  named,
  testId,
}: {
  children: React.ReactNode;
  nodeId?: string;
  signature?: string;
  source: VeilSource;
  reason: string | null;
  face: VeilFace;
  named: boolean;
  testId?: string;
}) {
  const shared = nodeId !== undefined && signature !== undefined;
  // Subscribed rather than read: the reveal belongs to the node, so every
  // mounted surface showing it lifts its veil together. An unshared veil still
  // has to call the hook — the empty key never matches a remembered reveal.
  const revealed = useRevealed(nodeId ?? "", signature ?? "");
  const veilId = testId ? `${testId}-veil` : undefined;
  const faceProps = { source, reason, face, named, testId: veilId, radius: face === "media" ? "0px" : undefined };

  if (!shared) {
    return <BodyVeil {...faceProps}>{children}</BodyVeil>;
  }

  return (
    <BodyVeil
      {...faceProps}
      revealed={revealed}
      onReveal={() => {
        rememberReveal(nodeId, signature);
      }}
    >
      {children}
    </BodyVeil>
  );
}

/** Re-exported so a caller reading one attachment does not import three modules. */
export { tileRatio, sensitiveSignature };
