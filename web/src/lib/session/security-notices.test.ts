import { describe, expect, it, vi } from "vitest";

import { createSecurityNotices } from "./security-notices";

describe("securityNotices", () => {
  it("posts, overwrites, and dismisses, notifying subscribers", () => {
    const notices = createSecurityNotices();
    const listener = vi.fn();
    const unsubscribe = notices.subscribe(listener);

    expect(notices.reuseDetectedAt()).toBeNull();
    notices.post("2026-08-10T09:30:00Z");
    expect(notices.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
    // A later detection overwrites an undelivered one.
    notices.post("2026-08-11T00:00:00Z");
    expect(notices.reuseDetectedAt()).toBe("2026-08-11T00:00:00Z");
    notices.dismiss();
    expect(notices.reuseDetectedAt()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    notices.post("2026-08-12T00:00:00Z");
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
