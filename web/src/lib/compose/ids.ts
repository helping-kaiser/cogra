// Ids for the things a compose session holds.
//
// ONE MINTING RULE, because these ids are not interchangeable with a
// timestamp. `PickedAsset.id` is stable for the asset's whole life in the
// draft, including across a restore, and it is the key the upload effect
// dedupes by — two covers chosen inside one millisecond would share a
// `Date.now()`-derived id and one upload would be skipped.
//
// AND THE PICKED FILE'S NAME NEVER GOES IN. The name can itself be personal
// data ("IMG_20260828_ourhouse.jpg"); media-api.ts refuses to send it to the
// server for exactly that reason, and a draft id carrying it writes it to disk
// instead. An id is opaque.

/** A fresh opaque id for a picked asset, a cover, or a refusal row. */
export function newComposeId(): string {
  return crypto.randomUUID();
}
