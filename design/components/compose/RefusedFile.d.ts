/**
 * A file the surface turned away: the failed tile, and the words saying which
 * rule it broke. Drawn where the file was offered — never a dialog, never a
 * snackbar — and offering only Remove it, because retrying cannot make a file
 * smaller or a format readable.
 */
export interface RefusedFileProps {
  /** Omit for a file nothing can read: an empty tile is the honest picture. */
  src?: string;
  alt?: string;
  video?: boolean;
  /** One file, one line, the nearest reason. */
  message?: string;
  onRemove?: () => void;
}

export declare function RefusedFile(props: RefusedFileProps): JSX.Element;
