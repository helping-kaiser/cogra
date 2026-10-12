"use client";

// THE DETAIL CLIP — the top of a video post's detail view
// (`design/components/media/DetailClip.jsx`).
//
// IT SITS ABOVE THE CARD, NOT INSIDE IT, "which is why the author chip leads
// the CARD on that surface rather than the screen. On every other surface the
// chip sits above the content; here the content the reader is already watching
// sits above everything, and the card beneath it is the post as it always
// reads" (`DetailClip.jsx:10-13`).
//
// IT IS CONTENT, AND SCROLLS WITH THE PAGE (jakob's ruling 100, 2026-10-09 —
// design/readme.md §13, "The clip detail rulings"): "Comments live in their
// sheet, so nothing stands below the post on its detail but the post itself,
// and a clip held on screen would take the room the post is read in"
// (`DetailClip.jsx:15-17`). It heads the detail's column, flush on the card —
// the caller sets the two as one block (`DetailClip.prompt.md:15`) — and
// nothing here holds it on screen.
//
// OPENING THE DETAIL STARTS IT, and scroll never stops it: "the open is the
// deliberate act, so no share of the screen gates it" and "a clip scrolled out
// of view plays on — scroll never stops it — and no floating player takes its
// place" (`DetailClip.jsx:18-21`). That is its stage's law, not this frame's:
// the stage it stands on is a DETAIL stage (`stage-host.tsx`, `stage.ts`),
// which starts the clip on the open and never decides from the scroll.
//
// THE GROUND IS BLACK (`DetailClip.jsx:51` — `background: "#000"`), "so a clip
// that does not fill the frame's width sits on the same ground the viewer would
// give it" (`DetailClip.jsx:24-26`).
//
// IT CARRIES THE FULL TRANSPORT (`controls="transport"`), the ladder's second
// rung: the reader opened this clip on purpose.
//
// THE DETAIL CLIP'S VEIL FACE (jakob 2026-09-24): a sensitive post's clip
// veils IN PLACE — the caller wraps it in a `BodyVeil` sharing the post's own
// reveal, never demoting it into the card — and the transport goes with it
// (PostDetailVideoSensitive.md:3-7). `VideoPlayer` already refuses the playback
// claim while `useVeiled()` reads true (`video-player.tsx`, backlog item 103),
// but it draws its transport bar off `surface` alone, with no veil check of its
// own — so a `transport` surface behind a veil would still mount play/pause,
// skip and a scrubber nothing plays under. Reading the veil here and dropping
// to a surface that draws no bar is what keeps "nothing plays beneath a veil"
// true of the controls too, without reaching into `VideoPlayer` to add a check
// it was not built to need everywhere else it is used.
//
// IT IS ITS DETAIL'S ONE STAGE (the stage-law packet §3.2 rule 12): a sheet or
// a dialog over the post stops it where it is and, dismissed, resumes it only
// if it was playing when the layer rose and the device allows autoplay; the
// reader's own pause survives; the opinion pad pauses and resumes it
// (PostDetailVideo.md:39–51). The unveil plays it where the device allows
// autoplay and never otherwise (PostDetailVideoSensitive.md:15/17) — the veil
// is an eligibility change on the one element, which the veil keeps mounted.

import { MediaTile } from "./media-tile";
import { useVeiled } from "./body-veil";
import { StageHost } from "./stage-host";

export function DetailClip({
  src,
  mimeType,
  poster,
  altText,
  sourceRatio,
  durationMs,
  mediaId,
  behindViewer = false,
  onOpenViewer,
  testId = "detail-clip",
}: {
  src: string;
  /** The clip's identity in the session's clip memory (`clip-memory.ts`). */
  mediaId?: string | null;
  /**
   * Whether the fullscreen viewer stands over the post. The detail clip has
   * handed its clip over to it: "WHEN the fullscreen viewer opens over the
   * post -> the clip stops AND NEVER it plays behind the viewer", and on close
   * it plays on, or stands paused, from where the viewer's clip reached
   * (PostDetailVideo.md:57–61).
   */
  behindViewer?: boolean;
  mimeType: string;
  poster?: string | null;
  altText?: string | null;
  sourceRatio?: number | null;
  durationMs?: number | null;
  /**
   * Where the clip's own tap goes (`DetailClip.jsx:28-29` — "the tap on it is
   * the surface's to wire: back into the stream where the reader came from it,
   * and into the fullscreen viewer everywhere else").
   *
   * THE STREAM HALF IS THE REEL PACKET'S (feed-card-rework BX-2). `Reel` is not
   * built, so PostDetailVideo.md:33 ("GIVEN the reader came from the stream …
   * the clip expands back into the stream") has no origin to come from yet;
   * every reader comes from "anywhere else" (:35), so the viewer half is the
   * whole of the wiring today, and the stream half lands with the stream.
   */
  onOpenViewer?: () => void;
  testId?: string;
}) {
  // Read off the nearest `BodyVeil`, if the caller put one around this clip
  // (a sensitive post's does). `transport` is the only surface that draws a
  // bar, so falling back to `full` while veiled is what keeps that bar out of
  // the tree entirely rather than merely blurred and still there to tab into
  // — see the veil-face note above.
  const veiled = useVeiled();
  return (
    <div
      data-testid={testId}
      // A LITERAL, not a role: this is the ground behind media, and the
      // viewer's own ground is black in both themes — a surface role would
      // make the band under a clip change colour with the theme while the
      // clip beside it did not.
      style={{ background: "#000" }}
    >
      <StageHost detail>
        <MediaTile
          src={src}
          mimeType={mimeType}
          poster={poster}
          altText={altText}
          sourceRatio={sourceRatio}
          durationMs={durationMs}
          mediaId={mediaId}
          handedOver={behindViewer}
          // "WHEN the phone turns to landscape GIVEN the detail holds a
          // landscape clip -> the fullscreen viewer opens on the clip"
          // (PostDetailVideo.md:63) — a clip wider than tall, by the ratio the
          // server probed. Never under the veil: nothing of a veiled clip
          // plays, and the viewer would show it bare.
          openOnLandscape={!veiled && (sourceRatio ?? 0) > 1}
          // On its stage: the detail stage starts it on the open, where the
          // device allows (PostDetailVideo.md:7/9). `VideoPlayer` itself
          // refuses the claim while veiled either way.
          autoplay
          surface={veiled ? "full" : "transport"}
          // The media meets the screen's own sides here: there is no card
          // around it to round against (`DetailClip.jsx:43` — `radius="0px"`).
          radius="0px"
          onOpen={onOpenViewer}
          testId={`${testId}-media`}
        />
      </StageHost>
    </div>
  );
}
