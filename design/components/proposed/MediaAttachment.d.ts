/**
 * PROPOSED. design.md §6's media attachment: a tile whose space is reserved
 * before load, with optional authored alt text.
 *
 * `portrait` is the CAP — 4:5 — and it bounds the TILE, not the picture: a taller
 * frame is fitted inside it (`fit="contain"`, the default) with the reserved
 * surface showing at the sides, never cut. Only a gallery's secondary squares
 * crop. Video autoplays muted while on screen, and mute is one global sticky
 * decision shared by every video (`useGlobalMute`).
 *
 * Still undecided: how a gallery interacts with the §9 sensitive blur.
 */
export interface MediaAttachmentProps {
  /** Omit to render the reserved region with its label — the honest placeholder. */
  src?: string;
  /** First frame for a video, shown before playback starts. */
  poster?: string;
  /** Authored, optional, never invented. Without it the tile is aria-hidden. */
  alt?: string;
  /** A named ratio or any CSS aspect-ratio value. `portrait` is 4:5, the cap. */
  ratio?: "landscape" | "square" | "portrait" | string;
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

/** One lead tile plus up to two squares and a +n remainder. */
export interface MediaGalleryProps {
  items?: readonly MediaAttachmentProps[];
  ratio?: "landscape" | "square" | "portrait" | string;
}

export declare function MediaGallery(props: MediaGalleryProps): JSX.Element | null;
