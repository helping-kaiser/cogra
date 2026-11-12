// A record's place in the published order (api-spec.md "Mirror-ordered reads
// use keyset cursors"): the key of record, landing epoch then position within
// the epoch, compared lexicographically. Act time decides no precedence, so it
// is not part of the key. A fold that needs a bundle's NEWEST record reads it
// here rather than trusting the order a page happened to arrive in.

export type CausalKey = {
  readonly landingEpoch: number;
  readonly position: number;
};

/** Whether `a` lands after `b` in the published order. */
export function laterThan(a: CausalKey, b: CausalKey): boolean {
  if (a.landingEpoch !== b.landingEpoch) return a.landingEpoch > b.landingEpoch;
  return a.position > b.position;
}

/** The newest of a non-empty run of records. */
export function newestOf<R extends CausalKey>(records: readonly R[]): R {
  return records.reduce((a, b) => (laterThan(b, a) ? b : a));
}
