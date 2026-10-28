// Invites, line by line: behavior/Invites.md, InvitesEmpty.md, InviteNew.md,
// InviteCreated.md, InviteExpiry.md, ApprovePad.md, RejectConfirm.md and
// RejectAllConfirm.md compiled into view-level tests. Every mutation is mocked
// (MSW) and the signer is the fake: nothing here signs, approves, closes or
// creates anything anywhere real.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { carryToInvites } from "@/lib/invites/invites-notice";
import { EMPTY_SIGN_WORDS } from "@/lib/ui/empty-sign-confirm";
import { createTokenStore } from "@/lib/session/token-store";
import { expectation, stanceRecord } from "@/lib/signing/intent";
import { keepPick, listKeptPicks } from "@/lib/stance/kept-picks";
import { writeStanceTaught } from "@/lib/stance/stance-coach";
import {
  application,
  approveAnswer,
  daysAgo,
  graphIdOf,
  inviteLink,
  invitesHandler,
  linkNode,
  MANY,
  meHandler,
  NOW,
  SINGLE,
  staticInvites,
  userError,
  type ApplicationFixture,
  type LinkFixture,
} from "@/test/invites";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { InvitesView } from "./invites-view";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  usePathname: () => "/invites",
  useSearchParams: () => new URLSearchParams(),
}));

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/** The board's own queue: @imke (9d, not ready), three vora rows, @rafa ready. */
function boardQueue(): ApplicationFixture[] {
  return [
    application({ handle: "rafa", createdAt: daysAgo(3), link: SINGLE }),
    application({ handle: "vora81", createdAt: daysAgo(1.2), link: MANY, keyAttached: false }),
    application({ handle: "imke", createdAt: daysAgo(9), link: MANY, emailVerified: false }),
    application({ handle: "vora82", createdAt: daysAgo(1.1), link: MANY, keyAttached: false }),
    application({ handle: "vora83", createdAt: daysAgo(1), link: MANY, keyAttached: false }),
  ];
}

function boardLinks(): LinkFixture[] {
  return [
    inviteLink({ id: SINGLE.id, singleUse: true }),
    inviteLink({ id: MANY.id, singleUse: false, expiresAt: new Date(NOW + 2 * 864e5).toISOString() }),
    inviteLink({ id: "dead", usable: false }),
  ];
}

function show(
  options: {
    queue?: ApplicationFixture[];
    links?: LinkFixture[];
    from?: string | null;
    signer?: ReturnType<typeof fakeWriteSigner>;
  } = {},
) {
  const state = { queue: options.queue ?? boardQueue(), links: options.links ?? boardLinks() };
  server.use(meHandler("MEMBER"), invitesHandler({ queue: () => state.queue, links: () => state.links }));
  const signer = options.signer ?? fakeWriteSigner();
  renderWithProviders(<InvitesView from={options.from ?? null} now={() => NOW} />, {
    store: signedInStore(),
    writeSigner: signer,
  });
  return { state, signer };
}

const rows = () => screen.queryAllByTestId("invites.application");
const row = (handle: string) =>
  rows().find((element) => element.getAttribute("data-testid-key") === handle) as HTMLElement;
const rowPress = (handle: string) => within(row(handle)).getByTestId(`invites-application-app-${handle}-open`);

