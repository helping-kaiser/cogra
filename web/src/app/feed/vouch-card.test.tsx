import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { createStubStanceData } from "@/lib/stance/stub-stance-data";
import type { StanceData } from "@/lib/stance/stance-data";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { LONG_PRESS_MS, SETTING_AFTER_MS } from "@/lib/ui/stance-control";
import { VouchCard } from "./vouch-card";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const server = startMswServer();

type MeShape = {
  hasReciprocated?: boolean;
  vouchBackDismissed?: boolean;
  accountState?: "MEMBER" | "APPLICANT";
  invitedBy?: { id: string; handle: string; displayName: string | null; avatarUrl?: string } | null;
};

const MIRA = { id: "mira-id", handle: "mira", displayName: "Mira Voss" };

function me(shape: MeShape = {}) {
  const inviter = shape.invitedBy === undefined ? MIRA : shape.invitedBy;
  return {
    __typename: "User",
    id: "acct-1",
    handle: "noa",
    displayName: { __typename: "ModeratedText", value: null },
    actorPubkey: null,
    accountState: shape.accountState ?? "MEMBER",
    hasReciprocated: shape.hasReciprocated ?? false,
    vouchBackDismissed: shape.vouchBackDismissed ?? false,
    preferences: null,
    invitedBy:
      inviter === null
        ? null
        : {
            __typename: "User",
            id: inviter.id,
            handle: inviter.handle,
            displayName: { __typename: "ModeratedText", value: inviter.displayName },
            avatar:
              "avatarUrl" in inviter && inviter.avatarUrl !== undefined
                ? { __typename: "MediaAttachment", url: inviter.avatarUrl }
                : null,
          },
  };
}

function meHandler(read: () => ReturnType<typeof me>) {
  return gqlLink.query("Me", () => HttpResponse.json({ data: { me: read() } }));
}

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function renderCard(
  options: { stanceData?: StanceData; refreshSignal?: number } = {},
) {
  return renderWithProviders(
    <ul>
      <VouchCard refreshSignal={options.refreshSignal} />
    </ul>,
    { store: signedInStore(), stanceData: options.stanceData },
  );
}

function dismissHandler(answer: () => "ok" | "fail", calls: { n: number }) {
  return gqlLink.mutation("DismissVouchBack", () => {
    calls.n += 1;
    if (answer() === "fail") return HttpResponse.error();
    return HttpResponse.json({
      data: {
        dismissVouchBack: {
          __typename: "DismissVouchBackPayload",
          user: { __typename: "User", id: "acct-1", vouchBackDismissed: true },
          userErrors: [],
        },
      },
    });
  });
}

