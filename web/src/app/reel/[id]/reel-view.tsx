"use client";

// THE STREAM (`design/designs/canonical/screens/Reel.jsx`, `ReelSensitive.jsx`;
// behavior/Reel.md, behavior/ReelSensitive.md; roadmap.md:596-609).
//
// A portrait clip's tap opens it: the list the clip was tapped in, narrowed to
// clips taller than they are wide, in that list's order (Reel.md:3) — held by
// `stream-session.ts`. This file is the SCREEN over that state:
//
// - THE GROUND is the stream's own black in the dark theme (`data-theme`,
//   Reel.jsx:59), standing below the system status bar and never painting its
//   strip (Reel.md:7-9): the page sets no `theme-color` and draws nothing
//   outside its own box.
// - ONE CLIP ON ONE STAGE (web-stage-law.md L01, "one stage per scroll
//   surface"): the clip on screen is the only candidate, so the stage elects
//   it the moment it is on screen where the device allows autoplay, and
//   everything else the stage law says — the pad pausing and resuming, a
//   sheet stopping, a hidden page, suppression never stopping a playing clip
//   (ruling 96), the veil's unveil being an eligibility change — holds here
//   because it is the same engine (`stage.ts`).
// - THE CHROME: the way back top-left and the sound disc top-right, the rail
//   down the right, the caption above the bar, the thin seek line on the bar
//   (Reel.jsx:76-149), and the bottom bar itself, which stays (Reel.md:17).
// - THE SWIPE: up brings the next clip, down the one before; nothing moves by
//   itself (Reel.md:31-47) — the session decides, this file only hears the
//   gesture.
// - THE SCORE DOOR: the rail's score opens the post's detail, the clip
//   squishing to its head still playing (Reel.md:59; the motion table's
//   squish, readme §13) — React's `<ViewTransition>` names the clip on both
//   sides, the documented shared-element pattern
//   (node_modules/next/dist/docs/01-app/02-guides/view-transitions.md), and
//   the clip's live element carries the frame it reached (`video-stage.ts`).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  ViewTransition,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { isPending, readCachedPost, type PostView } from "@/lib/api/content-api";
import { fetchFeedWindow } from "@/lib/api/feed-api";
import { useSeenOnOpen } from "@/lib/history/seen-tracker";
import {
  atTheEnd,
  onScreen,
  streamBack,
  streamFor,
  type StreamSession,
  type StreamState,
} from "@/lib/reel/stream-session";
import { streamFrom } from "@/lib/reel/stream-origin";
import { reelClipName } from "@/lib/reel/squish";
import { DASH, cardFigure } from "@/lib/score/figure";
import { useStanding } from "@/lib/score/use-standing";
import { useHostSnack } from "@/lib/saved/save-row";
import { useAlwaysUnveil } from "@/lib/settings/sensitive-content";
import { useAuthPhase } from "@/lib/session/provider";
import { BottomNav } from "@/lib/ui/bottom-nav";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { bodyIsSensitive, galleryItems, payloadIsRedacted, veilSource } from "@/lib/ui/post-media";
import { useShareCapable } from "@/lib/ui/share-button";
import { LINK_COPIED, shareLink } from "@/lib/ui/share";
import { Snackbar } from "@/lib/ui/snackbar";
import { StanceControl } from "@/lib/ui/stance-control";
import { InlineAction } from "@/lib/ui2/inline-action";
import { VEIL_SOURCES, VeilContext, VisibilityGlyph } from "@/lib/ui2/media/body-veil";
import { ReelCaption } from "@/lib/ui2/media/reel-caption";
import { ReelPlate } from "@/lib/ui2/media/reel-plate";
import { ReelRail } from "@/lib/ui2/media/reel-rail";
import { rememberReveal, sensitiveSignature, useRevealed } from "@/lib/ui2/media/reveal";
import { StageHost } from "@/lib/ui2/media/stage-host";
import { VideoPlayer } from "@/lib/ui2/media/video-player";
import { CommentsSheet } from "@/app/comments/comments-sheet";

/**
 * The stream's nodes, registered as `reel` (nodes.json, round 26 — `Reel` and
 * `ReelSensitive`, one surface in two states, one prefix).
 */
const REEL: DataNode = { path: "reel" };
const STAGE = part(REEL, "stage");
const RAIL = part(REEL, "rail");
const CAPTION = part(REEL, "caption");

/** The stream's lines (Reel.jsx:126-138; copy-voice, the slice-3 round). */
export const LAST_CLIP_HERE = "That's the last clip here.";
export const COULDNT_LOAD_MORE = "Couldn't load more";

/** The veil's face (`SensitiveVeil` media face; copy-voice.md:3100-3107). */
const VEIL_LABEL = "Sensitive — tap to view";

