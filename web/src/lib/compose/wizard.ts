// The compose wizard's model, as pure data and pure functions.
//
// The wizard is a sequence of screens over one draft, and every rule worth
// getting right is a rule about that draft rather than about a screen: the body
// is words XOR media, the whole post shares one crop shape, an asset is only
// attachable once its bytes are on the server, and the seal may not be reached
// while any of that is unsettled. Keeping the rules here — with no React, no
// DOM, and no network — is what lets every branch be tested directly, which is
// the only way a five-screen flow with concurrent uploads stays honest.
//
// THE BODY XOR (D16). The contract refuses a post carrying both words and
// attachments and refuses one carrying neither, so the wizard's top-level branch
// IS that choice. Switching sides does not destroy the other side's draft — a
// reader who taps "Add pictures instead" and changes their mind would otherwise
// lose their paragraphs to a mis-tap — but only the active side is ever sent.

import type { GalleryEntryDraft } from "@/lib/api/content-api";
import type { Crop } from "@/lib/ui2/media/crop";
import { CENTERED } from "@/lib/ui2/media/crop";
import { POST_SHAPES, type PostShape } from "@/lib/ui2/media/aspect";
import type { License } from "@/lib/license";
import { PUBLIC_DOMAIN } from "@/lib/license";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";

/** The write side's cap; a whole-batch refusal, so the picker enforces it too. */
export const POST_ATTACHMENT_CAP = 10;

export type BodyMode = "words" | "media";

/**
 * What a picked file is. The two kinds compose differently — ten pictures OR
 * one video and its cover, never both — so the distinction has to be in the
 * model rather than read off a MIME type at every call site.
 */
export type MediaKind = "picture" | "video";

export type Step = "pick" | "crop" | "cover" | "details" | "seal";

/**
 * One asset's journey to the server. `encoding` and `uploading` are separate
 * because they fail differently and the reader can act on only one of them: an
 * encode that fails is a picture this browser cannot read, an upload that fails
 * is worth a retry.
 */
export type AssetUpload =
  | { readonly kind: "waiting" }
  | { readonly kind: "encoding" }
  | { readonly kind: "uploading" }
  | { readonly kind: "done"; readonly mediaId: string }
  | { readonly kind: "failed"; readonly message: string; readonly retryable: boolean };

export type PickedAsset = {
  /** Stable for the asset's whole life in the draft, including across a restore. */
  readonly id: string;
  /** The picked original. The crop and the downscale are applied at encode time. */
  readonly file: Blob;
  readonly crop: Crop;
  /** What a blind reader reads. It rides the upload, so it is entered before it. */
  readonly altText: string;
  readonly upload: AssetUpload;
  /** Absent on drafts written before video; read through `kindOf`, never raw. */
  readonly kind?: MediaKind;
};

/** What a picked asset is, defaulting a pre-video draft to the only kind it could hold. */
export function kindOf(asset: PickedAsset): MediaKind {
  return asset.kind ?? "picture";
}

/**
 * The video's poster — its own asset, uploaded BEFORE the video that names it.
 *
 * It is not an attachment: the post's gallery carries the video alone, and the
 * cover reaches the reader through the video's own `coverMedia`. That is why it
 * sits beside `assets` rather than in it — a cover in the gallery would publish
 * a second picture nobody attached.
 */
export type CoverAsset = {
  readonly id: string;
  readonly file: Blob;
  /**
   * Which offer it came from: an index into the frames pulled off the clip, or
   * -1 for a picture of the author's own. The index is what re-selects the
   * right tile when the screen is reopened or a draft is restored.
   */
  readonly frame: number;
  readonly upload: AssetUpload;
};

/** A picture of the author's own rather than a frame out of the clip. */
export const COVER_FROM_PICTURE = -1;

export type WizardState = {
  readonly step: Step;
  readonly mode: BodyMode;
  readonly words: string;
  readonly assets: readonly PickedAsset[];
  /**
   * The video's face. Null on a picture post, and on a video whose cover the
   * author has not settled yet — the cover screen fills it the moment it can.
   */
  readonly cover: CoverAsset | null;
  /** One shape for the whole post; the framing inside it is per picture. */
  readonly shape: PostShape;
  /** Which asset the crop screen is working on. */
  readonly focused: number;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly TagDraft[];
  readonly references: readonly ReferenceDraft[];
  readonly license: License;
  /**
   * The author's own sensitive mark — the seal's switch. It veils the pictures
   * and the description; the title stays readable, so choosing is informed.
   */
  readonly sensitive: boolean;
  /** Shown on the veil when it is given. Blank counts as none. */
  readonly sensitiveReason: string;
  /**
   * Where the author stands on their own post — the Publish record's `pDirected`.
   * `pInterest` is census-fixed at 1 for Publish, so there is one free number
   * here and not a pair; the low-defaults policy value is +0.1.
   */
  readonly pDirected: number;
};

