// KeptPicksReview.md and KeptPicksSeal.md, compiled line by line against the
// stand-in seam — the key is stubbed present or absent; nothing here restores
// or signs for real.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KeptTargetPreview } from "@/lib/stance/kept-preview";
import { keepPick, listKeptPicks } from "@/lib/stance/kept-picks";
import { useSettling } from "@/lib/stance/settling";
import { createStubStanceData, type StubStanceOptions } from "@/lib/stance/stub-stance-data";
import { createTokenStore } from "@/lib/session/token-store";
import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
import { byNode } from "@/test/data-node";
import { renderWithProviders } from "@/test/providers";
import { KeptPicksView, NOTHING_LEFT } from "./kept-picks-view";

const router = { replace: vi.fn(), push: vi.fn() };
let search = "from=%2Ffeed";
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));

const ADA = { kind: "post" as const, id: "post-ada" };
const MIRA = { kind: "profile" as const, id: "user-mira" };
const JUNO = { kind: "post" as const, id: "post-juno" };

const PREVIEWS: Record<string, KeptTargetPreview> = {
  "post-ada": { kind: "post", name: "The long way home — @ada", sub: "Post", src: null, removed: null },
  "user-mira": { kind: "person", name: "Mira Voss", sub: "Person", src: null, removed: null },
  "post-juno": {
    kind: "post",
    name: "Tide tables and the third headland — @juno",
    sub: "Post",
    src: null,
    removed: "Removed by its author",
  },
};

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "u1" });
  return store;
}

/** The three picks the boards draw: a plain one, one that severs, one over a removed post. */
async function keepTheBoardsPicks() {
  await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
  await keepPick("u1", MIRA, { pDirected: 0.55, pInterest: 0.2 });
  await keepPick("u1", JUNO, { pDirected: -0.15, pInterest: 0.15 });
}

function SettlingProbe() {
  return <span data-testid="probe-settling">{String(useSettling(ADA))}</span>;
}

function mount(options: StubStanceOptions = {}) {
  const data = createStubStanceData({
    previews: PREVIEWS,
    // Mira's standing nets back to zero with the kept pick: one record the
    // pick exactly cancels.
    seed: { "user-mira": { records: [{ pDirected: -0.55, pInterest: -0.2 }] } },
    ...options,
  });
  renderWithProviders(
    <>
      <KeptPicksView />
      <SettlingProbe />
      <CarriedSnackbar />
    </>,
    { store: signedIn(), stanceData: data },
  );
  return data;
}

async function openSeal() {
  fireEvent.click(await screen.findByTestId("keptPicks.sign"));
  await screen.findByText("What you sign");
}

beforeEach(() => {
  router.replace.mockClear();
  router.push.mockClear();
  search = "from=%2Ffeed";
});