/**
 * Where the stream's stacked chrome stands above the screen's foot: the bar's
 * own height plus the phone's bottom inset, and the drawn lift over it
 * (`BAND_HEIGHT + n`, Reel.jsx:87, :123, :143).
 */
function aboveBar(px: number): string {
  return `calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + ${px}px)`;
}

/** How far a drag travels before it is a swipe rather than a tap. */
const SWIPE_PX = 48;

export function ReelView({ postId }: { postId: string }) {
  const client = useApolloClient();
  const router = useRouter();
  // THE STREAM THE READER IS IN: the held one carrying this clip — the tap
  // that opened it, or a return from the detail — or, cold, a stream of the
  // one clip the cache already holds.
  const [session, setSession] = useState<StreamSession | null>(() =>
    streamFor(postId, readCachedPost(client, postId)),
  );
  // A COLD LINK the cache does not hold reads the post (the card's own read,
  // `feed(orderedIds)`), and a post that is not a stream clip opens as the
  // post it is.
  useEffect(() => {
    if (session !== null) return;
    let cancelled = false;
    void fetchFeedWindow(client, [postId], ["POST"]).then((read) => {
      if (cancelled) return;
      const post = read.kind === "success" ? (read.value[0] as PostView | undefined) : undefined;
      const opened = post !== undefined ? streamFor(postId, post) : null;
      if (opened !== null) setSession(opened);
      else router.replace(`/posts/${postId}`);
    });
    return () => {
      cancelled = true;
    };
  }, [client, postId, router, session]);

  return (
    <div
      data-theme="dark"
      data-testid="reel"
      // THE STREAM'S BLACK (Reel.jsx:59) — a literal, as the media ground is
      // everywhere: the viewer's ground is black in both themes.
      className="relative min-h-0 flex-1 overflow-hidden text-on-surface"
      style={{ background: "#000", colorScheme: "dark" }}
    >
      {session !== null && <Stream session={session} />}
    </div>
  );
}

function Stream({ session }: { session: StreamSession }) {
  const state = useSyncExternalStore(session.subscribe, () => session.snapshot, () => session.snapshot);
  const clip = onScreen(state);
  const back = streamBack(state.origin);
  const phase = useAuthPhase();
  const { snack, notify, dismiss } = useHostSnack();
  // The direction the last move went, for the incoming clip's entrance.
  const [moved, setMoved] = useState<"next" | "previous" | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<{ id: string; total: number } | null>(null);

  // THE ADDRESS FOLLOWS THE CLIP ON SCREEN, so a reload opens on it. The
  // native `replaceState` is the App Router's documented way to change the URL
  // without a navigation (Next docs, "Linking and navigating": window.history).
  useEffect(() => {
    if (clip === undefined) return;
    const here = `/reel/${clip.id}`;
    if (window.location.pathname !== here) window.history.replaceState(null, "", here);
  }, [clip]);

  const next = useCallback(() => {
    if (session.next()) setMoved("next");
  }, [session]);
  const previous = useCallback(() => {
    if (session.previous()) setMoved("previous");
  }, [session]);

  // THE KEYS PAGE TOO, for a reader with no swipe: the arrows and Page keys,
  // the scroller's own grammar. A key aimed at a control — the seek slider,
  // a field in a sheet — is that control's.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || commentsOpen) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, [role=slider], [role=dialog], dialog") !== null) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        previous();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentsOpen, next, previous]);

  // THE SWIPE: a vertical drag past `SWIPE_PX` that travelled more than it
  // strayed. Controls that own their own drag — the seek line, the opinion's
  // hold — stop the pointer before it reaches here.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const from = start.current;
    start.current = null;
    if (from === null) return;
    const dy = event.clientY - from.y;
    const dx = event.clientX - from.x;
    if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx)) return;
    if (dy < 0) next();
    else previous();
  };
  // A wheel's notch is one page, not a scroll: the stream has no offset.
  const wheelAt = useRef(0);
  const onWheel = (event: ReactWheelEvent) => {
    if (Math.abs(event.deltaY) < 20 || event.timeStamp - wheelAt.current < 400) return;
    wheelAt.current = event.timeStamp;
    if (event.deltaY > 0) next();
    else previous();
  };

  if (clip === undefined) return null;
  const comments = liveComments?.id === clip.id ? liveComments.total : clip.comments.totalCount;

  return (
    <>
      <div
        className="absolute inset-0"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (start.current = null)}
        onWheel={onWheel}
      >
        {/* THE STREAM'S ONE STAGE (web-stage-law.md L01). */}
        <StageHost>
          <Clip
            key={clip.id}
            post={clip}
            state={state}
            entrance={moved}
            onRetry={() => session.retry()}
            onOpenComments={() => setCommentsOpen(true)}
            comments={comments}
            onCopied={() => notify(LINK_COPIED)}
          />
        </StageHost>
        {/* THE WAY BACK (Reel.md:75-79), the media disc's surface because it
            sits on photography. Back closes onto the origin exactly — the
            origin keeps its own place (`feed-memory.ts`), so the arrow does
            not scroll it. */}
        <Link
          href={back.href}
          scroll={false}
          aria-label={back.label}
          {...testAttributes(part(REEL, "backDisc"))}
          className="cg-state cg-focus cg-hit absolute grid size-9 place-items-center rounded-full"
          style={{ top: 8, left: 8, zIndex: 4, background: "var(--surface-snackbar)", color: "var(--on-surface-snackbar)" }}
        >
          <Icon name="arrow_back" size={20} />
        </Link>
      </div>
      {/* THE BOTTOM BAR STAYS (Reel.md:17; Reel.jsx:147-149): the stream is
          Feed's (readme §13, stack ownership), so the Feed slot is lit and
          leaves the stream for the feed it narrowed. */}
      <div className="absolute inset-x-0 bottom-0" style={{ zIndex: 4 }}>
        <BottomNav active="feed" signedIn={phase === "signedIn"} node={part(REEL, "bottomBar")} />
      </div>
      <Snackbar
        testId="reel-snackbar"
        node={part(REEL, "snackbar")}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismiss}
      />
      {/* THE SAME COMMENTS SHEET, over the clip (Reel.md:71): its covering
          layer stops the clip — a sheet suspends the stage. */}
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        post={clip}
        onCount={(total) => setLiveComments({ id: clip.id, total })}
      />
    </>
  );
}

