// What a batch of picked files becomes: some accepted, some refused with
// words.
//
// THE REFUSAL IS PER FILE AND IT PERSISTS (ComposePickedErrors). The board
// draws a LIST of refusals, each carrying its own "Remove it", sitting beside a
// tray that went on accepting everything else — "Picked · 2" above two refused
// files. That shape is the ruling: a batch is screened file by file, what
// passes joins the draft, and what does not stays on screen saying why until
// the author dismisses it. A single transient banner cannot express that, which
// is why this returns a list rather than a message.
//
// A REFUSED FILE NEVER JOINS THE BATCH. The board's own edge says so — "the
// refusal leaves the list — the file never joined the batch" — so there is
// nothing to undo when one is dismissed, and Next carries on with what was
// accepted.
//
// The screening is here, as pure data, rather than in the component: these are
// the product's format rules, and every one of them is a rule a test should be
// able to state directly.

import type { MediaScale } from "@/__generated__/graphql";
import { clipOutlook } from "@/lib/ui2/media/compress-video";
import { isAnimatedGif } from "@/lib/ui2/media/gif";
import {
  COMMENT_VIDEO_MAX_BYTES,
  PICTURE_MAX_BYTES,
  POST_VIDEO_MAX_BYTES,
  megabytes,
} from "@/lib/ui2/media/caps";
import { pickedContainer } from "@/lib/ui2/media/video";
import { newComposeId } from "./ids";
import { POST_ATTACHMENT_CAP, type MediaKind } from "./wizard";

/** One file that did not get in, and the sentence the author reads about it. */
export type PickRefusal = {
  readonly id: string;
  /** The file's own name, so a reader can tell which of five it was. */
  readonly name: string;
  readonly reason: string;
  /**
   * The file itself, so a picture refusal can preview its own bytes
   * (`RefusedFile`, `ComposePickedErrors`). Never uploaded and never read for
   * anything else — a refused file never joins the batch.
   */
  readonly file: File;
};

export type PickOutcome = {
  readonly accepted: readonly File[];
  /** What the accepted files are; a batch is never mixed by the time it is out. */
  readonly kind: MediaKind;
  readonly refusals: readonly PickRefusal[];
};

// The two sentences ComposePickedErrors draws, verbatim. The cap is named only
// here — the board states it in the refusal and nowhere else, so a reader is
// told the limit at the moment it matters instead of being warned in advance
// about a file they may never pick.
//
// The picture sentence is spoken by the UPLOAD (`runUpload`, and the avatar's
// own resolve), never by this screening: the cap governs the encoded bytes, and
// the encode is what makes it unreachable for an ordinary photo.
export const TOO_BIG_PICTURE = `That picture is too big — a picture can be up to ${megabytes(PICTURE_MAX_BYTES)}.`;
export const UNREADABLE = "That file isn't a picture or a video CoGra can read.";

/**
 * The comment's video refusal, drawn verbatim by ReplyMediaErrors — the cap is
 * named only in the refusal, so a reader is told the limit at the moment it
 * matters rather than warned in advance about a file they may never pick.
 */
export const TOO_BIG_VIDEO_COMMENT = `That video is too big — a comment's video can be up to ${megabytes(COMMENT_VIDEO_MAX_BYTES)}.`;

// Undrawn, written to the board's pattern. Reported rather than presented as
// board-backed: ComposePickedErrors draws the picture case and the
// unknown-format case, and these are the cases the post path has beyond them.
export const TOO_BIG_VIDEO_POST = `That video is too big — a post's video can be up to ${megabytes(POST_VIDEO_MAX_BYTES)}.`;
export const ANIMATED_GIF =
  "That GIF moves, and CoGra can't take a moving GIF here. A still one is fine.";
export const MIXED_BODY = "A post carries pictures or one video, not both.";
export const MIXED_BODY_COMMENT = "A comment carries pictures or one video, not both.";
/**
 * A second clip — one more in a photos-app batch, or one dropped while a clip
 * is staged; the batch's first clip is the body (copy-voice, *Refused files*,
 * round 22; ComposePick.md, ComposePickWeb.md).
 */
