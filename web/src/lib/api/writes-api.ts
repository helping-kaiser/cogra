// The client legs of the write path (api-spec.md "The write flow"),
// lifted into outcomes. Submit and approve send one element per call and
// unwrap the single result (Android parity); the host key is fetched
// once per client — it never rotates within a deployment.

import type { ApolloClient } from "@apollo/client";

import {
  ApproveActsDocument,
  HostPublicKeyDocument,
  StagedWriteDocument,
  SubmitProposalsDocument,
  type RecordFamily,
  type StagedWriteState,
} from "@/__generated__/graphql";
import { failed, fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";

/** The one staged-write shape the signer consumes, across operations. */
export type StagedWriteView = {
  id: string;
  state: StagedWriteState;
  family: RecordFamily;
  canonicalProposal: string;
  verifiedAct: string | null;
};

function toView(fields: StagedWriteView): StagedWriteView {
  return {
    id: fields.id,
    state: fields.state,
    family: fields.family,
    canonicalProposal: fields.canonicalProposal,
    verifiedAct: fields.verifiedAct,
  };
}

const hostKeyCache = new WeakMap<ApolloClient, string>();

export async function hostPublicKey(client: ApolloClient): Promise<Outcome<string>> {
  const cached = hostKeyCache.get(client);
  if (cached !== undefined) return success(cached);
  const fetched = await fetchOutcome(() => client.query({ query: HostPublicKeyDocument }));
  if (fetched.kind !== "success") return fetched;
  hostKeyCache.set(client, fetched.value.hostPublicKey);
  return success(fetched.value.hostPublicKey);
}

function single(writes: readonly StagedWriteView[] | null): Outcome<StagedWriteView> {
  if (writes === null || writes.length !== 1) {
    return failed(new Error("expected exactly one staged write in the payload"));
  }
  return success(toView(writes[0]));
}

export async function submitProposal(
  client: ApolloClient,
  stagedWriteId: string,
  signature: string,
): Promise<Outcome<StagedWriteView>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: SubmitProposalsDocument,
        variables: { input: { proposals: [{ stagedWriteId, signature }] } },
      }),
    (data) => data.submitProposals.userErrors,
    (data) => data.submitProposals.stagedWrites,
  );
  if (outcome.kind !== "success") return outcome;
  return single(outcome.value);
}

export async function approveAct(
  client: ApolloClient,
  stagedWriteId: string,
  signature: string,
): Promise<Outcome<StagedWriteView>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: ApproveActsDocument,
        variables: { input: { approvals: [{ stagedWriteId, signature }] } },
      }),
    (data) => data.approveActs.userErrors,
    (data) => data.approveActs.stagedWrites,
  );
  if (outcome.kind !== "success") return outcome;
  return single(outcome.value);
}

/** null: the id names no staged write of this session's actor (or it is long gone). */
export async function fetchStagedWrite(
  client: ApolloClient,
  id: string,
): Promise<Outcome<StagedWriteView | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: StagedWriteDocument, variables: { id }, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.stagedWrite === null ? null : toView(fetched.value.stagedWrite));
}