describe("the kept picks' review", () => {
  it("lists one row per kept opinion, under its title and its one line", async () => {
    await keepTheBoardsPicks();
    mount();
    expect(await screen.findByText("Kept picks")).toBeInTheDocument();
    expect(
      screen.getByText(
        "These waited on this device for your key, and nothing is signed yet. Remove any you no longer mean — the rest sign together.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("The long way home — @ada")).toBeInTheDocument());
    expect(screen.getByText("Mira Voss")).toBeInTheDocument();
    // Each pick keyed by its place in the review (nodes.json KeptPicksReview).
    expect(screen.getAllByTestId("keptPicks.pick").map((pick) => pick.getAttribute("data-testid-key"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(screen.getAllByTestId("keptPicks.pick")).toHaveLength(3);
    // The pair spoken as the readout speaks it (`stance`).
    expect(screen.getByText("Nice, For or against +0.10, How much reaches you +0.10")).toBeInTheDocument();
    expect(screen.getByTestId("keptPicks.sign")).toHaveTextContent("Sign them");
  });

  it("lists plain opinions only: a kept vouch-back or approval never joins", async () => {
    // KeptPicksReview.md:5,7.
    await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
    await keepPick("u1", MIRA, { pDirected: 0.3, pInterest: 0.3 }, "approval");
    await keepPick("u1", JUNO, { pDirected: 0.3, pInterest: 0.3 }, "vouchBack");
    mount();
    await waitFor(() => expect(screen.getAllByTestId("keptPicks.pick")).toHaveLength(1));
  });

  it("names a kept approval under the intro, with Open Invites, and never takes it in", async () => {
    // KeptPicksReview.md:43-47.
    await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
    await keepPick("u1", MIRA, { pDirected: 0.3, pInterest: 0.3 }, "approval");
    mount();
    const line = await screen.findByTestId("keptPicks.approval");
    expect(line).toHaveTextContent("An approval waits in your invites — go there to sign it.");
    fireEvent.click(within(line).getByText("Open Invites"));
    expect(router.push).toHaveBeenCalledWith("/invites?from=kept-picks");
    expect((await listKeptPicks("u1")).length).toBe(2);
  });

  it("stands no approval line when no approval was kept", async () => {
    await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
    mount();
    await screen.findAllByTestId("keptPicks.pick");
    expect(screen.queryByTestId("keptPicks.approval")).toBeNull();
  });

  it("keeps a removed target's row, wearing its mark in the name's place", async () => {
    // KeptPicksReview.md:9.
    await keepTheBoardsPicks();
    mount();
    await waitFor(() => expect(screen.getByText("Removed by its author")).toBeInTheDocument());
    expect(screen.queryByText("Tide tables and the third headland — @juno")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove this pick: Post, Removed by its author" }),
    ).toBeInTheDocument();
  });

  it("states on its own row a pick that would net its bundle to nothing", async () => {
    // KeptPicksReview.md:11.
    await keepTheBoardsPicks();
    mount();
    await waitFor(() => expect(screen.getByText("This takes you back to zero.")).toBeInTheDocument());
    expect(screen.getAllByText("This takes you back to zero.")).toHaveLength(1);
  });

  it("drops a pick at once on its ×, announced, with no confirmation and no undo", async () => {
    // KeptPicksReview.md:15.
    await keepTheBoardsPicks();
    mount();
    const remove = await screen.findByRole("button", { name: "Remove The long way home — @ada" });
    await act(async () => {
      fireEvent.click(remove);
    });
    await waitFor(() => expect(screen.getAllByTestId("keptPicks.pick")).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByTestId("keptPicks.announcement")).toHaveTextContent("Removed — 2 picks left."),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Undo")).toBeNull();
    expect((await listKeptPicks("u1")).map((k) => k.target.id)).toEqual(["user-mira", "post-juno"]);
  });

  it("closes to where it was opened from on the last drop, with Nothing left to sign.", async () => {
    // KeptPicksReview.md:17.
    await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
    mount();
    const remove = await screen.findByRole("button", { name: /^Remove / });
    await act(async () => {
      fireEvent.click(remove);
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed"));
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent(NOTHING_LEFT);
  });

  it("returns where it was opened from on the header back, every pick still kept", async () => {
    // KeptPicksReview.md:29.
    await keepTheBoardsPicks();
    mount();
    const back = await screen.findByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/feed");
    expect((await listKeptPicks("u1")).length).toBe(3);
  });

  it("opens the seal on Sign them, and signs nothing", async () => {
    // KeptPicksReview.md:19.
    await keepTheBoardsPicks();
    const data = mount();
    await openSeal();
    expect(data.sent).toEqual([]);
  });

  it("never stands without the key: it leaves for where it was opened from", async () => {
    await keepTheBoardsPicks();
    mount({ keyAbsent: true });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed"));
  });

  it("never follows an origin that is not this app's own path", async () => {
    search = "from=%2F%2Fevil.example";
    await keepTheBoardsPicks();
    mount();
    const back = await screen.findByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/feed");
  });
});

describe("the kept picks' seal", () => {
  it("is the standard seal: What you sign, Last step, the ?, the acts card, Sign the opinions over Back", async () => {
    // KeptPicksSeal.md:3-7.
    await keepTheBoardsPicks();
    mount();
    await openSeal();
    expect(screen.getByTestId("keptPicksSeal.header.stage")).toHaveTextContent("Last step");
    expect(screen.getByRole("button", { name: "How signing works" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave — your picks are kept" })).toBeInTheDocument();
    const acts = screen.getByTestId("keptPicksSeal.acts");
    expect(within(acts).getAllByText("Opinion")).toHaveLength(3);
    expect(within(acts).getAllByText("1 opinion")).toHaveLength(3);
    expect(
      within(acts)
        .getAllByTestId("keptPicksSeal.acts.actRow")
        .map((row) => row.getAttribute("data-testid-key")),
    ).toEqual(["1", "2", "3"]);
    expect(screen.getByTestId("keptPicksSeal.header.help")).toHaveAccessibleName("How signing works");
    expect(screen.getByTestId("keptPicksSeal.foot")).toContainElement(screen.getByTestId("keptPicksSeal.foot.sign"));
    expect(screen.getByTestId("keptPicksSeal.acts.total")).toHaveTextContent("3 things, signed together");
    expect(screen.getByTestId("keptPicksSeal.acts.note")).toHaveTextContent("They land together, or none does.");
    expect(screen.getByTestId("keptPicksSeal.foot.sign")).toHaveTextContent("Sign the opinions");
    expect(screen.getByTestId("keptPicksSeal.foot.back")).toHaveTextContent("Back");
    // Nothing on the seal is removable.
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("reads a removed target back by its mark, over the pair it still signs", async () => {
    await keepTheBoardsPicks();
    mount();
    await waitFor(() => expect(screen.getByText("Removed by its author")).toBeInTheDocument());
    await openSeal();
    // @juno's post is the third pick kept, so the seal's third row.
    expect(screen.getByTestId(byNode("keptPicksSeal.acts.actRow.value", "3"))).toHaveTextContent(
      "Removed by its author",
    );
    // A pick that nets to nothing reads its pair and nothing more here.
    expect(screen.queryByText("This takes you back to zero.")).toBeNull();
  });

  it("signs the batch on Sign the opinions, with no severance dialog, and leaves with the batch snackbar", async () => {
    // KeptPicksSeal.md:19,25.
    await keepTheBoardsPicks();
    const data = mount();
    await openSeal();
    await act(async () => {
      fireEvent.click(screen.getByTestId("keptPicksSeal.foot.sign"));
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/feed"));
    expect(data.batches).toEqual([
      [
        { target: "post-ada", pick: { pDirected: 0.1, pInterest: 0.1 } },
        { target: "user-mira", pick: { pDirected: 0.55, pInterest: 0.2 } },
        { target: "post-juno", pick: { pDirected: -0.15, pInterest: 0.15 } },
      ],
    ]);
    expect(screen.queryByTestId("severance-confirm")).toBeNull();
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent("Signed 3 things, still settling.");
    // Signed, the picks are kept no longer, and each target settles.
    expect(await listKeptPicks("u1")).toEqual([]);
    expect(screen.getByTestId("probe-settling")).toHaveTextContent("true");
  });

  it("keeps every pick and shows the fault line and Retry when no answer comes", async () => {
    // KeptPicksSeal.md:27.
    await keepTheBoardsPicks();
    mount({ offline: true });
    await screen.findByTestId("keptPicks.sign");
    fireEvent.click(screen.getByTestId("keptPicks.sign"));
    await act(async () => {
      fireEvent.click(await screen.findByTestId("keptPicksSeal.foot.sign"));
    });
    expect(await screen.findByTestId("keptPicksSeal.fault")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("keptPicksSeal.foot.sign")).toHaveTextContent("Retry");
    expect((await listKeptPicks("u1")).length).toBe(3);
  });

  it("answers the write rule with the notice, its fact ending your picks are still kept., and Not now back to the review", async () => {
    // KeptPicksSeal.md:29-31; KeptPicksReview.md:23-25.
    await keepTheBoardsPicks();
    mount({ refuse: "WRITE_RULE_FAILED" });
    await openSeal();
    await act(async () => {
      fireEvent.click(screen.getByTestId("keptPicksSeal.foot.sign"));
    });
    const notice = await screen.findByTestId("keptPicksSeal.writeRule");
    expect(notice).toHaveTextContent("You can't sign right now");
    expect(notice).toHaveTextContent(
      "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your picks are still kept.",
    );
    fireEvent.click(screen.getByTestId("keptPicksSeal.notNow"));
    expect(await screen.findByText("Kept picks")).toBeInTheDocument();
    expect(screen.getAllByTestId("keptPicks.pick")).toHaveLength(3);
    expect((await listKeptPicks("u1")).length).toBe(3);
  });

  it("answers any other refusal with the bug notice: Try again in it, Report a problem and Not now under it", async () => {
    // KeptPicksSeal.md:33-35.
    await keepTheBoardsPicks();
    mount({ refuse: "BAD_INPUT" });
    await openSeal();
    await act(async () => {
      fireEvent.click(screen.getByTestId("keptPicksSeal.foot.sign"));
    });
    const notice = await screen.findByTestId("keptPicksSeal.bug");
    expect(notice).toHaveTextContent("This shouldn't have happened");
    expect(within(notice).getByTestId("keptPicksSeal.tryAgain")).toHaveTextContent("Try again");
    expect(screen.getByTestId("keptPicksSeal.report")).toHaveTextContent("Report a problem");
    fireEvent.click(screen.getByTestId("keptPicksSeal.notNow"));
    expect(await screen.findByText("Kept picks")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await listKeptPicks("u1")).length).toBe(3);
  });

  it("steps back to the review on the arrow and on Back, every pick still in it", async () => {
    // KeptPicksSeal.md:43-45.
    await keepTheBoardsPicks();
    mount();
    await openSeal();
    fireEvent.click(screen.getByRole("button", { name: "Back a step" }));
    expect(await screen.findByText("Kept picks")).toBeInTheDocument();
    await openSeal();
    fireEvent.click(screen.getByTestId("keptPicksSeal.foot.back"));
    expect(await screen.findByText("Kept picks")).toBeInTheDocument();
    expect(screen.getAllByTestId("keptPicks.pick")).toHaveLength(3);
  });

  it("leaves the flow on the X, signing nothing and keeping every pick", async () => {
    // KeptPicksSeal.md:47.
    await keepTheBoardsPicks();
    const data = mount();
    await openSeal();
    fireEvent.click(screen.getByRole("button", { name: "Leave — your picks are kept" }));
    expect(router.replace).toHaveBeenCalledWith("/feed");
    expect(data.sent).toEqual([]);
    expect((await listKeptPicks("u1")).length).toBe(3);
  });

  it("opens the signing text from the header's ?", async () => {
    await keepTheBoardsPicks();
    mount();
    await openSeal();
    fireEvent.click(screen.getByRole("button", { name: "How signing works" }));
    expect(screen.getByTestId("keptPicksSeal.help-dialog")).toHaveTextContent("How signing works");
  });

  it("names a kept approval under the acts card too, and never signs it with the picks", async () => {
    await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
    await keepPick("u1", MIRA, { pDirected: 0.3, pInterest: 0.3 }, "approval");
    const data = mount();
    await openSeal();
    expect(screen.getByTestId("keptPicksSeal.approval")).toHaveTextContent(
      "An approval waits in your invites — go there to sign it.",
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("keptPicksSeal.foot.sign"));
    });
    await waitFor(() => expect(data.batches).toHaveLength(1));
    expect(data.batches[0]!.map((entry) => entry.target)).toEqual(["post-ada"]);
    expect((await listKeptPicks("u1")).map((k) => k.family)).toEqual(["approval"]);
  });

  it("reads 1 thing, signed and no all-or-nothing line for a single pick", async () => {
    await keepPick("u1", ADA, { pDirected: 0.1, pInterest: 0.1 });
    mount();
    await openSeal();
    expect(screen.getByTestId("keptPicksSeal.acts.total")).toHaveTextContent("1 thing, signed");
    expect(screen.queryByTestId("keptPicksSeal.acts.note")).toBeNull();
  });
});

describe("the seal while the signing waits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("reads Signing the opinions… past 200ms, the ways out refusing a press; the slow line past 5s", async () => {
    // KeptPicksSeal.md:19-23.
    await keepTheBoardsPicks();
    let release: () => void = () => {};
    const data = createStubStanceData({ previews: PREVIEWS });
    data.commitBatch = () =>
      new Promise((resolve) => {
        release = () => resolve({ kind: "success", value: { records: 3 } });
      });
    renderWithProviders(<KeptPicksView />, { store: signedIn(), stanceData: data });
    await openSeal();
    fireEvent.click(screen.getByTestId("keptPicksSeal.foot.sign"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByTestId("keptPicksSeal.foot.sign")).toHaveTextContent("Signing the opinions…");
    expect(screen.getByTestId("keptPicksSeal.foot.sign")).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back a step" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave — your picks are kept" }));
    expect(screen.getByText("What you sign")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByTestId("keptPicksSeal.acts.note")).toHaveTextContent(
      "Still signing — the network is slow right now.",
    );
    await act(async () => {
      release();
    });
    vi.useRealTimers();
  });
});
