// The device's half of the write handshake (api-spec.md "The write
// flow"; Android mirror: WriteSigner.kt): material persists BEFORE the
// submit, and the approve step verifies against that persisted copy,
// never the server's echo — the user never signs blind bytes.

import type { ApolloClient } from "@apollo/client";

import type { StagedWriteState } from "@/__generated__/graphql";
import type { UserError } from "@/lib/api/outcome";
import {
  approveAct,
  fetchStagedWrite,
  hostPublicKey,
  submitProposal,
  type StagedWriteView,
} from "@/lib/api/writes-api";
import { ActorKey, HandshakeError } from "@/lib/crypto/actor-key";
import { fromBase64, toBase64 } from "@/lib/crypto/bytes";
import type { PreSignedProposal } from "@/lib/crypto/handshake";
import { decodeProposal, decodeVerifiedAct, encodePreCommitmentOf, WireError } from "@/lib/crypto/wire";
import type { AuthGuard } from "@/lib/session/guard";
import type { IdentityStore } from "@/lib/identity/store";

export type WriteResult =
  /** Approved and relaying (or already landed) — the device's part is done. */
  | { kind: "done"; id: string; state: StagedWriteState }
  /** Seal-poll budget exhausted; material kept, resume() continues. */
  | { kind: "awaitingSeal"; id: string }
  /** The API refused; TERMINAL_REFUSALS decides whether material is cleared. */
  | { kind: "refused"; id: string; errors: readonly UserError[] }
  /** The device refused to sign a failing verification; material cleared. */
  | { kind: "rejectedByDevice"; id: string; reason: string }
  /** Transport fault; material kept, resume() retries. */
  | { kind: "failed"; id: string; cause: unknown };

export type WriteSigner = {
  /**
   * Runs the handshake for a staged write discovered on the poll — the
   * admission Registration's path. Dispatches on the staged state so a
   * crash between any two legs heals here.
   */
  signStaged(staged: StagedWriteView): Promise<WriteResult>;
  /** Continues every persisted handshake — the parked-acts entry point. */
  resume(): Promise<WriteResult[]>;
};

const SEAL_POLL_ATTEMPTS = 5;
const SEAL_POLL_DELAY_MS = 1_000;

/**
 * Refusal codes that end a handshake for good — the material is spent.
 * Anything else (RATE_LIMITED backoff, INTERNAL fault, UNAUTHENTICATED,
 * a code this build does not know) keeps the material for resume().
 */
const TERMINAL_REFUSALS: ReadonlySet<UserError["code"]> = new Set([
  "SIGNATURE_INVALID",
  "STAGED_WRITE_EXPIRED",
  "NOT_FOUND",
  "BAD_INPUT",
  "FORBIDDEN",
  "WRITE_RULE_FAILED",
]);

function synthesized(code: UserError["code"], message: string): UserError {
  return { code, message, field: null };
}

