// `StanceData` over the real operations (stance.graphql).
//
// Both reads are the same field: `viewerStance` answers the standing,
// and answers the landing too when it is asked with a pick. So a
// projection costs one round trip and the standing rides along with it —
// there is no second query, and nothing here folds one into the other.
//
// Both go through `viewerField` inside the guard, like every other
// viewer-scoped read (outcome.ts): `viewerStance` answers null rather
// than an error for a reader the request did not authenticate, so unless
// that null is lifted where the guard can see it, a read issued before
// this tab has minted an access token comes back empty and nothing
// refreshes. And the cache is not partitioned by viewer, so a viewer's
// own field is never answered from it — a cached null would outlive the
// refresh that fixes it, and a cached bundle would outlive the account
// that earned it.
//
// Both writes are the ordinary staged-write handshake: prepare, then
// sign what came back. A pick prepares one record; a severance prepares
// the whole counter-record batch, and the gesture signs every element of
// it in one pass — the reader agreed to the batch once, at its stated
// cost, so the signing is not re-asked per record (api-spec.md "A
// prepare may stage a batch"). The batch is signed in order and stops at
// the first element that does not complete: a partly-signed batch leaves
// the rest staged for `resume()`, which is the same recovery every other
// multi-write gesture in the app relies on.

import type { ApolloClient } from "@apollo/client";

import {
  CommentStanceDocument,
  PostStanceDocument,
  ProfileStanceDocument,
} from "@/__generated__/graphql";
import { failed, success, viewerField, type Outcome } from "@/lib/api/outcome";
import { prepareSeverance, prepareStance, type StagedWriteView } from "@/lib/api/writes-api";
import type { AuthGuard } from "@/lib/session/guard";
import type { WriteSigner } from "@/lib/signing/write-signer";
import type { StancePair } from "./model";
import {
  INCLUDE_PENDING_DEFAULT,
  type StanceBundle,
  type StanceCommit,
  type StanceData,
  type StanceLanding,
  type StanceReadOptions,
  type StanceTarget,
} from "./stance-data";

/** Every viewer-scoped read in the app asks the server (outcome.ts). */
const READ_POLICY = "network-only";

/** The `viewerStance` selection, identically shaped across the three roots. */
type WireBundle = {
  readonly pDirected: number;
  readonly pInterest: number;
  readonly rawPDirected: number;
  readonly rawPInterest: number;
  readonly recordCount: number;
  readonly inert: boolean;
  readonly severed: boolean;
  readonly severanceCost: number;
  readonly projected: {
    readonly pDirected: number;
    readonly pInterest: number;
    readonly inert: boolean;
    readonly severed: boolean;
  } | null;
};

function wireBundle(
  client: ApolloClient,
  target: StanceTarget,
  pick: StancePair | null,
  options?: StanceReadOptions,
): Promise<Outcome<WireBundle>> {
  const variables = {
    id: target.id,
    pick: pick === null ? null : { pDirected: pick.pDirected, pInterest: pick.pInterest },
    includePending: options?.includePending ?? INCLUDE_PENDING_DEFAULT,
  };

  switch (target.kind) {
    case "post":
      return viewerField(
        () => client.query({ query: PostStanceDocument, variables, fetchPolicy: READ_POLICY }),
        (data) => data.post?.viewerStance,
      );
    case "comment":
      return viewerField(
        () => client.query({ query: CommentStanceDocument, variables, fetchPolicy: READ_POLICY }),
        (data) => data.comment?.viewerStance,
      );
    case "profile":
      return viewerField(
        () => client.query({ query: ProfileStanceDocument, variables, fetchPolicy: READ_POLICY }),
        (data) => data.user?.viewerStance,
      );
  }
}

export function createApolloStanceData(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  signer: WriteSigner;
}): StanceData {
  const { client, guard, signer } = deps;

  /**
   * Signs a prepared batch in order. Every element must complete for the
   * gesture to have happened; the first that does not stops the pass and
   * leaves the remainder for `resume()`.
   */
  const signAll = async (writes: readonly StagedWriteView[]): Promise<Outcome<StanceCommit>> => {
    for (const staged of writes) {
      const result = await signer.signStaged(staged);
      if (result.kind !== "done") {
        return failed(
          new Error(`staged write ${staged.id} did not complete: ${result.kind}`),
        );
      }
    }
    return success({ records: writes.length });
  };

  return {
    async bundle(target, options): Promise<Outcome<StanceBundle>> {
      const read = await guard.run(() => wireBundle(client, target, null, options));
      if (read.kind !== "success") return read;
      const wire = read.value;
      return success({
        current: { pDirected: wire.pDirected, pInterest: wire.pInterest },
        // Carried through unclipped: the landing line folds against
        // these, and the clip is what would lose the history (§8.3).
        rawSum: { pDirected: wire.rawPDirected, pInterest: wire.rawPInterest },
        records: wire.recordCount,
        inert: wire.inert,
        severed: wire.severed,
        severance: { records: wire.severanceCost },
      });
    },

    async project(target, pick, options): Promise<Outcome<StanceLanding>> {
      const read = await guard.run(() => wireBundle(client, target, pick, options));
      if (read.kind !== "success") return read;
      const projected = read.value.projected;
      if (projected === null) {
        return failed(new Error("viewerStance answered a pick without a projection"));
      }
      return success({
        landing: { pDirected: projected.pDirected, pInterest: projected.pInterest },
        inert: projected.inert,
        severed: projected.severed,
      });
    },

    async commit(target, pick): Promise<Outcome<StanceCommit>> {
      // Exactly the pick, verbatim — the bundle is the fold's business.
      const prepared = await guard.run(() =>
        prepareStance(client, target.id, pick.pDirected, pick.pInterest),
      );
      if (prepared.kind !== "success") return prepared;
      return signAll(prepared.value);
    },

    async sever(target): Promise<Outcome<StanceCommit>> {
      const prepared = await guard.run(() => prepareSeverance(client, target.id));
      if (prepared.kind !== "success") return prepared;
      return signAll(prepared.value);
    },
  };
}
