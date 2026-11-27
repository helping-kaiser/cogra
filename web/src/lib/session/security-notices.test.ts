import { afterEach, describe, expect, it, vi } from "vitest";

import { blockStorage } from "@/test/blocked-storage";
import { createSecurityNotices } from "./security-notices";

const KEY_1 = "cogra.securityNotice.acct-1";

/** The active account, as the token store would answer it. */
function accounts(initial: string | null) {
  let active = initial;
  const listeners = new Set<() => void>();
  return {
    activeAccountId: () => active,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    switchTo(next: string | null) {
      active = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("securityNotices", () => {
  it("posts, overwrites, and dismisses, notifying subscribers", () => {
    const notices = createSecurityNotices({ accounts: accounts("acct-1") });
    const listener = vi.fn();
    const unsubscribe = notices.subscribe(listener);

    expect(notices.reuseDetectedAt()).toBeNull();
    notices.post("2026-08-10T09:30:00Z", "acct-1");
    expect(notices.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
    // A later detection overwrites an undelivered one.
    notices.post("2026-08-11T00:00:00Z", "acct-1");
    expect(notices.reuseDetectedAt()).toBe("2026-08-11T00:00:00Z");
    notices.dismiss();
    expect(notices.reuseDetectedAt()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    notices.post("2026-08-12T00:00:00Z", "acct-1");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  // FeedSecurityNotice.md:17 — the card stands "across an app restart": a
  // fresh module instance over the same storage still holds it.
  it("stands_across_a_restart_for_the_same_account", () => {
    createSecurityNotices({ accounts: accounts(null) }).post("2026-08-10T09:30:00Z", "acct-1");
    const restarted = createSecurityNotices({ accounts: accounts("acct-1") });
    expect(restarted.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
  });

  // auth.md "Multi-account device custody": device-local flags are bound to
  // the account they belong to — a shared device never shows another's.
  it("never_shows_for_another_account_or_while_signed_out", () => {
    const active = accounts("acct-2");
    const notices = createSecurityNotices({ accounts: active });
    notices.post("2026-08-10T09:30:00Z", "acct-1");
    expect(notices.reuseDetectedAt()).toBeNull();
    active.switchTo(null);
    expect(notices.reuseDetectedAt()).toBeNull();
    active.switchTo("acct-1");
    expect(notices.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
  });

  it("tells_subscribers_when_the_active_account_changes", () => {
    const active = accounts("acct-2");
    const notices = createSecurityNotices({ accounts: active });
    const listener = vi.fn();
    notices.subscribe(listener);
    active.switchTo("acct-1");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // FeedSecurityNotice.md:15 — "Got it -> the card goes AND NEVER the card returns".
  it("got_it_removes_it_for_good_and_a_restart_stays_clean", () => {
    const notices = createSecurityNotices({ accounts: accounts("acct-1") });
    notices.post("2026-08-10T09:30:00Z", "acct-1");
    notices.dismiss();
    expect(window.localStorage.getItem(KEY_1)).toBeNull();
    expect(createSecurityNotices({ accounts: accounts("acct-1") }).reuseDetectedAt()).toBeNull();
  });

  it("dismisses_only_the_active_accounts_notice", () => {
    const active = accounts("acct-2");
    const notices = createSecurityNotices({ accounts: active });
    notices.post("2026-08-10T09:30:00Z", "acct-1");
    notices.post("2026-08-11T00:00:00Z", "acct-2");
    notices.dismiss();
    active.switchTo("acct-1");
    expect(notices.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
  });

  // Another tab's `Got it` reaches this one by the `storage` event, which a
  // browser fires only in the OTHER tabs — so the event is dispatched here.
  it("a_dismiss_in_another_tab_reaches_this_one_by_the_storage_event", () => {
    const here = createSecurityNotices({ accounts: accounts("acct-1") });
    const there = createSecurityNotices({ accounts: accounts("acct-1") });
    here.post("2026-08-10T09:30:00Z", "acct-1");
    const listener = vi.fn();
    here.subscribe(listener);
    there.dismiss();
    window.dispatchEvent(new StorageEvent("storage", { key: KEY_1, newValue: null }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(here.reuseDetectedAt()).toBeNull();
    // Another key's change is not this store's news.
    window.dispatchEvent(new StorageEvent("storage", { key: "cogra.theme" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // What is written at rest: the detection time the server gave, and nothing
  // that names a token or a session.
  it("stores_the_detection_time_and_nothing_else", () => {
    createSecurityNotices({ accounts: accounts(null) }).post("2026-08-10T09:30:00Z", "acct-1");
    const written = Object.keys(window.localStorage).filter((key) =>
      key.startsWith("cogra.securityNotice."),
    );
    expect(written).toEqual([KEY_1]);
    expect(window.localStorage.getItem(KEY_1)).toBe("2026-08-10T09:30:00Z");
  });

  it("forget_drops_one_accounts_notice_and_no_other", () => {
    const notices = createSecurityNotices({ accounts: accounts("acct-1") });
    notices.post("2026-08-10T09:30:00Z", "acct-1");
    notices.post("2026-08-11T00:00:00Z", "acct-2");
    notices.forget("acct-1");
    expect(notices.reuseDetectedAt()).toBeNull();
    expect(window.localStorage.getItem("cogra.securityNotice.acct-2")).toBe("2026-08-11T00:00:00Z");
  });

  // auth.md "Multi-account device custody": the dead lock's notice is a
  // device-local flag bound to the account whose lock it was — another
  // account signing in in this tab is never told ITS lock was lost.
  it("a_lost_lock_is_told_only_to_the_account_whose_lock_it_was", () => {
    const active = accounts("acct-1");
    const notices = createSecurityNotices({ accounts: active });
    notices.postLockLost("acct-1");
    expect(notices.lockLost()).toBe(true);
    active.switchTo("acct-2");
    expect(notices.lockLost()).toBe(false);
    active.switchTo(null);
    expect(notices.lockLost()).toBe(false);
    active.switchTo("acct-1");
    expect(notices.lockLost()).toBe(true);
  });

  it("got_it_on_a_lost_lock_puts_away_only_the_active_accounts_and_forget_drops_it", () => {
    const active = accounts("acct-2");
    const notices = createSecurityNotices({ accounts: active });
    notices.postLockLost("acct-1");
    notices.postLockLost("acct-2");
    notices.dismissLockLost();
    expect(notices.lockLost()).toBe(false);
    active.switchTo("acct-1");
    expect(notices.lockLost()).toBe(true);
    notices.forget("acct-1");
    expect(notices.lockLost()).toBe(false);
  });

  describe("with storage refused", () => {
    let restore: (() => void) | null = null;
    afterEach(() => {
      restore?.();
      restore = null;
    });

    // A blocked browser keeps today's behaviour: the notice lives in this
    // page's memory, and nothing throws.
    it("falls_back_to_memory_without_throwing", () => {
      restore = blockStorage("localStorage");
      const notices = createSecurityNotices({ accounts: accounts("acct-1") });
      expect(() => notices.post("2026-08-10T09:30:00Z", "acct-1")).not.toThrow();
      expect(notices.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
      expect(() => notices.dismiss()).not.toThrow();
      expect(notices.reuseDetectedAt()).toBeNull();
    });
  });
});
