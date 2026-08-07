// Scriptable registration runtime for UI tests: a flow whose progress
// the test emits, and a ceremony whose legs are vi.fn spies.

import { vi } from "vitest";

import type { StagedWriteView } from "@/lib/api/writes-api";
import type { KeyCeremony } from "@/lib/identity/key-ceremony";
import type { RegistrationFlow } from "@/lib/signing/registration-flow";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import type { WriteSigner } from "@/lib/signing/write-signer";

export function fakeFlow(initial: RegistrationProgress | null = null) {
  let current = initial;
  const listeners = new Set<() => void>();
  const flow: RegistrationFlow = {
    progress: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ensureAdvancing: vi.fn(),
    consumeLanded: vi.fn(() => false),
    reset: vi.fn(),
  };
  return {
    flow,
    emit(progress: RegistrationProgress | null) {
      current = progress;
      for (const l of listeners) l();
    },
  };
}

export function fakeCeremony(overrides: Partial<KeyCeremony> = {}): KeyCeremony {
  return {
    createActorKey: vi.fn(() =>
      Promise.resolve({ publicKeyBase64: "cHVi", l0Address: "aa".repeat(20) }),
    ),
    publicIdentity: vi.fn(() => Promise.resolve(null)),
    attachActorKey: vi.fn(() => Promise.resolve({ kind: "success" as const, value: true as const })),
    createPendingBackup: vi.fn(() => Promise.resolve("AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE")),
    uploadPendingBackup: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

export function fakeWriteSigner(overrides: Partial<WriteSigner> = {}): WriteSigner {
  return {
    signStaged: vi.fn((staged: StagedWriteView) =>
      Promise.resolve({ kind: "done" as const, id: staged.id, state: "RELAYING" as const }),
    ),
    resume: vi.fn(() => Promise.resolve([])),
    ...overrides,
  };
}
