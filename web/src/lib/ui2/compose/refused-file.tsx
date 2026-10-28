"use client";

// One refused file, as `RefusedFile` draws it (design/components/compose):
// the failed tile beside the words, `gap: var(--space-2)`. The pick step and
// the edits' media rows answer a file they turned away with the same row —
// never a dialog, never a snackbar, and `Remove it` the only way out
// (RefusedFile.prompt.md).
//
// A picture's own bytes preview the tile. A video or anything else gets
// none — the same "omit `src` for a file nothing can read: an empty tile is
// the honest picture" rule the design system states, since a browser has no
// cheap way to pull a poster frame from a refused clip's bytes the way an
// `<img>` shows a picture's.

import { useObjectUrl } from "@/lib/compose/previews";
import type { PickRefusal } from "@/lib/compose/pick";

import { MediaThumb } from "./media-thumb";
import { UploadErrorLine } from "./upload-notice";

export function RefusedFileRow({
  refusal,
  onDismiss,
  testIdPrefix = "wizard",
}: {
  refusal: PickRefusal;
  onDismiss: () => void;
  testIdPrefix?: string;
}) {
  const previewable = refusal.file.type.startsWith("image/");
  const src = useObjectUrl(previewable ? refusal.file : null);
  return (
    <div className="flex items-center gap-2">
      <MediaThumb src={src} failed testId={`${testIdPrefix}-refusal-${refusal.id}-thumb`} />
      <div className="min-w-0 flex-1">
        <UploadErrorLine
          message={refusal.reason}
          onRemove={onDismiss}
          testId={`${testIdPrefix}-refusal-${refusal.id}`}
        />
      </div>
    </div>
  );
}
