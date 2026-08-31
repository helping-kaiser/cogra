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

import { CENTERED } from "@/lib/ui2/media/crop";
import type { AssetUpload, PickedAsset } from "./wizard";

/** D9(ii): four per comment, checked whole before anything is staged. */
export const COMMENT_ATTACHMENT_CAP = 4;

export type CommentMedia = readonly PickedAsset[];

export const NO_COMMENT_MEDIA: CommentMedia = [];

/**
 * Add picked files, up to the cap.
 *
 * The cap is enforced on the way IN rather than at the seal: telling a reader
 * their fifth picture was one too many after it has uploaded wastes the upload
 * and the wait, and the server refuses the whole batch anyway.
 */
export function pickInto(
  current: CommentMedia,
  picked: readonly { id: string; file: Blob }[],
): CommentMedia {
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
export function commentGate(words: string, media: CommentMedia): Gate {
  if (words.trim() === "") return { ok: false, reason: "A comment needs words." };
  if (media.length > COMMENT_ATTACHMENT_CAP) {
    return { ok: false, reason: `A comment carries at most ${COMMENT_ATTACHMENT_CAP} pictures.` };
  }
  const failed = uploadsFailed(media);
  if (failed > 0) {
    return {
      ok: false,
      reason: failed === 1 ? "One picture didn't upload." : `${failed} pictures didn't upload.`,
    };
  }
  const pending = uploadsPending(media);
  if (pending > 0) {
    return {
      ok: false,
      reason:
        pending === 1 ? "One picture is still uploading." : `${pending} pictures are still uploading.`,
    };
  }
  return ALLOWED;
}

/** The gallery in order, or null while any picture is still unresolved. */
export function commentAttachmentIds(media: CommentMedia): readonly string[] | null {
  if (media.length === 0) return null;
  const ids: string[] = [];
  for (const asset of media) {
    if (asset.upload.kind !== "done") return null;
    ids.push(asset.upload.mediaId);
  }
  return ids;
}
