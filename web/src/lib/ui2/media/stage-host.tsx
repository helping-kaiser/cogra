"use client";

// WHERE A SCROLL SURFACE'S STAGE LIVES (tmp_dev packet `web-stage-law.md` §3.2
// rule 14). "Each scroll surface has one stage, and a post's clip and a
// comment's clip compete for the same one" (design/readme.md §13): the feed's
// list, the comment thread, the topic page's list — and the profile's posts
// view and History when the web draws them — each wrap their clips in a
// `StageHost`, and every `VideoPlayer` inside joins that host's stage.
//
// The host feeds the engine (`stage.ts`) everything the platform says about
// the surface:
//
// - what covers it — the layer signal of `covering-layer.tsx`, read where the
//   host stands, so the thread inside its sheet is covered only by layers
//   raised over the sheet;
// - whether the page is shown (`page-visibility.ts`);
// - whether the device suppresses autoplay (`autoplay-suppression.ts`), live;
// - when its own scroller lands at its hard top (`hard-top-landing.ts`, on the
//   scroller `scroll-host.tsx` names — the shell's column for a page, the
//   sheet's body for the thread).
//
// ALL THREE SIGNALS ARE READ AS RENDERED VALUES, and that is load-bearing for
// covering layers. A layer handed over to another in one commit — a menu
// sheet closing as the license sheet it raised opens — drops and raises
// inside one effects flush; `useSyncExternalStore` reads the store again when
// it renders, after the flush, so the host never sees the instant between
// them as the suspension lifting. A handover that spans commits says so
// explicitly instead (`BottomSheet`'s `coverHeld`, the thread yielding to its
// composer).
//
// A PRIVATE STAGE is what a clip outside any host gets — the detail's pinned
// clip, the viewer, a compose preview, a gallery on an unhosted page (android
// precedent: `MediaGallery.kt:88`). It elects, freezes, honours suppression
// and the page's visibility, but reads no covering layer and lands at no hard
// top: the detail's pinned clip is its own stage with its own rules (the
// pinned-clip PR), and the player layer (`video-stage.ts`) still keeps one
// clip playing across all of them.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useHardTopLanding } from "@/lib/ui/hard-top-landing";
import { isPageVisible, usePageVisible } from "@/lib/ui/page-visibility";
import { useScrollHost } from "@/lib/ui/scroll-host";

import { useSurfaceCover } from "../covering-layer";
import { isAutoplaySuppressed, useAutoplaySuppressed } from "./autoplay-suppression";
import { Stage } from "./stage";

const StageContext = createContext<Stage | null>(null);

/** The stage the calling component stands on, or null outside any host. */
export function useStage(): Stage | null {
  return useContext(StageContext);
}

export function StageHost({
  children,
  private: isPrivate = false,
}: {
  children: ReactNode;
  /** A stage for clips that no surface hosts — see the note above. */
  private?: boolean;
}) {
  // Identity, not value: one engine for the host's whole life. The lazy
  // initializer reads the platform once, so the first registration already
  // knows the page and the device.
  const [stage] = useState(
    () => new Stage({ visible: isPageVisible(), allowed: !isAutoplaySuppressed() }),
  );
  const cover = useSurfaceCover();
  const visible = usePageVisible();
  const suppressed = useAutoplaySuppressed();
  const scroller = useScrollHost();

  useEffect(() => () => stage.dispose(), [stage]);
  useEffect(() => stage.setAllowed(!suppressed), [stage, suppressed]);
  useEffect(() => stage.setVisible(visible), [stage, visible]);
  useEffect(() => {
    if (!isPrivate) stage.setCover(cover);
  }, [stage, cover, isPrivate]);

  useHardTopLanding({ host: scroller, onLand: () => stage.land(), enabled: !isPrivate });

  return <StageContext.Provider value={stage}>{children}</StageContext.Provider>;
}

/**
 * Stand `children` on the surrounding stage, or on a private one where no
 * host surrounds them.
 */
export function OnStage({ children }: { children: ReactNode }) {
  return useStage() === null ? <StageHost private>{children}</StageHost> : <>{children}</>;
}
