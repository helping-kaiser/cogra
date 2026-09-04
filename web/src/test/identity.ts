// An in-memory IdentityStore for UI tests: custody state is scripted
// per test instead of driving fake-indexeddb through the real store
// (the real store's IndexedDB behavior is covered by its own suite).

import type { ActorKey } from "@/lib/crypto/actor-key";
import type { PreSignedProposal } from "@/lib/crypto/handshake";
import type { IdentityStore } from "@/lib/identity/store";

export function fakeIdentityStore(initial: {
  keyOnDevice?: boolean;
  seed?: Uint8Array | null;
  reciprocationDismissed?: boolean;
  handshakeIds?: string[];
  ephemeral?: boolean;
} = {}): IdentityStore {
  let keyOnDevice = initial.keyOnDevice ?? false;
  let seed = initial.seed ?? null;
  let dismissed = initial.reciprocationDismissed ?? false;
  let ephemeral = initial.ephemeral ?? false;
  let pendingBlob: Uint8Array | null = null;
  const handshakes = new Set(initial.handshakeIds ?? []);
  // The UI only checks key presence; the marker object stands in for a
  // real CryptoKey-backed ActorKey.
  const keyMarker = {} as ActorKey;

  return {
    actorKey: () => Promise.resolve(keyOnDevice ? keyMarker : null),
    actorSeed: () => Promise.resolve(seed),
    saveActor(newSeed, retainSeed) {
      keyOnDevice = true;
      seed = retainSeed ? newSeed : null;
      return Promise.resolve(keyMarker);
    },
    clearActorSeed() {
      seed = null;
      return Promise.resolve();
    },
    savePendingBackupBlob(blob) {
      pendingBlob = blob;
      return Promise.resolve();
    },
    pendingBackupBlob: () => Promise.resolve(pendingBlob),
    clearPendingBackupBlob() {
      pendingBlob = null;
      return Promise.resolve();
    },
    saveHandshake(stagedWriteId) {
      handshakes.add(stagedWriteId);
      return Promise.resolve();
    },
    handshake: () => Promise.resolve(null as PreSignedProposal | null),
    clearHandshake(stagedWriteId) {
      handshakes.delete(stagedWriteId);
      return Promise.resolve();
    },
    handshakeIds: () => Promise.resolve([...handshakes]),
    clearHandshakes() {
      handshakes.clear();
      return Promise.resolve();
    },
    reciprocationDismissed: () => Promise.resolve(dismissed),
    markReciprocationDismissed() {
      dismissed = true;
      return Promise.resolve();
    },
    setEphemeral(value) {
      ephemeral = value;
      return Promise.resolve();
    },
    purgeIfEphemeral() {
      if (ephemeral) {
        keyOnDevice = false;
        seed = null;
        pendingBlob = null;
        handshakes.clear();
        dismissed = false;
        ephemeral = false;
      }
      return Promise.resolve();
    },
  };
}
