import * as React from "react";

export interface DeletionBandProps {
  /** Whole days left of the seven-day window. Spelled out in the line. */
  days?: number;
  /** The request opted into content-level redaction — the line names it. */
  content?: boolean;
  /** Overrides the composed line. The two readings above are the house ones. */
  line?: string;
  /** The way back. `Cancel` unless a surface has reason to say otherwise. */
  actionLabel?: string;
  onCancel?: () => void;
}

/** The deletion band: a confirmed account deletion's countdown and its cancel,
    riding directly under the surface's header on every logged-in screen until
    the deadline or the cancel. */
export function DeletionBand(props: DeletionBandProps): React.JSX.Element;