/** The policy default the seal shows before anyone touches it. */
export const DEFAULT_P_DIRECTED = 0.1;

export function emptyWizard(): WizardState {
  return {
    step: "pick",
    mode: "media",
    words: "",
    assets: [],
    cover: null,
    shape: "tall",
    focused: 0,
    title: "",
    description: "",
    tags: [],
    references: [],
    license: PUBLIC_DOMAIN,
    sensitive: false,
    sensitiveReason: "",
    pDirected: DEFAULT_P_DIRECTED,
  };
}

// ---------------------------------------------------------------- the steps

const WORD_STEPS: readonly Step[] = ["pick", "details", "seal"];
const PICTURE_STEPS: readonly Step[] = ["pick", "crop", "details", "seal"];
const VIDEO_STEPS: readonly Step[] = ["pick", "cover", "details", "seal"];

/** Whether the body is the moving kind — one video, and the cover it carries. */
export function isVideoPost(state: WizardState): boolean {
  const first = state.assets[0];
  return state.mode === "media" && first !== undefined && kindOf(first) === "video";
}

/**
 * The screens this draft actually has.
 *
 * A VIDEO SKIPS THE CROP AND TAKES THE COVER INSTEAD, which is what the graph
 * draws: ComposePick's Next branches "pictures — the crop" against "a video —
 * its face", and the crop board draws no video at all. The two screens are
 * alternatives rather than a sequence, so a video post is the same four stages
 * deep as a picture post and Back never lands on a screen that has nothing to
 * show.
 */
export function stepsFor(state: WizardState): readonly Step[] {
  if (state.mode === "words") return WORD_STEPS;
  return isVideoPost(state) ? VIDEO_STEPS : PICTURE_STEPS;
}

export function stepIndex(state: WizardState): number {
  return Math.max(0, stepsFor(state).indexOf(state.step));
}

/** Null at the end of the sequence — the seal advances by signing, not by stepping. */
export function nextStep(state: WizardState): Step | null {
  const steps = stepsFor(state);
  return steps[stepIndex(state) + 1] ?? null;
}

/** Null on the first screen, where "back" leaves the wizard entirely. */
export function previousStep(state: WizardState): Step | null {
  const steps = stepsFor(state);
  const index = stepIndex(state);
  return index > 0 ? (steps[index - 1] ?? null) : null;
}

// ------------------------------------------------------------- the guards

export type Blocked = { readonly ok: false; readonly reason: string };
export type Allowed = { readonly ok: true };
export type Gate = Allowed | Blocked;

const ALLOWED: Gate = { ok: true };

/** Whether the body — the one mandatory field — is there at all. */
export function bodyGate(state: WizardState): Gate {
  if (state.mode === "words") {
    return state.words.trim() === "" ? { ok: false, reason: "The post needs a body." } : ALLOWED;
  }
  if (state.assets.length === 0) {
    return { ok: false, reason: "Pick at least one picture." };
  }
  if (state.assets.length > POST_ATTACHMENT_CAP) {
    return {
      ok: false,
      reason: `A post carries at most ${POST_ATTACHMENT_CAP} pictures.`,
    };
  }
  return ALLOWED;
}

/** The cover screen's own gate: a video may not leave it faceless. */
export function coverGate(state: WizardState): Gate {
  if (!isVideoPost(state)) return ALLOWED;
  return state.cover === null
    ? { ok: false, reason: "Choose a frame, or a picture of your own." }
    : ALLOWED;
}

/** Every upload this draft is waiting on — the cover counts, though it is no attachment. */
function allUploads(state: WizardState): readonly AssetUpload[] {
  const uploads = state.assets.map((asset) => asset.upload);
  return state.cover === null ? uploads : [...uploads, state.cover.upload];
}

export function uploadsPending(state: WizardState): number {
  return allUploads(state).filter(
    (upload) => upload.kind === "waiting" || upload.kind === "encoding" || upload.kind === "uploading",
  ).length;
}

export function uploadsFailed(state: WizardState): number {
  return allUploads(state).filter((upload) => upload.kind === "failed").length;
}

/**
 * The seal gate. An attachment names an asset id, so a post cannot be prepared
 * while any picture is still on its way — and saying so plainly beats a submit
 * button that refuses for reasons the reader cannot see.
 */
