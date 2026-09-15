"use client";

// WHAT THE LICENSE ROW OPENS (design/designs/canonical/screens/PostLicense.jsx;
// `_shared.jsx` `LicenseSheet`). The terms come up from the bottom edge over
// the surface the reader asked from, and go back to it the way any sheet does —
// the scrim, the swipe, Escape. A block unfolded inside a post had no such way
// back, which is the whole reason this is a sheet, and why the terms are never
// a state of the card.
//
// ONE SHEET, TWO MENUS. The reader's ⋮ and the author's own both carry the
// License terms row, and both land here: the terms of a post read the same
// whichever menu asked for them.
//
// IT CARRIES NO TITLE ROW. The inset heads itself — its caption is the words
// the reader tapped, and the Public Domain name rides that same line — so a
// title above it would say `License terms` twice, a few pixels apart, in two
// sizes. The sheet's name lives on the accessible name, which is where a screen
// reader asks for it.

import type { License } from "@/lib/license";
import { LicenseTerms } from "@/lib/ui/license-fields";
import { BottomSheet } from "./bottom-sheet";

export function LicenseSheet({
  open,
  onClose,
  license,
  testId,
  stacked = false,
}: {
  open: boolean;
  onClose: () => void;
  license: License;
  testId: string;
  /**
   * Raised from a comment's menu, this sheet comes up over the comments
   * thread — a sheet over a sheet — rather than over the plain post page
   * (`CommentLicense.jsx`, design/readme.md:2364). The one sheet answers for
   * whichever menu asked, so the caller says which case this is.
   */
  stacked?: boolean;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="License terms"
      titleHidden
      testId={testId}
      stacked={stacked}
    >
      <LicenseTerms license={license} testId={`${testId}-terms`} />
    </BottomSheet>
  );
}
