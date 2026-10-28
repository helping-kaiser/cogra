// The ask link's landing, line by line: behavior/VouchAsk.md, VouchAskPad.md,
// VouchAskInvalid.md and VouchAskUnusable.md. Every mutation is mocked (MSW)
// and the signer is the fake.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { takeInvitesNotice } from "@/lib/invites/invites-notice";
import { heldAskLink } from "@/lib/session/held-link";
import { createTokenStore } from "@/lib/session/token-store";
import { expectation, stanceRecord } from "@/lib/signing/intent";
import { listKeptPicks } from "@/lib/stance/kept-picks";
import { writeStanceTaught } from "@/lib/stance/stance-coach";
import {
  application,
  applicationNode,
  approveAnswer,
  askCheckAnswer,
  graphIdOf,
  meHandler,
  userError,
} from "@/test/invites";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { VouchAskView } from "./vouch-ask-view";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  usePathname: () => "/vouch/k1",
  useSearchParams: () => new URLSearchParams(),
}));

const server = startMswServer();
const ASK = "k1";

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function myApplication(askLink: string | null) {
  return gqlLink.query("MyApplication", () =>
    HttpResponse.json({
      data: { me: { __typename: "User", id: "u1", askLink, application: null } },
    }),
  );
}

function check(answer: Parameters<typeof askCheckAnswer>[0]) {
  return gqlLink.query("AskLinkCheck", () => HttpResponse.json(askCheckAnswer(answer)));
}

const USABLE = { usable: true, applicantHandle: "noor", reason: null } as const;

const KEPT_NOOR = expect.objectContaining({
  family: "approval",
  target: { kind: "profile", id: "app-noor" },
  pick: { pDirected: 0.1, pInterest: 0.1 },
});

function asMember(answer: Parameters<typeof askCheckAnswer>[0] = USABLE, signer = fakeWriteSigner()) {
  server.use(meHandler("MEMBER"), myApplication(null), check(answer));
  renderWithProviders(<VouchAskView id={ASK} />, { store: signedInStore(), writeSigner: signer });
  return signer;
}

function stageHandler(fields: Parameters<typeof application>[0] = {}) {
  let calls = 0;
  const handler = gqlLink.mutation("StageApplicant", () => {
    calls += 1;
    return HttpResponse.json({
      data: {
        stageApplicant: {
          __typename: "StageApplicantPayload",
          application: applicationNode(application({ handle: "noor", link: null, ...fields })),
          userErrors: [],
        },
      },
    });
  });
  return { handler, calls: () => calls };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  writeStanceTaught();
  push.mockReset();
  replace.mockReset();
  takeInvitesNotice();
});

