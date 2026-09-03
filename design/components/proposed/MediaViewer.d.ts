/**
 * PROPOSED. The full-media view: tapping media in a post's detail view opens it
 * covering as much of the screen as possible.
 *
 * The frame is never cropped here — `contain`, centred, as large as the viewport
 * allows: whatever a card crops, the viewer restores. It is dismissed rather
 * than navigated away from — an X, a swipe down, Escape, and the backdrop all
 * close it, and the route never changes.
 *
 * A picture pinch-zooms and the gallery's swipe carries over; a video takes the
 * full transport, and rotating the device fills the screen with it. No acts, and
 * the description is not shown — alt text is for the people who cannot see the
 * frame, not a caption the author never wrote.
 */
export interface MediaViewerItem {
  src?: string;
  poster?: string;
  alt?: string;
  kind?: "image" | "video";
}

export interface MediaViewerProps {
  items?: readonly MediaViewerItem[];
  /** Which item opens first. Arrows and ←/→ move within the set. */
  index?: number;
  onClose?: () => void;
  onIndexChange?: (index: number) => void;
  /** The video transport's drawn readout — a board cannot play. */
  playing?: boolean;
  elapsed?: string;
  duration?: string;
  progress?: number;
}

export declare function MediaViewer(props: MediaViewerProps): JSX.Element | null;
