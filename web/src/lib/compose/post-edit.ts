// The post edit's state — design/designs/canonical/EditCompose, EditWords,
// EditComposeVideo, EditPicked; the guard is `edit-batch.ts`'s.
//
// AN EDIT IS COMPLETE STATE (`PreparePostEditInput`): the record re-states the
// title, the description, the body, the gallery and the author's own mark, so
// each is carried from the read and sent back whether or not it was touched.
//
// THE BODY IS WORDS OR MEDIA, never both, and the edit may end up a different
// kind than the post that was published: the LAST picture or the clip leaving
// flips it to words, the words field arriving empty (EditPicked.md,
// EditWords.md). THE FLIP DROPS A STANDING DESCRIPTION (design/readme.md
// :8179-8181, K8.1/D4): a description is how words stand BESIDE pictures, so a
// words post carries none, and the server refuses one at ["description"].

import type { GalleryEntryDraft, PostDetailView } from "@/lib/api/content-api";
import type { License } from "@/lib/license";
import { snapDimension } from "@/lib/stance/model";
import { referenceDrafts } from "@/lib/references/claims";
import type { ReferenceDraft } from "@/lib/references/draft";
import type { TagDraft } from "@/lib/topics/draft";
import { nearestPostShape, POST_SHAPES, type PostShape } from "@/lib/ui2/media/aspect";
import {
  addAssets,
  clipOf,
  editClaims,
  galleryOf,
  removeFrom,
  withAltText,
  withNewCover,
  withUpload,
  type EditGallery,
} from "./comment-edit";
import {
  bodyProblem,
  descriptionProblem,
  POST_ATTACHMENT_CAP,
  sensitiveReasonProblem,
  titleProblem,
  type PickedAsset,
} from "./wizard";

export type PostEditState = {
  readonly id: string;
  readonly license: License;
  readonly title: string;
  readonly description: string;
  readonly words: string;
  readonly gallery: EditGallery;
  /** The pictures' durations, by media id — a clip's tile is drawn as one. */
  readonly durations: Readonly<Record<string, number>>;
  /**
   * THE POST'S ONE SHAPE (D17), which every picture the edit adds is cut to:
   * read off the pictures the post was published with, so the crop the edit
   * opens is locked to it (ComposeCrop.md: "locked to the post's one shape").
   * Null while the body holds no picture to read it from — a words post or a
   * clip — and then the crop offers its chips and the first framing sets it.
   */
  readonly shape: PostShape | null;
  readonly tags: readonly TagDraft[];
  readonly references: readonly ReferenceDraft[];
  readonly sensitive: boolean;
  readonly sensitiveReason: string;
  /** What the post arrived with: the baseline the tag and citation acts read. */
  readonly loadedTags: readonly TagDraft[];
  readonly loadedReferences: readonly ReferenceDraft[];
  /**
   * THE EDIT'S OWN PICK — the attachment its Publish carries, the value it
   * ADDS to the post's backing (round 15, PICK-IS-THE-EDGE). 0.00 by
   * default, which changes the backing by nothing; never a value the backing
   * is set to, so nothing here computes a delta (EditPad.md, post.md §4).
   */
  readonly pick: number;
  /**
   * Whether the edit record is in the batch. STICKY: set by the first change
   * to a field the record carries and never cleared by typing it back — the
   * guard is the acts batch, not a byte comparison (EditComposeUnchanged.md:3).
   * A moved pick alone fills it (EditCompose.md); a Set at 0.00 adds nothing.
   */
  readonly recordStaged: boolean;
};

export type PostEditAction =
  | { type: "title"; title: string }
  | { type: "description"; description: string }
  | { type: "words"; words: string }
  | { type: "tags"; tags: readonly TagDraft[] }
  | { type: "references"; references: readonly ReferenceDraft[] }
  | { type: "sensitive"; sensitive: boolean }
  | { type: "sensitiveReason"; reason: string }
  | { type: "removePicture"; id: string }
  | { type: "movePicture"; from: number; to: number }
  | { type: "describe"; id: string; altText: string }
  /** The backing pad's Set: the edit's own pick. */
  | { type: "pick"; pick: number }
  /** Pictures back from the crop, framed at `shape` — the post's own, or the one the chips chose. */
  | { type: "addPictures"; assets: readonly PickedAsset[]; shape: PostShape }
  /** One upload's next step: an added picture's, or the clip's new face's. */
  | { type: "upload"; id: string; upload: PickedAsset["upload"] }
  /** A face for the clip, back from the cover's crop — or null, `Remove it` under the cover row. */
  | { type: "cover"; cover: PickedAsset | null };