export function createWriteSigner(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  store: IdentityStore;
  /** Injectable for tests; production uses the real timer. */
  sleep?: (ms: number) => Promise<void>;
}): WriteSigner {
  const { client, guard, store } = deps;
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  /** A write-leg refusal: clears the material only when it is spent. */
  async function refuse(id: string, errors: readonly UserError[]): Promise<WriteResult> {
    if (errors.length > 0 && errors.every((e) => TERMINAL_REFUSALS.has(e.code))) {
      await store.clearHandshake(id);
    }
    return { kind: "refused", id, errors };
  }

  /** A read-leg refusal: the handshake is intact server-side — keep the material. */
  function refuseKeeping(id: string, errors: readonly UserError[]): WriteResult {
    return { kind: "refused", id, errors };
  }

  async function reject(id: string, reason: string): Promise<WriteResult> {
    await store.clearHandshake(id);
    return { kind: "rejectedByDevice", id, reason };
  }

  async function done(id: string, state: StagedWriteState): Promise<WriteResult> {
    await store.clearHandshake(id);
    return { kind: "done", id, state };
  }

  function preCommitmentSignature(pre: PreSignedProposal): string {
    return toBase64(encodePreCommitmentOf(pre));
  }

  /**
   * From a submitted pre-commitment to the approval: await the seal
   * (bounded — the seal may be synchronous, in which case the loop never
   * runs), verify everything, sign the witness.
   */
  async function approveFrom(
    key: ActorKey,
    id: string,
    pre: PreSignedProposal,
    staged: StagedWriteView,
  ): Promise<WriteResult> {
    let current = staged;
    let attempts = 0;
    while (current.verifiedAct === null) {
      if (current.state === "EXPIRED") {
        return refuse(id, [synthesized("STAGED_WRITE_EXPIRED", "garbage-collected unlanded")]);
      }
      if (attempts >= SEAL_POLL_ATTEMPTS) return { kind: "awaitingSeal", id };
      attempts += 1;
      await sleep(SEAL_POLL_DELAY_MS);
      const read = await guard.run(() => fetchStagedWrite(client, id));
      if (read.kind === "refused") return refuseKeeping(id, read.errors);
      if (read.kind === "failed") return { kind: "failed", id, cause: read.cause };
      if (read.value === null) {
        return { kind: "failed", id, cause: new Error("staged write vanished mid-seal") };
      }
      current = read.value;
    }

    const hostKey = await hostPublicKey(client);
    if (hostKey.kind === "refused") return refuseKeeping(id, hostKey.errors);
    if (hostKey.kind === "failed") return { kind: "failed", id, cause: hostKey.cause };

    let approvalSignature: string;
    try {
      const act = decodeVerifiedAct(fromBase64(current.verifiedAct));
      const witness = await key.approve(pre, act, fromBase64(hostKey.value));
      approvalSignature = toBase64(witness.approvalSignature);
    } catch (e) {
      if (e instanceof HandshakeError || e instanceof WireError) {
        return reject(id, e.message);
      }
      throw e;
    }

    const approved = await guard.run(() => approveAct(client, id, approvalSignature));
    if (approved.kind === "refused") return refuse(id, approved.errors);
    if (approved.kind === "failed") return { kind: "failed", id, cause: approved.cause };
    return done(id, approved.value.state);
  }

  async function submitAndApprove(
    key: ActorKey,
    id: string,
    pre: PreSignedProposal,
  ): Promise<WriteResult> {
    const submitted = await guard.run(() => submitProposal(client, id, preCommitmentSignature(pre)));
    if (submitted.kind === "refused") return refuse(id, submitted.errors);
    if (submitted.kind === "failed") return { kind: "failed", id, cause: submitted.cause };
    return approveFrom(key, id, pre, submitted.value);
  }

  async function signOne(key: ActorKey, staged: StagedWriteView): Promise<WriteResult> {
    const id = staged.id;
    const pre = await store.handshake(id);
    switch (staged.state) {
      case "AWAITING_PRE_SIGN": {
        if (pre !== null) {
          // The submit response was lost: re-send THIS device's material
          // — the stored nonce, never a fresh one.
          return submitAndApprove(key, id, pre);
        }
        let fresh: PreSignedProposal;
        try {
          fresh = await key.preSign(decodeProposal(fromBase64(staged.canonicalProposal)));
        } catch (e) {
          if (e instanceof WireError) return reject(id, e.message);
          throw e;
        }
        await store.saveHandshake(id, fresh);
        return submitAndApprove(key, id, fresh);
      }
      case "SEALING":
      case "AWAITING_APPROVAL": {
        if (pre !== null) return approveFrom(key, id, pre, staged);
        // Pre-signed by another device, or custody was cleared. Not a
        // device rejection — only the expiry re-stage recovers.
        return refuse(id, [
          synthesized("INTERNAL", "handshake material lost — awaiting re-stage"),
        ]);
      }
      case "RELAYING":
      case "LANDED":
        return done(id, staged.state);
      case "EXPIRED":
        return refuse(id, [synthesized("STAGED_WRITE_EXPIRED", "garbage-collected unlanded")]);
      default:
        // A state this build does not know (the generated union lags the
        // server): refuse without spending the material — an updated
        // build resumes it. Android's WriteState.UNKNOWN twin.
        return refuseKeeping(id, [
          synthesized("INTERNAL", "staged-write state this app version does not know"),
        ]);
    }
  }

  async function resumeOne(key: ActorKey, id: string): Promise<WriteResult> {
    const pre = await store.handshake(id);
    if (pre === null) {
      return { kind: "failed", id, cause: new Error("no handshake material for this id") };
    }
    const read = await guard.run(() => fetchStagedWrite(client, id));
    if (read.kind === "refused") return refuseKeeping(id, read.errors);
    if (read.kind === "failed") return { kind: "failed", id, cause: read.cause };
    if (read.value === null) {
      // Collected long ago — the handshake can never finish.
      return refuse(id, [synthesized("NOT_FOUND", "staged write is gone")]);
    }
    return signOne(key, read.value);
  }

  return {
    async signStaged(staged) {
      const key = await store.actorKey();
      if (key === null) {
        return { kind: "failed", id: staged.id, cause: new Error("no actor key on this device") };
      }
      return signOne(key, staged);
    },

    async resume() {
      const ids = await store.handshakeIds();
      if (ids.length === 0) return [];
      const key = await store.actorKey();
      if (key === null) {
        return ids.map((id) => ({
          kind: "failed" as const,
          id,
          cause: new Error("no actor key on this device"),
        }));
      }
      const results: WriteResult[] = [];
      for (const id of ids) results.push(await resumeOne(key, id));
      return results;
    },
  };
}