export const ONE_VIDEO = "A post carries one video.";
/** Its comment-scale twin. */
export const ONE_VIDEO_COMMENT = "A comment carries one video.";
/** The eleventh picture's line (copy-voice, *Refused files*; ComposePick.md). */
export const TOO_MANY_POST = "That's more than a post carries — up to ten pictures.";
/** The fifth picture's line, the comment's twin (copy-voice, *Refused files*). */
export const TOO_MANY_COMMENT = "That's more than a comment carries — up to four pictures.";

/**
 * A video picked into an edit whose body has no clip. The add path is staged
 * (staged-surfaces, *A video picked at an edit*): the drawn path takes the clip
 * through the cover step (EditWords.md: "its face is chosen on the cover step
 * before the edit takes it"), and until it ships the media row refuses the clip
 * in these words, `Remove it` alone (copy-voice, *Refused files*, seam 248).
 */
export const VIDEO_AT_EDIT = "A video can't join an edit yet — post it on its own.";

/**
 * What a surface's video costs and what it says when a file exceeds it.
 *
 * A comment is the post's grammar at half the byte budget, so the two differ in
 * exactly these values and nothing else — which is why they are a parameter
 * rather than a second copy of the screening. `destination` is the same fact
 * said to the server: the upload names it, and the server sizes the clip for
 * that parent's cap.
 */
export type PickScale = {
  readonly videoMaxBytes: number;
  /**
   * Spoken here for a clip provably over the cap, and by the upload
   * (`runVideoUpload`) for one whose encoded bytes still came out over it.
   */
  readonly tooBigVideo: string;
  readonly mixedBody: string;
  /** What a second clip reads: the body holds one. */
  readonly oneVideo: string;
  readonly destination: MediaScale;
  /**
   * How many pictures the body holds, and the line a picture past that reads.
   * NEVER A PICTURE DROPPED IN SILENCE (ComposePick.md, ComposePickedErrors.md):
   * the overflow is refused in words beside the rest. Omitted where the
   * surface still caps its batch on its own.
   */
  readonly pictureCap?: { readonly count: number; readonly refusal: string };
};

export const POST_SCALE: PickScale = {
  videoMaxBytes: POST_VIDEO_MAX_BYTES,
  tooBigVideo: TOO_BIG_VIDEO_POST,
  mixedBody: MIXED_BODY,
  oneVideo: ONE_VIDEO,
  destination: "POST",
  pictureCap: { count: POST_ATTACHMENT_CAP, refusal: TOO_MANY_POST },
};

export const COMMENT_SCALE: PickScale = {
  videoMaxBytes: COMMENT_VIDEO_MAX_BYTES,
  tooBigVideo: TOO_BIG_VIDEO_COMMENT,
  mixedBody: MIXED_BODY_COMMENT,
  oneVideo: ONE_VIDEO_COMMENT,
  destination: "COMMENT",
};

function isVideoType(file: File): boolean {
  return file.type.startsWith("video/");
}

