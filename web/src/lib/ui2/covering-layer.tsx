"use client";

// WHAT IS RAISED OVER A SURFACE — the covering-layer signal the stage law
// reads (tmp_dev packet `web-stage-law.md` §3.2 rule 7, RF-3).
//
// "A sheet over a surface suspends that surface's stage" (design/readme.md
// §13): a clip behind a sheet is not on screen in the law's sense, so the
// covered surface's incumbent stops rather than playing on under the scrim.
// The rulings widen it to every sheet AND every dialog (Feed.md:31–37,
// PostDetailVideo.md:31–37), and carve the opinion pad out as a PAUSE instead
// — the pad pauses the playing clip and resumes that same clip on close, with
// no re-election (Feed.md:39/41, PostDetailVideo.md:39/41).
//
// WHY A SIGNAL AND NOT GEOMETRY. A native `<dialog>` opened with `showModal()`
// sits in the top layer, and the IntersectionObserver a surface measures its
// clips with does not see it: a clip under a raised sheet still reports itself
// fully in view. So the layer has to SAY it is there. The primitives say it
// themselves — `BottomSheet`, every native dialog, the stance pad — so no
// call site that raises one can forget to.
//
// WHICH SURFACE A LAYER COVERS is the order layers were raised in, the same
// order the platform stacks them: "the dialog is placed in the top layer, on
// top of any other dialogs that might be present"
// (https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal).
// The page's own surface stands beneath every layer; a surface drawn INSIDE a
// layer — the comment thread inside its sheet — stands on that layer, and is
// covered only by layers raised after it. That is what lets the thread sheet
// suspend the feed under it while a join prompt raised over the thread
// suspends the thread in turn.
//
// Behaviour-neutral on its own: nothing reads the signal until a stage host
// does (the election PR).

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * What a layer does to the surfaces beneath it: a sheet or a dialog
 * `suspend`s them (their stage holds nobody); the opinion pad `pause`s the
 * playing clip without changing hands.
 */
export type CoverKind = "suspend" | "pause";

type Layer = { readonly token: object; readonly kind: CoverKind };

/** The open layers, in the order they were raised — the top layer's own order. */
let layers: readonly Layer[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function raise(layer: Layer) {
  layers = [...layers, layer];
  emit();
}

function lower(token: object) {
  const next = layers.filter((layer) => layer.token !== token);
  if (next.length === layers.length) return;
  layers = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What covers a surface: the strongest kind among the layers raised over it. */
export type SurfaceCover = "suspended" | "paused" | null;

/**
 * What covers the surface that stands on `surface` — a layer's token, or null
 * for the page beneath every layer.
 *
 * A surface whose layer is not raised is read as the page beneath every
 * layer: it is not on screen at all, so counting it covered stops nothing a
 * reader could see.
 */
export function coverOf(surface: object | null): SurfaceCover {
  const index = surface === null ? -1 : layers.findIndex((layer) => layer.token === surface);
  const above = layers.slice(index + 1);
  if (above.some((layer) => layer.kind === "suspend")) return "suspended";
  if (above.some((layer) => layer.kind === "pause")) return "paused";
  return null;
}

/**
 * Announce a covering layer while `open`: from the moment it is raised until
 * it is dismissed — or unmounted, whichever comes first.
 *
 * Returns the layer's own token, which the layer hands to what it draws
 * through {@link CoveringLayerProvider} so a surface inside it knows where it
 * stands.
 */
export function useCoversSurface(open: boolean, kind: CoverKind): object {
  // Identity, not value — the same stable-token idiom `video-player.tsx` uses.
  const [token] = useState(() => ({}));
  useEffect(() => {
    if (!open) return;
    raise({ token, kind });
    return () => lower(token);
  }, [open, kind, token]);
  return token;
}

const CoveringLayerContext = createContext<object | null>(null);

/** Puts what a layer draws on that layer, so the surfaces inside it stand there. */
export function CoveringLayerProvider({ layer, children }: { layer: object; children: ReactNode }) {
  return <CoveringLayerContext.Provider value={layer}>{children}</CoveringLayerContext.Provider>;
}

/** The layer the calling component stands on, or null for the page. */
export function useCoveringLayer(): object | null {
  return useContext(CoveringLayerContext);
}

/**
 * What covers the surface the calling component stands on, as a value it
 * re-renders on (`useSyncExternalStore`, React's documented way to read a
 * store outside React). The server snapshot is uncovered: a server render
 * has no layers raised.
 */
export function useSurfaceCover(): SurfaceCover {
  const surface = useCoveringLayer();
  return useSyncExternalStore(
    subscribe,
    () => coverOf(surface),
    () => null,
  );
}

/** Test-only: the raised layers' kinds, bottom to top. */
export function raisedLayersForTests(): readonly CoverKind[] {
  return layers.map((layer) => layer.kind);
}

/** Test-only: how many readers are subscribed — the teardown-hygiene probe. */
export function coverListenersForTests(): number {
  return listeners.size;
}
