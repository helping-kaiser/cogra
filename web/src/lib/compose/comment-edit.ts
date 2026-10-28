// An edit's gallery — the comment edit's (design/designs/canonical/CommentEdit,
// CommentEditVideo) and the post edit's (EditCompose, EditComposeVideo,
// EditPicked) alike.
//
// AN EDIT'S PICTURES ARE NOT A COMPOSE'S, and that is why this is its own model
// rather than `CommentMedia`. A composer starts from nothing and every picture
// is bytes on their way up; an editor starts from pictures that are ALREADY on
// the server, with ids and URLs and no local blob at all. Faking a blob for
// those would put a lie in the one place the gallery is read from, so the two
// kinds are named instead: a picture is KEPT or it is ADDED.
//
// A CLIP KEEPS ITS BYTES AND MAY TAKE A NEW FACE (api-spec.md, "A video and its
// cover are two contents"). The clip is never swapped at an edit — it stays or
// leaves whole — but the still that fronts it is a picture of the author's own,
// and the placement names it at the edit's signing. So a kept clip carries an
// optional `newCover`, uploaded like any added picture and waited on by the
// same gate.
//
// THE GALLERY IS COMPLETE STATE, like the body and the mark. What this model
// produces is the gallery the edit LEAVES STANDING — never a delta — so
// removing the last picture sends an empty gallery rather than nothing.

import type { GalleryEntryDraft } from "@/lib/api/content-api";
import { ledgerEntry, type MediaLedger } from "@/lib/compose/payload-expectation";
import { parseAspectRatio } from "@/lib/ui2/media/aspect";
import { CENTERED } from "@/lib/ui2/media/crop";
import { COMMENT_ATTACHMENT_CAP } from "./comment-media";
import { commentBodyProblem } from "./reply-wizard";
import type { PickedAsset } from "./wizard";

/** A placement the edit opened with. */
export type KeptPicture = {
  readonly kind: "kept";
  readonly mediaId: string;
  readonly url: string;
  readonly altText: string;
  /**
   * The poster this placement already named. Carried through the editor
   * because an edit re-states the whole gallery: dropping it here would
   * publish a new version that quietly lost the clip's face.
   */
  readonly coverMediaId: string | null;
  /**
   * Whether that poster is a silently taken frame rather than a chosen
   * still. Carried through for the same reason `coverMediaId` is: an edit
   * that dropped it would silently turn a taken cover into a chosen one on
   * the next save.
   */
  readonly coverTaken: boolean | null;
  /** Whether the asset is a clip — a clip is the whole body, and its tile is drawn as one. */
  readonly video: boolean;
  /** The asset's own ratio, width over height, or null where the server has not probed it. */
  readonly ratio: number | null;
  /** What the poster this placement names looks like, where it names one. */
  readonly coverUrl: string | null;
  /**
   * The face this edit set on a kept clip — on its way up or landed — or null
   * while the clip keeps the face it arrived with. Only a video placement
   * takes a cover, so a picture never carries one.
   */
  readonly newCover: PickedAsset | null;
};

export type EditPicture =
  /** Already on the server when the editor opened; its bytes never move. */
  | KeptPicture
  /** Chosen in this editor; it uploads like any other picture. */
  | { readonly kind: "added"; readonly asset: PickedAsset };

export type EditGallery = readonly EditPicture[];

/** Each picture's own handle, whichever kind it is. */
export function pictureId(picture: EditPicture): string {
  return picture.kind === "kept" ? picture.mediaId : picture.asset.id;
}

export function pictureAltText(picture: EditPicture): string {
  return picture.kind === "kept" ? picture.altText : picture.asset.altText;
}

/** The gallery the content arrived with, in the author's order. */
export function galleryOf(
  attachments: readonly {
    id: string;
    url: string;
    altText?: string | null;
    mimeType?: string | null;
    options?: { aspectRatio?: string | null; durationMs?: number | null } | null;
    coverMedia?: { id: string; url?: string | null } | null;
    coverTaken?: boolean | null;
  }[],
): EditGallery {
  return attachments.map((attachment) => ({
    kind: "kept" as const,
    mediaId: attachment.id,
    url: attachment.url,
    altText: attachment.altText ?? "",
    coverMediaId: attachment.coverMedia?.id ?? null,
    coverTaken: attachment.coverTaken ?? null,
    // Only the contract can say what an asset is: its type, or a length where
    // the server read one (`durationMs` reads null on a still).
    video:
      (attachment.mimeType ?? "").startsWith("video/") ||
      typeof attachment.options?.durationMs === "number",
    ratio: parseAspectRatio(attachment.options?.aspectRatio),
    coverUrl: attachment.coverMedia?.url ?? null,
    newCover: null,
  }));
}

