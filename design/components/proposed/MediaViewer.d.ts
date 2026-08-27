/**
 * PROPOSED. The full-media view: tapping media in a post's detail view opens it
 * covering as much of the screen as possible.
 *
 * The frame is never cropped here — `contain`, centred, as large as the viewport
 * allows. It is backed out of rather than navigated away from: `arrow_back`,
 * Escape, and the backdrop all close it, and the route never changes. A video
 * takes real controls here; in a feed tile it has only sound.
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
}

export declare function MediaViewer(props: MediaViewerProps): JSX.Element | null;