beforeEach(() => {
  window.localStorage.clear();
  writeStanceTaught();
  push.mockReset();
  replace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Invites (behavior/Invites.md)", () => {
  it(":3-:23 New invite heads, Applications then Live links, groups by link and age, never by readiness", async () => {
    show();
    expect(await screen.findByTestId("invites.create")).toHaveTextContent("New invite");
    const page = document.body.textContent ?? "";
    expect(page.indexOf("Applications")).toBeLessThan(page.indexOf("Live links"));
    // :9 groups labelled by link and count; :11 groups by their oldest row.
    const groups = screen.getAllByTestId("invites.group.label").map((e) => e.textContent);
    expect(groups).toEqual(["Many uses · 4 waiting", "Single use · 1 waiting"]);
    // :11, :13 — @imke is oldest and not ready, and still stands first.
    expect(rows().map((e) => e.getAttribute("data-testid-key"))).toEqual([
      "imke",
      "vora81",
      "vora82",
      "vora83",
      "rafa",
    ]);
    // :19 the handle alone; :21 the reader's fact, never the missing proof.
    expect(within(row("imke")).getByTestId("invites.application.title")).toHaveTextContent("@imke");
    expect(within(row("imke")).getByTestId("invites.application.second")).toHaveTextContent(
      "Not fully registered yet",
    );
    expect(within(row("rafa")).getByTestId("invites.application.second")).toHaveTextContent(
      "Ready for your approval",
    );
    expect(within(row("imke")).getByTestId("invites.application.trailing")).toHaveTextContent("9d");
    // :23 every row's close, named with its handle.
    expect(within(row("imke")).getByTestId("invites.application.close")).toHaveAccessibleName(
      "Close @imke's application",
    );
  });

  it(":15-:17 Close all stands past one waiting and only there", async () => {
    show();
    const closes = await screen.findAllByTestId("invites.group.close");
    expect(closes).toHaveLength(1);
    expect(closes[0]).toHaveAccessibleName("Close all 4 applications from this link");
    expect(closes[0].getAttribute("data-testid-key")).toBe(MANY.id);
  });

  it(":27-:33 a live link's card holds the link whole; dead links never stand; no token, no reward", async () => {
    show();
    const cards = await screen.findAllByTestId("invites.link");
    expect(cards.map((c) => c.getAttribute("data-testid-key"))).toEqual([SINGLE.id, MANY.id]);
    const single = cards[0];
    expect(within(single).getByTestId("invites.link.label")).toHaveTextContent("Single use · not used yet");
    expect(within(single).getByTestId("invites.link.address")).toHaveTextContent(
      `${window.location.origin}/join/${SINGLE.id}`,
    );
    expect(within(single).getByTestId("invites.link.caption")).toHaveTextContent(/^Expires in 7 days · /);
    expect(within(single).getByTestId("invites.link.copy")).toHaveAccessibleName("Copy the link");
    expect(within(single).getByTestId("invites.link.action")).toHaveTextContent("Revoke");
    expect(within(cards[1]).getByTestId("invites.link.label")).toHaveTextContent("Many uses");
    expect(document.body.textContent).not.toMatch(/token/i);
    expect(document.body.textContent).not.toMatch(/reward/i);
  });

  it(":37 New invite opens the create sheet", async () => {
    show();
    fireEvent.click(await screen.findByTestId("invites.create"));
    expect(await screen.findByRole("dialog", { name: "New invite" })).toBeInTheDocument();
  });

  it(":39 a not-ready row answers with the snackbar and never opens the pad", async () => {
    show();
    await screen.findAllByTestId("invites.application");
    fireEvent.click(rowPress("imke"));
    expect(await screen.findByTestId("invites-snackbar")).toHaveTextContent(
      "@imke has to finish registering before you can approve",
    );
    expect(screen.queryByTestId("invites.application.stance.pad")).not.toBeInTheDocument();
  });

  it(":43 a row's close raises its dialog; :45 Close all raises the group's", async () => {
    show();
    await screen.findAllByTestId("invites.application");
    fireEvent.click(within(row("imke")).getByTestId("invites.application.close"));
    expect(await screen.findByTestId("invites.dialog.title")).toHaveTextContent("Close @imke's application?");
    fireEvent.click(screen.getByTestId("invites.dialog.keep"));
    fireEvent.click(screen.getByTestId("invites.group.close"));
    expect(await screen.findByTestId("invites.dialog.title")).toHaveTextContent(
      "Close all 4 applications from this link?",
    );
  });

  it(":47 the copy control lands the link on the clipboard with Link copied", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    show();
    const cards = await screen.findAllByTestId("invites.link");
    fireEvent.click(within(cards[0]).getByTestId("invites.link.copy"));
    expect(await screen.findByTestId("invites-snackbar")).toHaveTextContent("Link copied");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/${SINGLE.id}`);
  });

  it(":49-:53 revoke asks nothing, waits as Revoking… past 200ms, then the card leaves with Invite revoked", async () => {
    let calls = 0;
    const { state } = show();
    server.use(
      gqlLink.mutation("RevokeInviteLink", async () => {
        calls += 1;
        await delay(400);
        state.links = state.links.filter((l) => l.id !== SINGLE.id);
        return HttpResponse.json({
          data: {
            revokeInviteLink: {
              __typename: "RevokeInviteLinkPayload",
              inviteLink: { __typename: "InviteLink", id: SINGLE.id, revokedAt: daysAgo(0) },
              userErrors: [],
            },
          },
        });
      }),
    );
    const cards = await screen.findAllByTestId("invites.link");
    const revoke = within(cards[0]).getByTestId("invites.link.action");
    fireEvent.click(revoke);
    fireEvent.click(revoke);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(revoke).toHaveTextContent("Revoking…"));
    expect(revoke).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.getAllByTestId("invites.link")).toHaveLength(1));
    expect(screen.getByTestId("invites-snackbar")).toHaveTextContent("Invite revoked");
    expect(screen.getByTestId("invites-snackbar")).not.toHaveTextContent("Undo");
    expect(calls).toBe(1);
  });

  it(":57 the last revoke stands the empty Invites", async () => {
    const { state } = show({ queue: [], links: [inviteLink()] });
    server.use(
      gqlLink.mutation("RevokeInviteLink", () => {
        state.links = [];
        return HttpResponse.json({
          data: {
            revokeInviteLink: {
              __typename: "RevokeInviteLinkPayload",
              inviteLink: { __typename: "InviteLink", id: SINGLE.id, revokedAt: daysAgo(0) },
              userErrors: [],
            },
          },
        });
      }),
    );
    fireEvent.click(await screen.findByTestId("invites.link.action"));
    expect(await screen.findByTestId("invites-empty")).toBeInTheDocument();
  });

  it(":59 a revoke that does not go through keeps the card and answers in the network fault's grammar", async () => {
    show();
    server.use(gqlLink.mutation("RevokeInviteLink", () => HttpResponse.error()));
    const cards = await screen.findAllByTestId("invites.link");
    fireEvent.click(within(cards[0]).getByTestId("invites.link.action"));
    expect(await screen.findByTestId("invites-revoke-failed")).toHaveTextContent("Can't reach the server");
    expect(screen.getAllByTestId("invites.link")).toHaveLength(2);
  });

  it(":71-:75 an ask-link row heads Applications; kept with the key elsewhere it reads Waiting for your key", async () => {
    await keepPick("acct-1", { kind: "profile", id: "app-noor" }, { pDirected: 0.3, pInterest: 0.2 }, "approval");
    show({
      queue: [...boardQueue(), application({ handle: "noor", link: null, createdAt: daysAgo(2) })],
      signer: fakeWriteSigner({ hasKey: () => Promise.resolve(false) }),
    });
    await screen.findAllByTestId("invites.application");
    expect(rows()[0].getAttribute("data-testid-key")).toBe("noor");
    await waitFor(() =>
      expect(within(row("noor")).getByTestId("invites.application.second")).toHaveTextContent(
        "Waiting for your key",
      ),
    );
  });

  it(":73-:75 with the key back the kept approval reads Ready for your approval", async () => {
    await keepPick("acct-1", { kind: "profile", id: "app-noor" }, { pDirected: 0.3, pInterest: 0.2 }, "approval");
    show({ queue: [application({ handle: "noor", link: null })] });
    await screen.findAllByTestId("invites.application");
    expect(within(row("noor")).getByTestId("invites.application.second")).toHaveTextContent(
      "Ready for your approval",
    );
  });

  it(":89 closing a kept approval drops the kept vouch and signs nothing", async () => {
    await keepPick("acct-1", { kind: "profile", id: "app-noor" }, { pDirected: 0.3, pInterest: 0.2 }, "approval");
    const { state, signer } = show({ queue: [application({ handle: "noor", link: null })] });
    server.use(
      gqlLink.mutation("RejectApplication", () => {
        state.queue = [];
        return HttpResponse.json({
          data: {
            rejectApplication: {
              __typename: "RejectApplicationPayload",
              application: { __typename: "Application", id: "app-noor", rejectedAt: daysAgo(0) },
              userErrors: [],
            },
          },
        });
      }),
    );
    await screen.findAllByTestId("invites.application");
    fireEvent.click(within(row("noor")).getByTestId("invites.application.close"));
    fireEvent.click(await screen.findByTestId("invites.dialog.close"));
    await waitFor(() => expect(rows()).toHaveLength(0));
    await waitFor(async () => expect(await listKeptPicks("acct-1")).toEqual([]));
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it(":93 an ask link's arrival for a member already holding the asker says so on Invites", async () => {
    carryToInvites({ kind: "alreadyWaiting", handle: "noor" });
    show({ queue: [application({ handle: "noor", link: null })] });
    expect(await screen.findByTestId("invites-snackbar")).toHaveTextContent(
      "@noor is already waiting in your invites.",
    );
  });

  it.each([
    [null, "/profile", "Back to your profile"],
    ["notifications", "/notifications", "Back to Notifications"],
    ["kept-picks", "/kept-picks", "Back to Kept picks"],
  ])(":95-:97 the back arrow names its door (from %s)", async (from, href, label) => {
    show({ from });
    const back = await screen.findByTestId("invites.header.back");
    expect(back).toHaveAttribute("href", href);
    expect(back).toHaveAccessibleName(label);
  });

  it("never stands for an applicant: they land where app-open lands (ProfileApplicant.md:18)", async () => {
    server.use(meHandler("APPLICANT"), staticInvites([], []));
    renderWithProviders(<InvitesView from={null} />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("the empty Invites (behavior/InvitesEmpty.md)", () => {
  it(":3-:13 the line, Create invite under it at full width, no error colour; Create opens the sheet", async () => {
    show({ queue: [], links: [] });
    const empty = await screen.findByTestId("invites-empty");
    expect(empty).toHaveTextContent(
      "No invites out yet. A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in.",
    );
    const create = screen.getByTestId("invites-empty-create");
    expect(create).toHaveTextContent("Create invite");
    expect(create.className).toContain("w-full");
    expect(empty.innerHTML).not.toContain("text-error");
    expect(screen.getByTestId("invites.header.back")).toHaveAccessibleName("Back to your profile");
    fireEvent.click(create);
    expect(await screen.findByRole("dialog", { name: "New invite" })).toBeInTheDocument();
  });
});

describe("the create sheet (behavior/InviteNew.md, InviteExpiry.md, InviteCreated.md)", () => {
  async function openSheet() {
    fireEvent.click(await screen.findByTestId("invites.create"));
    return screen.findByRole("dialog", { name: "New invite" });
  }

  it("InviteNew.md:3-:11 two choices and nothing else: single use on, 7 days, the footnote", async () => {
    show();
    const sheet = await openSheet();
    expect(within(sheet).getByRole("switch", { name: /Only one person can use it/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(sheet).getByRole("button", { name: /Expires after/ })).toHaveTextContent("7 days");
    expect(within(sheet).getByTestId("invites-sheet-footnote")).toHaveTextContent(
      "With it off, anyone holding the link can apply until it expires. Either way each person still needs your approval, one at a time.",
    );
    // :5 no opinion control.
    expect(within(sheet).queryByRole("slider")).not.toBeInTheDocument();
    expect(sheet.textContent).not.toMatch(/opinion/i);
  });

  it("InviteExpiry.md:5-:9 three lengths, one selected, a tap picks and closes with no Done", async () => {
    show();
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: /Expires after/ }));
    const chooser = await screen.findByRole("dialog", { name: "Expires after" });
    const radios = within(chooser).getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual(["24 hours", "7 days", "30 days"]);
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
    expect(within(chooser).queryByText("Done")).not.toBeInTheDocument();
    fireEvent.click(radios[2]);
    await waitFor(() =>
      expect(within(sheet).getByRole("button", { name: /Expires after/ })).toHaveTextContent("30 days"),
    );
  });

  it("InviteNew.md:15-:21, InviteCreated.md:3-:9 create with the staged choices, Creating invite… past 200ms, then the fresh link", async () => {
    let input: Record<string, unknown> | null = null;
    show();
    server.use(
      gqlLink.mutation("CreateInviteLink", async ({ variables }) => {
        input = (variables as { input: Record<string, unknown> }).input;
        await delay(400);
        return HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: linkNode(inviteLink({ id: "fresh", singleUse: false })),
              userErrors: [],
            },
          },
        });
      }),
    );
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("switch"));
    fireEvent.click(within(sheet).getByTestId("invites-sheet-create"));
    await waitFor(() => expect(within(sheet).getByTestId("invites-sheet-create")).toHaveTextContent("Creating invite…"));
    const created = await screen.findByRole("dialog", { name: "Your invite link" });
    expect(input).toEqual({ singleUse: false, expiresAt: new Date(NOW + 7 * 864e5).toISOString() });
    expect(within(created).getByTestId("invites-sheet-link")).toHaveTextContent(`${window.location.origin}/join/fresh`);
    expect(within(created).getByTestId("invites-sheet-share")).toHaveTextContent("Share link");
    expect(created.textContent).not.toMatch(/token/i);
  });

  it("InviteNew.md:23 a create that does not go through answers in the fault's grammar and keeps the choices", async () => {
    show();
    server.use(gqlLink.mutation("CreateInviteLink", () => HttpResponse.error()));
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("switch"));
    fireEvent.click(within(sheet).getByTestId("invites-sheet-create"));
    expect(await within(sheet).findByTestId("invites-sheet-failed")).toHaveTextContent("Can't reach the server");
    expect(within(sheet).getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("InviteCreated.md:17 Share link with no platform sheet copies, with Link copied", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText }, share: undefined });
    show();
    server.use(
      gqlLink.mutation("CreateInviteLink", () =>
        HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: linkNode(inviteLink({ id: "fresh" })),
              userErrors: [],
            },
          },
        }),
      ),
    );
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByTestId("invites-sheet-create"));
    fireEvent.click(await screen.findByTestId("invites-sheet-share"));
    expect(await screen.findByTestId("invites-snackbar")).toHaveTextContent("Link copied");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/fresh`);
  });
});

