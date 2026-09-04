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
import { equalBytes, fromBase64, toBase64 } from "@/lib/crypto/bytes";
import {
  KeyBackupError,
  openKeyBackup,
  RecoveryCode,
  RecoveryCodeLengthError,
  sealKeyBackup,
  signUpload,
} from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import { secretsFromSeed, type ExportedSecret } from "./key-export";
import type { IdentityStore } from "./store";

/** How opening the stored blob under the current code can fail. */
type OpenFailure =
  | { kind: "malformedCode" }
  | { kind: "wrongCode" }
  | { kind: "noBackup" }
  | { kind: "refused"; errors: readonly UserError[] }
  | { kind: "failed"; cause: unknown };

export type BackupResult = { kind: "created"; code: string } | { kind: "noSeed" } | OpenFailure;

/**
 * A reveal never writes: no upload, no re-seal, and the seed is not
 * re-persisted — it lives in memory for the render alone.
 */
export type RevealResult =
  | { kind: "revealed"; secrets: readonly ExportedSecret[] }
  | { kind: "noSeed" }
  | OpenFailure;

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
  /**
   * Show the secrets from the retained seed — the state where no blob
   * exists yet. Nothing gates it: the seed already sits in this
   * browser's store, so a code prompt would prove nothing and would
   * lock out exactly the person who declined the backup.
   */
  revealRetained(): Promise<RevealResult>;
  /**
   * Show the secrets once the seed is gone: the current code opens the
   * stored blob, the same proof rekey demands, because custody left the
   * browser with a non-extractable key alone (web.md "Key custody").
   */
  revealFromBackup(currentCodeInput: string): Promise<RevealResult>;
};

export function createBackupManager(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  store: IdentityStore;
}): BackupManager {
  const { client, guard, store } = deps;

  /**
   * The account's custody key — the one the server has attached, and so the
   * only one whose signature proves possession. Taken from the store rather
   * than re-derived from whatever seed is in hand: in `rekey` the seed comes
   * out of the SERVER'S blob, and a proof made by that seed's key proves
   * possession of the blob, not of the account.
   */
  async function custodyKey(): Promise<{ kind: "key"; key: ActorKey } | OpenFailure> {
    try {
      const key = await store.actorKey();
      if (key === null) {
        return { kind: "failed", cause: new Error("no actor key on this device") };
      }
      return { kind: "key", key };
    } catch (cause) {
      return { kind: "failed", cause };
    }
  }

  async function sealAndUpload(seed: Uint8Array, key: ActorKey): Promise<BackupResult> {
    const code = RecoveryCode.generate();
    const blob = await sealKeyBackup(seed, code);
    // The proof of actor possession the server demands: a session alone
    // must not be able to overwrite the blob (auth.md "Key recovery").
    const challenge = await guard.run(() => createKeyBackupChallenge(client));
    if (challenge.kind === "refused") return { kind: "refused", errors: challenge.errors };
    if (challenge.kind === "failed") return { kind: "failed", cause: challenge.cause };
    const signature = await signUpload(key, fromBase64(challenge.value), blob);
    const uploaded = await guard.run(() =>
      uploadKeyBackup(client, toBase64(blob), challenge.value, toBase64(signature)),
    );
    if (uploaded.kind === "refused") return { kind: "refused", errors: uploaded.errors };
    if (uploaded.kind === "failed") return { kind: "failed", cause: uploaded.cause };
    return { kind: "created", code: code.display() };
  }

  /**
   * The current code, re-proved: parse it, fetch the blob, open it in
   * memory. Both post-wipe paths — replacing the code and revealing the
   * key — start here, and neither re-persists the seed.
   */
  async function openCurrent(
    currentCodeInput: string,
  ): Promise<{ kind: "opened"; seed: Uint8Array } | OpenFailure> {
    let currentCode: RecoveryCode;
    try {
      currentCode = RecoveryCode.fromInput(currentCodeInput);
    } catch (e) {
      // Only a length complaint is a shape complaint; a full-length
      // code that will not decode is a wrong code, which is what the
      // GCM tag would have said anyway.
      if (e instanceof RecoveryCodeLengthError) return { kind: "malformedCode" };
      if (e instanceof KeyBackupError) return { kind: "wrongCode" };
      throw e;
    }

    const fetched = await guard.run(() => fetchKeyBackup(client));
    if (fetched.kind === "refused") return { kind: "refused", errors: fetched.errors };
    if (fetched.kind === "failed") return { kind: "failed", cause: fetched.cause };
    if (fetched.value === null) return { kind: "noBackup" };

    try {
      return { kind: "opened", seed: await openKeyBackup(fromBase64(fetched.value), currentCode) };
    } catch (e) {
      if (e instanceof KeyBackupError) return { kind: "wrongCode" };
      throw e;
    }
  }

  return {
    async enable() {
      let seed: Uint8Array | null;
      try {
        seed = await store.actorSeed();
      } catch (cause) {
        return { kind: "failed", cause };
      }
      if (seed === null) return { kind: "noSeed" };
      const key = await custodyKey();
      if (key.kind !== "key") return key;
      const result = await sealAndUpload(seed, key.key);
      if (result.kind === "created") {
        // THE CODE IS THE ONLY COPY, AND IT IS ALREADY SPENT. The blob sits on
        // the server sealed under it, so a wipe that throws must not take the
        // code down with it — that would leave a backup nobody can ever open.
        // The wipes are best-effort: a retained seed is a far smaller harm
        // than a lost code, and a later `enable()` overwrites the blob anyway.
        try {
          await store.clearPendingBackupBlob();
          await store.clearActorSeed();
        } catch {
          // Deliberately swallowed — the code below is what must reach the
          // caller, and there is nothing the reader could do about a store
          // fault at this point.
        }
      }
      return result;
    },

    async rekey(currentCodeInput) {
      const opened = await openCurrent(currentCodeInput);
      if (opened.kind !== "opened") return opened;
      const key = await custodyKey();
      if (key.kind !== "key") return key;
      // LOUDLY, rather than by uploading a blob the account cannot use. The
      // fetched blob is supposed to hold this account's own seed; if it holds
      // another, re-sealing it under a fresh code would hand the reader a code
      // for a key that is not theirs, and the mismatch would only surface much
      // later as writes the backend refuses.
      const blobKey = await ActorKey.fromSeed(opened.seed);
      if (!equalBytes(blobKey.publicKeyBytes(), key.key.publicKeyBytes())) {
        return {
          kind: "failed",
          cause: new Error("the stored backup holds a different key than this device's custody"),
        };
      }
      return sealAndUpload(opened.seed, key.key);
    },

    async revealRetained() {
      let seed: Uint8Array | null;
      try {
        seed = await store.actorSeed();
      } catch (cause) {
        return { kind: "failed", cause };
      }
      if (seed === null) return { kind: "noSeed" };
      return { kind: "revealed", secrets: secretsFromSeed(seed) };
    },

    async revealFromBackup(currentCodeInput) {
      const opened = await openCurrent(currentCodeInput);
      if (opened.kind !== "opened") return opened;
      return { kind: "revealed", secrets: secretsFromSeed(opened.seed) };
    },
  };
}
