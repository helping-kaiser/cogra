// The reply wizard's model, as pure data and pure functions —
// design/designs/canonical/{ReplyCompose,ReplyPicturesWeb,ReplySeal,ReplyPad}.
//
// A COMMENT IS NOT A SMALL POST, so this is its own machine rather than a mode
// of `wizard.ts`, and the differences are exactly the ones the boards draw:
//
//  · TWO STAGES, not four. There is no pick stage — "+ Add pictures" opens the
//    browser's own file dialog, so the pictures land in the composer the reader
//    is already standing on (ReplyCompose and ReplyPicturesWeb are one screen,
//    with and without a tray). There is no crop stage either: a comment's
//    pictures keep their own shape.
//  · WORDS PLUS PICTURES, never the post's words-XOR-media (D16). The words are
//    mandatory and the pictures are the optional half, so there is no mode to
//    switch and the body gate is just "are there words".
//  · A STANCE PAIR, not one number. Publish fixes `pInterest` at 1 and leaves a
//    post's author one free number; a comment's genesis Review carries both, so
//    the seal's Adjust opens the two-axis pad (ReplyPad) rather than the post
//    wizard's single slider.
//
// NO DRAFTS (jakob 2026-09-01). Leaving discards the comment, so nothing here
// persists and there is no draft store beside it. The post wizard's IndexedDB
// draft is untouched — that ruling is about comments only. This is why `leave`
// is not modelled as a state at all: the flow simply ends.
//
// THE SENSITIVE SELF-MARK IS NOT HERE, and its absence is deliberate and
// approved (jakob 2026-09-01). ReplySeal boards a "Mark (sensitive)" row, but a
// sensitive-marked COMMENT has no veiled read state yet (design backlog item
// 25.4), so shipping the switch would promise a veil the reader never gets.
// `PrepareCommentInput.sensitive` stays on the wire, defaulted by the server —
// the contract is untouched, only the control is held back.

import type { License } from "@/lib/license";
import { PUBLIC_DOMAIN } from "@/lib/license";
import type { StancePair } from "@/lib/stance/model";
import { clampPair, TAP_DEFAULT } from "@/lib/stance/model";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";
import {
  commentGate,
  COMMENT_ATTACHMENT_CAP,
  NO_COMMENT_MEDIA,
  pickInto,
  removeFrom,
  withUpload,
  type CommentMedia,
  type Gate,
} from "./comment-media";
import type { AssetUpload } from "./wizard";

export type ReplyStep = "compose" | "seal";

/**
 * What the reply answers, as the composer needs to show it.
 *
 * The board pins the target at the top of the composer — a chip carrying the
 * author's avatar, the target's name and a one-line snippet — because a reply
 * written full-screen has otherwise lost sight of what it replies to. `kind`
 * is what separates ReplyEntry's two doors: "Add a comment" pins the post,
 * "Reply" pins the comment it was pressed on.
 */
export type ReplyTarget = {
  readonly id: string;
  readonly kind: "post" | "comment";
  /** The post's title, or the comment author's handle — the chip's first line. */
  readonly label: string;
  readonly authorHandle: string;
  readonly authorName: string;
  readonly avatarUrl: string | null;
  /** One clipped line of what is being answered. */
  readonly snippet: string;
};

export type ReplyState = {
  readonly step: ReplyStep;
  readonly target: ReplyTarget;
  readonly words: string;
  readonly media: CommentMedia;
  readonly tags: readonly TagDraft[];
  readonly references: readonly ReferenceDraft[];
  readonly license: License;
  /** Where the author stands on what they answer — the genesis Review's pair. */
  readonly stance: StancePair;
};

/** The policy default the seal shows before anyone opens the pad (+0.10 / +0.10). */
export const DEFAULT_REPLY_STANCE: StancePair = TAP_DEFAULT;

export function emptyReply(target: ReplyTarget): ReplyState {
  return {
    step: "compose",
    target,
    words: "",
    media: NO_COMMENT_MEDIA,
    tags: [],
    references: [],
    license: PUBLIC_DOMAIN,
    stance: DEFAULT_REPLY_STANCE,
  };
}

// ---------------------------------------------------------------- the steps

const STEPS: readonly ReplyStep[] = ["compose", "seal"];

export function stepIndex(state: ReplyState): number {
  return Math.max(0, STEPS.indexOf(state.step));
}

