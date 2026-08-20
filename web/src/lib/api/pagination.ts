// The client half of the listing contract (api-spec.md "Pagination is
// Relay cursor connections").
//
// A page is a snapshot, not a live view: refetching is the client's own
// explicit act, and the client neither merges newly pending items into a
// page it already holds nor reconciles a held page against a newer one.
// A refresh therefore replaces the held list outright; appending a
// further page is the one place a held page and a newer read meet.
//
// There they can overlap. Pending entries sort in their own namespace
// above every landed one, so an entry that lands between two fetches
// leaves that namespace for its place in landing order — which can fall
// below the cursor the walk resumes from, and the walk serves it again.
// The held copy wins and the repeat is dropped: keeping both would show
// one node twice, and swapping in the newer copy would be the
// reconciliation the contract rules out.

export function appendDeduped<T extends { id: string }>(
  held: readonly T[],
  incoming: readonly T[],
): readonly T[] {
  const seen = new Set(held.map((item) => item.id));
  const fresh: T[] = [];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    fresh.push(item);
  }
  // Identity is preserved when a page adds nothing, so an all-repeat
  // page costs no re-render.
  return fresh.length === 0 ? held : [...held, ...fresh];
}