/** The post as the read served it, ready to edit. */
export function postEditOf(post: PostDetailView): PostEditState {
  const tags = post.topics.map((claim) => ({
    name: claim.hashtag.name.value ?? "",
    relevance: claim.relevance,
    confidence: claim.confidence,
  }));
  // A claim CoGra cannot type is dropped: it has no L2 id to name it back by,
  // so it renders on the detail but is never staged — nor read as withdrawn.
  const references = referenceDrafts(post.references);
  const gallery = galleryOf(post.attachments);
  const firstPicture = gallery.find((picture) => picture.kind === "kept" && !picture.video);
  const durations: Record<string, number> = {};
  for (const attachment of post.attachments) {
    const ms = attachment.options?.durationMs;
    if (typeof ms === "number") durations[attachment.id] = ms;
  }
  return {
    id: post.id,
    license: post.license,
    title: post.title.value ?? "",
    description: post.description.value ?? "",
    words: post.content.value ?? "",
    gallery,
    durations,
    shape: firstPicture?.kind === "kept" ? nearestPostShape(firstPicture.ratio) : null,
    tags,
    references,
    // THE AUTHOR'S OWN mark (round 4): what a reader sees is the OR of the
    // author's mark and a moderator's, and re-stating the OR would adopt a
    // moderator's verdict as the author's own.
    sensitive: post.sensitiveSelfMark,
    sensitiveReason: post.sensitiveReason ?? "",
    loadedTags: tags,
    loadedReferences: references,
    pick: 0,
    recordStaged: false,
  };
}

/** Whether the body is media: the gallery holds anything. */
export function isMediaBody(state: PostEditState): boolean {
  return state.gallery.length > 0;
}

/** Whether the body is one clip — `EditComposeVideo`'s anatomy. */
export function isClipBody(state: PostEditState): boolean {
  return clipOf(state.gallery) !== undefined;
}

function move<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

export function postEditReducer(state: PostEditState, action: PostEditAction): PostEditState {
  switch (action.type) {
    case "title":
      return { ...state, title: action.title, recordStaged: true };
    case "description":
      return { ...state, description: action.description, recordStaged: true };
    case "words":
      return { ...state, words: action.words, recordStaged: true };
    case "tags":
      return { ...state, tags: action.tags };
    case "references":
      return { ...state, references: action.references };
    case "sensitive":
      // The contract refuses a reason without the mark, so a reason left
      // behind could only be a refusal waiting at the submit.
      return {
        ...state,
        sensitive: action.sensitive,
        sensitiveReason: action.sensitive ? state.sensitiveReason : "",
        recordStaged: true,
      };
    case "sensitiveReason":
      return { ...state, sensitiveReason: action.reason, recordStaged: true };
    case "removePicture": {
      const gallery = removeFrom(state.gallery, action.id);
      if (gallery.length === state.gallery.length) return state;
      if (gallery.length > 0) return { ...state, gallery, recordStaged: true };
      // The last picture or the clip left: the body becomes words, the field
      // arrives empty, and the description goes with the pictures (K8.1).
      return { ...state, gallery, words: "", description: "", shape: null, recordStaged: true };
    }
    case "movePicture": {
      const gallery = move(state.gallery, action.from, action.to);
      return gallery === state.gallery ? state : { ...state, gallery, recordStaged: true };
    }
    case "describe":
      return {
        ...state,
        gallery: withAltText(state.gallery, action.id, action.altText),
        recordStaged: true,
      };
    case "pick": {
      // Every pick on the strip is legal; −0 is +0 on the wire (PR-91). The
      // pick is a hundredth (EditPad.md), so one that reads 0.00 IS 0 and
      // stages no record — a float's 0.004 never slips one in.
      const pick = snapDimension(action.pick);
      return { ...state, pick, recordStaged: state.recordStaged || pick !== 0 };
    }
    case "addPictures": {
      if (action.assets.length === 0) return state;
      // Pictures replace a words body: the words they replace are gone from
      // the body (EditWords.md: "they pass the crop AND the words they replace
      // are gone from the body").
      return {
        ...state,
        gallery: addAssets(state.gallery, action.assets, POST_ATTACHMENT_CAP),
        words: state.gallery.length === 0 ? "" : state.words,
        shape: state.shape ?? action.shape,
        recordStaged: true,
      };
    }
    case "upload":
      // An upload's progress is no change of the author's: it stages nothing.
      return { ...state, gallery: withUpload(state.gallery, action.id, action.upload) };
    case "cover": {
      const clip = clipOf(state.gallery);
      if (clip === undefined) return state;
      // A face set is a change to the record (the cover pointer swaps at the
      // signing); taking it back leaves the record as staged as it was — the
      // guard is the batch, never a byte comparison (EditComposeUnchanged.md).
      return {
        ...state,
        gallery: withNewCover(state.gallery, clip.mediaId, action.cover),
        recordStaged: state.recordStaged || action.cover !== null,
      };
    }
  }
}

