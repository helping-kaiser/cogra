// Actor restore from the recovery code (auth.md "Key recovery"): parse
// the code, fetch the newest blob, open it on device, persist the seed
// as a non-extractable key.

import type { ApolloClient } from "@apollo/client";

import { fetchKeyBackup } from "@/lib/api/auth-api";
import { hasCode } from "@/lib/api/outcome";
import { fromBase64 } from "@/lib/crypto/bytes";
import {
  KeyBackupError,
  openKeyBackup,
  RecoveryCode,
  RecoveryCodeLengthError,
} from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import type { IdentityStore } from "./store";

export type RestoreResult =
  | { kind: "restored" }
  | { kind: "malformedCode" }
  | { kind: "wrongCode" }
  | { kind: "noBackup" }
  /** A deliberate backoff — retry later, nothing is wrong with the connection. */
  | { kind: "rateLimited" }
  | { kind: "failed"; cause: unknown };

export async function restoreActor(
  deps: { client: ApolloClient; guard: AuthGuard; store: IdentityStore },
  codeInput: string,
): Promise<RestoreResult> {
  let code: RecoveryCode;
  try {
    code = RecoveryCode.fromInput(codeInput);
  } catch (e) {
    // A length complaint is the only one the reader can act on; a
    // full-length code that will not decode is simply a wrong code.
    if (e instanceof RecoveryCodeLengthError) return { kind: "malformedCode" };
    if (e instanceof KeyBackupError) return { kind: "wrongCode" };
    throw e;
  }

  const fetched = await deps.guard.run(() => fetchKeyBackup(deps.client));
  if (fetched.kind === "refused") {
    if (hasCode(fetched, "RATE_LIMITED")) return { kind: "rateLimited" };
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

  // The decrypted seed exists only here. A custody store that cannot take it
  // is a `failed` — the variant this result already carries — not a rejection
  // that throws the seed away out of a function whose caller reads outcomes.
  try {
    await deps.store.saveActor(seed, false);
  } catch (cause) {
    return { kind: "failed", cause };
  }
  return { kind: "restored" };
}
