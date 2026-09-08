/**
 * PROPOSED. design.md §6's media attachment: a tile whose space is reserved
 * before load, with optional authored alt text.
 *
 * A PICTURE's ratio vocabulary is the compose crop ruling's — `tall` 4:5,
 * `square` 1:1, `wide` 1.91:1. `tall` is also the CAP. Nothing is letterboxed:
 * a tile is filled (`fit="cover"`, the default), so an uncropped picture — a
 * comment's — display-crops to its frame, centred, and the whole frame is one
 * tap away in the viewer. The crop is display-only; the bytes stay uncropped.
 *
 * A CLIP is not cropped by an author, so it keeps its own shape, clamped to
 * tall: `landscape` 16:9 and `square` display true, and anything taller than
 * 4:5 centre-crops to 4:5 (`clipFrame`). A clip is never letterboxed, and the
 * full frame lives on the stream and in the viewer.
 *
 * Video autoplays muted while on screen, and mute is one global sticky decision
 * shared by every video (`useGlobalMute`). What else a clip carries is the
 * control ladder, which `controls` names. A sensitive post veils the whole
 * gallery, never per-picture.
 */
export interface MediaAttachmentProps {
  /** Omit to render the reserved region with its label — the honest placeholder. */
  src?: string;
  /** First frame for a video, shown before playback starts. */
  poster?: string;
  /** Authored, optional, never invented. Without it the tile is aria-hidden. */
  alt?: string;
  /**
   * A named ratio or any CSS aspect-ratio value. `tall` is 4:5, the cap;
   * `portrait` (9:16) and `landscape` (16:9) are a clip's native shapes.
   */
  ratio?: "tall" | "square" | "wide" | "portrait" | "landscape" | string;
  kind?: "image" | "video";
  /** What belongs here, shown while there is no src. */
  label?: string;
  radius?: string;
  /** "cover" (default) fills the tile; "contain" fits the frame inside it. */
  fit?: "contain" | "cover";
  /**
   * Defaults to `var(--media-max-height)` — the height that leaves the rest of
   * the post on screen above the bottom bar. A capped tile fits its frame; it
   * never crops to obey the cap.
   */
  maxHeight?: string;
  /**
   * The control ladder's rung. `"sound"` — a feed card, the sound disc alone;
   * `"transport"` — a detail view, play/pause and a real timeline; `"play"` —
   * the play disc of a card whose autoplay the device suppressed; `"none"`
   * where the surface draws its own.
   */
  controls?: "sound" | "transport" | "play" | "none";
  /** The cover instead of the running clip: before first play, or where autoplay is suppressed. */
  resting?: boolean;
  /** Transport readout — the drawn state, since a board cannot play. */
  playing?: boolean;
  elapsed?: string;
  duration?: string;
  /** 0..1 along the timeline. */
  progress?: number;
}

export declare function MediaAttachment(props: MediaAttachmentProps): JSX.Element;

/** The global, sticky mute decision: `[muted, setMuted]`, shared by every video. */
export declare function useGlobalMute(): [boolean, (muted: boolean) => void];

/** The shape a clip stands at in a card: its own, unless taller than 4:5. */
export declare function clipFrame(ratio: string): string;

/** The disc a media surface's controls wear, so photography never swallows one. */
export interface MediaDiscProps {
  label: string;
  glyph: string;
  onClick?: () => void;
  pressed?: boolean;
  corner?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

export declare function MediaDisc(props: MediaDiscProps): JSX.Element;

/**
 * A swipeable pager: one frame at the post's one crop shape, dots below —
 * dots only, never a "1/n" count. Every frame renders at the shared ratio
 * (the `ratio` prop, else the first item's), so uncropped sets pass a fixed
 * frame and fit whole frames inside it. The cap is authoring-side: at most
 * ten pictures, or one video.
 */
export interface MediaGalleryProps {
  items?: readonly MediaAttachmentProps[];
  ratio?: "tall" | "square" | "wide" | string;
  radius?: string;
  /** Passed through to each frame; falls back to the item's own `maxHeight`. */
  maxHeight?: string;
}

export declare function MediaGallery(props: MediaGalleryProps): JSX.Element | null;
