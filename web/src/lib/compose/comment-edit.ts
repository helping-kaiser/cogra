// A comment edit's gallery — design/designs/canonical/CommentEdit.
//
// AN EDIT'S PICTURES ARE NOT A COMPOSE'S, and that is why this is its own model
// rather than `CommentMedia`. A composer starts from nothing and every picture
// is bytes on their way up; an editor starts from pictures that are ALREADY on
// the server, with ids and URLs and no local blob at all. Faking a blob for
// those would put a lie in the one place the gallery is read from, so the two
// kinds are named instead: a picture is KEPT or it is ADDED.
//
// THE GALLERY IS COMPLETE STATE, like the body and the mark. What this model
// produces is the gallery the edit LEAVES STANDING — never a delta — so
// removing the last picture sends an empty gallery rather than nothing.

import type { GalleryEntryDraft } from "@/lib/api/content-api";
import { CENTERED } from "@/lib/ui2/media/crop";
import { COMMENT_ATTACHMENT_CAP } from "./comment-media";
import type { PickedAsset } from "./wizard";

export type EditPicture =
  /** Already on the server when the editor opened; its bytes never move. */
  | { readonly kind: "kept"; readonly mediaId: string; readonly url: string; readonly altText: string }
  /** Chosen in this editor; it uploads like any other comment picture. */
  | { readonly kind: "added"; readonly asset: PickedAsset };

export type EditGallery = readonly EditPicture[];

/** Each picture's own handle, whichever kind it is. */
export function pictureId(picture: EditPicture): string {
  return picture.kind === "kept" ? picture.mediaId : picture.asset.id;
}

export function pictureAltText(picture: EditPicture): string {
  return picture.kind === "kept" ? picture.altText : picture.asset.altText;
}

/** The gallery the comment arrived with, in the author's order. */
export function galleryOf(
  attachments: readonly { id: string; url: string; altText?: string | null }[],
): EditGallery {
  return attachments.map((attachment) => ({
    kind: "kept" as const,
    mediaId: attachment.id,
    url: attachment.url,
    altText: attachment.altText ?? "",
  }));
}

export function addTo(
  gallery: EditGallery,
  picked: readonly { id: string; file: Blob }[],
): EditGallery {
  const room = COMMENT_ATTACHMENT_CAP - gallery.length;
  if (room <= 0) return gallery;
  const added = picked.slice(0, room).map((one) => ({
    kind: "added" as const,
    asset: {
      id: one.id,
      file: one.file,
      // Never framed: a comment has no crop step, on the editor as on the
      // composer, so the encoder keeps the picture's own shape.
      crop: CENTERED,
      altText: "",
      upload: { kind: "waiting" } as PickedAsset["upload"],
    },
  }));
  return [...gallery, ...added];
}

export function removeFrom(gallery: EditGallery, id: string): EditGallery {
  return gallery.filter((picture) => pictureId(picture) !== id);
}

export function withAltText(gallery: EditGallery, id: string, altText: string): EditGallery {
  return gallery.map((picture) => {
    if (pictureId(picture) !== id) return picture;
    return picture.kind === "kept"
      ? { ...picture, altText }
      : { ...picture, asset: { ...picture.asset, altText } };
  });
}

export function withUpload(
  gallery: EditGallery,
  id: string,
  upload: PickedAsset["upload"],
): EditGallery {
  return gallery.map((picture) =>
    picture.kind === "added" && picture.asset.id === id
      ? { ...picture, asset: { ...picture.asset, upload } }
      : picture,
  );
}

/**
 * What to draw for the pictures already on the server: their served URLs.
 * The added ones get object URLs from the preview hook instead, and the two
 * maps are merged by the caller — one lookup, whichever kind a picture is.
 */
export function keptPreviews(gallery: EditGallery): Readonly<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const picture of gallery) {
    if (picture.kind === "kept") urls[picture.mediaId] = picture.url;
  }
  return urls;
}

/**
 * Why the edit cannot be signed yet, or null. Only the ADDED pictures can
 * hold it up: an attachment names an asset id, and one that is still
 * uploading has none yet.
 */
export function editBlocked(gallery: EditGallery): string | null {
  const failed = uploadsFailed(gallery);
  if (failed > 0) {
    return failed === 1 ? "One picture didn't upload." : `${failed} pictures didn't upload.`;
  }
  const pending = uploadsPending(gallery);
  if (pending > 0) {
    return pending === 1
      ? "One picture is still uploading."
      : `${pending} pictures are still uploading.`;
  }
  return null;
}

/**
 * Just the added pictures' assets — what the uploader and the preview hook
 * take. The kept ones have no local bytes and nothing to upload.
 */
export function addedAssets(gallery: EditGallery): readonly PickedAsset[] {
  return gallery.flatMap((picture) => (picture.kind === "added" ? [picture.asset] : []));
}

/** The pictures still on their way up — the ones the seal would wait for. */
export function uploadsPending(gallery: EditGallery): number {
  return gallery.filter(
    (picture) =>
      picture.kind === "added" &&
      (picture.asset.upload.kind === "waiting" ||
        picture.asset.upload.kind === "encoding" ||
        picture.asset.upload.kind === "uploading"),
  ).length;
}

export function uploadsFailed(gallery: EditGallery): number {
  return gallery.filter(
    (picture) => picture.kind === "added" && picture.asset.upload.kind === "failed",
  ).length;
}

/** How many carry a description — the counter's numerator. */
export function describedCount(gallery: EditGallery): number {
  return gallery.filter((picture) => pictureAltText(picture).trim() !== "").length;
}

/**
 * The gallery the edit leaves standing, or null while an added picture is
 * still unresolved — an attachment names an asset id, so the edit cannot be
 * prepared until every id exists.
 */
export function editClaims(gallery: EditGallery): readonly GalleryEntryDraft[] | null {
  const claims: GalleryEntryDraft[] = [];
  for (const picture of gallery) {
    if (picture.kind === "kept") {
      claims.push({
        mediaId: picture.mediaId,
        altText: picture.altText.trim() === "" ? null : picture.altText.trim(),
      });
      continue;
    }
    if (picture.asset.upload.kind !== "done") return null;
    claims.push({
      mediaId: picture.asset.upload.mediaId,
      altText: picture.asset.altText.trim() === "" ? null : picture.asset.altText.trim(),
    });
  }
  return claims;
}

/** Whether the gallery differs from the one the comment opened with. */
export function galleryChanged(before: EditGallery, after: EditGallery): boolean {
  if (before.length !== after.length) return true;
  return before.some((picture, index) => {
    const now = after[index];
    if (now === undefined) return true;
    return pictureId(picture) !== pictureId(now) || pictureAltText(picture) !== pictureAltText(now);
  });
}
