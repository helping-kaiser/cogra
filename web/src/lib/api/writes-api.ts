// The client legs of the write path (api-spec.md "The write flow"),
// lifted into outcomes. Submit and approve send one element per call and
// unwrap the single result (Android parity); the host key is fetched
// once per client — it never rotates within a deployment.

import type { ApolloClient } from "@apollo/client";

import {
  ApproveActsDocument,
  HostPublicKeyDocument,
  PrepareStanceDocument,
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

/**
 * A PreparePayload write, lifted into the signer's staged-write shape:
 * a fresh prepare is by definition awaiting its pre-signature.
 */
export function stagedFromPrepared(prepared: {
  id: string;
  family: RecordFamily;
  canonicalProposal: string;
}): StagedWriteView {
  return {
    id: prepared.id,
    family: prepared.family,
    canonicalProposal: prepared.canonicalProposal,
    state: "AWAITING_PRE_SIGN",
    verifiedAct: null,
  };
}

/** Projects any staged-write-shaped payload node down to the view. */
export function toView(fields: StagedWriteView): StagedWriteView {
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

/**
 * Prepares the viewer's stance toward a target — toward a Profile this
 * is the reciprocation gesture completing the CoGra-join mutual pair
 * (api-spec.md "The generic stance"). Returns the staged writes for the
 * device to sign.
 */
export async function prepareStance(
  client: ApolloClient,
  target: string,
  pDirected: number,
  pInterest: number,
): Promise<Outcome<readonly StagedWriteView[]>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareStanceDocument,
        variables: { input: { target, pDirected, pInterest } },
      }),
    (data) => data.prepareStance.userErrors,
    (data) => data.prepareStance.writes,
  );
  if (outcome.kind !== "success") return outcome;
  return success(outcome.value.map(stagedFromPrepared));
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
