// The in-memory hand-off for the login security notice (auth.md "Reuse
// detection"): the backend delivers the event exactly once on the
// LogInPayload, and login navigates away on the phase flip, so the
// signed-in shell renders it from this per-tab store rather than the
// login surface. A tab closed before rendering loses the notice — the
// accepted narrow-carrier trade-off (auth.md).

export type SecurityNotices = {
  /** The pending detection time (ISO 8601); null once dismissed or when none arrived. */
  reuseDetectedAt(): string | null;
  post(detectedAt: string): void;
  dismiss(): void;
  subscribe(listener: () => void): () => void;
};

export function createSecurityNotices(): SecurityNotices {
  let reuseDetectedAt: string | null = null;
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
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const securityNotices: SecurityNotices = createSecurityNotices();
