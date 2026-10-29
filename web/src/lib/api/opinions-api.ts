// Who holds an opinion on a post, a comment or a person, and whom a person
// holds one on (api-spec.md `Node.incomingRecords` / `outgoingRecords`, family
// OPINION), lifted into an outcome and folded into the rows the opinions
// sheet and the opinions page draw (`held-opinions.ts`).

import type { ApolloClient } from "@apollo/client";

import {
  NodeOpinionsDocument,
  UserOpinionsByDocument,
  UserOpinionsOnDocument,
  type OpinionPersonFieldsFragment,
  type OpinionRecordFieldsFragment,
} from "@/__generated__/graphql";
import type { OpinionDirection } from "@/lib/profile/opinions-route";
import { foldHeldOpinions } from "@/lib/stance/held-opinions";
import type { StancePair } from "@/lib/stance/model";
import { REDACTED_ACTOR_NAME } from "@/lib/ui2/content-row";
import { fetchOutcome, success, type Outcome } from "./outcome";

/** The person a row is about, as `StanceRow` draws them. */
export type OpinionHolder = {
  /** The name line: the written name, else the handle, else the raw address. */
  readonly name: string;
  /** The handle line and the profile the row opens; null where there is none to open. */
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  /** A deleted account: the reserved disc and `Deleted account`. */
  readonly redacted: boolean;
  /**
   * The account's id, the lowercase UUID the wire carries (`User.id`); null
   * for an address no account fronts. A deleted account's row is keyed by it
   * (nodes.json `profileStances.list.redactedRow`), having no handle to name.
   */
  readonly actorId: string | null;
  /**
   * The handle the row's door opens, which is not always one the row may
   * print: a deleted account's route still names its account (ProfileDeleted.md,
   * "reached by structure that still points at the account") while its handle
   * line is gone (`StanceRow.jsx`, the `redacted` row). Null opens nothing.
   */
  readonly door: string | null;
};

/** One row: a person and the standing opinion the row is about. */
export type HeldOpinionView = {
  /** The person's L1 address — the bundle's key on this list. */
  readonly holderId: string;
  readonly holder: OpinionHolder;
  readonly pair: StancePair;
  readonly severed: boolean;
};

/**
 * Who the row names. A deleted account reads REDACTED in its name and serves
 * no handle the row may print (ER-G10). An address no account fronts still
 * holds its opinion and keeps its row, named by its L1 identifier — the
 * chronicle never depends on typed coverage (`RefsSheet`'s untyped citation).
 */
function holderOf(person: OpinionPersonFieldsFragment | null | undefined, address: string): OpinionHolder {
  if (person === null || person === undefined) {
    return { name: address, handle: null, avatarUrl: null, redacted: false, actorId: null, door: null };
  }
  if (person.displayName.status === "REDACTED") {
    // THE ROW IS STILL A DOOR (`StanceRow.jsx`, round 27): the husk is reached
    // the way every card reaches it, by the route its account still answers
    // to (`ProfileFeedCard`'s `/u/<handle>`), and that route is never printed.
    return {
      name: REDACTED_ACTOR_NAME,
      handle: null,
      avatarUrl: null,
      redacted: true,
      actorId: person.id,
      door: person.handle,
    };
  }
  const avatar = person.avatar;
  return {
    name: person.displayName.value?.trim() || person.handle,
    handle: person.handle,
    avatarUrl: avatar === null || avatar === undefined || avatar.status === "REDACTED" ? null : avatar.url,
    redacted: false,
    actorId: person.id,
    door: person.handle,
  };
}

/** How many pages the whole set may take before the read gives up (100 apiece). */
const MAX_PAGES = 50;

/** One page of a record connection, as every opinions read serves it. */
type Page<R> = {
  readonly edges: readonly { readonly node: R }[];
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor?: string | null };
};

