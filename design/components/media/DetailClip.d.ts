/**
 * The clip at the top of a video post's detail view — and what the stream's
 * squish morph leaves behind: the clip shrinks out of the stream to the top of
 * the screen, still playing, and the post rises beneath it (readme §13, the
 * reel round).
 *
 * It sits ABOVE the card, not inside it, which is why the author chip leads the
 * card on that surface rather than the screen. It is content and scrolls with
 * the page; opening the detail starts it, and scrolled out of view it plays on,
 * with no floating player in its place (readme §13, the clip detail rulings).
 * It carries the ladder's second rung — the full transport — on a black
 * ground, and the tap on it belongs to the surface: back into the stream where
 * the reader came from it, into the fullscreen viewer everywhere else.
 *
 * THE DETAIL CLIP'S VEIL FACE (jakob 2026-09-24): a sensitive video post's
 * clip veils IN PLACE rather than demoting into the card, transport hidden —
 * under the backlog-103 ruling nothing plays beneath a veil, so the face is
 * the whole surface and its only affordance is the reveal.
 */
import type { MediaAttachmentProps } from "./MediaAttachment";

export interface DetailClipProps {
  /** The clip, in `MediaAttachment`'s own shape — kind, src, poster, ratio, alt. */
  item: MediaAttachmentProps;
  /** The transport's drawn readout; a board cannot play. */
  playing?: boolean;
  elapsed?: string;
  duration?: string;
  /** 0..1 along the timeline. */
  progress?: number;
  /** Present, the clip veils in place and the transport is not drawn. */
  sensitive?: { reason?: string; source?: "author" | "platform" };
}

export declare function DetailClip(props: DetailClipProps): JSX.Element;
