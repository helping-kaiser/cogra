// The key ceremony (auth.md "Application" step 3; Android mirror:
// KeyCeremony.kt): mint the actor locally, attach only the public
// halves, seal the backup blob on device. The blob uploads immediately
// after the attach; a failed upload parks it and every poll pass
// retries.

import type { ApolloClient } from "@apollo/client";

import { attachActorKey } from "@/lib/api/onboarding-api";
import { createKeyBackupChallenge, uploadKeyBackup } from "@/lib/api/auth-api";
import type { Outcome } from "@/lib/api/outcome";
import { fromBase64, randomBytes, toBase64 } from "@/lib/crypto/bytes";
import { addressOf, CryptoUnavailableError, ed25519Available } from "@/lib/crypto/hashing";
import { RecoveryCode, sealKeyBackup, signUpload } from "@/lib/crypto/key-backup";
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
      // Asked before anything is minted or written, so a browser without
      // Ed25519 is told what is wrong rather than failing somewhere inside the
      // ceremony. The probe runs once per page (hashing.ts).
      if (!(await ed25519Available())) {
        throw new CryptoUnavailableError("this browser cannot hold a CoGra key");
      }
      const key = await store.saveActor(randomBytes(32), true);
      // A blob parked under the superseded key would never upload: its
      // proof verifies against the key the account now has attached.
      await store.clearPendingBackupBlob();
      // Handshake material is orphaned by the same stroke and for the same
      // reason: what is parked was PRE-SIGNED by the key just replaced, and
      // an approval this key made over it would be signed by a key unrelated
      // to the pre-commitment. Only an expiry re-stage recovers those writes.
      await store.clearHandshakes();
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

    // EVERY FAULT IS `false` HERE, because that is what the contract above
    // promises and what the caller does with it: this runs on every poll pass
    // and `false` means "still parked, try again". A throw instead — a
    // malformed challenge through `fromBase64`, a custody store that cannot be
    // read — rejects the poll's own promise, which nothing is catching. A wipe
    // that fails leaves the blob parked, so the next pass re-uploads it.
    async uploadPendingBackup() {
      try {
        const blob = await store.pendingBackupBlob();
        if (blob === null) return true;
        const key = await store.actorKey();
        if (key === null) return false;
        const challenge = await guard.run(() => createKeyBackupChallenge(client));
        if (challenge.kind !== "success") return false;
        const signature = await signUpload(key, fromBase64(challenge.value), blob);
        const outcome = await guard.run(() =>
          uploadKeyBackup(client, toBase64(blob), challenge.value, toBase64(signature)),
        );
        if (outcome.kind !== "success") return false;
        await store.clearPendingBackupBlob();
        await store.clearActorSeed();
        return true;
      } catch {
        return false;
      }
    },
  };
}