export function sealGate(state: WizardState): Gate {
  const body = bodyGate(state);
  if (!body.ok) return body;
  if (state.mode === "words") return ALLOWED;
  const cover = coverGate(state);
  if (!cover.ok) return cover;
  // A video post's two uploads are the clip and its cover, so the count is
  // never the plural "pictures" a gallery would report — it says "video"
  // whichever of the two is still moving, because both are the one body.
  const video = isVideoPost(state);
  const failed = uploadsFailed(state);
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
  const pending = uploadsPending(state);
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

/** Whether the step the reader is on may hand over to the next one. */
export function advanceGate(state: WizardState): Gate {
  switch (state.step) {
    case "pick":
      return bodyGate(state);
    // A frame is selected the moment the clip is read, so this only ever
    // speaks when no frame could be taken and no picture was chosen.
    case "cover":
      return coverGate(state);
    // Every picture has a crop from the moment it is picked, and the details
    // are all optional, so neither screen can be incomplete.
    case "crop":
    case "details":
      return ALLOWED;
    case "seal":
      return sealGate(state);
  }
}

// ------------------------------------------------------------- the outputs

/**
 * What pressing "Sign and publish" would sign. The post is one act; each topic
 * and each citation is its own. Attaching mints no record and costs nothing —
 * the pictures were uploaded before any of this, outside the graph entirely.
 */
export function signedActions(state: WizardState): number {
  return 1 + state.tags.length + state.references.length;
}

/** The gallery in order, or null while any asset is still unresolved. */
export function attachmentClaims(state: WizardState): readonly GalleryEntryDraft[] | null {
  if (state.mode === "words") return null;
  const claims: GalleryEntryDraft[] = [];
  for (const asset of state.assets) {
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

/** The words half, or null on a media post — the XOR, as the input wants it. */
export function bodyContent(state: WizardState): string | null {
  return state.mode === "words" ? state.words : null;
}

export function shapeRatio(state: WizardState): number {
  return POST_SHAPES[state.shape].ratio;
}

// ------------------------------------------------------------- the actions

export type WizardAction =
  | { type: "mode"; mode: BodyMode }
  | { type: "words"; words: string }
  | { type: "pick"; assets: readonly { id: string; file: Blob; kind?: MediaKind }[] }
  | { type: "unpick"; id: string }
  | { type: "cover"; cover: CoverAsset | null }
  /** The opening default: the first offer, but never over a choice already made. */
  | { type: "coverIfUnset"; cover: CoverAsset }
  | { type: "coverUpload"; upload: AssetUpload }
  | { type: "reorder"; from: number; to: number }
  | { type: "focus"; index: number }
  | { type: "shape"; shape: PostShape }
  | { type: "crop"; id: string; crop: Crop }
  | { type: "altText"; id: string; altText: string }
  | { type: "upload"; id: string; upload: AssetUpload }
  | { type: "title"; title: string }
  | { type: "description"; description: string }
  | { type: "tags"; tags: readonly TagDraft[] }
  | { type: "references"; references: readonly ReferenceDraft[] }
  | { type: "license"; license: License }
  | { type: "sensitive"; sensitive: boolean }
  | { type: "sensitiveReason"; sensitiveReason: string }
  | { type: "pDirected"; pDirected: number }
  | { type: "goto"; step: Step }
  | { type: "advance" }
  | { type: "back" };

function withAsset(
  state: WizardState,
  id: string,
  change: (asset: PickedAsset) => PickedAsset,
): WizardState {
  return { ...state, assets: state.assets.map((asset) => (asset.id === id ? change(asset) : asset)) };
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "mode":
      // Switching sides returns to the pick screen: the crop step belongs to a
      // body that no longer exists, and a reader left standing on it would see
      // an empty frame with no way to explain it.
      return action.mode === state.mode ? state : { ...state, mode: action.mode, step: "pick" };

    case "words":
      return { ...state, words: action.words };

    case "pick": {
      // TEN PICTURES OR ONE VIDEO, NEVER BOTH — the composition ruling, enforced
      // here so no path can assemble a body the contract refuses. A pick that
      // would mix the kinds is DROPPED rather than allowed to replace what is
      // already there: silently throwing away nine framed pictures because a
      // video landed on the drop zone is the one outcome worth refusing over.
      // The screen says why; this only makes it impossible.
      const holdsVideo = isVideoPost(state);
      const wants = action.assets.filter((picked) => (picked.kind ?? "picture") === "video");
      const pictures = action.assets.filter((picked) => (picked.kind ?? "picture") !== "video");

      if (holdsVideo) return state;
      if (wants.length > 0) {
        // A video takes the body whole, so it may only arrive into an empty one
        // — and only one of them, however many were dropped at once.
        if (state.assets.length > 0) return state;
        const picked = wants[0]!;
        return {
          ...state,
          assets: [
            {
              id: picked.id,
              file: picked.file,
              crop: CENTERED,
              altText: "",
              upload: { kind: "waiting" } as AssetUpload,
              kind: "video" as MediaKind,
            },
          ],
          cover: null,
        };
      }

      // The cap is enforced on the way in rather than on the way out: telling a
      // reader at the seal that their eleventh picture was too many wastes the
      // upload and the wait.
      const room = POST_ATTACHMENT_CAP - state.assets.length;
      const added = pictures.slice(0, Math.max(0, room)).map((picked) => ({
        id: picked.id,
        file: picked.file,
        crop: CENTERED,
        altText: "",
        upload: { kind: "waiting" } as AssetUpload,
        kind: "picture" as MediaKind,
      }));
      return { ...state, assets: [...state.assets, ...added] };
    }

    case "unpick": {
      const assets = state.assets.filter((asset) => asset.id !== action.id);
      return {
        ...state,
        assets,
        // The cover belongs to the clip, so removing the clip takes its face
        // with it — a poster left behind would be uploaded for a video that is
        // no longer in the post.
        cover: assets.length === 0 ? null : state.cover,
        focused: Math.min(state.focused, Math.max(0, assets.length - 1)),
      };
    }

    case "cover":
      return { ...state, cover: action.cover };

    case "coverIfUnset":
      // A restored draft arrives with its face already chosen, and the frames
      // are re-captured behind it — without this guard the first offer would
      // quietly overwrite what the author picked last time.
      return state.cover === null ? { ...state, cover: action.cover } : state;

    case "coverUpload":
      return state.cover === null
        ? state
        : { ...state, cover: { ...state.cover, upload: action.upload } };

    case "reorder": {
      // ORDER IS THE COVER: the first picture leads the post, so moving one is
      // how the cover is chosen and there is no separate cover control. The
      // focus follows the picture that moved rather than the position, or a
      // reorder on the crop step would silently reframe a different picture.
      const { from, to } = action;
      const last = state.assets.length - 1;
      if (from === to || from < 0 || to < 0 || from > last || to > last) return state;
      const assets = [...state.assets];
      const [moved] = assets.splice(from, 1);
      assets.splice(to, 0, moved);
      const focused =
        state.focused === from
          ? to
          : state.focused > from && state.focused <= to
            ? state.focused - 1
            : state.focused >= to && state.focused < from
              ? state.focused + 1
              : state.focused;
      return { ...state, assets, focused };
    }

    case "focus":
      return { ...state, focused: Math.min(Math.max(0, action.index), Math.max(0, state.assets.length - 1)) };

    case "shape": {
      // The shape is the post's, so changing it re-frames every picture — and
      // re-framing happens against the ORIGINAL picture, never against the last
      // crop. The measured area is the previous shape's rectangle, so keeping
      // it would bake the old shape into the upload; dropping it makes the
      // cropper measure a fresh one from the media. The position and zoom stay,
      // so a reader who framed three pictures and then tried another shape
      // keeps where they had put each one.
      if (action.shape === state.shape) return state;
      return {
        ...state,
        shape: action.shape,
        assets: state.assets.map((asset) => ({
          ...asset,
          crop: { ...asset.crop, area: null, areaPercent: null },
        })),
      };
    }

    case "crop":
      return withAsset(state, action.id, (asset) => ({ ...asset, crop: action.crop }));

    case "altText":
      return withAsset(state, action.id, (asset) => ({ ...asset, altText: action.altText }));

    case "upload":
      return withAsset(state, action.id, (asset) => ({ ...asset, upload: action.upload }));

    case "title":
      return { ...state, title: action.title };

    case "description":
      return { ...state, description: action.description };

    case "tags":
      return { ...state, tags: action.tags };

    case "references":
      return { ...state, references: action.references };

    case "license":
      return { ...state, license: action.license };

    case "sensitive":
      // Unmarking keeps the reason typed: an author who toggles the switch off
      // and on again should not have to write it a second time. What is SENT is
      // gated on the switch, not on the text.
      return { ...state, sensitive: action.sensitive };

    case "sensitiveReason":
      return { ...state, sensitiveReason: action.sensitiveReason };

    case "pDirected":
      // Clamped here rather than trusted from a control: the contract's
      // Dimension is the closed interval, and a slider is not the only caller.
      return { ...state, pDirected: Math.min(1, Math.max(-1, action.pDirected)) };

    case "goto":
      // Only backwards, and only to a step this mode has: a jump may never skip
      // a gate. Switching sides is what still uses it — the shortcut links the
      // details step once carried are gone (jakob 2026-08-31, "none").
      return stepsFor(state).includes(action.step) ? { ...state, step: action.step } : state;

    case "advance": {
      if (!advanceGate(state).ok) return state;
      const next = nextStep(state);
      return next === null ? state : { ...state, step: next };
    }

    case "back": {
      const previous = previousStep(state);
      return previous === null ? state : { ...state, step: previous };
    }
  }
}
