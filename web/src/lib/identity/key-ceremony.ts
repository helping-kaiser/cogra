// The key ceremony (auth.md "Application" steps 3; Android mirror:
// KeyCeremony.kt): mint the actor locally, attach only the public
// halves, seal the backup blob on device. The blob uploads immediately
// after the attach; a failed upload parks the blob and every poll pass
// retries. Once a blob is uploaded the raw seed is wiped — from then on
// custody is the non-extractable CryptoKey alone (web.md "Key custody").
// The recovery code is displayed exactly once and never persisted.

import type { ApolloClient } from "@apollo/client";

import { attachActorKey } from "@/lib/api/onboarding-api";
import { uploadKeyBackup } from "@/lib/api/auth-api";
import type { Outcome } from "@/lib/api/outcome";
import { randomBytes, toBase64 } from "@/lib/crypto/bytes";
import { addressOf } from "@/lib/crypto/hashing";
import { RecoveryCode, sealKeyBackup } from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import type { IdentityStore } from "./store";

/** The public halves the attach sends — the seed never crosses the wire. */
export type ActorPublicIdentity = {
  publicKeyBase64: string;
  l0Address: string;
};

export type KeyCeremony = {
  /**
   * Mints and persists a fresh actor, seed retained (no blob exists
   * yet). Pre-approval this overwrites any earlier unbound key — the
   * attached key is replaceable until approval binds the address.
   */
  createActorKey(): Promise<ActorPublicIdentity>;
  publicIdentity(): Promise<ActorPublicIdentity | null>;
  /** Attaches the persisted key's public halves to the account. */
  attachActorKey(): Promise<Outcome<true>>;
  /**
   * The accepted backup offer: generate the code, seal the blob, park
   * it. Returns the code's display form — shown once, never stored.
   */
  createPendingBackup(): Promise<string>;
  /**
   * Flushes the parked blob if one exists; true when nothing remains
   * parked. On success the raw seed is wiped (web.md "Key custody").
   */
  uploadPendingBackup(): Promise<boolean>;
};

export function createKeyCeremony(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  store: IdentityStore;
}): KeyCeremony {
  const { client, guard, store } = deps;

  async function publicIdentity(): Promise<ActorPublicIdentity | null> {
    const key = await store.actorKey();
    if (key === null) return null;
    const publicKey = key.publicKeyBytes();
    return { publicKeyBase64: toBase64(publicKey), l0Address: await addressOf(publicKey) };
  }

  return {
    async createActorKey() {
      const key = await store.saveActor(randomBytes(32), true);
      const publicKey = key.publicKeyBytes();
      return { publicKeyBase64: toBase64(publicKey), l0Address: await addressOf(publicKey) };
    },

    publicIdentity,

    async attachActorKey() {
      const identity = await publicIdentity();
      if (identity === null) throw new Error("no actor key to attach");
      return guard.run(() => attachActorKey(client, identity.publicKeyBase64, identity.l0Address));
    },

    async createPendingBackup() {
      const seed = await store.actorSeed();
      if (seed === null) throw new Error("no seed to back up");
      const code = RecoveryCode.generate();
      const blob = await sealKeyBackup(seed, code);
      await store.savePendingBackupBlob(blob);
      return code.display();
    },

    async uploadPendingBackup() {
      const blob = await store.pendingBackupBlob();
      if (blob === null) return true;
      const outcome = await guard.run(() => uploadKeyBackup(client, toBase64(blob)));
      if (outcome.kind !== "success") return false;
      await store.clearPendingBackupBlob();
      await store.clearActorSeed();
      return true;
    },
  };
}