describe("the approval pad (behavior/ApprovePad.md)", () => {
  async function openPad(signer = fakeWriteSigner()) {
    const shown = show({ signer });
    await screen.findAllByTestId("invites.application");
    fireEvent.click(rowPress("rafa"));
    const pad = await screen.findByTestId("invites.application.stance.pad");
    return { ...shown, pad };
  }

  it(":5 approving is vouching — never a button labelled Approve, never sliders", async () => {
    await openPad();
    expect(screen.queryByText(/Approve and vouch/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });

  it(":9, :15-:19 no Walk it back; the close's slot holds the anchor; the two lines; ? named How vouching works", async () => {
    const { pad } = await openPad();
    expect(within(pad).queryByText(/Walk it/)).not.toBeInTheDocument();
    expect(within(row("rafa")).queryByTestId("invites.application.close")).not.toBeInTheDocument();
    expect(within(row("rafa")).getByTestId("invites.application.stance.anchor")).toBeInTheDocument();
    expect(within(pad).getByTestId("invites.application.stance.pad.note")).toHaveTextContent(
      "Vouching is the act. Set signs your opinion on @rafa and brings them in.It is one signed, priced act — and it is theirs to answer: their opinion back completes the pair.",
    );
    expect(within(pad).getByTestId("invites.application.stance.pad.help")).toHaveAccessibleName(
      "How vouching works",
    );
  });

  it(":21-:23 the ? replaces the body in place, Set disabled; Back to the pad returns it", async () => {
    const { pad } = await openPad();
    fireEvent.click(within(pad).getByTestId("invites.application.stance.pad.help"));
    expect(pad).toHaveTextContent(
      "A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in.",
    );
    expect(pad).toHaveTextContent("Nothing is signed until Set.");
    expect(within(pad).getByTestId("invites.application.stance.pad.set")).toBeDisabled();
    fireEvent.click(screen.getByTestId("invites-approve-app-rafa-explain-back"));
    expect(within(pad).getByTestId("invites.application.stance.pad.note")).toBeInTheDocument();
  });

  it(":29 Cancel closes onto Invites, nothing signed, still waiting", async () => {
    const { pad, signer } = await openPad();
    fireEvent.click(within(pad).getByTestId("invites.application.stance.pad.cancel"));
    await waitFor(() => expect(screen.queryByTestId("invites.application.stance.pad")).not.toBeInTheDocument());
    expect(signer.sign).not.toHaveBeenCalled();
    expect(row("rafa")).toBeInTheDocument();
    expect(within(row("rafa")).getByTestId("invites.application.close")).toBeInTheDocument();
  });

  it(":7, :33-:37 Set at the standing default signs +0.10 / +0.10 toward the applicant, the row leaves, Signed snackbar", async () => {
    let variables: unknown = null;
    const { state, pad, signer } = await openPad();
    server.use(
      gqlLink.mutation("ApproveApplicants", ({ variables: v }) => {
        variables = v;
        state.queue = state.queue.filter((a) => a.handle !== "rafa");
        return HttpResponse.json(approveAnswer());
      }),
    );
    fireEvent.click(within(pad).getByTestId("invites.application.stance.pad.set"));
    await waitFor(() => expect(row("rafa")).toBeUndefined());
    expect(variables).toEqual({
      input: { approvals: [{ application: "app-rafa", pDirected: 0.1, pInterest: 0.1 }] },
    });
    expect(signer.sign).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "w1" })],
      expectation([stanceRecord(graphIdOf("rafa"), 0.1, 0.1)]),
    );
    expect(screen.getByTestId("invites-snackbar")).toHaveTextContent("Signed, still settling. Current opinion");
  });

  it(":43-:45 Set at exactly (0, 0) asks the empty sign with its vouch-in warning; Set it anyway is the act", async () => {
    let variables: unknown = null;
    const { pad } = await openPad();
    server.use(
      gqlLink.mutation("ApproveApplicants", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json(approveAnswer());
      }),
    );
    const square = within(pad).getByTestId("invites.application.stance.pad.field.square");
    for (const key of ["ArrowLeft", "ArrowLeft", "ArrowDown", "ArrowDown"]) fireEvent.keyDown(square, { key });
    fireEvent.click(within(pad).getByTestId("invites.application.stance.pad.set"));
    const ask = await screen.findByTestId("empty-sign-confirm");
    expect(screen.queryByTestId("severance-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-sign-effect")).toHaveTextContent(/@rafa/);
    expect(screen.getByTestId("empty-sign-effect").textContent).toBe(
      EMPTY_SIGN_WORDS.vouchIn("@rafa"),
    );
    expect(variables).toBeNull();
    await act(async () => {
      fireEvent.click(within(ask).getByTestId("empty-sign-proceed"));
    });
    await waitFor(() => expect(variables).not.toBeNull());
    const approval = (variables as { input: { approvals: { pDirected: number; pInterest: number }[] } }).input
      .approvals[0];
    expect(approval.pDirected + 0).toBe(0);
    expect(approval.pInterest + 0).toBe(0);
  });

  it(":47 a signing that does not go through keeps the pad at the pick with the line and Retry", async () => {
    const { pad } = await openPad();
    server.use(gqlLink.mutation("ApproveApplicants", () => HttpResponse.error()));
    fireEvent.click(within(pad).getByTestId("invites.application.stance.pad.set"));
    expect(await screen.findByTestId("invites-approve-app-rafa-pad-failed")).toHaveTextContent(
      "That didn't send. Try again.",
    );
    expect(within(pad).getByTestId("invites.application.stance.pad.set")).toHaveTextContent("Retry");
  });

  it(":49 the write rule's refusal is the notice, with Not now, nothing signed", async () => {
    const { pad, signer } = await openPad();
    server.use(
      gqlLink.mutation("ApproveApplicants", () =>
        HttpResponse.json({
          data: {
            approveApplicants: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [userError("WRITE_RULE_FAILED")],
            },
          },
        }),
      ),
    );
    fireEvent.click(within(pad).getByTestId("invites.application.stance.pad.set"));
    expect(await screen.findByTestId("invites-approve-app-rafa-write-rule")).toHaveTextContent(
      "You can't sign right now",
    );
    expect(screen.getByTestId("invites-approve-app-rafa-not-now")).toBeInTheDocument();
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it(":39 with the key elsewhere the pad carries the key notice and signs nothing", async () => {
    const { signer } = await openPad(fakeWriteSigner({ hasKey: () => Promise.resolve(false) }));
    expect(await screen.findByTestId("invites-approve-app-rafa-key-absent")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("invites-approve-app-rafa-keep-pending"));
    await waitFor(async () =>
      expect(await listKeptPicks("acct-1")).toEqual([
        expect.objectContaining({
          family: "approval",
          target: { kind: "profile", id: "app-rafa" },
          pick: { pDirected: 0.1, pInterest: 0.1 },
        }),
      ]),
    );
    expect(signer.sign).not.toHaveBeenCalled();
  });
});