/** The one clip a body holds, or undefined where the body is pictures or words. */
export function clipOf(gallery: EditGallery): KeptPicture | undefined {
  const first = gallery[0];
  return gallery.length === 1 && first !== undefined && first.kind === "kept" && first.video
    ? first
    : undefined;
}

/**
 * Whether the clip's face is one its author CHOSE — a still they picked when
 * they published, or a face this edit set. A taken frame is a still nobody
 * picked, so the cover field offers the door over it (EditComposeVideo.md:
 * "Add a cover GIVEN no cover was ever chosen, even when a taken still
 * exists"). Chosen-vs-taken is the stored authoring fact, never a guess from
 * the bytes.
 */
export function coverChosen(clip: KeptPicture): boolean {
  return clip.newCover !== null || (clip.coverMediaId !== null && clip.coverTaken !== true);
}

/** Sets, or with null takes back, the face this edit gives a kept clip. */
export function withNewCover(
  gallery: EditGallery,
  clipId: string,
  cover: PickedAsset | null,
): EditGallery {
  return gallery.map((picture) =>
    picture.kind === "kept" && picture.mediaId === clipId && picture.video
      ? { ...picture, newCover: cover }
      : picture,
  );
}

/** A comment's pictures, as the platform's picker hands them over: unframed. */
export function addTo(
  gallery: EditGallery,
  picked: readonly { id: string; file: Blob }[],
): EditGallery {
  return addAssets(
    gallery,
    picked.map((one) => ({
      id: one.id,
      file: one.file,
      // Never framed: a comment has no crop step, on the editor as on the
      // composer, so the encoder keeps the picture's own shape.
      crop: CENTERED,
      altText: "",
      upload: { kind: "waiting" } as PickedAsset["upload"],
    })),
    COMMENT_ATTACHMENT_CAP,
  );
}

/**
 * Adds pictures to the gallery, up to `cap`. The post edit's come through its
 * crop already framed; a comment's come straight from the picker. Either
 * caller screens the batch first (`screenPick`), so nothing past the cap
 * reaches here to be dropped in silence.
 */