/**
 * The words body past its cap, in the board's own line (EditWords.md: the
 * body takes the error outline and `A post's words are at most 5,000
 * characters.` stands under it). The cap is the wizard's — one number,
 * pinned to the server's `content.postBodyChars`.
 */
export function wordsProblem(words: string): string | null {
  return bodyProblem(words) === null ? null : "A post's words are at most 5,000 characters.";
}

/** Why Sign the edit is inert beyond the empty batch: a field over its cap, or null. */
export function postEditProblem(state: PostEditState): string | null {
  return (
    titleProblem(state.title) ??
    (isMediaBody(state) ? descriptionProblem(state.description) : wordsProblem(state.words)) ??
    (state.sensitive ? sensitiveReasonProblem(state.sensitiveReason) : null)
  );
}

/**
 * What `preparePostEdit` is sent: the whole content state, the words path
 * without a description, and the edit's own pick — always stated, 0 when
 * unmoved (the required-stance wire: the server never fills a stance in).
 */
export function postEditInput(state: PostEditState): {
  id: string;
  title: string | null;
  description: string | null;
  content: string;
  attachments: readonly GalleryEntryDraft[];
  sensitive: boolean;
  sensitiveReason: string;
  pDirected: number;
} {
  const media = isMediaBody(state);
  return {
    id: state.id,
    title: state.title.trim() === "" ? null : state.title,
    description: media && state.description.trim() !== "" ? state.description : null,
    content: media ? "" : state.words,
    attachments: editClaims(state.gallery) ?? [],
    sensitive: state.sensitive,
    sensitiveReason: state.sensitiveReason,
    pDirected: state.pick,
  };
}

/** What the acts card's Edit row names: the title, else the words' head. */
export function recordName(state: PostEditState): string {
  const title = state.title.trim();
  if (title !== "") return title;
  const words = state.words.trim();
  return words === "" ? "The post" : words.slice(0, 60);
}

/**
 * The ratio an upload the edit took is cut to: a picture at the post's one
 * shape, the clip's new face at the clip's own ratio — the window the cover's
 * crop was locked to (CoverCrop.md). The crop's own area already carries it;
 * this is the encoder's frame where no area was measured.
 */
export function uploadRatio(state: PostEditState, assetId: string): number | undefined {
  const clip = clipOf(state.gallery);
  if (clip !== undefined && clip.newCover?.id === assetId) return coverRatio(clip.ratio);
  return state.shape === null ? undefined : POST_SHAPES[state.shape].ratio;
}

/**
 * The window a clip's new face is cut to: the clip's own ratio in a post
 * (CoverCrop.md). A clip the server never probed reserves the square, the
 * neutral reservation `tileRatio` makes for a shape unknown.
 */
export function coverRatio(clipRatio: number | null): number {
  return clipRatio !== null && Number.isFinite(clipRatio) && clipRatio > 0 ? clipRatio : 1;
}
