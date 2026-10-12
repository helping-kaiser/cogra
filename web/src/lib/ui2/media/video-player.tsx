"use client";

// The feed's video: autoplay muted when it comes into view, the sound disc
// every card wears, and the one global mute.
//
// AUTOPLAY IS ONLY EVER MUTED, and that is a platform rule rather than a taste.
// MDN: "Autoplay blocking is not applied to <video> elements when the source
// media does not have an audio track, or if the audio track is muted… Inaudible
// media are not affected by autoplay blocking."
// (https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) Chrome
// states it more bluntly still — "Muted autoplay is always allowed"
// (https://developer.chrome.com/blog/autoplay/). So the element starts muted,
// and sound is something the reader turns on.
//
// AND THE PLAY CALL CAN STILL BE REFUSED. `play()` returns a promise that
// rejects — `NotAllowedError` — when the browser declines; a refused UNMUTED
// start plays muted and turns the sound off everywhere (FeedCover.md:41), which
// `playback.ts` does for every start this player makes.
//
// THE STAGE DECIDES WHEN IT PLAYS. The player measures nothing itself: it
// joins its surface's stage (`stage-host.tsx`), whose one IntersectionObserver
// and pure election say which clip holds it (the stage law, Feed.md:3–55), and
// the stage starts and freezes the element. A clip that loses the stage
// pauses rather than stopping: it stands on the frame it reached.
//
// THE MUTE IS BOUND BOTH WAYS. Nothing but this component's own sound disc
// changes `.muted` today, but a `volumechange` can still arrive from outside
// it — the browser's picture-in-picture window carries its own mute control —
// so reading it back into the shared store is what keeps an out-of-band mute
// from silently diverging from what every other player on screen shows.
//
// A DEVICE THAT SUPPRESSES AUTOPLAY GETS THE PLAY DISC. "ALWAYS the device
// suppresses autoplay GIVEN it asks for reduced motion or data saver"
// (FeedCover.md:23), and then no clip starts on its own (FeedCover.md:25) —
// so a frame whose clip is not playing wears the play disc in the sound
// disc's place (FeedCover.md:21), and a tap plays the clip where it stands
// (FeedCover.md:27). Read live through `autoplay-suppression.ts`: a reader
// changing either preference while the page is up changes the disc.
//
// ONE CLIP, MANY PRESENTATIONS (the stage-law packet §3.2 rules 5 and 13). A
// clip that has played never wears its stored still again within the reading
// session, its remounts included (FeedCover.md:7/9), and it carries the frame
// it reached card → detail → back (PostDetailVideo.md:53/55).
//
// THE ELEMENT ITSELF CARRIES IT (jakob's ruling q-fx2a). The `<video>` is not
// this component's: it is the clip's live element from the player layer's
// pool (`video-stage.ts`), taken when the player mounts and released when it
// leaves, so the clip's next presentation takes the SAME element — decoded,
// at the frame it reached, playing if it was — and nothing re-prepares. React
// renders only an always-empty slot for it and the controls around it; the
// element is appended into the slot by hand, which is the arrangement
// react.dev documents as safe ("Manipulating the DOM with Refs": React never
// touches the children of an element it always renders empty).
//
// WHERE THE POOL HAS NOTHING TO GIVE — a first presentation, an element that
// was dropped — a new element is built, and the session's clip memory
// (`clip-memory.ts`, keyed by the clip's media id) is what carries the frame:
// a player remembers where it stood as it leaves, a player mounting on a
// remembered clip drops the still and points its new element at that frame,
// and the handover still (`handover-still.tsx`) covers the decode. Whether the
// clip then PLAYS is its surface's stage's to decide in both cases.
//
// The fullscreen viewer is the one presentation that also carries the PLAY
// STATE (PostDetailVideo.md:57–61, ViewerVideo.md:5): the detail clip HANDS
// its clip over as the viewer opens — remembers where it stood and whether it
// played, gives up its element and leaves its stage, so nothing of it plays
// behind the viewer — and the viewer CARRIES that state in; on close the
// viewer remembers on its way out and the detail clip takes it back the same
// way.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

import { testAttributes, type DataNode } from "@/lib/ui/data-node";

import { useAutoplaySuppressed } from "./autoplay-suppression";
import { useVeiled } from "./body-veil";
import * as clipMemory from "./clip-memory";
import { HandoverStill, pictureOf } from "./handover-still";
import { setMuted, useMuted } from "./mute";
import { startPlayback } from "./playback";
import { OnStage, useStage } from "./stage-host";
import { formatDuration } from "./video";
import { VideoTransport } from "./video-transport";
import { claim, holds, releaseElement, takeElement } from "./video-stage";

