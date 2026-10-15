// What a payload must decode to, rebuilt from the request the form sent
// (intent.ts; Android twin: PayloadExpectation.kt).
//
// THE EXPECTATION FOLLOWS THE WIRE, THEN THE SERVER. It is built from the
// same fields the prepare call is given, run through the same input shaping
// the API layer applies (`attachmentInputs`, `sensitiveInput`, `mediaField`),
// and then through the server's own normalization — the title, description
// and alt text trimmed with Rust's `str::trim` and folded to absent when
// blank, a post's words and a self-mark's reason only blank-folded, a
// comment's words and a profile's fields carried untouched. Anything else
// the server would do to a value is a finding, not a tolerance.
//
// EVERY ASSET IS ONE THIS DEVICE CAN STATE. A gallery entry's digests come
// from the device's own ledger: the uploads it made this session (each with
// the upload digest it computed and the rendition digest it read at READY),
// and, on an edit, the assets the version being edited carries, read back
// by id. An entry the ledger cannot name becomes an `UnknownAsset`, which
// no manifest entry matches — the gesture is refused rather than signed
// over a placement nobody on this device can vouch for.

import {
  attachmentInputs,
  sensitiveInput,
  type GalleryEntryDraft,
} from "@/lib/api/content-api";
import type { KnownMedia } from "@/lib/api/media-api";
import { mediaField, type MediaSelection } from "@/lib/api/profile-api";
import {
  serverBlankFolded,
  serverChecked,
  type ExpectedAsset,
  type ExpectedContent,
  type ExpectedProfile,
  type UnknownAsset,
} from "@/lib/signing/intent";

/** Every asset this device can state, by the media id it attaches it under. */
export type MediaLedger = ReadonlyMap<string, KnownMedia>;

/** One entry of a ledger from an upload state, when it finished and carries its digests. */
export function ledgerEntry(upload: {
  readonly kind: string;
  readonly mediaId?: string;
  readonly media?: KnownMedia;
}): readonly [string, KnownMedia][] {
  return upload.kind === "done" && upload.mediaId !== undefined && upload.media !== undefined
    ? [[upload.mediaId, upload.media]]
    : [];
}

/** Every asset a gallery names — each placement's asset and its poster. */
export function galleryMediaIds(entries: readonly GalleryEntryDraft[] | undefined): string[] {
  return (entries ?? []).flatMap((entry) =>
    entry.coverMediaId === null || entry.coverMediaId === undefined
      ? [entry.mediaId]
      : [entry.mediaId, entry.coverMediaId],
  );
}

function assetExpectation(
  mediaId: string,
  altText: string | null,
  coverMediaId: string | null,
  coverTaken: boolean,
  ledger: MediaLedger,
): ExpectedAsset | UnknownAsset {
  const known = ledger.get(mediaId);
  if (known === undefined) return { kind: "unknown", mediaId };
  let cover: string | null = null;
  if (coverMediaId !== null) {
    const poster = ledger.get(coverMediaId);
    if (poster === undefined) return { kind: "unknown", mediaId: coverMediaId };
    cover = poster.digest;
  }
  return {
    kind: "asset",
    digest: known.digest,
    mime: known.mime,
    altText: serverChecked(altText),
    cover,
    coverTaken: coverTaken && cover !== null,
    uploadDigest: known.uploadDigest,
  };
}

/** The fields a content prepare is sent, as its caller hands them to the API layer. */
export type SentContent = {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly content: string | null;
  readonly attachments?: readonly GalleryEntryDraft[];
  readonly sensitive?: boolean;
  readonly sensitiveReason?: string;
};

/**
 * What a Publish or Review payload must decode to. `node` is the id the
 * prepare named for the content — the minted node on a create, the edited
 * one on an edit.
 */
export function contentExpectation(
  node: string,
  sent: SentContent,
  shape: "post" | "comment",
  ledger: MediaLedger,
): ExpectedContent {
  const media = (attachmentInputs(sent.attachments) ?? []).map((entry) =>
    assetExpectation(
      entry.mediaId,
      entry.altText,
      entry.coverMediaId,
      entry.coverTaken === true,
      ledger,
    ),
  );
  const mark = sensitiveInput(sent.sensitive, sent.sensitiveReason);
  return {
    node,
    // A post's words are words or nothing beside media, which the envelope
    // carries as the empty body; a comment's words ride exactly as typed.
    title: shape === "post" ? serverChecked(sent.title) : null,
    description: shape === "post" ? serverChecked(sent.description) : null,
    body: shape === "post" ? (serverBlankFolded(sent.content) ?? "") : sent.content,
    media,
    sensitive: mark.sensitive ? { reason: serverBlankFolded(mark.sensitiveReason) } : null,
  };
}

/** What a profile update's payload must decode to: the fields untouched, the avatar three-valued. */
export function profileExpectation(
  node: string,
  sent: {
    readonly displayName: string;
    readonly bio: string | null;
    readonly websiteUrl: string | null;
    readonly avatar?: MediaSelection;
  },
  ledger: MediaLedger,
): ExpectedProfile {
  const avatarId = mediaField(sent.avatar);
  return {
    node,
    displayName: sent.displayName,
    bio: sent.bio,
    websiteUrl: sent.websiteUrl,
    avatar:
      avatarId === undefined
        ? { state: "untouched" }
        : avatarId === null
          ? { state: "cleared" }
          : { state: "set", asset: assetExpectation(avatarId, null, null, false, ledger) },
  };
}
