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
// A PRIVATE STAGE is what a clip outside any host gets — the viewer, a compose
// preview, a gallery on an unhosted page, a clip on a layer raised over its
// host (android precedent: `MediaGallery.kt:88`). It elects, freezes, honours
// suppression and the page's visibility, but reads no covering layer and lands
// at no hard top; the player layer (`video-stage.ts`) still keeps one clip
// playing across all of them.
//
// THE PINNED STAGE is the detail's pinned clip's (`pinned-clip.tsx`): "the
// pinned clip is its detail's one stage" (the stage-law packet §3.2 rule 12).
// It reads the covering layers over the detail as a list does, but answers
// them in its own resume mode (`stage.ts`, PostDetailVideo.md:31–41), and it
// lands at no hard top — the clip is pinned, the page scrolls beneath it.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useHardTopLanding } from "@/lib/ui/hard-top-landing";
import { isPageVisible, usePageVisible } from "@/lib/ui/page-visibility";
import { useScrollHost } from "@/lib/ui/scroll-host";

import { useCoveringLayer, useSurfaceCover } from "../covering-layer";
import { isAutoplaySuppressed, useAutoplaySuppressed } from "./autoplay-suppression";
import { Stage } from "./stage";

// A LAYER SHIELDS WHAT IT DRAWS FROM THE STAGE BENEATH IT. A host is a stage on
// the layer it stands on — the page, or a sheet. A clip drawn on a layer RAISED
// OVER that host (a sheet with no stage of its own, the fullscreen viewer) is
// not on the covered surface at all: joining its stage would have the layer
// suspend the very clip it draws, since that stage holds nobody while the
// layer is up (Feed.md:33). So a host is only the stage of components standing
// on its own layer (`CoveringLayerProvider`), and a clip on a layer above it
// finds no host and gets a private stage of its own — "a clip drawn on the
// sheet competes for the stage by the same law" (design/readme.md §13), on the
// sheet's stage rather than the covered surface's.
type Hosted = { readonly stage: Stage; readonly layer: object | null };

const StageContext = createContext<Hosted | null>(null);

/**
 * The stage the calling component stands on, or null outside any host — and
 * null on a layer raised over the nearest host, which is not its surface.
 */
export function useStage(): Stage | null {
  const hosted = useContext(StageContext);
  const layer = useCoveringLayer();
  return hosted !== null && hosted.layer === layer ? hosted.stage : null;
}

export function StageHost({
  children,
  private: isPrivate = false,
  pinned = false,
}: {
  children: ReactNode;
  /** A stage for clips that no surface hosts — see the note above. */
  private?: boolean;
  /** The detail's pinned clip's stage — see the note above. */
  pinned?: boolean;
}) {
  // Identity, not value: one engine for the host's whole life. The lazy
  // initializer reads the platform once, so the first registration already
  // knows the page and the device.
  const [stage] = useState(
    () => new Stage({ visible: isPageVisible(), allowed: !isAutoplaySuppressed(), pinned }),
  );
  const cover = useSurfaceCover();
  const layer = useCoveringLayer();
  // Memoised as react.dev's `useContext` page advises for an object value, so
  // the players reading it re-render only when the layer the host stands on
  // changes — which, for a mounted host, is never.
  const hosted = useMemo<Hosted>(() => ({ stage, layer }), [stage, layer]);
  const visible = usePageVisible();
  const suppressed = useAutoplaySuppressed();
  const scroller = useScrollHost();

  useEffect(() => () => stage.dispose(), [stage]);
  useEffect(() => stage.setAllowed(!suppressed), [stage, suppressed]);
  useEffect(() => stage.setVisible(visible), [stage, visible]);
  useEffect(() => {
    if (!isPrivate) stage.setCover(cover);
  }, [stage, cover, isPrivate]);

  useHardTopLanding({
    host: scroller,
    onLand: () => stage.land(),
    enabled: !isPrivate && !pinned,
  });

  return <StageContext.Provider value={hosted}>{children}</StageContext.Provider>;
}

/**
 * Stand `children` on the surrounding stage, or on a private one where no
 * host surrounds them.
 */
export function OnStage({ children }: { children: ReactNode }) {
  return useStage() === null ? <StageHost private>{children}</StageHost> : <>{children}</>;
}