describe("the ask (behavior/VouchAsk.md)", () => {
  it(":3-:11 a member meets the ask with the pad closed: the asker named, a monogram, nothing staged", async () => {
    const stage = stageHandler();
    server.use(stage.handler);
    asMember();
    const ask = await screen.findByTestId("vouchAsk.ask");
    expect(within(ask).getByTestId("vouchAsk.ask.title")).toHaveTextContent("@noor is asking to be vouched in");
    expect(within(ask).getByTestId("vouchAsk.ask.body")).toHaveTextContent(
      "They have an account and can read; what they do not have yet is anyone standing for them. Your opinion is what brings them in.",
    );
    expect(within(ask).getByTestId("vouchAsk.ask.avatar")).toHaveTextContent("N");
    expect(screen.getByTestId("vouchAsk.header.title")).toHaveTextContent("A vouch, asked for");
    expect(screen.queryByTestId("vouchAsk.ask.stance.pad")).not.toBeInTheDocument();
    expect(stage.calls()).toBe(0);
  });

  it(":39 the header's arrow reads a plain Back; :45-:47 cold, it opens the feed's root", async () => {
    asMember();
    const back = await screen.findByTestId("vouchAsk.header.back");
    expect(back).toHaveAccessibleName("Back");
    expect(back).toHaveAttribute("href", "/");
  });

  it(":41 Not now leaves, nothing signed", async () => {
    const signer = asMember();
    fireEvent.click(await screen.findByTestId("vouchAsk.ask.later"));
    expect(push).toHaveBeenCalledWith("/");
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it(":13 an applicant lands at app-open, never this page", async () => {
    server.use(meHandler("APPLICANT"), myApplication("someone-else"), check(USABLE));
    renderWithProviders(<VouchAskView id={ASK} />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("vouchAsk.ask")).not.toBeInTheDocument();
  });

  it(":15, :49 the asker lands at app-open even when the link stages nobody", async () => {
    server.use(meHandler("APPLICANT"), myApplication(ASK), check({ usable: false, applicantHandle: "noor", reason: "LANDED" }));
    renderWithProviders(<VouchAskView id={ASK} />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("vouchAsk.title")).not.toBeInTheDocument();
  });

  it(":17 a member already holding the asker meets Invites with its snackbar", async () => {
    asMember({ usable: false, applicantHandle: "noor", reason: "WAITING_ON_VIEWER" });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/invites"));
    expect(takeInvitesNotice()).toEqual({ kind: "alreadyWaiting", handle: "noor" });
  });

  it(":21-:23 a guest meets the ask; the tap raises the guest gate; the link is held for the sign-in", async () => {
    server.use(check(USABLE));
    renderWithProviders(<VouchAskView id={ASK} />, { store: createTokenStore(), writeSigner: fakeWriteSigner() });
    fireEvent.click(await screen.findByTestId("vouchAsk.ask.stance.anchor"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("vouchAsk.ask.stance.pad")).not.toBeInTheDocument();
    expect(heldAskLink()).toBe(ASK);
  });
});

describe("the ask's pad (behavior/VouchAskPad.md)", () => {
  async function openPad(signer = fakeWriteSigner()) {
    asMember(USABLE, signer);
    fireEvent.click(await screen.findByTestId("vouchAsk.ask.stance.anchor"));
    return screen.findByTestId("vouchAsk.ask.stance.pad");
  }

  it(":7-:13 the pad at +0.10 / +0.10, no Walk it back, its two lines, ? named How vouching works", async () => {
    const pad = await openPad();
    expect(within(pad).queryByText(/Walk it/)).not.toBeInTheDocument();
    expect(within(pad).getByTestId("vouchAsk.ask.stance.pad.note")).toHaveTextContent(
      "Vouching is the act. Set signs your opinion on @noor and brings them in.",
    );
    expect(within(pad).getByTestId("vouchAsk.ask.stance.pad.help")).toHaveAccessibleName("How vouching works");
  });

  it(":25 Set stages, approves the staged row with the pick, signs it, and opens Invites with the signed snackbar", async () => {
    const stage = stageHandler();
    let variables: unknown = null;
    server.use(
      stage.handler,
      gqlLink.mutation("ApproveApplicants", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json(approveAnswer());
      }),
    );
    const signer = fakeWriteSigner();
    const pad = await openPad(signer);
    fireEvent.click(within(pad).getByTestId("vouchAsk.ask.stance.pad.set"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invites"));
    expect(stage.calls()).toBe(1);
    expect(variables).toEqual({ input: { approvals: [{ application: "app-noor", pDirected: 0.1, pInterest: 0.1 }] } });
    expect(signer.sign).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "w1" })],
      expectation([stanceRecord(graphIdOf("noor"), 0.1, 0.1)]),
    );
    expect(takeInvitesNotice()).toEqual({
      kind: "signed",
      handle: "noor",
      landing: { pDirected: 0.1, pInterest: 0.1 },
    });
  });

  it(":33 an asker not fully registered is staged, the vouch kept, nothing signed, Invites at their row", async () => {
    const stage = stageHandler({ keyAttached: false });
    server.use(stage.handler);
    const signer = fakeWriteSigner();
    const pad = await openPad(signer);
    fireEvent.click(within(pad).getByTestId("vouchAsk.ask.stance.pad.set"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invites"));
    expect(signer.sign).not.toHaveBeenCalled();
    await waitFor(async () => expect(await listKeptPicks("acct-1")).toEqual([KEPT_NOOR]));
    expect(takeInvitesNotice()).toEqual({ kind: "notRegistered", handle: "noor" });
  });

  it(":27 a link turned unusable since the ask opened shows the case for its new state, nothing signed", async () => {
    let answer: Parameters<typeof askCheckAnswer>[0] = USABLE;
    server.use(
      meHandler("MEMBER"),
      myApplication(null),
      gqlLink.query("AskLinkCheck", () => HttpResponse.json(askCheckAnswer(answer))),
      gqlLink.mutation("StageApplicant", () => {
        answer = { usable: false, applicantHandle: "noor", reason: "LANDED" };
        return HttpResponse.json({
          data: {
            stageApplicant: {
              __typename: "StageApplicantPayload",
              application: null,
              userErrors: [userError("ASK_LINK_UNUSABLE")],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<VouchAskView id={ASK} />, { store: signedInStore(), writeSigner: signer });
    fireEvent.click(await screen.findByTestId("vouchAsk.ask.stance.anchor"));
    fireEvent.click(within(await screen.findByTestId("vouchAsk.ask.stance.pad")).getByTestId("vouchAsk.ask.stance.pad.set"));
    expect(await screen.findByTestId("vouchAsk.title")).toHaveTextContent("@noor is already in");
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it(":29 with the key elsewhere, Keep it pending stages the asker and keeps the vouch for Invites", async () => {
    const stage = stageHandler();
    server.use(stage.handler);
    const signer = fakeWriteSigner({ hasKey: () => Promise.resolve(false) });
    await openPad(signer);
    fireEvent.click(await screen.findByTestId("vouch-ask-keep-pending"));
    await waitFor(async () =>
      expect(await listKeptPicks("acct-1")).toEqual([KEPT_NOOR]),
    );
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it(":45 Cancel closes onto the ask, nothing signed, the ask still there", async () => {
    const signer = fakeWriteSigner();
    const pad = await openPad(signer);
    fireEvent.click(within(pad).getByTestId("vouchAsk.ask.stance.pad.cancel"));
    await waitFor(() => expect(screen.queryByTestId("vouchAsk.ask.stance.pad")).not.toBeInTheDocument());
    expect(screen.getByTestId("vouchAsk.ask")).toBeInTheDocument();
    expect(signer.sign).not.toHaveBeenCalled();
  });
});

describe("the dead ends (behavior/VouchAskInvalid.md, VouchAskUnusable.md)", () => {
  it("VouchAskInvalid.md:3-:9 an id resolving to nobody: no cause, no error colour, the back arrow only", async () => {
    asMember(null);
    expect(await screen.findByTestId("vouchAsk.title")).toHaveTextContent("This ask link doesn't work");
    expect(screen.getByTestId("vouchAsk.body")).toHaveTextContent(
      "Check that the whole link came through, or ask the person who sent it for it again.",
    );
    expect(document.body.innerHTML).not.toContain("text-error");
    expect(screen.getAllByRole("link")).toEqual([screen.getByTestId("vouchAsk.header.back")]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("VouchAskInvalid.md:3 the same for a guest", async () => {
    server.use(check(null));
    renderWithProviders(<VouchAskView id={ASK} />, { store: createTokenStore(), writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("vouchAsk.title")).toHaveTextContent("This ask link doesn't work");
  });

  it("VouchAskUnusable.md:11-:17 a landed asker: the heading, nobody else named, the profile door", async () => {
    asMember({ usable: false, applicantHandle: "noor", reason: "LANDED" });
    expect(await screen.findByTestId("vouchAsk.title")).toHaveTextContent("@noor is already in");
    expect(document.body.innerHTML).not.toContain("text-error");
    const door = screen.getByTestId("vouchAsk.profileDoor");
    expect(door).toHaveTextContent("See @noor's profile");
    fireEvent.click(door);
    expect(push).toHaveBeenCalledWith("/u/noor");
  });
});