/** Null at the seal — it advances by signing, not by stepping. */
export function nextStep(state: ReplyState): ReplyStep | null {
  return STEPS[stepIndex(state) + 1] ?? null;
}

/** Null on the composer, where the arrow leaves for the thread. */
export function previousStep(state: ReplyState): ReplyStep | null {
  const index = stepIndex(state);
  return index > 0 ? (STEPS[index - 1] ?? null) : null;
}

// ------------------------------------------------------------- the gates

/**
 * Whether the composer may hand over to the seal.
 *
 * IT DOES NOT WAIT FOR THE UPLOADS, and that is the board's own rule:
 * ReplyPicturesWeb's Next leads to ReplySeal *or* to the gated seal
 * (ComposeSealUploading) when bytes are still moving. Holding the reader on
 * the composer instead would strand them in front of a button that does
 * nothing while the pictures upload — the seal is where the waiting is shown,
 * because the seal is where the waiting matters.
 */
export function advanceGate(state: ReplyState): Gate {
  if (state.words.trim() === "") return { ok: false, reason: "A comment needs words." };
  if (state.media.length > COMMENT_ATTACHMENT_CAP) {
    return {
      ok: false,
      reason: `A comment carries at most ${COMMENT_ATTACHMENT_CAP} pictures.`,
    };
  }
  return { ok: true };
}

/**
 * Whether the seal's own button may sign. STRICTER than the advance gate, and
 * this is where the difference lives: an attachment names an asset id, so a
 * comment cannot be prepared while a picture is still on its way. A batch that
 * was still arriving when Next was pressed settles under the gate line here
 * rather than bouncing the reader back a stage (ComposeSealUploading).
 */
export function sealGate(state: ReplyState): Gate {
  return commentGate(state.words, state.media);
}

// ------------------------------------------------------------- the outputs

/**
 * What "Sign comment" would sign. The comment is one act; each topic and each
 * citation is its own. Attaching mints no record — the pictures were uploaded
 * before any of this, outside the graph entirely.
 */
export function signedActions(state: ReplyState): number {
  return 1 + state.tags.length + state.references.length;
}

/** The seal's lede: what is answered, and how long the answer is. */
export function replySummary(state: ReplyState): string {
  const count = [...state.words.trim()].length;
  const characters = count === 1 ? "1 character" : `${count} characters`;
  return `Reply to "${state.target.label}" — ${characters}.`;
}

/** The acts card's first row — what the one signed act actually is. */
export function replyActLabel(target: ReplyTarget): string {
  return target.kind === "post"
    ? `Reply to @${target.authorHandle}'s post`
    : `Reply to @${target.authorHandle}'s comment`;
}

// ------------------------------------------------------------- the actions

export type ReplyAction =
  | { type: "words"; words: string }
  | { type: "pick"; assets: readonly { id: string; file: Blob }[] }
  | { type: "unpick"; id: string }
  | { type: "altText"; id: string; altText: string }
  | { type: "upload"; id: string; upload: AssetUpload }
  | { type: "tags"; tags: readonly TagDraft[] }
  | { type: "references"; references: readonly ReferenceDraft[] }
  | { type: "license"; license: License }
  | { type: "stance"; stance: StancePair }
  | { type: "advance" }
  | { type: "back" };

export function replyReducer(state: ReplyState, action: ReplyAction): ReplyState {
  switch (action.type) {
    case "words":
      return { ...state, words: action.words };

    case "pick":
      // The cap is enforced on the way in, by the shared model: a fifth picture
      // refused after it uploaded wastes the upload and the wait.
      return { ...state, media: pickInto(state.media, action.assets) };

    case "unpick":
      return { ...state, media: removeFrom(state.media, action.id) };

    case "altText":
      return {
        ...state,
        media: state.media.map((asset) =>
          asset.id === action.id ? { ...asset, altText: action.altText } : asset,
        ),
      };

    case "upload":
      return { ...state, media: withUpload(state.media, action.id, action.upload) };

    case "tags":
      return { ...state, tags: action.tags };

    case "references":
      return { ...state, references: action.references };

    case "license":
      return { ...state, license: action.license };

    case "stance":
      // Clamped here rather than trusted from a control: the contract's
      // Dimension is the closed interval, and the pad is not the only caller.
      return { ...state, stance: clampPair(action.stance) };

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
