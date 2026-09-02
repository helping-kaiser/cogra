// A comment's pictures — the model behind the reply composer's media row.
//
// A COMMENT IS NOT A SMALL POST, and the differences are the whole reason this
// is its own module rather than a narrower `WizardState`:
//
//  · a comment is words PLUS optional pictures, never the post's words-XOR-media
//    (D16), so there is no mode to switch and no body gate to pass;
//  · there is NO CROP STEP — the boards give comments no crop screen at all, so
//    every picture keeps its own shape and uploads AT PICK rather than after a
//    framing the reader never does ("they upload while you write");
//  · the cap is four, not ten (D9(ii)) — a comment's gallery is a supporting
//    picture, not an album.
//
// The picked asset itself is the wizard's `PickedAsset`, unchanged: the upload
// states, the retry story, and `runUpload` are the same on both surfaces, and a
// second nearly-identical asset type would be two places to fix one bug. The
// crop it carries is simply never framed, which is exactly what "no crop step"
// means — `encodeForUpload` then keeps the source's own shape.

import type { GalleryEntryDraft } from "@/lib/api/content-api";
import { CENTERED } from "@/lib/ui2/media/crop";
import { kindOf, type AssetUpload, type CoverAsset, type MediaKind, type PickedAsset } from "./wizard";

/** D9(ii): four per comment, checked whole before anything is staged. */
export const COMMENT_ATTACHMENT_CAP = 4;

export type CommentMedia = readonly PickedAsset[];

export const NO_COMMENT_MEDIA: CommentMedia = [];

/**
 * Whether the comment's body is the moving kind.
 *
 * A COMMENT'S GRAMMAR IS THE POST'S AT COMMENT CAPS (design/backlog.md item
 * 31): four pictures OR one video with its cover, never both. The cover is not
 * an attachment here either — it reaches the reader through the video's own
 * `coverMedia`, so it never enters the gallery or the description count.
 */
export function isVideoComment(media: CommentMedia): boolean {
  const first = media[0];
  return first !== undefined && kindOf(first) === "video";
}

/**
 * Add picked files, up to the cap.
 *
 * The cap is enforced on the way IN rather than at the seal: telling a reader
 * their fifth picture was one too many after it has uploaded wastes the upload
 * and the wait, and the server refuses the whole batch anyway.
 */
export function pickInto(
  current: CommentMedia,
  picked: readonly { id: string; file: Blob; kind?: MediaKind }[],
): CommentMedia {
  // A VIDEO TAKES THE BODY WHOLE, so it may only arrive into an empty one and
  // brings no room for anything beside it. The screening refuses a mixed batch
  // before it reaches here; this is the guard that makes it impossible.
  if (isVideoComment(current)) return current;
  const video = picked.find((one) => (one.kind ?? "picture") === "video");
  if (video !== undefined) {
    if (current.length > 0) return current;
    return [
      {
        id: video.id,
        file: video.file,
        crop: CENTERED,
        altText: "",
        upload: { kind: "waiting" } as AssetUpload,
        kind: "video" as MediaKind,
      },
    ];
  }

  const room = COMMENT_ATTACHMENT_CAP - current.length;
  if (room <= 0) return current;
  const added = picked.slice(0, room).map((one) => ({
    id: one.id,
    file: one.file,
    // Never framed: a comment has no crop step, so the encoder keeps the
    // picture's own shape.
    crop: CENTERED,
    altText: "",
    upload: { kind: "waiting" } as AssetUpload,
    kind: "picture" as MediaKind,
  }));
  return [...current, ...added];
}

export function removeFrom(current: CommentMedia, id: string): CommentMedia {
  return current.filter((asset) => asset.id !== id);
}

export function withUpload(
  current: CommentMedia,
  id: string,
  upload: AssetUpload,
): CommentMedia {
  return current.map((asset) => (asset.id === id ? { ...asset, upload } : asset));
}

export function uploadsPending(media: CommentMedia): number {
  return media.filter(
    (asset) =>
      asset.upload.kind === "waiting" ||
      asset.upload.kind === "encoding" ||
      asset.upload.kind === "uploading",
  ).length;
}

export function uploadsFailed(media: CommentMedia): number {
  return media.filter((asset) => asset.upload.kind === "failed").length;
}

export type Gate = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const ALLOWED: Gate = { ok: true };

/**
 * Whether the comment can be signed.
 *
 * An attachment names an asset id, so a comment cannot be prepared while a
 * picture is still on its way — and saying so plainly beats a button that
 * refuses for a reason the reader cannot see. Words alone are always fine: the
 * pictures are the optional half.
 */
export function commentGate(
  words: string,
  media: CommentMedia,
  /** The video's face, which must land before the video can name it. */
  cover: CoverAsset | null = null,
): Gate {
  if (words.trim() === "") return { ok: false, reason: "A comment needs words." };
  if (media.length > COMMENT_ATTACHMENT_CAP) {
    return { ok: false, reason: `A comment carries at most ${COMMENT_ATTACHMENT_CAP} pictures.` };
  }
  const video = isVideoComment(media);
  if (video && cover === null) {
    return { ok: false, reason: "Choose a frame, or a picture of your own." };
  }
  // The cover counts among what the seal waits for, though it is no
  // attachment: the video cannot be created without it.
  const uploads = cover === null ? media.map((a) => a.upload) : [...media.map((a) => a.upload), cover.upload];
  const failed = uploads.filter((u) => u.kind === "failed").length;
  if (failed > 0) {
    return {
      ok: false,
      reason: video
        ? "The video didn't upload."
        : failed === 1
          ? "One picture didn't upload."
          : `${failed} pictures didn't upload.`,
    };
  }
  const pending = uploads.filter(
    (u) => u.kind === "waiting" || u.kind === "encoding" || u.kind === "uploading",
  ).length;
  if (pending > 0) {
    return {
      ok: false,
      reason: video
        ? "The video is still uploading."
        : pending === 1
          ? "One picture is still uploading."
          : `${pending} pictures are still uploading.`,
    };
  }
  return ALLOWED;
}

/** The gallery in order, or null while any picture is still unresolved. */
export function commentAttachmentClaims(media: CommentMedia): readonly GalleryEntryDraft[] | null {
  if (media.length === 0) return null;
  const claims: GalleryEntryDraft[] = [];
  for (const asset of media) {
    if (asset.upload.kind !== "done") return null;
    // Blank is not a description: a decorative picture carries null so a
    // screen reader is told "no description" rather than "described as
    // nothing".
    claims.push({
      mediaId: asset.upload.mediaId,
      altText: asset.altText.trim() === "" ? null : asset.altText.trim(),
    });
  }
  return claims;
}