export function addAssets(
  gallery: EditGallery,
  assets: readonly PickedAsset[],
  cap: number,
): EditGallery {
  const room = Math.max(0, cap - gallery.length);
  return [...gallery, ...assets.slice(0, room).map((asset) => ({ kind: "added" as const, asset }))];
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

/** One upload's next step, wherever it stands — an added picture or a clip's new face. */
export function withUpload(
  gallery: EditGallery,
  id: string,
  upload: PickedAsset["upload"],
): EditGallery {
  return gallery.map((picture) => {
    if (picture.kind === "added") {
      return picture.asset.id === id ? { ...picture, asset: { ...picture.asset, upload } } : picture;
    }
    return picture.newCover !== null && picture.newCover.id === id
      ? { ...picture, newCover: { ...picture.newCover, upload } }
      : picture;
  });
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
 * Why the edit cannot be signed, or null.
 *
 * The words answer to the same cap a fresh comment does — `commentBodyProblem`
 * is the reply composer's own check, pinned to the server's `commentBodyChars`
 * once, not re-derived here. Past that only a FAILED upload holds the commit
 * shut (CommentEdit.md: "Sign the edit is disabled GIVEN the gate line shows
 * its fault reading"). An upload still RUNNING never does: Sign stays enabled,
 * and a press is held until the bytes land.
 */
export function editBlocked(gallery: EditGallery, words: string): string | null {
  const bodyIssue = commentBodyProblem(words);
  if (bodyIssue !== null) return bodyIssue;
  return uploadsFailed(gallery) > 0 ? failedUploadLine(uploadsFailed(gallery)) : null;
}

/** The failed uploads' words — the fault reading's first sentence, and the line under the row. */
export function failedUploadLine(failed: number): string {
  return failed === 1 ? "One picture didn't upload." : `${failed} pictures didn't upload.`;
}

/**
 * Just the added pictures' assets. The kept ones have no local bytes and
 * nothing to upload.
 */
export function addedAssets(gallery: EditGallery): readonly PickedAsset[] {
  return gallery.flatMap((picture) => (picture.kind === "added" ? [picture.asset] : []));
}

/** The faces this edit set on its clip — none, or one. */
export function newCovers(gallery: EditGallery): readonly PickedAsset[] {
  return gallery.flatMap((picture) =>
    picture.kind === "kept" && picture.newCover !== null ? [picture.newCover] : [],
  );
}

/**
 * Every upload this edit took — its added pictures and its clip's new face.
 * What the uploader starts, what the preview hook draws, and all the gate
 * counts: a picture the content already carried never uploads again.
 */
export function editUploads(gallery: EditGallery): readonly PickedAsset[] {
  return [...addedAssets(gallery), ...newCovers(gallery)];
}

function running(upload: PickedAsset["upload"]): boolean {
  return (
    upload.kind === "waiting" ||
    upload.kind === "encoding" ||
    upload.kind === "uploading" ||
    upload.kind === "processing"
  );
}

/** The uploads still on their way up — the ones a press of Sign waits for. */
export function uploadsPending(gallery: EditGallery): number {
  return editUploads(gallery).filter((asset) => running(asset.upload)).length;
}

export function uploadsFailed(gallery: EditGallery): number {
  return editUploads(gallery).filter((asset) => asset.upload.kind === "failed").length;
}

/** `Uploading N of M`: of the uploads the edit took, how many have landed. */
export function uploadsDone(gallery: EditGallery): number {
  return editUploads(gallery).filter((asset) => asset.upload.kind === "done").length;
}

/** How many carry a description — the counter's numerator. */
export function describedCount(gallery: EditGallery): number {
  return gallery.filter((picture) => pictureAltText(picture).trim() !== "").length;
}

/**
 * The gallery the edit leaves standing, or null while an upload the edit took
 * is still unresolved — an attachment names an asset id, so the edit cannot
 * be prepared until every id exists.
 *
 * A kept placement re-states the poster it already named. An edit carries the
 * whole gallery rather than a delta, so a placement that came back without its
 * cover would be a new version that silently dropped the clip's face. A face
 * this edit set replaces it, chosen by definition. A picture added in this
 * editor names none: a picture is not covered by anything.
 */
export function editClaims(gallery: EditGallery): readonly GalleryEntryDraft[] | null {
  const claims: GalleryEntryDraft[] = [];
  for (const picture of gallery) {
    if (picture.kind === "kept") {
      const altText = picture.altText.trim() === "" ? null : picture.altText.trim();
      if (picture.newCover !== null) {
        if (picture.newCover.upload.kind !== "done") return null;
        claims.push({
          mediaId: picture.mediaId,
          altText,
          coverMediaId: picture.newCover.upload.mediaId,
          coverTaken: null,
        });
        continue;
      }
      claims.push({
        mediaId: picture.mediaId,
        altText,
        coverMediaId: picture.coverMediaId,
        coverTaken: picture.coverTaken,
      });
      continue;
    }
    if (picture.asset.upload.kind !== "done") return null;
    claims.push({
      mediaId: picture.asset.upload.mediaId,
      altText: picture.asset.altText.trim() === "" ? null : picture.asset.altText.trim(),
      coverMediaId: null,
      coverTaken: null,
    });
  }
  return claims;
}

/**
 * The assets this editor uploaded, with the digests it computed and read —
 * the ledger's own half. The kept placements' digests are read back by id
 * at sign time (`keptMediaIds`), since no gallery read selects them.
 */
export function addedLedger(gallery: EditGallery): MediaLedger {
  return new Map(editUploads(gallery).flatMap((asset) => ledgerEntry(asset.upload)));
}

/**
 * Every asset a kept placement names — the asset and the poster it keeps. A
 * poster this edit replaced is named by nothing the edit signs, so it is not
 * read back.
 */
export function keptMediaIds(gallery: EditGallery): string[] {
  return gallery.flatMap((picture) =>
    picture.kind !== "kept"
      ? []
      : picture.coverMediaId === null || picture.newCover !== null
        ? [picture.mediaId]
        : [picture.mediaId, picture.coverMediaId],
  );
}

/** Whether the gallery differs from the one the comment opened with. */
export function galleryChanged(before: EditGallery, after: EditGallery): boolean {
  if (before.length !== after.length) return true;
  return before.some((picture, index) => {
    const now = after[index];
    if (now === undefined) return true;
    return (
      pictureId(picture) !== pictureId(now) ||
      pictureAltText(picture) !== pictureAltText(now) ||
      (now.kind === "kept" && now.newCover !== null)
    );
  });
}
