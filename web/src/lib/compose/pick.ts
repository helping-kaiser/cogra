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

import { isAnimatedGif } from "@/lib/ui2/media/gif";
import { PICTURE_MAX_BYTES, POST_VIDEO_MAX_BYTES, megabytes } from "@/lib/ui2/media/caps";
import { looksLikeMp4 } from "@/lib/ui2/media/video";
import type { MediaKind } from "./wizard";

/** One file that did not get in, and the sentence the author reads about it. */
export type PickRefusal = {
  readonly id: string;
  /** The file's own name, so a reader can tell which of five it was. */
  readonly name: string;
  readonly reason: string;
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
export const TOO_BIG_PICTURE = `That picture is too big — a picture can be up to ${megabytes(PICTURE_MAX_BYTES)}.`;
export const UNREADABLE = "That file isn't a picture or a video CoGra can read.";

// Undrawn, written to the board's pattern. Reported rather than presented as
// board-backed: the board draws the picture case and the unknown-format case,
// and these three are the cases the web path has that it does not draw.
export const TOO_BIG_VIDEO = `That video is too big — a video can be up to ${megabytes(POST_VIDEO_MAX_BYTES)}.`;
export const ANIMATED_GIF =
  "That GIF moves, and CoGra can't take a moving GIF here. A still one is fine.";
export const MIXED_BODY = "A post carries pictures or one video, not both.";

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
): Promise<PickOutcome> {
  const refusals: PickRefusal[] = [];
  const pictures: File[] = [];
  const videos: File[] = [];
  let sequence = 0;
  const refuse = (file: File, reason: string) => {
    sequence += 1;
    refusals.push({ id: `${Date.now()}-${sequence}-${file.name}`, name: file.name, reason });
  };

  for (const file of files) {
    if (isVideoType(file)) {
      // The container is read from the BYTES: a File's type is the operating
      // system's guess from the extension, so a renamed .mkv claims video/mp4
      // and is not one. The server reads the same header.
      if (!(await looksLikeMp4(file))) {
        refuse(file, UNREADABLE);
        continue;
      }
      if (file.size > POST_VIDEO_MAX_BYTES) {
        refuse(file, TOO_BIG_VIDEO);
        continue;
      }
      videos.push(file);
      continue;
    }

    if (isPictureType(file)) {
      if (file.size > PICTURE_MAX_BYTES) {
        refuse(file, TOO_BIG_PICTURE);
        continue;
      }
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

  // A video takes the body whole, so the kinds cannot share a batch or a draft.
  if (held.hasVideo) {
    for (const file of [...videos, ...pictures]) refuse(file, MIXED_BODY);
    return { accepted: [], kind: "picture", refusals };
  }

  if (videos.length > 0) {
    if (held.count > 0 || pictures.length > 0) {
      for (const file of [...videos, ...pictures]) refuse(file, MIXED_BODY);
      return { accepted: [], kind: "picture", refusals };
    }
    // One video, however many were offered at once. The rest are refused for
    // the same reason a second one cannot join: the body holds one.
    for (const extra of videos.slice(1)) refuse(extra, MIXED_BODY);
    return { accepted: videos.slice(0, 1), kind: "video", refusals };
  }

  return { accepted: pictures, kind: "picture", refusals };
}
