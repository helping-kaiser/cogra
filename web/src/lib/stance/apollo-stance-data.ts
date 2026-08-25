// `StanceData` over the real operations (stance.graphql).
//
// Both reads are the same field: `viewerStance` answers the standing,
// and answers the landing too when it is asked with a pick. So a
// projection costs one round trip and the standing rides along with it —
// there is no second query, and nothing here folds one into the other.
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
import { failed, fetchOutcome, success, unauthenticated, type Outcome } from "@/lib/api/outcome";
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

/** The `viewerStance` selection, identically shaped across the three roots. */
type WireBundle = {
  readonly pDirected: number;
  readonly pInterest: number;
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

async function wireBundle(
  client: ApolloClient,
  target: StanceTarget,
  pick: StancePair | null,
  options?: StanceReadOptions,
): Promise<Outcome<WireBundle | null>> {
  const variables = {
    id: target.id,
    pick: pick === null ? null : { pDirected: pick.pDirected, pInterest: pick.pInterest },
    includePending: options?.includePending ?? INCLUDE_PENDING_DEFAULT,
  };
  // A pick must not be answered from an earlier read of the same field:
  // the landing is the whole point of asking.
  const fetchPolicy = pick === null ? "cache-first" : "network-only";

  const lift = (viewerStance: WireBundle | null | undefined): Outcome<WireBundle | null> =>
    success(viewerStance ?? null);

  switch (target.kind) {
    case "post": {
      const fetched = await fetchOutcome(() =>
        client.query({ query: PostStanceDocument, variables, fetchPolicy }),
      );
      return fetched.kind === "success" ? lift(fetched.value.post?.viewerStance) : fetched;
    }
    case "comment": {
      const fetched = await fetchOutcome(() =>
        client.query({ query: CommentStanceDocument, variables, fetchPolicy }),
      );
      return fetched.kind === "success" ? lift(fetched.value.comment?.viewerStance) : fetched;
    }
    case "profile": {
      const fetched = await fetchOutcome(() =>
        client.query({ query: ProfileStanceDocument, variables, fetchPolicy }),
      );
      return fetched.kind === "success" ? lift(fetched.value.user?.viewerStance) : fetched;
    }
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
    async bundle(target, options): Promise<Outcome<StanceBundle | null>> {
      const read = await guard.run(() => wireBundle(client, target, null, options));
      if (read.kind !== "success") return read;
      const wire = read.value;
      // Null is a viewer with no bundle to read at all; a bundle folding
      // no records is a viewer who simply has not stanced this yet. The
      // control shows the same "no standing" affordance for both.
      if (wire === null || wire.recordCount === 0) return success(null);
      return success({
        current: { pDirected: wire.pDirected, pInterest: wire.pInterest },
        inert: wire.inert,
        severed: wire.severed,
        severance: { records: wire.severanceCost },
      });
    },

    async project(target, pick, options): Promise<Outcome<StanceLanding>> {
      const read = await guard.run(() => wireBundle(client, target, pick, options));
      if (read.kind !== "success") return read;
      const wire = read.value;
      if (wire === null) return unauthenticated();
      const projected = wire.projected;
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