/** The veil's predicate (settings packet B5): sensitive, and the account does not always unveil. */
function useStreamVeil(post: PostView): { veiled: boolean; reveal: () => void } {
  const alwaysUnveil = useAlwaysUnveil();
  const signature = sensitiveSignature(post);
  const revealed = useRevealed(post.id, signature);
  const sensitive = !payloadIsRedacted(post) && bodyIsSensitive(post) && !alwaysUnveil;
  return {
    veiled: sensitive && !revealed,
    // ONE REVEAL FOR THE POST, AND IT LASTS THE SESSION (ReelSensitive.md:29):
    // the shared reveal store every surface showing the post reads.
    reveal: () => rememberReveal(post.id, signature),
  };
}

function Clip({
  post,
  state,
  entrance,
  onRetry,
  onOpenComments,
  comments,
  onCopied,
}: {
  post: PostView;
  state: StreamState;
  entrance: "next" | "previous" | null;
  onRetry: () => void;
  onOpenComments: () => void;
  comments: number;
  onCopied: () => void;
}) {
  const [media] = galleryItems(post);
  const { veiled, reveal } = useStreamVeil(post);
  const standing = useStanding(post.id, isPending(post));
  const shareCapable = useShareCapable();
  // A CLIP STANDING ON THE STREAM'S STAGE COUNTS ITS POST SEEN, once (the
  // packet's RL-G14 reading; History.md:5-7 — the top-layer content, whole).
  useSeenOnOpen(post.id);

  const from = streamFrom(post.id);
  const author = post.author;
  const title = post.title.value ?? null;
  const description = post.description.value ?? null;
  // WHOSE MARK THE VEIL IS: the author's mark alone says (`veilSource`) — every
  // status, `moderationStatus` included, reads the OR of the two marks.
  const source = VEIL_SOURCES[veilSource(post)];

  const notice = atTheEnd(state) ? (
    <ReelPlate node={part(CAPTION, "notice")}>
      <span className="text-on-surface-variant">{LAST_CLIP_HERE}</span>
    </ReelPlate>
  ) : state.fault ? (
    <ReelPlate node={part(CAPTION, "notice")}>
      <span className="text-on-surface-variant">{COULDNT_LOAD_MORE}</span>
      <InlineAction size="sm" ariaLabel="Retry loading more" onClick={onRetry} node={part(CAPTION, "notice.retry")}>
        Retry
      </InlineAction>
    </ReelPlate>
  ) : undefined;

  return (
    <div
      className={
        entrance === "next" ? "cg-reel-next absolute inset-0" : entrance === "previous" ? "cg-reel-previous absolute inset-0" : "absolute inset-0"
      }
    >
      {/* THE CLIP, at its own full frame (Reel.jsx:60-64): cover, as drawn —
          "letterboxing exists nowhere" (the packet's RL-G10 reading). Under
          the veil it stays mounted and blurred in place, so the unveil moves
          nothing and is an eligibility change on the same element
          (ReelSensitive.jsx:24-28; `body-veil.tsx`). */}
      <div
        {...testAttributes(STAGE, undefined)}
        aria-hidden={veiled ? "true" : undefined}
        className="absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={veiled ? { filter: "blur(24px)", transform: "scale(1.06)" } : undefined}
        >
          <VeilContext.Provider value={veiled}>
            {media !== undefined && media.src && (
              <ViewTransition name={reelClipName(media.mediaId ?? post.id)} share="cg-squish" default="none">
                <div className="absolute inset-0">
                  <VideoPlayer
                    src={media.src}
                    poster={media.poster}
                    altText={media.altText}
                    durationMs={media.durationMs}
                    mediaId={media.mediaId}
                    surface="stream"
                    framed
                    testId="reel-clip"
                    soundNode={part(REEL, "soundDisc")}
                    playNode={part(REEL, "playDisc")}
                    seekNode={part(REEL, "seekLine")}
                  />
                </div>
              </ViewTransition>
            )}
          </VeilContext.Provider>
        </div>
      </div>
      {veiled && (
        // THE STANDARD VEIL'S MEDIA FACE over the whole frame (ReelSensitive.jsx
        // :42-48): the mark, whose mark it is, and the face's words kept clear
        // of the rail on both sides (`faceGutter="76px"`) so they stay centred.
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            reveal();
          }}
          aria-label={`${VEIL_LABEL}. ${source}`}
          {...testAttributes(part(STAGE, "veil"))}
          className="cg-focus absolute inset-0 grid cursor-pointer place-items-center border-0 p-0"
          style={{ background: "color-mix(in oklab, var(--scrim-dialog) 55%, transparent)", zIndex: 1 }}
        >
          <span className="flex flex-col items-center gap-2 text-center" style={{ padding: "0 76px", color: "#fff" }}>
            <VisibilityGlyph />
            <span className="text-label-large">{VEIL_LABEL}</span>
            <span className="text-body-small" style={{ opacity: 0.85 }}>
              {source}
            </span>
          </span>
        </button>
      )}
      {/* THE TWO WASHES (Reel.jsx:66-74): chrome over photography needs its own
          contrast, and a gradient does it without drawing a bar. Inert, so a
          veil beneath keeps the whole frame as its tap (ReelSensitive.jsx:54). */}
      <div
        aria-hidden="true"
        {...testAttributes(part(REEL, "washTop"))}
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: 140, zIndex: 2, background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))" }}
      />
      <div
        aria-hidden="true"
        {...testAttributes(part(REEL, "washBottom"))}
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height: 260, zIndex: 2, background: "linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))" }}
      />
      <ReelRail
        node={RAIL}
        bottom={aboveBar(96)}
        author={
          author === null
            ? null
            : {
                handle: author.handle,
                displayName: author.displayName.value ?? author.handle,
                src: author.avatar?.url ?? null,
                // The profile's way back reads `Back to the stream`
                // (copy-voice.md:721-722) — the reader's own clip's included
                // (the packet's RL-G16 reading).
                href: `/u/${encodeURIComponent(author.handle)}?from=${encodeURIComponent(from)}`,
              }
        }
        stance={
          // THE SYSTEM'S OWN CONTROL in its media dress: the same tap, hold,
          // pad over the paused clip, seal, guest gate and key notice
          // (Reel.md:61-73; graph.json Reel via 4).
          <StanceControl
            overMedia
            target={{ id: post.id, kind: "post", label: "this post" }}
            testIdPrefix="reel-stance"
            node={part(RAIL, "stance")}
            // The face's line is the rail's own `stanceLine`, beside the face
            // (ReelRail.jsx: the placer's, never the stance node's part).
            lineNode={part(RAIL, "stanceLine")}
          />
        }
        comments={comments}
        onOpenComments={onOpenComments}
        share={
          shareCapable
            ? {
                onShare: () => {
                  void shareLink(new URL(`/posts/${post.id}`, window.location.href).toString()).then(
                    (outcome) => {
                      if (outcome === "copied") onCopied();
                    },
                  );
                },
              }
            : undefined
        }
        score={{
          // THE SAME FIGURE THE CARD WEARS, the one the latest fetch of the post
          // found (Reel.md:21, :27, :29 — `standing.ts`, the score readout's
          // store), and every face is the door to the post (Reel.md:23).
          value: standing.kind === "figure" ? cardFigure(standing.score) : DASH,
          settling: standing.kind === "settling",
          href: `/posts/${post.id}?from=${encodeURIComponent(from)}`,
        }}
      />
      <ReelCaption
        node={CAPTION}
        bottom={aboveBar(66)}
        handle={author?.handle ?? null}
        title={title}
        description={description}
        notice={notice}
        veiled={veiled}
        onReveal={reveal}
      />
    </div>
  );
}