/**
 * How much of a player a surface gets — the control ladder, as a type
 * (design/readme.md, "The control ladder").
 *
 * `reading` is the comment's form (design/backlog.md item 31, round 2 point 2,
 * drawn by ReplyMedia): the clip wears ONE control — the sound — and no
 * play/pause and no duration pill. A comment is something you read past, not a
 * player you operate, and a transport bar on a 220px square inside a thread is
 * more chrome than content. The sound still has to be reachable, because
 * autoplay is muted and a reader must be able to hear what was posted.
 *
 * `full` is the feed card's, and it wears the same one control: "a feed card
 * wears the sound control and nothing else — no play/pause, no duration pill,
 * at both scales". Presence on screen is the whole policy there.
 *
 * `transport` is the ladder's second rung — the post detail's clip, and
 * the fullscreen viewer after it. The reader opened this clip on purpose, so
 * the transport is real: play/pause, the skips, and a timeline that takes a tap
 * anywhere or a drag along it. The sound moves INTO the bar there, which is why
 * the disc is not drawn beside it.
 */
export type PlayerSurface = "full" | "reading" | "transport";

/** How long the chrome stays up after the reader last touched it. The board
 * draws the revealed state because "a board of the hidden state is a board of a
 * video" (`VideoControls.jsx:35-37`); this is the hide it auto-hides on. */
const CHROME_LINGER_MS = 3_000;

/**
 * A clip on its surface's stage — or, where no surface hosts one, on a private
 * stage of its own (`stage-host.tsx`).
 */
export function VideoPlayer(props: VideoPlayerProps) {
  return (
    <OnStage>
      <Player {...props} />
    </OnStage>
  );
}

type VideoPlayerProps = Parameters<typeof Player>[0];

