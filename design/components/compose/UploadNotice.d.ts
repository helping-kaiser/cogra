/**
 * The two upload notices. `UploadStatusLine` is the seal's gate — while it
 * shows, the sign button is disabled: nothing signs until the content it
 * signs exists. `UploadErrorLine` carries a failure's words and its ways out
 * (Retry · Remove it); the failed tile itself wears `MediaThumb`'s badge. The
 * ways out follow the failure: a refused file — too big, or a format nothing
 * here reads — omits `onRetry`, because retrying cannot change the answer.
 */
export interface UploadStatusLineProps {
  done: number;
  total: number;
  /** 0..1 override for the ring; defaults to done/total. */
  progress?: number;
  /**
   * The gate's fault reading: an upload failed while the seal waits. The
   * failure's fact (`message`), "Signing waits for it." and Retry; the sign
   * button stays disabled. `done`/`total` are unused while it shows.
   */
  failed?: boolean;
  /** The failure's fact — "One picture didn't upload." by default. */
  message?: string;
  onRetry?: () => void;
}

export declare function UploadStatusLine(props: UploadStatusLineProps): JSX.Element;

export interface UploadErrorLineProps {
  message?: string;
  /** Omit for a refused file — the Retry link is dropped, not disabled. */
  onRetry?: () => void;
  onRemove?: () => void;
}

export declare function UploadErrorLine(props: UploadErrorLineProps): JSX.Element;
