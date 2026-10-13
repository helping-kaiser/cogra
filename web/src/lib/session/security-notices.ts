// The in-memory hand-off for the login's one-time notices: login navigates
// away on the phase flip, so the signed-in shell renders them from this
// per-tab store rather than the login surface. A tab closed before rendering
// loses them — the accepted narrow-carrier trade-off (auth.md).
//
// Two notices ride it:
// - the refresh-token reuse notice (auth.md "Reuse detection");
// - the dead device lock (sign-out-custody SC-G2, ruled PR-62): the sign-in
//   found this account's locked custody on this device, but the server could
//   no longer open its lock, so the locked copy was deleted — and the reader
//   is told once rather than finding the key gone without a word ("Never
//   erase silently").

export type SecurityNotices = {
  /** The pending detection time (ISO 8601); null once dismissed or when none arrived. */
  reuseDetectedAt(): string | null;
  post(detectedAt: string): void;
  dismiss(): void;
  /** Whether a dead device lock's notice waits to be said. */
  lockLost(): boolean;
  postLockLost(): void;
  dismissLockLost(): void;
  subscribe(listener: () => void): () => void;
};

export function createSecurityNotices(): SecurityNotices {
  let reuseDetectedAt: string | null = null;
  let lockLost = false;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  return {
    reuseDetectedAt: () => reuseDetectedAt,
    post(detectedAt) {
      reuseDetectedAt = detectedAt;
      notify();
    },
    dismiss() {
      reuseDetectedAt = null;
      notify();
    },
    lockLost: () => lockLost,
    postLockLost() {
      lockLost = true;
      notify();
    },
    dismissLockLost() {
      lockLost = false;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const securityNotices: SecurityNotices = createSecurityNotices();
