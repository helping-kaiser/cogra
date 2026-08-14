// The settings backup surface (auth.md "Key recovery"; Android mirror:
// BackupManager). The two legs differ: enable() re-seals from the
// retained seed in one step, while rekey() first re-proves the current
// code — the fetched blob opens in memory, the seed is re-sealed under
// a fresh code and never persisted. Uploads are direct, not parked: a
// failure changes nothing server-side and the fresh code is discarded.

import type { ApolloClient } from "@apollo/client";

import { createKeyBackupChallenge, fetchKeyBackup, uploadKeyBackup } from "@/lib/api/auth-api";
import type { UserError } from "@/lib/api/outcome";
import { ActorKey } from "@/lib/crypto/actor-key";
import { fromBase64, toBase64 } from "@/lib/crypto/bytes";
import {
  KeyBackupError,
  openKeyBackup,
  RecoveryCode,
  sealKeyBackup,
  signUpload,
} from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import type { IdentityStore } from "./store";

export type BackupResult =
  | { kind: "created"; code: string }
  | { kind: "noSeed" }
  | { kind: "malformedCode" }
  | { kind: "wrongCode" }
  | { kind: "noBackup" }
  | { kind: "refused"; errors: readonly UserError[] }
  | { kind: "failed"; cause: unknown };

export type BackupManager = {
  /**
   * Enable-late, from the seed retained while no blob exists. On
   * success the new code's display form comes back exactly once, the
   * seed is wiped, and any stale parked ceremony blob is dropped.
   */
  enable(): Promise<BackupResult>;
  /**
   * Replace the code when the seed is gone: open the current blob
   * under the entered code, re-seal under a fresh one, upload. The
   * seed lives only in memory for the exchange.
   */
  rekey(currentCodeInput: string): Promise<BackupResult>;
};

export function createBackupManager(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  store: IdentityStore;
}): BackupManager {
  const { client, guard, store } = deps;

  async function sealAndUpload(seed: Uint8Array): Promise<BackupResult> {
    const code = RecoveryCode.generate();
    const blob = await sealKeyBackup(seed, code);
    // The proof of actor possession the server demands: a session alone
    // must not be able to overwrite the blob (auth.md "Key recovery").
    const challenge = await guard.run(() => createKeyBackupChallenge(client));
    if (challenge.kind === "refused") return { kind: "refused", errors: challenge.errors };
    if (challenge.kind === "failed") return { kind: "failed", cause: challenge.cause };
    const signature = await signUpload(
      await ActorKey.fromSeed(seed),
      fromBase64(challenge.value),
      blob,
    );
    const uploaded = await guard.run(() =>
      uploadKeyBackup(client, toBase64(blob), challenge.value, toBase64(signature)),
    );
    if (uploaded.kind === "refused") return { kind: "refused", errors: uploaded.errors };
    if (uploaded.kind === "failed") return { kind: "failed", cause: uploaded.cause };
    return { kind: "created", code: code.display() };
  }

  return {
    async enable() {
      const seed = await store.actorSeed();
      if (seed === null) return { kind: "noSeed" };
      const result = await sealAndUpload(seed);
      if (result.kind === "created") {
        await store.clearPendingBackupBlob();
        await store.clearActorSeed();
      }
      return result;
    },

    async rekey(currentCodeInput) {
      let currentCode: RecoveryCode;
      try {
        currentCode = RecoveryCode.fromInput(currentCodeInput);
      } catch (e) {
        if (e instanceof KeyBackupError) return { kind: "malformedCode" };
        throw e;
      }

      const fetched = await guard.run(() => fetchKeyBackup(client));
      if (fetched.kind === "refused") return { kind: "refused", errors: fetched.errors };
      if (fetched.kind === "failed") return { kind: "failed", cause: fetched.cause };
      if (fetched.value === null) return { kind: "noBackup" };

      let seed: Uint8Array;
      try {
        seed = await openKeyBackup(fromBase64(fetched.value), currentCode);
      } catch (e) {
        if (e instanceof KeyBackupError) return { kind: "wrongCode" };
        throw e;
      }

      return sealAndUpload(seed);
    },
  };
}
