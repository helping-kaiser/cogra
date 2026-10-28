// ONE TRACE OPEN, HELD (score-readout packet CD-SR2): the score's tap is one
// live fetch, and the four levels read that one held answer — RankPath,
// RankHop and RankRecords make no call of their own, and the back arrows
// return to the held state. Re-entering the trace from a card is a NEW open,
// and a new live fetch (PR-39); nothing re-asks in the background.
//
// The levels are one route (`/trace/<id>`) whose search params say how deep
// the reader is, so the browser's own back steps up the levels; the held
// answer lives here, at module scope, so a level re-mounted by a back or a
// forward reads it rather than asking again. A cold arrival — a reload, a
// pasted link — finds nothing held and makes its own one fetch.
//
// WHERE THE TRACE WAS OPENED FROM names its first back arrow
// (graph.json's origin table; readme.md:8446-8450; History.md:61;
// Saved.md:37; ProfilePosts.md:39-41; SR-G13's build reading for the landed
// detail), and returns the reader there.

import type { TraceNodes } from "@/lib/api/trace-api";
import type { TraceCover } from "./cover";
import type { TraceAnswer, TraceThingKind } from "./trace-model";

/** Where a score was tapped. */
export type TraceOrigin =
  | { readonly kind: "feed" }
  /** The post's own detail; `via` is the detail's own origin, kept for its back arrow. */
  | { readonly kind: "post"; readonly postId: string; readonly via: string | null }
  | { readonly kind: "tag"; readonly name: string }
  | { readonly kind: "history" }
  | { readonly kind: "saved" }
  | { readonly kind: "profile" }
  | { readonly kind: "person"; readonly handle: string };

/** The first back arrow: where it goes and what it reads. */
export function traceBack(origin: TraceOrigin): { href: string; label: string } {
  switch (origin.kind) {
    case "feed":
      return { href: "/feed", label: "Back to feed" };
    case "post": {
      const via = origin.via === null ? "" : `?from=${encodeURIComponent(origin.via)}`;
      return { href: `/posts/${encodeURIComponent(origin.postId)}${via}`, label: "Back to the post" };
    }
    case "tag":
      return { href: `/topics/${encodeURIComponent(origin.name)}`, label: `Back to #${origin.name}` };
    case "history":
      return { href: "/history", label: "Back to History" };
    case "saved":
      return { href: "/saved", label: "Back to Saved" };
    case "profile":
      return { href: "/profile", label: "Back to your profile" };
    case "person":
      return { href: `/u/${encodeURIComponent(origin.handle)}`, label: "Back to the profile" };
  }
}

/** The `from` a trace URL carries. */
export function originParam(origin: TraceOrigin): string {
  switch (origin.kind) {
    case "post":
      return `post:${origin.postId}${origin.via === null ? "" : `:${origin.via}`}`;
    case "tag":
      return `tag:${origin.name}`;
    case "person":
      return `u:${origin.handle}`;
    default:
      return origin.kind;
  }
}

/** A `from` read back; anything unknown is the feed. */
export function originOf(param: string | null): TraceOrigin {
  if (param === null) return { kind: "feed" };
  if (param.startsWith("post:")) {
    const [postId, ...via] = param.slice("post:".length).split(":");
    return { kind: "post", postId: postId ?? "", via: via.length > 0 ? via.join(":") : null };
  }
  if (param.startsWith("tag:")) return { kind: "tag", name: param.slice("tag:".length) };
  if (param.startsWith("u:")) return { kind: "person", handle: param.slice("u:".length) };
  if (param === "history" || param === "saved" || param === "profile") return { kind: param };
  return { kind: "feed" };
}

/** How deep in the trace: level one, a path, a step on it, its records. */
export type TraceLevel =
  | { readonly kind: "entry" }
  | { readonly kind: "path"; readonly path: number }
  | { readonly kind: "step"; readonly path: number; readonly step: number }
  | { readonly kind: "records"; readonly path: number; readonly step: number };

/** What a trace URL says beyond the thing it is about. */
export type TraceAddress = {
  readonly targetId: string;
  readonly kind: TraceThingKind;
  readonly origin: TraceOrigin;
  /** The thing has not landed: the trace makes no fetch (FeedEntryMoved.md:9). */
  readonly settling: boolean;
};

/** The URL of `level` of the trace at `address`. Paths and steps count from 1. */
export function traceHref(address: TraceAddress, level: TraceLevel = { kind: "entry" }): string {
  const query = new URLSearchParams({ from: originParam(address.origin), kind: address.kind });
  if (address.settling) query.set("settling", "1");
  if (level.kind !== "entry") query.set("path", String(level.path));
  if (level.kind === "step" || level.kind === "records") query.set("step", String(level.step));
  if (level.kind === "records") query.set("records", "1");
  return `/trace/${encodeURIComponent(address.targetId)}?${query.toString()}`;
}

/** A trace URL's level, read back; anything malformed is level one. */
export function levelOf(params: { get(name: string): string | null }): TraceLevel {
  const count = (name: string) => {
    const value = Number(params.get(name));
    return Number.isInteger(value) && value >= 1 ? value : null;
  };
  const path = count("path");
  if (path === null) return { kind: "entry" };
  const step = count("step");
  if (step === null) return { kind: "path", path };
  return params.get("records") === "1" ? { kind: "records", path, step } : { kind: "step", path, step };
}

/** The held state of one open. */
export type TraceRead =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "answered"; readonly viewer: string; readonly answer: TraceAnswer; readonly nodes: TraceNodes }
  | { readonly kind: "failed"; readonly offline: boolean };

export type TraceOpen = {
  readonly targetId: string;
  /** The thing as its card held it, when the tap handed one (CD: "held, not re-read"). */
  readonly cover: TraceCover | null;
  /** The view the tapped figure was computed in (CD-SR1); null when none was held. */
  readonly viewer: string | null;
  readonly read: TraceRead;
};

let current: TraceOpen | null = null;

/** The tap: a new open of `targetId`, whose first level fetches once. */
export function beginTrace(targetId: string, cover: TraceCover | null, viewer: string | null): void {
  current = { targetId, cover, viewer, read: { kind: "idle" } };
}

/** The open the levels read, made fresh for a cold arrival. */
export function openTrace(targetId: string): TraceOpen {
  if (current === null || current.targetId !== targetId) beginTrace(targetId, null, null);
  return current!;
}

/** Hold what the open's one fetch came to, for every level that reads it. */
export function holdTraceRead(targetId: string, read: TraceRead): void {
  if (current !== null && current.targetId === targetId) current = { ...current, read };
}

/** Forget the open — a cold start, for a test. */
export function forgetTrace(): void {
  current = null;
}
