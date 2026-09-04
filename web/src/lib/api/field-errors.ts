// Reading a refusal's `field` path, in one place.
//
// A batched write refuses per member: a tag's complaint arrives at
// `["tags", i, "name"]` and a reference's at `["references", i, …]`, and every
// composing surface has to split those out of the flat error list so each chip
// carries its own and the rest reads on the general line. Written per screen it
// drifted — three copies of the path parser and four of the partition — so it
// is written here once and the screens keep only the sentence they show.

import type { UserError } from "./outcome";

/** The index a refusal path names under `head`, or null when it names none. */
export function pathIndex(field: readonly string[] | null, head: string): number | null {
  if (field === null || field.length < 2 || field[0] !== head) return null;
  const index = Number(field[1]);
  return Number.isInteger(index) ? index : null;
}

export type FieldPartition = {
  /** Refusals that name a tag, by its index in the batch. */
  readonly perTag: Record<number, string>;
  /** Refusals that name a reference, by its index in the batch. */
  readonly perReference: Record<number, string>;
  /** The first refusal naming neither — null when every one found a chip. */
  readonly general: string | null;
};

/**
 * Splits a refusal list into the chips that carry it and the line that carries
 * the rest.
 *
 * `message` is the caller's mapper rather than the error's own text: a
 * `UserError.message` is developer-facing by contract (api-spec.md
 * "Developer-facing fallback text; the client localizes off `code`"), so the
 * sentence a reader sees is always the client's.
 */
export function partitionFieldErrors(
  errors: readonly UserError[],
  message: (error: UserError) => string,
): FieldPartition {
  const perTag: Record<number, string> = {};
  const perReference: Record<number, string> = {};
  let general: string | null = null;
  for (const error of errors) {
    const tag = pathIndex(error.field, "tags");
    const reference = pathIndex(error.field, "references");
    if (tag !== null) perTag[tag] = message(error);
    else if (reference !== null) perReference[reference] = message(error);
    else general ??= message(error);
  }
  return { perTag, perReference, general };
}

/** Whether the partition put anything on a chip. */
export function hasFieldErrors(partition: FieldPartition): boolean {
  return (
    Object.keys(partition.perTag).length + Object.keys(partition.perReference).length > 0
  );
}
