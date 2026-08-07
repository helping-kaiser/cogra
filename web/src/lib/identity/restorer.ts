// Actor restore from the recovery code (auth.md "Key recovery"): parse
// the code, fetch the newest blob, open it on device, persist the seed
// as a non-extractable key. The blob it came from exists, so the raw
// seed is not retained (web.md "Key custody"). The AES-GCM tag is the
// wrong-code detector — there is no check digit.

import type { ApolloClient } from "@apollo/client";

import { fetchKeyBackup } from "@/lib/api/auth-api";
import { fromBase64 } from "@/lib/crypto/bytes";
import { KeyBackupError, openKeyBackup, RecoveryCode } from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import type { IdentityStore } from "./store";

export type RestoreResult =
  | { kind: "restored" }
  | { kind: "malformedCode" }
  | { kind: "wrongCode" }
  | { kind: "noBackup" }
  | { kind: "failed"; cause: unknown };

export async function restoreActor(
  deps: { client: ApolloClient; guard: AuthGuard; store: IdentityStore },
  codeInput: string,
): Promise<RestoreResult> {
  let code: RecoveryCode;
  try {
    code = RecoveryCode.fromInput(codeInput);
  } catch (e) {
    if (e instanceof KeyBackupError) return { kind: "malformedCode" };
    throw e;
  }

  const fetched = await deps.guard.run(() => fetchKeyBackup(deps.client));
  if (fetched.kind === "refused") {
    return { kind: "failed", cause: new Error("keyBackup read was refused") };
  }
  if (fetched.kind === "failed") return { kind: "failed", cause: fetched.cause };
  if (fetched.value === null) return { kind: "noBackup" };

  let seed: Uint8Array;
  try {
    seed = await openKeyBackup(fromBase64(fetched.value), code);
  } catch (e) {
    if (e instanceof KeyBackupError) return { kind: "wrongCode" };
    throw e;
  }

  await deps.store.saveActor(seed, false);
  return { kind: "restored" };
}
