/**
 * PROPOSED. design.md §6's media attachment: a tile whose space is reserved
 * before load, with optional authored alt text.
 *
 * The ratio vocabulary is the compose crop ruling's — `tall` 4:5, `square` 1:1,
 * `wide` 1.91:1. `tall` is also the CAP, and it bounds the TILE, not the
 * picture: a taller frame is fitted inside it (`fit="contain"`, the default)
 * with the reserved surface showing at the sides, never cut. Video autoplays
 * muted while on screen, and mute is one global sticky decision shared by every
 * video (`useGlobalMute`). A sensitive post veils the whole gallery, never
 * per-picture.
 */
export interface MediaAttachmentProps {
  /** Omit to render the reserved region with its label — the honest placeholder. */
  src?: string;
  /** First frame for a video, shown before playback starts. */
  poster?: string;
  /** Authored, optional, never invented. Without it the tile is aria-hidden. */
  alt?: string;
  /** A named ratio or any CSS aspect-ratio value. `tall` is 4:5, the cap. */
  ratio?: "tall" | "square" | "wide" | string;
  kind?: "image" | "video";
  /** What belongs here, shown while there is no src. */
  label?: string;
  radius?: string;
  /** "contain" (default) shows the whole frame; "cover" crops. */
  fit?: "contain" | "cover";
  /**
   * Defaults to `var(--media-max-height)` — the height that leaves the rest of
   * the post on screen above the bottom bar. A capped tile fits its frame; it
   * never crops to obey the cap.
   */
  maxHeight?: string;
}

export declare function MediaAttachment(props: MediaAttachmentProps): JSX.Element;

/** The global, sticky mute decision: `[muted, setMuted]`, shared by every video. */
export declare function useGlobalMute(): [boolean, (muted: boolean) => void];

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
}

export declare function MediaGallery(props: MediaGalleryProps): JSX.Element | null;
