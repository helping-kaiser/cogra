/**
 * Describe this picture — where alt text is written, reached per picture from
 * the details step's counter and the Show all sheet, never from the crop
 * step. Authored, optional, never invented; the "?" carries the full
 * explanation (copy-voice: "Describing pictures"). Builds on `BottomSheet`
 * and `TextField`.
 */
export interface DescribeSheetProps {
  open?: boolean;
  onClose?: () => void;
  /** The picture being described, shown whole above the field. */
  src?: string;
  /** Its current description, doubling as the preview's own alt. */
  alt?: string;
  value?: string;
  onChange?: (value: string) => void;
  onDone?: () => void;
  inline?: boolean;
  /**
   * The clip's shape: "Describe the video", one entry for the whole clip, the
   * preview wearing the play disc. The cover is never offered — it is the
   * video's face, not a second picture.
   */
  video?: boolean;
}

export declare function DescribeSheet(props: DescribeSheetProps): JSX.Element;