describe("VouchCard", () => {
  beforeEach(() => {
    push.mockClear();
    window.localStorage.clear();
  });

  // VouchBack.md:3 — server state alone; no key term (the key may live
  // elsewhere: this render has no key on any device).
  it("the vouch card stands for a landed member whose pair is incomplete", async () => {
    server.use(meHandler(() => me()));
    renderCard();
    expect(await screen.findByTestId("feed.vouchCard")).toBeInTheDocument();
  });

  it("shows no vouch card to an applicant, a genesis member or a completed pair", async () => {
    for (const shape of [
      { accountState: "APPLICANT" as const },
      { invitedBy: null, hasReciprocated: true },
      { hasReciprocated: true },
    ]) {
      server.use(meHandler(() => me(shape)));
      const { unmount } = renderCard();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument();
      unmount();
    }
  });

  // VouchBack.md:5 — the card names, and wears the face of, `invitedBy`.
  it("the vouch card names the member who vouched the account in", async () => {
    server.use(
      meHandler(() => me({ invitedBy: { ...MIRA, avatarUrl: "https://media.example/mira.jpg" } })),
    );
    renderCard();
    expect(await screen.findByTestId("feed.vouchCard.title")).toHaveTextContent(
      "@mira vouched you in",
    );
    const avatar = screen.getByTestId("feed.vouchCard.avatar");
    expect(avatar.style.width).toBe("64px");
    expect(avatar.querySelector("img")?.getAttribute("src")).toContain("mira.jpg");
  });

  // VouchBack.md:7, :11 — the drawn body; it claims no order.
  it("the vouch card reads its drawn body and claims no order", async () => {
    server.use(meHandler(() => me()));
    renderCard();
    expect(await screen.findByTestId("feed.vouchCard.body")).toHaveTextContent(
      "Vouch back to open the way from your side — your opinion toward @mira, and your feed grows from it. Vouching opens the opinion control, set to a gentle default.",
    );
    expect(screen.getByTestId("feed.vouchCard.dismiss")).toHaveTextContent("Got it");
    // The olive register.
    expect(screen.getByTestId("feed.vouchCard").className).toContain("bg-tertiary-container");
  });

  // VouchBack.md:11, :13, :17 — the card's act is the stance face, not a
  // button: Got it leads the row, the one line stands beside the face, and
  // the face keeps the trailing seat. The old button is gone (seam 178).
  it("the card's act is the stance face with one coaching line beside it", async () => {
    server.use(meHandler(() => me()));
    renderCard();
    const hint = await screen.findByTestId("feed.vouchCard.hint");
    expect(hint).toHaveTextContent("Tap the face to vouch back.");
    const anchor = screen.getByTestId("feed.vouchCard.stance.anchor");
    // The hollow face: the account holds no opinion of the voucher.
    expect(screen.getByTestId("feed.vouchCard.stance.anchor.face")).toBeInTheDocument();
    const dismiss = screen.getByTestId("feed.vouchCard.dismiss");
    const order = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(order(dismiss, hint)).toBe(true);
    expect(order(hint, anchor)).toBe(true);
    // Nothing of the old button stands: not its node, not its words.
    expect(screen.queryByTestId("feed.vouchCard.vouch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed-vouch-card-vouch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vouch back" })).not.toBeInTheDocument();
  });

  // stance-control.md "The vouch card's empty face is a line face in the
  // card's ink" (jakob 2026-10-14): sentiment_neutral in on-tertiary-container
  // at full opacity, never the 🫥 emoji.
  it("the card's empty face is a line face in the card's ink", async () => {
    server.use(meHandler(() => me()));
    renderCard();
    const face = await screen.findByTestId("feed.vouchCard.stance.anchor.face");
    expect(face).not.toHaveTextContent("🫥");
    expect(face.style.color).toBe("var(--on-tertiary-container)");
    expect(face.querySelector("svg")).not.toBeNull();
    expect(face.className).not.toContain("opacity-40");
    expect(face.className).not.toContain("grayscale");
  });

  // VouchBack.md:13 — the line claims nothing about first-ness; that is the
  // band's line (:23).
  it("the coaching line claims no first-opinion language", async () => {
    server.use(meHandler(() => me()));
    renderCard();
    const hint = await screen.findByTestId("feed.vouchCard.hint");
    expect(hint.textContent).toBe("Tap the face to vouch back.");
    expect(hint.textContent ?? "").not.toMatch(/first|opinion/i);
  });

  // VouchBack.md:37 — a read-side comfort: away at once, silently.
  it("got it puts the card away silently", async () => {
    const calls = { n: 0 };
    server.use(meHandler(() => me()), dismissHandler(() => "ok", calls));
    const { container } = renderCard();
    fireEvent.click(await screen.findByTestId("feed.vouchCard.dismiss"));
    // Gone the moment it is pressed — before the server has answered.
    expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument();
    await waitFor(() => expect(calls.n).toBe(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    // Nothing stands in its place: no snackbar, no line, no reminder.
    expect(container.querySelector("ul")).toBeEmptyDOMElement();
  });

  // VouchBack.md:39, :41 — ruling 44: the failure reverts and says so.
  it("a failed got it brings the card back with retry", async () => {
    const calls = { n: 0 };
    let answer: "ok" | "fail" = "fail";
    server.use(meHandler(() => me()), dismissHandler(() => answer, calls));
    renderCard();
    fireEvent.click(await screen.findByTestId("feed.vouchCard.dismiss"));

    expect(await screen.findByTestId("feed-vouch-card-failed")).toHaveTextContent(
      "That didn't go through.",
    );
    expect(screen.getByTestId("feed.vouchCard")).toBeInTheDocument();
    expect(screen.getByTestId("feed-vouch-card-retry")).toHaveTextContent("Retry");

    answer = "ok";
    fireEvent.click(screen.getByTestId("feed-vouch-card-retry"));
    // Retry: the card steps aside and the put-away is asked again.
    expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument();
    await waitFor(() => expect(calls.n).toBe(2));
  });

  // VouchBack.md:45 — account state, read off the server on any device.
  it("a put-away card stays away on a fresh device", async () => {
    server.use(meHandler(() => me({ vouchBackDismissed: true })));
    renderCard();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument();
  });

  // VouchBack.md:3 + the backend guard: an opinion on someone else ends the
  // borrowing but leaves the pair incomplete, so the card keeps standing.
  it("the vouch card stands after an opinion on someone else", async () => {
    server.use(meHandler(() => me({ hasReciprocated: false })));
    renderCard();
    expect(await screen.findByTestId("feed.vouchCard")).toBeInTheDocument();
  });

  // VouchBack.md:57, :59 — the card returns with the next read, unless it
  // was put away.
  it("an expired vouch-back returns the card unless put away", async () => {
    let state: MeShape = { hasReciprocated: true };
    server.use(meHandler(() => me(state)));
    // The feed's refresh, standing in: each press is the next fresh read.
    function Harness() {
      const [signal, setSignal] = useState(0);
      return (
        <>
          <button type="button" data-testid="refresh" onClick={() => setSignal((n) => n + 1)} />
          <ul>
            <VouchCard refreshSignal={signal} />
          </ul>
        </>
      );
    }
    renderWithProviders(<Harness />, { store: signedInStore() });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument();

    // The signed vouch-back expired: the pair is incomplete again.
    state = { hasReciprocated: false };
    fireEvent.click(screen.getByTestId("refresh"));
    expect(await screen.findByTestId("feed.vouchCard")).toBeInTheDocument();

    // Put away before it expired: never returns.
    state = { hasReciprocated: false, vouchBackDismissed: true };
    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() =>
      expect(screen.queryByTestId("feed.vouchCard")).not.toBeInTheDocument(),
    );
  });

  describe("the vouch-back pad", () => {
    async function openPad(stanceData: StanceData = createStubStanceData()) {
      server.use(meHandler(() => me()));
      renderCard({ stanceData });
      fireEvent.click(await screen.findByTestId("feed.vouchCard.stance.anchor"));
      return screen.findByTestId("feed.vouchCard.stance.pad");
    }

    // VouchBack.md:39 — a tap on the face blooms the pad and signs nothing.
    it("a tap on the face blooms the pad and signs nothing", async () => {
      const data = createStubStanceData();
      const pad = await openPad(data);
      expect(pad).toBeInTheDocument();
      expect(data.sent).toHaveLength(0);
      expect(push).not.toHaveBeenCalled();
    });

    // VouchBack.md:43 — a hold signs the gentle default as the vouch-back and
    // the ceremony opens, never the pad.
    it("a hold on the face signs the gentle default and opens the ceremony", async () => {
      const data = createStubStanceData();
      server.use(meHandler(() => me()));
      renderCard({ stanceData: data });
      const anchor = await screen.findByTestId("feed.vouchCard.stance.anchor");
      fireEvent.pointerDown(anchor, { pointerId: 1, clientX: 0, clientY: 0 });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS + 50));
      });
      await act(async () => {
        fireEvent.pointerUp(anchor, { pointerId: 1 });
        fireEvent.click(anchor);
      });
      await waitFor(() => expect(data.sent).toHaveLength(1));
      expect(data.sent[0]).toEqual({
        target: "mira-id",
        pick: { pDirected: 0.1, pInterest: 0.1 },
      });
      await waitFor(() => expect(push).toHaveBeenCalledWith("/vouched-in"));
      expect(screen.queryByTestId("feed.vouchCard.stance.pad")).not.toBeInTheDocument();
    });

    // VouchBack.md:39 — Set on a pick never moved signs the gentle default.
    it("the face's pad signs the gentle default", async () => {
      const data = createStubStanceData();
      await openPad(data);
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.pad.set"));
      await waitFor(() => expect(data.sent).toHaveLength(1));
      expect(data.sent[0]).toEqual({
        target: "mira-id",
        pick: { pDirected: 0.1, pInterest: 0.1 },
      });
    });

    // VouchBackPad.md:9 — the pad and its ? are named Your vouch back.
    it("the vouch-back pad is titled your vouch back", async () => {
      const pad = await openPad();
      expect(pad).toHaveAttribute("aria-label", "Your vouch back");
      expect(screen.getByTestId("feed.vouchCard.stance.pad.help")).toHaveAttribute(
        "aria-label",
        "Your vouch back",
      );
    });

    // VouchBackPad.md:21 — help in place, Set disabled, never a dialog.
    it("the vouch-back pad's help reads in place", async () => {
      await openPad();
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.pad.help"));
      const help = screen.getByTestId("vouch-back-explanation");
      expect(help).toHaveTextContent(
        "Vouching back signs your opinion of the person who vouched you in, and your feed grows from it.",
      );
      expect(help).toHaveTextContent(
        "The pad is how you shape what reaches you — for or against, and how much. Nothing is signed until Set.",
      );
      expect(screen.getByTestId("feed.vouchCard.stance.pad")).toContainElement(help);
      expect(screen.getByTestId("feed.vouchCard.stance.pad.set")).toBeDisabled();
      // The pad is the one dialog (it is modal, StanceControl.jsx); the help
      // opens no second one over it.
      expect(screen.getAllByRole("dialog")).toEqual([screen.getByTestId("feed.vouchCard.stance.pad")]);
    });

    // VouchBackPad.md:11.
    it("the vouch-back pad carries no walk it back", async () => {
      const data = createStubStanceData({
        seed: { "mira-id": { records: [{ pDirected: 0.3, pInterest: 0.2 }] } },
      });
      await openPad(data);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(screen.queryByTestId("vouch-back-sever")).not.toBeInTheDocument();
      expect(screen.queryByText("Walk it back")).not.toBeInTheDocument();
    });

    // VouchBackPad.md:13 — every open, not only the first.
    it("the opener line stands on every vouch-back open", async () => {
      await openPad();
      const opener =
        "Your vouch back. The pad is how you shape what reaches you — for or against, and how much.";
      expect(screen.getByTestId("feed.vouchCard.stance.pad.note")).toHaveTextContent(opener);
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.pad.cancel"));
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.anchor"));
      expect(await screen.findByTestId("feed.vouchCard.stance.pad.note")).toHaveTextContent(
        opener,
      );
      // The first-ever coaching lines rode the first open only.
      expect(screen.queryByTestId("vouch-back-coaching")).not.toBeInTheDocument();
    });

    // VouchBackPad.md:5 — the wash covers the shell; the card's own
    // controls cannot be reached under it.
    it("the shell is inert under the vouch-back pad", async () => {
      await openPad();
      const scrim = screen.getByTestId("vouch-back-scrim");
      expect(scrim.className).toContain("bg-scrim/50");
      expect(scrim.className).toContain("fixed inset-0");
      // A press on the wash closes onto the card and stages nothing (:49).
      fireEvent.pointerDown(scrim);
      expect(screen.queryByTestId("feed.vouchCard.stance.pad")).not.toBeInTheDocument();
      expect(screen.getByTestId("feed.vouchCard")).toBeInTheDocument();
    });

    // VouchBackPad.md:45.
    it("cancel closes onto the vouch card with nothing staged", async () => {
      const data = createStubStanceData();
      await openPad(data);
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.pad.cancel"));
      expect(screen.queryByTestId("feed.vouchCard.stance.pad")).not.toBeInTheDocument();
      expect(screen.getByTestId("feed.vouchCard")).toBeInTheDocument();
      expect(data.sent).toHaveLength(0);
      expect(push).not.toHaveBeenCalled();
    });

    // VouchBackPad.md:31 — K4.2: Setting… past 200ms, inert, no spinner.
    it("set reads setting after 200ms", async () => {
      const stub = createStubStanceData();
      let release: () => void = () => {};
      const slow: StanceData = {
        ...stub,
        commit: (target, pick) =>
          new Promise((resolve) => {
            release = () => void stub.commit(target, pick).then(resolve);
          }),
      };
      await openPad(slow);
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const set = screen.getByTestId("feed.vouchCard.stance.pad.set");
        fireEvent.click(set);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(SETTING_AFTER_MS - 50);
        });
        expect(set).toHaveTextContent("Set");
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });
        expect(set).toHaveTextContent("Setting…");
        expect(set).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByTestId("feed.vouchCard.stance.pad")).toBeInTheDocument();
        await act(async () => release());
      } finally {
        vi.useRealTimers();
      }
      await waitFor(() => expect(push).toHaveBeenCalledWith("/vouched-in"));
    });

    // VouchBackPad.md:37 — PadFailed: open at the pick, fault, Retry.
    it("a vouch-back that didn't sign keeps the pad at the pick", async () => {
      await openPad(createStubStanceData({ offline: true }));
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.pad.set"));
      expect(await screen.findByTestId("vouch-back-pad-failed")).toHaveTextContent(
        "That didn't send. Try again.",
      );
      expect(screen.getByTestId("feed.vouchCard.stance.pad")).toBeInTheDocument();
      expect(screen.getByTestId("feed.vouchCard.stance.pad.set")).toHaveTextContent("Retry");
      expect(push).not.toHaveBeenCalled();
    });

    // VouchBackPad.md:33 — the ceremony, not the master's snackbar.
    it("set taken on the vouch-back opens the ceremony", async () => {
      await openPad();
      fireEvent.click(screen.getByTestId("feed.vouchCard.stance.pad.set"));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/vouched-in"));
      expect(screen.queryByTestId("vouch-back-signed")?.textContent ?? "").toBe("");
    });
  });
});
