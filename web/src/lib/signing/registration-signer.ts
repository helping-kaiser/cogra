// One pass of the application poll (auth.md "Approval and landing";
// Android mirror: RegistrationSigner.kt): read the status, flush the
// parked backup, then branch — member, staged Registration to sign,
// re-arm needed, landing awaited, or the applicant cards.

import type { ApolloClient } from "@apollo/client";

import type { UserError } from "@/lib/api/outcome";
import { fetchApplicationStatus } from "@/lib/api/onboarding-api";
import { toBase64 } from "@/lib/crypto/bytes";
import type { KeyCeremony } from "@/lib/identity/key-ceremony";
import type { IdentityStore } from "@/lib/identity/store";
import type { AuthGuard } from "@/lib/session/guard";
import { keyUsable } from "./key-usable";
import type { WriteSigner } from "./write-signer";

export type RegistrationProgress =
  /** Landed — the loop's terminal state. */
  | { kind: "member" }
  /** Approved and signed; the wait is on the server. */
  | { kind: "awaitingLanding" }
  /** A staged Registration exists but this device cannot sign — restore the key. */
  | { kind: "awaitingSigningKey" }
  /** The live application: the two proofs and whether the key is on this device. */
  | {
      kind: "awaitingApproval";
      emailVerified: boolean;
      keyAttached: boolean;
      keyOnDevice: boolean;
    }
  /** No application, or an expired one — a fresh invite re-arms it. */
  | { kind: "needsInvite" }
  /** The device refused to sign — no amount of polling repairs it. */
  | { kind: "rejectedByDevice"; reason: string }
  | { kind: "refused"; errors: readonly UserError[] }
  | { kind: "failed"; cause: unknown };

export type RegistrationSigner = {
  advance(): Promise<RegistrationProgress>;
};

export function createRegistrationSigner(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  store: IdentityStore;
  ceremony: KeyCeremony;
  writeSigner: WriteSigner;
  /** Injectable for tests; production uses the wall clock. */
  now?: () => number;
}): RegistrationSigner {
  const { client, guard, store, ceremony, writeSigner } = deps;
  const now = deps.now ?? (() => Date.now());

  /** base64 of the account slot's public key half; null when the slot is empty. */
  async function devicePubkey(): Promise<string | null> {
    const key = await store.actorKey();
    return key === null ? null : toBase64(key.publicKeyBytes());
  }

  /**
   * Silent crash healing for the gap between minting and attaching:
   * reached only when the server reports no key attached AND this
   * account's slot holds a key — never a blind fire across accounts.
   */
  async function repairAttach(): Promise<boolean> {
    return (await ceremony.attachActorKey()).kind === "success";
  }

  return {
    async advance() {
      const status = await guard.run(() => fetchApplicationStatus(client));
      if (status.kind === "refused") return { kind: "refused", errors: status.errors };
      if (status.kind === "failed") return { kind: "failed", cause: status.cause };

      // A session exists from registration on, so a parked blob never
      // waits on a milestone — flush every pass, result ignored.
      await ceremony.uploadPendingBackup();

      const { accountState, actorPubkey, application, stagedRegistration } = status.value;
      if (accountState === "MEMBER") return { kind: "member" };

      if (stagedRegistration !== null) {
        if (!keyUsable(await devicePubkey(), actorPubkey)) {
          return { kind: "awaitingSigningKey" };
        }
        const result = await writeSigner.signStaged(stagedRegistration);
        switch (result.kind) {
          case "done":
          case "awaitingSeal":
            return { kind: "awaitingLanding" };
          case "refused":
            return { kind: "refused", errors: result.errors };
          case "rejectedByDevice":
            return { kind: "rejectedByDevice", reason: result.reason };
          case "failed":
            return { kind: "failed", cause: result.cause };
        }
      }

      if (application === null) return { kind: "needsInvite" };
      if (application.approvedAt !== null) return { kind: "awaitingLanding" };
      if (Date.parse(application.expiresAt) < now()) return { kind: "needsInvite" };

      const devicePub = await devicePubkey();
      return {
        kind: "awaitingApproval",
        emailVerified: application.emailVerified,
        keyAttached: application.keyAttached || (devicePub !== null && (await repairAttach())),
        keyOnDevice: keyUsable(devicePub, actorPubkey),
      };
    },
  };
}
