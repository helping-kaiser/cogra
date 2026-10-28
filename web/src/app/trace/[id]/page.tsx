import type { Metadata } from "next";

import { levelOf, originOf, type TraceAddress } from "@/lib/score/trace-session";
import type { TraceThingKind } from "@/lib/score/trace-model";
import { TraceView } from "./trace-view";

export const metadata: Metadata = { title: "Why this reached you — CoGra" };

const KINDS: readonly TraceThingKind[] = ["post", "comment", "person", "topic"];

/** A single search parameter's value, or null (an array is never one we wrote). */
function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export default async function TracePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const kind = one(query.kind);
  const address: TraceAddress = {
    targetId: id,
    kind: KINDS.includes(kind as TraceThingKind) ? (kind as TraceThingKind) : "post",
    // WHERE THE SCORE WAS TAPPED names the first back arrow (graph.json's
    // origin table; `trace-session.ts`).
    origin: originOf(one(query.from)),
    settling: one(query.settling) === "1",
  };
  // THE KEY IS THE THING, never the level: walking down and back up the four
  // levels is one mount over one held answer (CD-SR2).
  return <TraceView key={id} address={address} level={levelOf({ get: (name) => one(query[name]) })} />;
}
