// One pass of the application poll (auth.md "Approval and landing";
// Android mirror: RegistrationSigner.kt): read the status, flush the
// parked backup, then branch — member, staged Registration to sign,
// landing awaited, or the applicant cards.

import type { ApolloClient } from "@apollo/client";

import { hasCode, type Outcome, type UserError } from "@/lib/api/outcome";
import { fetchApplicationStatus } from "@/lib/api/onboarding-api";
import { toBase64 } from "@/lib/crypto/bytes";
import type { KeyCeremony } from "@/lib/identity/key-ceremony";
import type { IdentityStore } from "@/lib/identity/store";
import type { AuthGuard } from "@/lib/session/guard";
import { REGISTRATION_EXEMPTION } from "./intent";
import { keyUsable } from "./key-usable";
import type { WriteSigner } from "./write-signer";

export type RegistrationProgress =
  /** Landed — the loop's terminal state. */
  | { kind: "member" }
  /** Approved and signed; the wait is on the server. */
  | { kind: "awaitingLanding" }
  /** A staged Registration exists but this device cannot sign — restore the key. */
  | { kind: "awaitingSigningKey" }
  /**
   * The live application: the two proofs and whether the key is on this
   * device — and, when this pass's repair attach did not go through, why.
   */
  | {
      kind: "awaitingApproval";
      emailVerified: boolean;
      keyAttached: boolean;
      keyOnDevice: boolean;
      /** Absent unless this pass's repair attach failed. */
      attachFault?: AttachFault;
    }
  /** The device refused to sign — no amount of polling repairs it. */
  | { kind: "rejectedByDevice"; reason: string }
  | { kind: "refused"; errors: readonly UserError[] }
  | { kind: "failed"; cause: unknown };

/**
 * Why an attach did not go through (ApplicantFeed.md:37): `keyInUse` when the
 * server refused the key as another account's (`ACTOR_KEY_IN_USE`), `failed`
 * for every other refusal and for no answer.
 */
export type AttachFault = "failed" | "keyInUse";

/** The fault an attach's outcome reads as; null when it went through. */
export function attachFaultOf(outcome: Outcome<true>): AttachFault | null {
  if (outcome.kind === "success") return null;
  return hasCode(outcome, "ACTOR_KEY_IN_USE") ? "keyInUse" : "failed";
}

export type RegistrationSigner = {
  advance(): Promise<RegistrationProgress>;
};

export function createRegistrationSigner(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  store: IdentityStore;
  ceremony: KeyCeremony;
  writeSigner: WriteSigner;
}): RegistrationSigner {
  const { client, guard, store, ceremony, writeSigner } = deps;

  /** base64 of the account slot's public key half; null when the slot is empty. */
  async function devicePubkey(): Promise<string | null> {
    const key = await store.actorKey();
    return key === null ? null : toBase64(key.publicKeyBytes());
  }

  /**
   * Silent crash healing for the gap between minting and attaching:
   * reached only when the server reports no key attached AND this
   * account's slot holds a key — never a blind fire across accounts.
   * Hands back why it failed; null when it went through.
   */
  async function repairAttach(): Promise<AttachFault | null> {
    return attachFaultOf(await ceremony.attachActorKey());
  }

  return {
    async advance() {
      const status = await guard.run(() => fetchApplicationStatus(client));
      if (status.kind === "refused") return { kind: "refused", errors: status.errors };
      if (status.kind === "failed") return { kind: "failed", cause: status.cause };

      // A session exists from registration on, so a parked blob never
      // waits on a milestone — flush every pass, result ignored.
      await ceremony.uploadPendingBackup();

      const { accountState, actorPubkey, application, stagedRegistration, carriedBatch } =
        status.value;
      if (accountState === "MEMBER") {
        // The landing released what the applicant carried: sign it now,
        // without a prompt, with the vouch-in (auth.md "Application") —
        // checked against what was verified at its prepare
        // (write-signer.ts `signCarriedAtLanding`).
        // Best-effort by design — a write left mid-handshake keeps its
        // material for resume(), and one never started is still
        // AWAITING_PRE_SIGN on the next pass.
        if (carriedBatch.length > 0 && keyUsable(await devicePubkey(), actorPubkey)) {
          await writeSigner.signCarriedAtLanding(carriedBatch);
        }
        return { kind: "member" };
      }

      // A LANDED Registration is done: the node exists, and what the
      // account waits on now is a vouch (auth.md "Approval and landing").
      // Falling through to the application reads waiting again after a
      // lapsed vouch, approved while a vouch is in play.
      if (stagedRegistration !== null && stagedRegistration.state !== "LANDED") {
        if (!keyUsable(await devicePubkey(), actorPubkey)) {
          return { kind: "awaitingSigningKey" };
        }
        // No form stands behind the staged Registration — the backend
        // staged it at approval — so it is the named exemption from
        // the intent check (intent.ts), and still runs every transport check.
        const result = await writeSigner.signStaged(stagedRegistration, REGISTRATION_EXEMPTION);
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
          case "carried":
            // signStaged never keeps a write for the landing: only a checked
            // batch does (write-signer.ts `sign`).
            return { kind: "failed", cause: new Error("a staged Registration is never carried") };
        }
      }

      // Registration writes the application with the account, and an
      // application carries no timer (auth.md "Expiry"), so an applicant
      // without one is a server fault rather than a step the person takes.
      if (application === null) return { kind: "refused", errors: [] };
      if (application.approvedAt !== null) return { kind: "awaitingLanding" };

      const devicePub = await devicePubkey();
      // The same attach, under the same condition, as ever: only its reason
      // is kept now.
      const attachFault = application.keyAttached || devicePub === null ? null : await repairAttach();
      return {
        kind: "awaitingApproval",
        emailVerified: application.emailVerified,
        keyAttached: application.keyAttached || (devicePub !== null && attachFault === null),
        keyOnDevice: keyUsable(devicePub, actorPubkey),
        ...(attachFault === null ? {} : { attachFault }),
      };
    },
  };
}
