// The quiet lines the compose masters set on a type role WITHOUT its weight.
//
// `PickTray`'s caption, `PickedSheet`'s footnote, `DescribeSheet`'s sub-line,
// `ComposePickWeb`'s drop line and `UploadErrorLine` declare the role's size,
// leading and tracking and leave the weight to the page, so they read at the
// body's 400 rather than the role's own 500. The `text-label-small` utility
// carries all four, so these lines take the three they name and nothing more.
export const LABEL_SMALL_PLAIN =
  "text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)]";