describe("the closing dialogs (behavior/RejectConfirm.md, RejectAllConfirm.md)", () => {
  function rejectHandler(state: { queue: ApplicationFixture[] }, onCall?: () => Promise<void>) {
    return gqlLink.mutation("RejectApplication", async ({ variables }) => {
      await onCall?.();
      const id = (variables as { input: { application: string } }).input.application;
      state.queue = state.queue.filter((a) => a.id !== id);
      return HttpResponse.json({
        data: {
          rejectApplication: {
            __typename: "RejectApplicationPayload",
            application: { __typename: "Application", id, rejectedAt: daysAgo(0) },
            userErrors: [],
          },
        },
      });
    });
  }

  it("RejectConfirm.md:3-:11 the dialog's words; Close it quiet on the left, Keep it filled on the right; no error colour", async () => {
    show();
    await screen.findAllByTestId("invites.application");
    fireEvent.click(within(row("imke")).getByTestId("invites.application.close"));
    const dialog = await screen.findByTestId("invites.dialog");
    expect(within(dialog).getByTestId("invites.dialog.title")).toHaveTextContent("Close @imke's application?");
    expect(within(dialog).getByTestId("invites.dialog.body")).toHaveTextContent(
      "It leaves your list and @imke is told. Their account stays exactly as it is — signed in, and free to keep reading.",
    );
    expect(within(dialog).getByTestId("invites.dialog.body")).toHaveTextContent(
      "This is your call and nobody else's. Any member can still vouch them in, and @imke gets a link to ask with.",
    );
    const [first, second] = within(dialog).getAllByRole("button");
    expect(first).toHaveTextContent("Close it");
    expect(second).toHaveTextContent("Keep it");
    expect(dialog.innerHTML).not.toContain("text-error");
    expect(dialog.textContent).not.toMatch(/delete|reject/i);
  });

  it("RejectConfirm.md:15-:19 Close it waits as Closing it… past 200ms, refuses a second press, then the row leaves", async () => {
    let calls = 0;
    const { state } = show();
    server.use(
      rejectHandler(state, async () => {
        calls += 1;
        await delay(400);
      }),
    );
    await screen.findAllByTestId("invites.application");
    fireEvent.click(within(row("imke")).getByTestId("invites.application.close"));
    const close = await screen.findByTestId("invites.dialog.close");
    fireEvent.click(close);
    fireEvent.click(close);
    await waitFor(() => expect(close).toHaveTextContent("Closing it…"));
    expect(close).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.queryByTestId("invites.dialog")).not.toBeInTheDocument());
    expect(row("imke")).toBeUndefined();
    expect(calls).toBe(1);
  });

  it("RejectConfirm.md:23 a closing that does not go through keeps the dialog, the line, and Retry", async () => {
    show();
    server.use(gqlLink.mutation("RejectApplication", () => HttpResponse.error()));
    await screen.findAllByTestId("invites.application");
    fireEvent.click(within(row("imke")).getByTestId("invites.application.close"));
    fireEvent.click(await screen.findByTestId("invites.dialog.close"));
    expect(await screen.findByTestId("invites-dialog-failed")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("invites.dialog.close")).toHaveTextContent("Retry");
    expect(row("imke")).toBeInTheDocument();
  });

  it("RejectConfirm.md:25-:27 Keep it, and Escape, close the dialog with nothing closed", async () => {
    let calls = 0;
    show();
    server.use(
      gqlLink.mutation("RejectApplication", () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );
    await screen.findAllByTestId("invites.application");
    fireEvent.click(within(row("imke")).getByTestId("invites.application.close"));
    fireEvent.click(await screen.findByTestId("invites.dialog.keep"));
    expect(screen.queryByTestId("invites.dialog")).not.toBeInTheDocument();
    fireEvent.click(within(row("imke")).getByTestId("invites.application.close"));
    fireEvent(await screen.findByTestId("invites.dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByTestId("invites.dialog")).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("RejectAllConfirm.md:3-:23 the count in the title, no handles, Close them sweeps every waiting row at once", async () => {
    let link: unknown = null;
    const { state } = show();
    server.use(
      gqlLink.mutation("RejectLinkApplications", ({ variables }) => {
        link = (variables as { input: { inviteLink: string } }).input.inviteLink;
        state.queue = state.queue.filter((a) => a.link?.id !== MANY.id);
        return HttpResponse.json({
          data: {
            rejectLinkApplications: {
              __typename: "RejectLinkApplicationsPayload",
              rejectedCount: 4,
              userErrors: [],
            },
          },
        });
      }),
    );
    fireEvent.click(await screen.findByTestId("invites.group.close"));
    const dialog = await screen.findByTestId("invites.dialog");
    expect(within(dialog).getByTestId("invites.dialog.title")).toHaveTextContent(
      "Close all 4 applications from this link?",
    );
    expect(within(dialog).getByTestId("invites.dialog.body")).toHaveTextContent(
      "All four leave your list and all four people are told.",
    );
    expect(dialog.textContent).not.toMatch(/@/);
    expect(within(dialog).getByTestId("invites.dialog.close")).toHaveTextContent("Close them");
    expect(within(dialog).getByTestId("invites.dialog.keep")).toHaveTextContent("Keep them");
    fireEvent.click(within(dialog).getByTestId("invites.dialog.close"));
    await waitFor(() => expect(rows().map((r) => r.getAttribute("data-testid-key"))).toEqual(["rafa"]));
    expect(link).toBe(MANY.id);
  });

  it("RejectAllConfirm.md:27 a sweep that does not go through keeps the group whole, with Retry", async () => {
    show();
    server.use(gqlLink.mutation("RejectLinkApplications", () => HttpResponse.error()));
    fireEvent.click(await screen.findByTestId("invites.group.close"));
    fireEvent.click(await screen.findByTestId("invites.dialog.close"));
    expect(await screen.findByTestId("invites-dialog-failed")).toBeInTheDocument();
    expect(screen.getByTestId("invites.dialog.close")).toHaveTextContent("Retry");
    expect(rows()).toHaveLength(5);
  });
});