function Player({
  src,
  poster,
  altText,
  testId = "video-player",
  autoplay = true,
  surface = "full",
  framed = false,
  fit = "cover",
  onOpenViewer,
  durationMs,
  safeArea = false,
  soundNode,
  playNode,
  mediaId,
  carry = false,
  handedOver = false,
}: {
  src: string;
  /**
   * The clip's identity in the session's clip memory — the attachment's media
   * id. Without one the player remembers nothing (a compose preview's local
   * file is no clip of the session's).
   */
  mediaId?: string | null;
  /**
   * This presentation CARRIES ON a clip shown elsewhere — the fullscreen
   * viewer opened on the detail clip: it opens at the remembered frame AND in
   * the remembered play state (PostDetailVideo.md:57–61, ViewerVideo.md:5),
   * rather than its stage deciding. With nothing remembered, the stage's law.
   */
  carry?: boolean;
  /**
   * The clip is HANDED OVER to a layer presenting it bigger (the detail clip
   * while the viewer is up): the layer has its element, and this player stands
   * off its stage with none, so nothing of it plays behind that layer
   * (PostDetailVideo.md:57). Lowered, it takes the clip back at the frame and
   * in the play state the layer left it in (PostDetailVideo.md:59/61).
   */
  handedOver?: boolean;
  /** The registered node the sound disc is; it then names the disc instead of `testId`'s. */
  soundNode?: DataNode;
  /** The registered node the play disc is (`….frame.playDisc`), likewise. */
  playNode?: DataNode;
  /** The video's face. Null when there is none, or when it was redacted. */
  poster?: string | null;
  altText?: string | null;
  /** The record's own running time. No surface wears a duration PILL; the
   * transport's bar draws the total, and this is what it shows until the
   * element's own metadata lands with the authoritative number. */
  durationMs?: number | null;
  testId?: string;
  /**
   * Whether the clip joins its surface's stage at all. Off, it never starts on
   * its own — only by the reader's own press.
   */
  autoplay?: boolean;
  surface?: PlayerSurface;
  /**
   * Whether the caller reserved a frame for the clip to fill. Framed, the
   * element takes its parent's box whole; unframed it sizes itself, full
   * width, at whatever height its own ratio gives it.
   */
  framed?: boolean;
  /**
   * How the clip meets its frame.
   *
   * `cover` is the media law and the default: a clip keeps its native ratio
   * clamped to tall and "letterboxing exists nowhere" (the reel round). THE
   * FULLSCREEN VIEWER IS THE ONE EXCEPTION, and it is the rule's other half —
   * "the frame is never cut here… this is the surface the feed card's 4:5 clamp
   * exists against" (`MediaViewer.jsx:15-17`). `ViewerLandscape.jsx:5-9` states
   * the contrast outright: a 16:9 clip fills the height and leaves ground at
   * the sides, because "a card is a layout, and this is the frame itself".
   */
  fit?: "cover" | "contain";
  /**
   * The way into the fullscreen viewer, where the surface has one.
   *
   * The graph draws TWO routes there from the video detail — "the transport's
   * own way into the viewer — the clip tap is the other" (graph.json,
   * `PostDetailVideo` via 19 and via 3) — and both land here: the bar grows its
   * fullscreen toggle, and a tap on the clip WHILE THE CHROME IS UP opens the
   * viewer instead of hiding it.
   *
   * That second half is a reading of two drawn edges onto one gesture. The
   * chrome hides itself after three seconds over a running clip, so binding the
   * clip tap to the viewer outright would strand the transport with no way
   * back; binding it only once the controls are already visible keeps the
   * reveal tap intact and still gives the clip its own route in.
   */
  onOpenViewer?: () => void;
  /**
   * Whether this player reaches the edges of the SCREEN rather than sitting in
   * a frame on the page.
   *
   * Only the fullscreen viewer does, and only there does the transport's bar
   * have to clear the phone's own bottom strip — a framed clip inset for a home
   * indicator that is nowhere near it would just float.
   */
  safeArea?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const muted = useMuted();
  const suppressed = useAutoplaySuppressed();
  const stage = useStage();
  // A veiled clip sits fully out of the stage rotation — "ALWAYS a veiled clip
  // has no playback and no sound-disc presence" (Feed.md:43) — because the
  // veil is the reader's declared not-yet. "The unveil is an eligibility
  // change, not a suspension lift" (design/readme.md §13): the unveiled clip
  // joins the rotation exactly as a clip scrolling into view does, and
  // "WHEN a veiled clip unveils GIVEN the incumbent still qualifies -> NEVER
  // the stage changes hands" (Feed.md:47).
  const veiled = useVeiled();
  const transport = surface === "transport";
  // The clip's own clock, read off the element rather than held beside it: the
  // element is the truth about where playback is, and a second copy ticking on
  // its own would disagree with it the moment a seek or a stall happened.
  const [playing, setPlaying] = useState(false);
  // A clip that ran out is a clip at rest, and the transport has to say WHICH
  // rest: the press at the end starts the clip again rather than resuming it.
  const [ended, setEnded] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lengthSec, setLengthSec] = useState<number | null>(null);
  // The chrome is drawn revealed and hides itself; a tap on the video brings it
  // back (`design/designs/canonical/screens/PostDetailVideo.jsx:13-15`).
  const [chromeShown, setChromeShown] = useState(true);
  // Identity, not value: the stage tells surfaces apart by object identity
  // (mirroring VideoStage.kt's `token: Any`). `useState`'s lazy initializer
  // runs once and its result is stable across re-renders — unlike
  // `useRef({}).current`, it never reads a ref during render, which React's
  // own lint rule (react-hooks/refs) forbids.
  const [stageToken] = useState(() => ({}));
  // What the session remembered of this clip when the player first rendered,
  // and the memory's era then — read once, through lazy initializers, so the
  // render that draws the frame already knows whether its still may return.
  //
  // THAT RENDER CAN COME BEFORE THE OUTGOING PRESENTATION'S GOODBYE. A route
  // change (card → detail) renders the new page before the commit that
  // removes the old one, so the card's unmount write lands after this read.
  // Having played is therefore written the moment a clip first plays (`onPlay`
  // below), and the exact frame is read again once mounted, after every
  // outgoing write of the same commit has landed (the layout effect below).
  const [remembered] = useState(() => (mediaId ? clipMemory.read(mediaId) : undefined));
  const [bornIn] = useState(clipMemory.currentEra);
  // Whether the clip has played in THIS mount; with what the memory says of
  // earlier ones, whether it has played in the session.
  const playedHere = useRef(false);
  // The veil as last rendered, for the carry below, which must not start a
  // veiled clip and runs where the veil is not a dependency.
  const veiledNow = useRef(veiled);
  // The clip was handed over and is due back from the layer that took it.
  const dueBack = useRef(false);
  // Whether the element in the slot was carried in from another presentation
  // of the clip — then it already stands where the clip is, and nothing here
  // points it anywhere.
  const carriedIn = useRef(false);
  // What the element says, heard by whichever render is current.
  const hear = useRef<((event: Event) => void) | null>(null);

  // THE CLIP'S ELEMENT, taken into the slot as the slot attaches and released
  // as it detaches. A ref callback rather than an effect because of WHEN it
  // runs: React attaches a host element's ref in the same pass that runs the
  // layout effects around it, earlier siblings first and the enclosing
  // component last — so the element stands in the slot before the handover
  // still (a later sibling) asks what it can paint, and before this player's
  // own layout effects point it at a remembered frame. Handed over, the player
  // holds no element: the layer presenting the clip bigger has it.
  const slot = useCallback(
    (container: HTMLSpanElement | null) => {
      if (container === null || handedOver) return;
      const { video, carried } = takeElement(stageToken, mediaId ? { mediaId, src } : null);
      if (!carried) build(video, src);
      container.appendChild(video);
      ref.current = video;
      carriedIn.current = carried;
      const forward = (event: Event) => hear.current?.(event);
      for (const type of HEARD) video.addEventListener(type, forward);
      if (carried) {
        // The controls read what the element is doing, and a carried element
        // is already doing it: it fires no `play` for a start that happened
        // under the presentation before.
        playedHere.current ||= !video.paused;
        setPlaying(!video.paused && !video.ended);
        setEnded(video.ended);
        setElapsedSec(video.currentTime);
        if (Number.isFinite(video.duration)) setLengthSec(video.duration);
      }
      return () => {
        for (const type of HEARD) video.removeEventListener(type, forward);
        if (ref.current === video) ref.current = null;
        carriedIn.current = false;
        // Carried on only where it is worth it (`video-stage.ts`): a clip that
        // moved, and that a reader could be looking at or that was playing.
        const moved =
          playedHere.current || remembered?.everPlayed === true || video.currentTime !== 0;
        const shown = !video.paused || stage?.inView(stageToken) === true;
        releaseElement(stageToken, video, { keep: moved && shown, moved });
      };
    },
    [handedOver, stageToken, mediaId, src, remembered, stage],
  );

  /**
   * The way into the fullscreen viewer, handing the clip over first: where it
   * stands and whether it plays are remembered BEFORE the viewer renders, so
   * the viewer opens on them (ViewerVideo.md:5, PostDetailVideo.md:57).
   */
  const openViewer =
    onOpenViewer === undefined
      ? undefined
      : () => {
          const video = ref.current;
          if (video && mediaId) {
            const played = playedHere.current || remembered?.everPlayed === true;
            // The viewer presents this clip next, so its frame is pictured.
            remember(video, mediaId, played, bornIn, true);
          }
          onOpenViewer();
        };

  // WHAT THE ELEMENT SAYS, AS THE CONTROLS HEAR IT. The element's listeners
  // are added by hand (the element is not React's), so the current render's
  // handling is handed to them here — first among this player's layout
  // effects, before any of them moves the element and it speaks.
  useLayoutEffect(() => {
    hear.current = (event) => {
      const video = event.currentTarget as HTMLVideoElement;
      switch (event.type) {
        case "volumechange":
          setMuted(video.muted);
          return;
        // The transport's whole state comes off these: what the element is
        // doing IS what the controls report, so a play that the browser
        // refused shows as paused rather than as a lying pause glyph.
        case "play":
          playedHere.current = true;
          // Having played, said at once: a presentation of this clip that
          // renders before this one's goodbye already knows its still is gone
          // (FeedCover.md:7).
          if (mediaId) {
            clipMemory.write(
              mediaId,
              { time: video.currentTime, everPlayed: true, playing: true },
              bornIn,
            );
          }
          setPlaying(true);
          setEnded(false);
          return;
        case "pause":
          setPlaying(false);
          return;
        // A clip that runs out is a clip at rest, and the transport has to say
        // so. The HTML spec fires `pause` before `ended` for a non-looping
        // element, but only "if the media element's paused attribute is false"
        // (html.spec.whatwg.org, "playback has ended"), so the state is taken
        // from the event that is guaranteed rather than from the one that is
        // conditional.
        case "ended":
          setPlaying(false);
          setEnded(true);
          return;
        case "timeupdate":
          setElapsedSec(video.currentTime);
          return;
        case "durationchange":
          // A stream whose length the browser does not know answers `Infinity`
          // or `NaN`, and a timeline against an unknown end is a knob that
          // cannot mean anything — the record's own number stands instead.
          if (Number.isFinite(video.duration)) setLengthSec(video.duration);
          return;
        // A TAP ON THE VIDEO REVEALS THE CHROME. It is the player's own
        // gesture rather than the surface's: the surface's tap (back to the
        // stream, or into the viewer) is wired over the frame by the screen
        // that owns it, and reaching the controls must not depend on it.
        case "click":
          if (!transport) return;
          if (chromeShown && openViewer) openViewer();
          else setChromeShown((shown) => !shown);
          return;
      }
    };
  });

  // WHAT THE ELEMENT WEARS, for the presentation holding it now — a carried
  // element arrives wearing its last presentation's, and changes into these.
  useLayoutEffect(() => {
    const video = ref.current;
    if (!video) return;
    // A CLIP THAT HAS PLAYED NEVER WEARS ITS STILL AGAIN within the reading
    // session, its remounts included (FeedCover.md:7/9): the remembered frame
    // is its face.
    attribute(video, "poster", remembered?.everPlayed === true ? null : (poster ?? null));
    // A FEED CLIP LOOPS AND A CLIP UNDER THE REAL TRANSPORT STOPS (jakob
    // 2026-09-14, via the design loop). It sharpens the deliberate
    // reel-vs-video split: a clip in a card or a stream is a MOMENT, read
    // with the scroller's grammar, and stopping it would leave a card gone
    // still and dead under a reader still looking at it. A clip the reader
    // opened on purpose — the detail clip, the viewer — is a
    // PROGRAMME, read with a player's grammar, and a programme that silently
    // restarted would be a player that never admits it finished. The
    // transport then stands at its Play glyph, and pressing it replays.
    attribute(video, "loop", transport ? null : "");
    attribute(video, "aria-label", altText ?? null);
    attribute(video, "data-testid", testId);
    // `object-cover` IS THE RULING, not a taste: a clip keeps its native
    // ratio clamped to tall — 16:9 and 1:1 display true, anything taller
    // than 4:5 centre-crops to it, and letterboxing exists nowhere (the
    // reel round, review 1). Without it the element takes the CSS default
    // `object-fit: fill`, so the moment a caller's reserved box didn't
    // match the clip's own ratio the picture was squeezed to fit it.
    // THE GROUND BEHIND A FITTED FRAME IS THE VIEWER'S OWN BLACK. Every
    // other surface FILLS its box, so the reserved surface only ever shows
    // before the bytes land; the viewer fits, so what sits beside a 16:9
    // clip is ground the reader looks at — and a theme-coloured band there
    // would be a light strip down a black screen.
    attribute(
      video,
      "class",
      [
        surface === "reading" || framed ? "block size-full" : "block w-full",
        fit === "contain" ? "object-contain" : "bg-surface-container-high object-cover",
      ].join(" "),
    );
  });

  // The store is the truth; the element follows it. Written through the
  // property rather than the attribute because the attribute is only the
  // initial value once the element exists.
  useEffect(() => {
    const video = ref.current;
    if (video && video.muted !== muted) video.muted = muted;
  }, [muted]);

  useEffect(() => {
    veiledNow.current = veiled;
  }, [veiled]);

  // A REMEMBERED CLIP STANDS AT THE FRAME IT REACHED (FeedCover.md:9,
  // PostDetailVideo.md:53/55). Read at mount, in a LAYOUT effect: React runs
  // a commit's layout cleanups — the outgoing presentation's goodbye below —
  // before its layout mounts, so this sees the frame the clip left at. And it
  // runs before the stage (a passive effect) can start the clip, so a start
  // runs on from there rather than jumping. Before metadata has loaded, the
  // assignment is the element's "default playback start position", applied
  // when it loads (html.spec.whatwg.org, the `currentTime` setter) — so it
  // needs no wait for `loadedmetadata`.
  //
  // A CARRIED ELEMENT IS NOT POINTED ANYWHERE: it already stands at the frame
  // the clip reached — the element is the truth the memory only copies — and
  // a seek, even to the moment it is at, is the re-prepare carrying it avoids.
  useLayoutEffect(() => {
    const video = ref.current;
    if (carriedIn.current) return;
    const at = mediaId ? clipMemory.read(mediaId) : undefined;
    if (video && at !== undefined && at.time > 0) video.currentTime = at.time;
  }, [mediaId]);

  // WHERE IT STOOD, REMEMBERED ON THE WAY OUT. A layout cleanup, on purpose:
  // the host's stage is a parent whose passive cleanup freezes the clip as it
  // goes, and React runs every layout cleanup of a removed tree before any
  // passive one — so this still sees whether the clip was playing, which is
  // the play state the viewer hands back (PostDetailVideo.md:59/61) — and its
  // stage still holds its place, so this sees whether it was on screen.
  //
  // A player whose element another presentation holds by then — handed to the
  // viewer, which is still up — has nothing to say: the holder speaks for it.
  useLayoutEffect(() => {
    const video = ref.current;
    if (!video || !mediaId) return;
    return () => {
      if (!holds(stageToken, video)) return;
      const played = playedHere.current || remembered?.everPlayed === true;
      // A clip that never moved has nothing to say: its still is still right.
      if (!played && video.currentTime === 0) return;
      // Its frame is pictured for the next presentation only where a reader
      // could be looking at it (`Stage.inView`).
      remember(video, mediaId, played, bornIn, stage?.inView(stageToken) === true);
    };
  }, [mediaId, remembered, bornIn, stage, stageToken]);

  // ON THE STAGE for as long as the player is mounted — and not handed over.
  // It joins wearing the veil it stands under (`veiledNow`, written by the
  // effect above, earlier in the same commit), and the veil effect below
  // follows every later change — so a veil coming or going is an eligibility
  // change on the one registration, never a leave-and-rejoin that would hand
  // the stage away, and the detail's open never sees a veiled clip as bare.
  //
  // HANDED OVER, it leaves the stage: leaving freezes it where it stands, and
  // a clip that is on no stage cannot be started by one — not by an election,
  // a page shown again, or autoplay coming back (PostDetailVideo.md:57).
  // Taken back, it rejoins and carries the layer's play state in.
  //
  // AN ELEMENT CARRIED IN PLAYING keeps playing into the surface's first
  // measurement of it, which decides whether it holds the stage there
  // (`Stage.arrivePlaying`) — the hand-over below being the one presentation
  // that says so itself. On the detail, standing on the stage is the OPEN,
  // which starts the clip where it stands (`Stage.open`, PostDetailVideo.md:7).
  useEffect(() => {
    if (!autoplay || stage === null) return;
    if (handedOver) {
      dueBack.current = true;
      return;
    }
    const video = ref.current;
    if (!video) return;
    stage.register(stageToken, video, veiledNow.current);
    let decided = false;
    if ((carry || dueBack.current) && mediaId) {
      dueBack.current = false;
      const carried = clipMemory.read(mediaId);
      if (carried !== undefined) {
        decided = true;
        if (!carriedIn.current && video.currentTime !== carried.time) {
          video.currentTime = carried.time;
        }
        // "playing returns playing, paused returns paused" (RULINGS 4c,
        // PostDetailVideo.md:59/61). A carried PLAYING state is the reader's
        // own start continuing — under suppressed autoplay too, as the pad's
        // resume is (Feed.md:41): not a clip starting "on its own"
        // (FeedCover.md:25). A veiled clip starts nothing (Feed.md:43).
        if (carried.playing === true && !veiledNow.current) stage.handStart(stageToken);
        else stage.seat(stageToken);
      }
    }
    if (!decided) stage.arrive(stageToken, carriedIn.current);
    return () => stage.unregister(stageToken);
    // `src` too: a new source is a new element in the slot (`slot`), and the
    // stage has to watch the one that is there.
  }, [autoplay, stage, stageToken, handedOver, carry, mediaId, src]);

  useEffect(() => {
    if (autoplay) stage?.setVeiled(stageToken, veiled);
  }, [autoplay, stage, stageToken, veiled]);

  /**
   * The reader starts the clip — its play disc, or the transport's play. On
   * the stage it becomes the incumbent (FeedCover.md:27); a player kept off
   * the stage still takes the player layer, so one clip plays at a time
   * however it was started.
   */
  const startByHand = () => {
    const video = ref.current;
    if (!video) return;
    if (autoplay && stage !== null) {
      stage.handStart(stageToken);
      return;
    }
    claim(stageToken, video);
    startPlayback(video);
  };

  // The chrome only hides over a clip that is RUNNING. Hiding it over a paused
  // clip would leave the reader with a still picture and no way back to the
  // controls short of guessing that the picture is tappable.
  useEffect(() => {
    if (!transport || !chromeShown || !playing) return;
    const timer = window.setTimeout(() => setChromeShown(false), CHROME_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [transport, chromeShown, playing]);

  // The element's own metadata is authoritative — it is what a seek lands
  // against — and the record's number stands in until it arrives, so the bar
  // does not read "0:00" over a clip the reader can see is longer than that.
  const totalSec = lengthSec ?? (durationMs != null ? durationMs / 1000 : null);
  const progress = totalSec && totalSec > 0 ? elapsedSec / totalSec : 0;

  const seekTo = (seconds: number) => {
    const video = ref.current;
    if (!video) return;
    const end = Number.isFinite(video.duration) ? video.duration : (totalSec ?? 0);
    const to = Math.max(0, Math.min(end, seconds));
    video.currentTime = to;
    // Read back at once rather than waiting for `timeupdate`: the event fires
    // a few times a second, and a knob that lags the thumb dragging it reads
    // as a broken control.
    setElapsedSec(to);
  };

  // A SKIP IS RELATIVE TO THE ELEMENT, never to the rendered clock. Two taps
  // land inside one render, so a second skip computed from state would step
  // from where the first one started rather than from where it arrived.
  const skipBy = (seconds: number) => {
    const video = ref.current;
    if (video) seekTo(video.currentTime + seconds);
  };

  return (
    <span className="relative block size-full">
      {/* THE CLIP'S ELEMENT STANDS HERE, put in by hand (`slot`): React
          renders this span and never anything inside it. `contents` keeps
          the span out of the layout, so the element sizes against the frame
          exactly as a child of it would. */}
      <span ref={slot} className="contents" />

      {/* THE REACHED FRAME OVER AN ELEMENT STILL PREPARING IT
          (`handover-still.tsx`): a played clip's new presentation wears the
          picture its last one left, never the frame's ground or frame 0. */}
      {mediaId && remembered?.everPlayed === true && (
        <HandoverStill video={ref} mediaId={mediaId} fit={fit} testId={`${testId}-still`} />
      )}

      {/* THE LADDER'S SECOND RUNG, and it REPLACES the disc rather than
          joining it: the sound decision moves into the bar, because "a disc
          beside a bar is two pieces of chrome for one clip"
          (`design/components/media/MediaAttachment.jsx:281-294`). */}
      {transport && chromeShown && (
        <VideoTransport
          playing={playing}
          ended={ended}
          safeArea={safeArea}
          elapsed={formatDuration(Math.floor(elapsedSec) * 1000)}
          duration={formatDuration((totalSec ?? 0) * 1000)}
          progress={progress}
          muted={muted}
          testId={`${testId}-transport`}
          onTogglePlay={() => {
            const video = ref.current;
            if (!video) return;
            if (video.paused) {
              // PLAY AT THE END IS REPLAY. `play()` on an ended element seeks
              // to the start itself — "if the playback position is the end of
              // the media resource… seek to the earliest possible position"
              // (html.spec.whatwg.org, the play() algorithm) — but only when
              // the direction of playback is forwards and the element is not
              // looping, so the seek is stated rather than relied on: it is
              // also what puts the rendered clock back to 0:00 in the same
              // frame, instead of a tick later.
              if (video.ended) seekTo(0);
              // The press takes the stage, the same as a play-disc tap: one
              // clip plays at a time however it was started.
              startByHand();
            } else {
              video.pause();
            }
            // The press is also touching the chrome, so it stays up: a control
            // that vanishes the moment it is used is one the reader has to
            // re-summon to press twice.
            setChromeShown(true);
          }}
          onToggleMute={() => setMuted(!muted)}
          onSeek={(fraction) => seekTo(fraction * (totalSec ?? 0))}
          onSkip={skipBy}
          onFullscreen={openViewer}
        />
      )}

      {/* ONE CONTROL ON EVERY CARD'S CLIP — no play/pause, no duration pill,
          at both scales (design/readme.md, "the video conform round") — and
          WHICH ONE is the control ladder (`MediaAttachment.prompt.md:17`).
          The SOUND disc "GIVEN the device allows autoplay or its clip is
          playing" (FeedCover.md:17); the PLAY disc in its place "GIVEN the
          device suppresses autoplay and its clip is not playing"
          (FeedCover.md:21). Never both, and on every unveiled frame — not
          only the stage holder's. Veiled, neither is drawn: a control for a
          clip that cannot take the stage would offer a decision that does
          nothing (Feed.md:43–45, backlog item 103). Both are the master's
          `MediaDisc`, which keeps the tap to itself: a disc inside a card's
          open-the-post link must never open the post (FeedCover.md:27). */}
      {!transport && !veiled && suppressed && !playing && (
        <button
          type="button"
          {...testAttributes(playNode, `${testId}-play`)}
          // Says what the tap does, the copy voice's "the only one that
          // appears beside a still frame" (`MediaAttachment.jsx:323`).
          aria-label="Play this video"
          onClick={(event) => {
            keepToTheDisc(event);
            startByHand();
          }}
          className={DISC_CLASS}
          style={DISC_STYLE}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
      {/* The sound disc carries the sticky decision every video shares, so
          pressing it here changes the sound for the whole session — which
          is why it reads the shared store rather than the element. */}
      {!transport && !veiled && !(suppressed && !playing) && (
        <button
          type="button"
          {...testAttributes(soundNode, `${testId}-sound`)}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
          aria-pressed={!muted}
          onClick={(event) => {
            keepToTheDisc(event);
            setMuted(!muted);
          }}
          // `surface-snackbar` and `on-surface-snackbar` are tokens-2.css
          // SEMANTIC ALIASES (tokens-2.css:161-188), never bridged into
          // Tailwind's `@theme` the way the 1.0 palette is — by that file's
          // own design ("the semantic aliases resolve to roles… nothing in
          // this file needs a dark branch"), they are read with `var()`, the
          // same way `pager-dots.tsx` reads `--border-hairline`. `bg-*`/
          // `text-*` Tailwind classes built from them compile to nothing:
          // read as `var()` here instead, matching the master
          // (`design/components/media/MediaAttachment.jsx:127-128`).
          // WHY THE CORNER IS A STYLE AND NOT `absolute bottom-2 right-2`
          // (jakob's round-three hand test, 2026-09-22): tokens-2.css is
          // `@import`ed AFTER `tailwindcss` and its rules are therefore
          // UNLAYERED, while every Tailwind utility lives in
          // `@layer utilities` — and an unlayered declaration beats a layered
          // one whatever the source order. So `.cg-state`'s `position:
          // relative` (tokens-2.css:207) silently outranked the `absolute`
          // utility, the disc dropped out of the corner into normal flow at
          // the frame's left edge, and the card's section below clipped it.
          // The master positions this control with an inline style for its
          // own reasons (`MediaAttachment.jsx:117-131`) and an inline style
          // is the one thing an unlayered rule cannot outrank, so the two
          // answers are the same answer. Same file, same mechanism, same
          // shape as the snackbar colours below.
          className={DISC_CLASS}
          style={DISC_STYLE}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
            {muted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
        </button>
      )}
    </span>
  );
}

/**
 * Remember where a clip stands — and, when `pictured`, keep a picture of that
 * frame for the presentation that comes next (`handover-still.tsx`), taken in
 * the same moment so the picture is of exactly the time remembered.
 */
function remember(
  video: HTMLVideoElement,
  mediaId: string,
  everPlayed: boolean,
  bornIn: number,
  pictured: boolean,
): void {
  const entry = standing(video, everPlayed);
  clipMemory.write(mediaId, entry, bornIn);
  if (!pictured) return;
  const picture = pictureOf(video);
  if (picture) clipMemory.keepFrame(mediaId, { time: entry.time, picture }, bornIn);
}

/** What the player hears from its element (`hear` in the player). */
const HEARD = [
  "volumechange",
  "play",
  "pause",
  "ended",
  "timeupdate",
  "durationchange",
  "click",
] as const;

/**
 * A new element for a clip, built the way React built the `<video>` this
 * player used to render: what it plays, and what it plays under. What it
 * WEARS — the poster, the loop, its name and its class — is the presentation's
 * and is put on by the player, carried elements included.
 *
 * Every one of these is load-bearing: `muted` is what makes autoplay
 * permitted at all, `playsinline` is what stops iOS taking the clip
 * fullscreen, and `preload="metadata"` keeps a feed of ten clips from pulling
 * ten videos down before any of them is on screen. `muted` is the property,
 * as React sets it: the attribute is only a default once the element exists.
 */
function build(video: HTMLVideoElement, src: string): void {
  video.muted = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("preload", "metadata");
  video.setAttribute("src", src);
}

/** Set an attribute to `value`, or remove it for null — touching it only when it differs. */
function attribute(video: HTMLVideoElement, name: string, value: string | null): void {
  if (video.getAttribute(name) === value) return;
  if (value === null) video.removeAttribute(name);
  else video.setAttribute(name, value);
}

/** Where a clip stands, as the session's memory keeps it. */
function standing(video: HTMLVideoElement, everPlayed: boolean): clipMemory.ClipMemory {
  return {
    time: video.currentTime,
    everPlayed,
    playing: !video.paused && !video.ended,
  };
}

/**
 * Every disc a clip wears is one `MediaDisc`: one plate, one corner.
 *
 * THE PLATE IS 36px AND THE TARGET IS 48 (`--touch-target-min`): "48dp targets
 * grow invisibly where space allows" (jakob's ruling 92, seam 109). `cg-hit`
 * grows the press area around the drawn plate, and the corner has the room —
 * the plate stands 8px in from the frame's edges, and the growth needs 6.
 */
const DISC_CLASS =
  "cg-state cg-focus cg-hit grid size-9 cursor-pointer place-items-center rounded-full border-0 p-0";

/** See the sound disc's note for why the corner and the plate are a style. */
const DISC_STYLE: CSSProperties = {
  position: "absolute",
  bottom: "8px",
  right: "8px",
  zIndex: 2,
  background: "var(--surface-snackbar)",
  color: "var(--on-surface-snackbar)",
};

/**
 * A disc's press is the disc's alone, as the master's `MediaDisc` keeps it
 * (`MediaAttachment.jsx:151-154`): it never reaches the card's open-the-post
 * link around the frame.
 */
function keepToTheDisc(event: MouseEvent<HTMLButtonElement>): void {
  event.stopPropagation();
  event.preventDefault();
}