/**
 * Reads a whole record connection, a page at a time. The whole set is read
 * because the fold needs every record of a bundle, and the order — strongest
 * first — needs every bundle: a row cannot be placed before the last page has
 * said whether a later record moves it.
 */
async function readAll<R>(
  page: (after: string | null) => Promise<Outcome<Page<R> | undefined>>,
): Promise<Outcome<R[]>> {
  const records: R[] = [];
  let after: string | null = null;
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const fetched = await page(after);
    if (fetched.kind !== "success") return fetched;
    const connection = fetched.value;
    if (connection === undefined) break;
    records.push(...connection.edges.map((edge) => edge.node));
    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor ?? null;
    if (after === null) break;
  }
  return success(records);
}

/** The fold, in the view's terms: one row per holder, strongest first. */
function rowsOf(
  records: readonly (OpinionRecordFieldsFragment & { readonly holderId: string; readonly holder: OpinionHolder })[],
): HeldOpinionView[] {
  return foldHeldOpinions(records).map((held) => ({
    holderId: held.holderId,
    holder: held.holder,
    pair: held.pair,
    severed: held.severed,
  }));
}

/**
 * Everyone holding an opinion on this post or comment, strongest first — one
 * row per person, however many records their opinion took. The detail's count
 * and the sheet's rows are this one answer.
 */
export async function fetchHeldOpinions(
  client: ApolloClient,
  nodeId: string,
): Promise<Outcome<readonly HeldOpinionView[]>> {
  const read = await readAll((after) =>
    fetchOutcome(() =>
      client.query({ query: NodeOpinionsDocument, variables: { id: nodeId, after }, fetchPolicy: "network-only" }),
    ).then((fetched) =>
      fetched.kind === "success" ? success(fetched.value.node?.incomingRecords) : fetched,
    ),
  );
  if (read.kind !== "success") return read;
  return success(
    rowsOf(read.value.map((record) => ({ ...record, holderId: record.authorId, holder: holderOf(record.author, record.authorId) }))),
  );
}

/**
 * One direction of a person's opinions page, strongest first:
 *
 * - `on` — everyone holding an opinion on them, a row per author: the
 *   records the `Opinions on them` figure counts.
 * - `by` — everyone they hold an opinion on, a row per person it is about:
 *   the records the `Opinions by them` figure counts.
 *
 * THE FIGURE COUNTS RECORDS; THE PAGE LISTS PEOPLE (open-questions.md Q35).
 * A revised opinion is three records and one row, so a figure may read more
 * than its list holds — each says what its words say.
 */
export async function fetchProfileOpinions(
  client: ApolloClient,
  userId: string,
  direction: OpinionDirection,
): Promise<Outcome<readonly HeldOpinionView[]>> {
  if (direction === "on") {
    const read = await readAll((after) =>
      fetchOutcome(() =>
        client.query({ query: UserOpinionsOnDocument, variables: { id: userId, after }, fetchPolicy: "network-only" }),
      ).then((fetched) =>
        fetched.kind === "success" ? success(fetched.value.user?.incomingRecords) : fetched,
      ),
    );
    if (read.kind !== "success") return read;
    return success(
      rowsOf(read.value.map((record) => ({ ...record, holderId: record.authorId, holder: holderOf(record.author, record.authorId) }))),
    );
  }
  const read = await readAll((after) =>
    fetchOutcome(() =>
      client.query({ query: UserOpinionsByDocument, variables: { id: userId, after }, fetchPolicy: "network-only" }),
    ).then((fetched) =>
      fetched.kind === "success" ? success(fetched.value.user?.outgoingRecords) : fetched,
    ),
  );
  if (read.kind !== "success") return read;
  return success(
    rowsOf(
      read.value.map((record) => {
        // A binary family always names its far end; an unnamed one is no
        // person this list could place, so its address stands in.
        const address = record.targetId ?? record.id;
        const person = record.target?.__typename === "User" ? record.target : null;
        return { ...record, holderId: address, holder: holderOf(person, address) };
      }),
    ),
  );
}
