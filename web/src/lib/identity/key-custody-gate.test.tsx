import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KeyCustodyGate } from "./key-custody-gate";
import { ceremonyBackHref, RESTORE_BACK_HREF } from "./key-custody-routes";

const never = () => new Promise<boolean>(() => {});

describe("the probe: can this browser hold a key", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // The probe memoizes per page (hashing.ts), so each case loads a fresh module.
  async function freshProbe() {
    return (await import("@/lib/crypto/hashing")).ed25519Available;
  }

  it("answers true where WebCrypto generates an Ed25519 pair", async () => {
    expect(await (await freshProbe())()).toBe(true);
  });

  it("answers false where WebCrypto rejects Ed25519 with NotSupportedError, as the spec's normalize step does", async () => {
    const generate = vi
      .spyOn(crypto.subtle, "generateKey")
      .mockRejectedValue(new DOMException("Unrecognized algorithm name", "NotSupportedError"));
    expect(await (await freshProbe())()).toBe(false);
    expect(generate).toHaveBeenCalledWith("Ed25519", false, ["sign", "verify"]);
  });

  it("answers false where the browser has no SubtleCrypto at all (an insecure context)", async () => {
    vi.spyOn(globalThis, "crypto", "get").mockReturnValue({} as Crypto);
    expect(await (await freshProbe())()).toBe(false);
  });

  it("is read-only: the probe's key is non-extractable and nothing is stored", async () => {
    const generate = vi.spyOn(crypto.subtle, "generateKey");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await (await freshProbe())();
    expect(generate.mock.calls[0]?.[1]).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("KeyCustodyGate", () => {
  it("renders the ceremony on a browser that can hold a key", async () => {
    render(
      <KeyCustodyGate backHref="/" probe={() => Promise.resolve(true)}>
        <p data-testid="ceremony">ceremony</p>
      </KeyCustodyGate>,
    );
    expect(await screen.findByTestId("ceremony")).toBeInTheDocument();
    expect(screen.queryByTestId("keyCeremonyUnsupported.notice")).toBeNull();
  });

  it("opens KeyCeremonyUnsupported in the ceremony's place, and the ceremony never renders", async () => {
    render(
      <KeyCustodyGate backHref="/settings" probe={() => Promise.resolve(false)}>
        <p data-testid="ceremony">ceremony</p>
      </KeyCustodyGate>,
    );
    expect(await screen.findByTestId("keyCeremonyUnsupported.notice")).toBeInTheDocument();
    expect(screen.queryByTestId("ceremony")).toBeNull();
    expect(screen.getByTestId("keyCeremonyUnsupported.header.back")).toHaveAttribute("href", "/settings");
  });

  it("treats a probe that throws as a browser that cannot hold a key", async () => {
    render(
      <KeyCustodyGate backHref="/" probe={() => Promise.reject(new Error("boom"))}>
        <p data-testid="ceremony">ceremony</p>
      </KeyCustodyGate>,
    );
    expect(await screen.findByTestId("keyCeremonyUnsupported.notice")).toBeInTheDocument();
    expect(screen.queryByTestId("ceremony")).toBeNull();
  });

  it("draws nothing while the probe runs — no ceremony for a frame", async () => {
    const { container } = render(
      <KeyCustodyGate backHref="/" probe={never}>
        <p data-testid="ceremony">ceremony</p>
      </KeyCustodyGate>,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByTestId("ceremony")).toBeNull();
  });
});

describe("the refusal's way back (KeyCeremonyUnsupported.md back lines)", () => {
  it("goes to Settings from a key row in settings", () => {
    expect(ceremonyBackHref("settings")).toBe("/settings");
  });

  it("goes home from the task card and the key-elsewhere card — the applicant's feed", () => {
    expect(ceremonyBackHref(null)).toBe("/");
    expect(ceremonyBackHref("anything-else")).toBe("/");
  });

  it("goes to the restore's own home in the restore's place — KeyElsewhere and ApplicantKeyElsewhere both stand on the feed", () => {
    expect(RESTORE_BACK_HREF).toBe("/");
  });
});
