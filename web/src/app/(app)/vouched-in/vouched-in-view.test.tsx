import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, fireEvent, screen } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { CEREMONY_TIMELINE, CEREMONY_TOKENS, VouchedInView } from "./vouched-in-view";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

startMswServer(
  gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          handle: "noa",
          displayName: { __typename: "ModeratedText", value: null },
          actorPubkey: null,
          accountState: "MEMBER",
          // In flight: the vouch-back answers hasReciprocated at once.
          hasReciprocated: true,
          vouchBackDismissed: false,
          preferences: null,
          invitedBy: {
            __typename: "User",
            id: "mira-id",
            handle: "mira",
            displayName: { __typename: "ModeratedText", value: "Mira Voss" },
            avatar: { __typename: "MediaAttachment", url: "https://media.example/mira.jpg" },
          },
        },
      },
    }),
  ),
);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function stillness(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

async function arrive() {
  renderWithProviders(<VouchedInView />, { store: signedInStore() });
  return screen.findByTestId("vouchedIn");
}

describe("VouchedInView", () => {
  beforeEach(() => {
    replace.mockClear();
    stillness(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // VouchedIn.md:7, :9 — no back arrow, no bar, one control; the drawn words.
  it("the ceremony has one control and no back or bar", async () => {
    const root = await arrive();
    expect(screen.getByTestId("vouchedIn.title")).toHaveTextContent("You're part of the sky now.");
    expect(screen.getByTestId("vouchedIn.body")).toHaveTextContent(
      "Your opinion on @mira is signed, and the way is open both ways. The feed you see from here is your own.",
    );
    expect(screen.getByTestId("vouchedIn.onward")).toHaveTextContent("Go to your feed");
    expect(root.querySelectorAll("button")).toHaveLength(1);
    expect(screen.queryByTestId("page-header-back")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    // The voucher's own face sits in the sky.
    expect(
      screen.getByTestId("vouchedIn-voucher").querySelector("img")?.getAttribute("src"),
    ).toContain("mira.jpg");
  });

  // VouchedIn.md:11-23 — every offset is a sum of the stylesheet's tokens.
  it("the ceremony phases run on their tokens", () => {
    const css = readFileSync(resolve(__dirname, "../../tokens-2.css"), "utf8");
    const token = (name: string) => {
      const match = css.match(new RegExp(`${name}:\\s*(\\d+)ms`));
      if (match === null) throw new Error(`no ${name}`);
      return Number(match[1]);
    };
    expect(CEREMONY_TOKENS).toEqual({
      navForward: token("--duration-nav-forward"),
      long2: token("--duration-long-2"),
      medium2: token("--duration-medium-2"),
      medium4: token("--duration-medium-4"),
    });
    expect(CEREMONY_TIMELINE).toEqual({ point: 300, halo: 600, edge: 900, words: 1100, landed: 1500 });
  });

  // VouchedIn.md:27, :33 — inert until the words land, then the own feed.
  it("go to your feed is inert until the words land", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const root = await (async () => {
      renderWithProviders(<VouchedInView />, { store: signedInStore() });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      return screen.getByTestId("vouchedIn");
    })();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CEREMONY_TIMELINE.words);
    });
    expect(root).toHaveAttribute("data-stage", "words");
    fireEvent.click(screen.getByTestId("vouchedIn.onward"));
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CEREMONY_TIMELINE.landed - CEREMONY_TIMELINE.words);
    });
    expect(root).toHaveAttribute("data-stage", "landed");
    fireEvent.click(screen.getByTestId("vouchedIn.onward"));
    expect(replace).toHaveBeenCalledWith("/feed");
  });

  // VouchedIn.md:29 — a tap completes every phase at once.
  it("a tap completes the ceremony at once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    renderWithProviders(<VouchedInView />, { store: signedInStore() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const root = screen.getByTestId("vouchedIn");
    expect(root).toHaveAttribute("data-stage", "arriving");

    // The tap that completes the motion is not also a press on the button.
    const onward = screen.getByTestId("vouchedIn.onward");
    fireEvent.pointerDown(onward);
    fireEvent.click(onward);
    expect(root).toHaveAttribute("data-stage", "landed");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("vouchedIn-edge").style.strokeDashoffset).toBe("0");

    fireEvent.pointerDown(onward);
    fireEvent.click(onward);
    expect(replace).toHaveBeenCalledWith("/feed");
  });

  // VouchedIn.md:31 — the resting state, whole, with nothing animating.
  it("reduced motion arrives whole", async () => {
    stillness(true);
    const root = await arrive();
    expect(root).toHaveAttribute("data-stage", "landed");
    const halo = screen.getByTestId("vouchedIn-halo");
    expect(halo.style.transition).toBe("none");
    expect(screen.getByTestId("vouchedIn-words").style.opacity).toBe("1");
    fireEvent.click(screen.getByTestId("vouchedIn.onward"));
    expect(replace).toHaveBeenCalledWith("/feed");
  });
});
