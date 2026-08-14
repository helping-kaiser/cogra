// What a reveal hands the surface (Android twin: core:domain's
// ExportActorKey). Every secret in the backup container, each in its
// own portable form — today the actor key alone; the Collective splits
// extend the list when the container grows them (auth.md "the blob is
// a container").

import { exportActorSeed } from "@/lib/crypto/key-export";

/** Which client-held secret a block carries. */
export type SecretKind = "actorKey";

export type ExportedSecret = { kind: SecretKind; pem: string; hex: string };

export function secretsFromSeed(seed: Uint8Array): readonly ExportedSecret[] {
  const actor = exportActorSeed(seed);
  return [{ kind: "actorKey", pem: actor.pem, hex: actor.hex }];
}
