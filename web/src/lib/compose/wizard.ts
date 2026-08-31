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

export type Step = "pick" | "crop" | "details" | "seal";

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
};

// THE SENSITIVE SELF-MARK IS NOT HERE, and its absence is deliberate.
// ComposeSensitive draws it and D19 puts it in the wizard's scope, but the
// contract has no way to carry it: `PreparePostInput` has no sensitive field
// and there is no mutation that sets one — `SENSITIVE` exists only as a
// read-side `FieldModerationStatus`. A toggle whose value is dropped on the
// floor would tell an author their post is veiled when it is not, which is the
// one kind of wrong this particular control must never be. It lands when the
// contract can carry it; reported as a blocked item rather than faked.

export type WizardState = {
  readonly step: Step;
  readonly mode: BodyMode;
  readonly words: string;
  readonly assets: readonly PickedAsset[];
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
    shape: "tall",
    focused: 0,
    title: "",
    description: "",
    tags: [],
    references: [],
    license: PUBLIC_DOMAIN,
    pDirected: DEFAULT_P_DIRECTED,
  };
}

// ---------------------------------------------------------------- the steps

const WORD_STEPS: readonly Step[] = ["pick", "details", "seal"];
const MEDIA_STEPS: readonly Step[] = ["pick", "crop", "details", "seal"];

/** The crop screen exists only where there is something to crop. */
export function stepsFor(mode: BodyMode): readonly Step[] {
  return mode === "words" ? WORD_STEPS : MEDIA_STEPS;
}

export function stepIndex(state: WizardState): number {
  return Math.max(0, stepsFor(state.mode).indexOf(state.step));
}

/** Null at the end of the sequence — the seal advances by signing, not by stepping. */
export function nextStep(state: WizardState): Step | null {
  const steps = stepsFor(state.mode);
  return steps[stepIndex(state) + 1] ?? null;
}

/** Null on the first screen, where "back" leaves the wizard entirely. */
export function previousStep(state: WizardState): Step | null {
  const steps = stepsFor(state.mode);
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

export function uploadsPending(state: WizardState): number {
  return state.assets.filter(
    (asset) => asset.upload.kind === "waiting" || asset.upload.kind === "encoding" || asset.upload.kind === "uploading",
  ).length;
}

export function uploadsFailed(state: WizardState): number {
  return state.assets.filter((asset) => asset.upload.kind === "failed").length;
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
  const failed = uploadsFailed(state);
  if (failed > 0) {
    return {
      ok: false,
      reason: failed === 1 ? "One picture didn't upload." : `${failed} pictures didn't upload.`,
    };
  }
  const pending = uploadsPending(state);
  if (pending > 0) {
    return {
      ok: false,
      reason: pending === 1 ? "One picture is still uploading." : `${pending} pictures are still uploading.`,
    };
  }
  return ALLOWED;
}

/** Whether the step the reader is on may hand over to the next one. */
export function advanceGate(state: WizardState): Gate {
  switch (state.step) {
    case "pick":
      return bodyGate(state);
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
export function attachmentIds(state: WizardState): readonly string[] | null {
  if (state.mode === "words") return null;
  const ids: string[] = [];
  for (const asset of state.assets) {
    if (asset.upload.kind !== "done") return null;
    ids.push(asset.upload.mediaId);
  }
  return ids;
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
  | { type: "pick"; assets: readonly { id: string; file: Blob }[] }
  | { type: "unpick"; id: string }
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
      // The cap is enforced on the way in rather than on the way out: telling a
      // reader at the seal that their eleventh picture was too many wastes the
      // upload and the wait.
      const room = POST_ATTACHMENT_CAP - state.assets.length;
      const added = action.assets.slice(0, Math.max(0, room)).map((picked) => ({
        id: picked.id,
        file: picked.file,
        crop: CENTERED,
        altText: "",
        upload: { kind: "waiting" } as AssetUpload,
      }));
      return { ...state, assets: [...state.assets, ...added] };
    }

    case "unpick": {
      const assets = state.assets.filter((asset) => asset.id !== action.id);
      return { ...state, assets, focused: Math.min(state.focused, Math.max(0, assets.length - 1)) };
    }

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

    case "shape":
      // The shape is the post's, so changing it re-frames every picture. The
      // per-picture framing is kept: a reader who nudged three pictures and then
      // tried a different shape has not asked to lose that work, and every crop
      // stays valid because the model clamps to the unit square at any ratio.
      return { ...state, shape: action.shape };

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

    case "pDirected":
      // Clamped here rather than trusted from a control: the contract's
      // Dimension is the closed interval, and a slider is not the only caller.
      return { ...state, pDirected: Math.min(1, Math.max(-1, action.pDirected)) };

    case "goto":
      // Only backwards, and only to a step this mode has: a jump may never skip
      // a gate. Switching sides is what still uses it — the shortcut links the
      // details step once carried are gone (jakob 2026-08-31, "none").
      return stepsFor(state.mode).includes(action.step) ? { ...state, step: action.step } : state;

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