function isPictureType(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Screen a batch against what the draft is already holding.
 *
 * `held` is what the draft has now: a video takes the body whole, so anything
 * offered beside one is refused, and a video offered beside pictures is refused
 * the same way. Neither ever replaces what is there — losing nine framed
 * pictures to a mis-drop is the outcome all of this exists to prevent.
 */
export async function screenPick(
  files: readonly File[],
  held: { readonly hasVideo: boolean; readonly count: number },
  scale: PickScale = POST_SCALE,
): Promise<PickOutcome> {
  const refusals: PickRefusal[] = [];
  const pictures: File[] = [];
  const videos: File[] = [];
  const refuse = (file: File, reason: string) => {
    refusals.push({ id: newComposeId(), name: file.name, reason, file });
  };

  for (const file of files) {
    if (isVideoType(file)) {
      // The container is read from the BYTES: a File's type is the operating
      // system's guess from the extension, so a renamed .mkv claims video/mp4
      // and is not one. MP4 and an iPhone's QuickTime get in; both leave the
      // device as MP4 (`strip-video.ts`).
      if ((await pickedContainer(file)) === null) {
        refuse(file, UNREADABLE);
        continue;
      }
      // THE CAP IS ON WHAT IS SENT (jakob, 2026-09-23: "a video with 300mb that
      // compresses to less than 100mb is eligible"). A clip over it as picked
      // gets in wherever this browser will encode it down and the encode can
      // fit; the one it provably cannot fit — so long that even the floor
      // rate overflows — is refused now, in the same words, rather than after
      // the wait. Where there is no encode, the picked bytes are what go, and
      // they are weighed as they are. Whatever still comes out over the cap is
      // refused at upload (`runVideoUpload`), as a picture is.
      const outlook = await clipOutlook(file, scale.videoMaxBytes);
      // A picture that is not H.264 — an iPhone's HEVC — on a browser that
      // cannot turn it into H.264 is a video CoGra cannot take from here: the
      // server admits H.264 alone, and sending it would only earn that refusal
      // after the whole upload. The container line says so in its own words.
      if (outlook === "unconvertible") {
        refuse(file, UNREADABLE);
        continue;
      }
      if (outlook === "too-long" || (outlook === "as-picked" && file.size > scale.videoMaxBytes)) {
        refuse(file, scale.tooBigVideo);
        continue;
      }
      videos.push(file);
      continue;
    }

    if (isPictureType(file)) {
      // NO SIZE CHECK ON A PICTURE HERE. The cap is on the bytes that are
      // UPLOADED, and a picture is downscaled and re-encoded before any of them
      // leave (`encode-image.ts`: 1080 wide, WebP at 0.8), so a phone camera's
      // 12 MB original becomes a few hundred kilobytes. Screening the SOURCE
      // against the upload cap refused ordinary camera photos the product would
      // have taken happily — `runUpload` weighs the encoded blob instead, which
      // is the thing the server actually measures. A video carries no such pass,
      // which is why it is still screened above.
      //
      // AN ANIMATED GIF IS REFUSED IN WORDS rather than flattened in silence.
      // The encoder draws one frame onto a canvas, so an animation that went
      // down that path arrived as a still with nothing said; the browser has
      // no animated encoder to convert it with, so saying no is the honest
      // answer. A still GIF converts exactly as it always did.
      if (await isAnimatedGif(file)) {
        refuse(file, ANIMATED_GIF);
        continue;
      }
      pictures.push(file);
      continue;
    }

    refuse(file, UNREADABLE);
  }

  // A video takes the body whole, so the kinds cannot share a batch or a
  // draft. Onto a staged clip a picture is the mixing's refusal and a clip the
  // one-video one (ComposePickWeb.md, round 22).
  if (held.hasVideo) {
    for (const file of videos) refuse(file, scale.oneVideo);
    for (const file of pictures) refuse(file, scale.mixedBody);
    return { accepted: [], kind: "picture", refusals };
  }

  if (videos.length > 0) {
    if (held.count > 0 || pictures.length > 0) {
      // THE PICTURES ARE KEPT AND THE VIDEO IS REFUSED (ComposePick.md): a
      // clip beside pictures — in the tray or in the same batch — is the one
      // that cannot join; the pictures go on to the cap below.
      for (const file of videos) refuse(file, scale.mixedBody);
    } else {
      // One video, however many were offered at once: the batch's first is
      // the body, and each other clip reads the one-video line.
      for (const extra of videos.slice(1)) refuse(extra, scale.oneVideo);
      return { accepted: videos.slice(0, 1), kind: "video", refusals };
    }
  }

  // The grammar's last word: the pictures past the body's cap are refused, one
  // line each, and the ones that fit still join.
  const cap = scale.pictureCap;
  if (cap !== undefined) {
    const room = Math.max(0, cap.count - held.count);
    for (const extra of pictures.slice(room)) refuse(extra, cap.refusal);
    return { accepted: pictures.slice(0, room), kind: "picture", refusals };
  }
  return { accepted: pictures, kind: "picture", refusals };
}
