// The server-component client's transport (`apollo-client.ts`): the reads that
// build a page's unfurl metadata — a profile, a topic, an invite — before the
// document is sent. A render waits on them, so an API that accepts the
// connection and never answers would hold every such page open with it.
//
// THE BUDGET IS 10 SECONDS, the longest bounded wait the API itself makes
// (`RANKER_TIMEOUT_MS`'s default, `crates/api/src/ranker_pod.rs`). These reads
// are single-row lookups that touch no ranker, so a healthy one answers in
// milliseconds; the number only has to be above anything the API would still
// answer, and it cuts a hang, never a slow read. Every caller already catches
// and falls back to the page's static title.
//
// PER REQUEST, NOT PER LINK. `AbortSignal.timeout()` starts its clock when it
// is created, so one signal handed to the link at construction would expire
// for every request after the first window. HttpLink documents a `fetch`
// option for exactly this kind of wrapper
// (https://www.apollographql.com/docs/react/api/link/apollo-link-http).

import { HttpLink } from "@apollo/client";

import { graphqlUri } from "@/lib/graphql-uri";

export const SSR_READ_TIMEOUT_MS = 10_000;

/** `fetch` that gives each request its own deadline, and still honours the caller's signal. */
export function ssrFetch(
  inner: typeof fetch = (...args) => fetch(...args),
  timeoutMs: number = SSR_READ_TIMEOUT_MS,
): typeof fetch {
  return (input, init) => {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return inner(input, { ...init, signal });
  };
}

export function ssrLink(timeoutMs: number = SSR_READ_TIMEOUT_MS): HttpLink {
  return new HttpLink({ uri: graphqlUri(), fetch: ssrFetch(undefined, timeoutMs) });
}
