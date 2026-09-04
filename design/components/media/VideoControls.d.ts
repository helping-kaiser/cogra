/**
 * PROPOSED. The two rungs of the video control ladder above a feed card's sound
 * disc (readme §13, the reel round).
 *
 * `VideoTransport` — play/pause, elapsed, a real timeline (tap or drag to seek),
 * duration, and the global sticky sound control. It is uniform for every clip:
 * no length threshold decides whether a reader gets controls. Drawn on the post
 * detail view and in the fullscreen viewer.
 *
 * `SeekLine` — the same timeline thinned to a hairline at the screen's bottom
 * edge, with no glyphs beside it. The stream's only transport: a play/pause
 * there would answer a question nobody scrolling a stream is asking.
 *
 * Both auto-hide with the rest of the chrome; a tap on the video reveals them.
 */
export interface VideoTransportProps {
  playing?: boolean;
  /** Both are already-formatted times — the component never does arithmetic. */
  elapsed?: string;
  duration?: string;
  /** 0..1 along the timeline. */
  progress?: number;
  muted?: boolean;
  /** Shows the fullscreen toggle at the bar's right end. Defaults to true. */
  fullscreen?: boolean;
  onTogglePlay?: () => void;
  onToggleMute?: () => void;
  onFullscreen?: () => void;
  /** Fired by both skip-back and skip-forward. */
  onSkip?: () => void;
  /** The bar's distance from the frame's bottom edge, clear of the system
   *  gesture zone. Defaults to `GESTURE_ZONE`. */
  inset?: number;
}

export declare function VideoTransport(props: VideoTransportProps): JSX.Element;

export interface SeekLineProps {
  progress?: number;
  elapsed?: string;
  duration?: string;
}

export declare function SeekLine(props: SeekLineProps): JSX.Element;

/** A slider, not a progress bar: it reports where the clip is and is how the
 *  reader moves it, so it carries the knob and the slider role. */
export interface TimelineProps {
  /** 0..1 along the timeline. */
  progress?: number;
  elapsed?: string;
  duration?: string;
  /** The stream's rung: a 3px hairline with no knob, no glyphs. */
  thin?: boolean;
}

export declare function Timeline(props: TimelineProps): JSX.Element;

/** The inset that keeps the transport's bottom bar clear of the system
 *  gesture zone. */
export declare const GESTURE_ZONE: number;
