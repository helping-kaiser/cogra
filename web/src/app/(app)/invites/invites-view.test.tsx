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
  USED,
  userError,
  person,
  type ApplicationFixture,
  type LinkFixture,
  type PersonFixture,
} from "@/test/invites";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { detailRoot } from "@/app/shell";
import { backFor } from "@/lib/ui/back-origin";
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
    application({ handle: "rafa", createdAt: daysAgo(3), link: USED }),
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
    people?: PersonFixture[];
    from?: string | null;
    signer?: ReturnType<typeof fakeWriteSigner>;
  } = {},
) {
  const state = {
    queue: options.queue ?? boardQueue(),
    links: options.links ?? boardLinks(),
    people: options.people ?? [],
  };
  server.use(
    meHandler("MEMBER"),
    ...invitesHandler({ queue: () => state.queue, links: () => state.links, people: () => state.people }),
  );
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

  // :9 ALWAYS both sections stand whenever one of them holds something, a
  // section with nothing in it keeping its label; :11 invites.applicationsEmpty
  // reads No applications waiting. under invites.applicationsLabel GIVEN no
  // application waits and a link is live; :15 the quiet register, never the
  // error colour.
  it(":9 :11 :15 with no application waiting the half stands, its label over No applications waiting.", async () => {
    show({ queue: [] });
    const label = await screen.findByTestId("invites.applicationsLabel");
    expect(label).toHaveTextContent("Applications");
    const line = screen.getByTestId("invites.applicationsEmpty");
    expect(line).toHaveTextContent("No applications waiting.");
    expect(line).toHaveClass("text-body-medium", "text-on-surface-variant");
    expect(line.className).not.toContain("error");
    expect(label.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(screen.getByTestId("invites.linksLabel")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId("invites.link")).toHaveLength(2);
    expect(screen.queryByTestId("invites.linksEmpty")).toBeNull();
    expect(screen.queryByTestId("invites.empty")).toBeNull();
  });

  // :13 invites.linksEmpty reads No live links. under invites.linksLabel GIVEN
  // no link is live and an application waits.
  it(":9 :13 :15 with no live link the half stands, its label over No live links.", async () => {
    show({ links: [inviteLink({ id: "dead", usable: false })] });
    const label = await screen.findByTestId("invites.linksLabel");
    expect(label).toHaveTextContent("Live links");
    const line = screen.getByTestId("invites.linksEmpty");
    expect(line).toHaveTextContent("No live links.");
    expect(line).toHaveClass("text-body-medium", "text-on-surface-variant");
    expect(label.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("invites.link")).toBeNull();
    expect(screen.queryByTestId("invites.applicationsEmpty")).toBeNull();
    expect(rows()).toHaveLength(5);
  });

  // :59 WHEN tap a link's copy control GIVEN the copy does not go through ->
  // invites.link.copyFault reads That didn't go through. with Retry at its end,
  // the line last on that link's card AND the link stays whole AND NEVER Link
  // copied AND NEVER a dialog or notice; :61 WHEN tap its Retry -> the copy is
  // asked again AND the line leaves once the link lands.
  it(":59 :61 a copy that does not go through says so on its card, and Retry copies again", async () => {
    let fail = true;
    const writeText = vi.fn(() => (fail ? Promise.reject(new Error("denied")) : Promise.resolve()));
    Object.assign(navigator, { clipboard: { writeText } });
    show();
    const cards = await screen.findAllByTestId("invites.link");
    fireEvent.click(within(cards[0]).getByTestId("invites.link.copy"));
    const fault = await within(cards[0]).findByTestId("invites.link.copyFault");
    expect(fault).toHaveTextContent("That didn't go through. Retry");
    expect(cards[0].lastElementChild).toBe(fault);
    expect(within(cards[0]).getByTestId("invites.link.address")).toHaveTextContent(`/join/${SINGLE.id}`);
    expect(within(cards[1]).queryByTestId("invites.link.copyFault")).toBeNull();
    expect(screen.queryByTestId("invites-snackbar")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fail = false;
    fireEvent.click(within(fault).getByTestId("invites-copy-fault-retry"));
    await waitFor(() => expect(within(cards[0]).queryByTestId("invites.link.copyFault")).toBeNull());
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId("invites-snackbar")).toHaveTextContent("Link copied");
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
    expect(await screen.findByTestId("invites.empty")).toBeInTheDocument();
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
    server.use(meHandler("APPLICANT"), ...staticInvites([], []));
    renderWithProviders(<InvitesView from={null} />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

// The board's own people (Invites' `letIn` chip): Nadia 2d, Wren 5d, Juno 9d,
// Kel 12d, Tobias 16d — newest first, as `vouchedIn` serves them.
function boardPeople(count = 5): PersonFixture[] {
  return [
    person({ id: "b1a7ca95-9571-4509-9e42-d1c45c67b233", handle: "nadia", displayName: "Nadia Rask", vouchedAt: daysAgo(2) }),
    person({ id: "59959e13-ced7-462c-b7cd-c0381ec09b90", handle: "wren", displayName: "Wren Aliyev", vouchedAt: daysAgo(5) }),
    person({ id: "22dd3e59-8c50-4ce3-b2f5-e12c57abb984", handle: "juno", displayName: "Juno Baptiste", vouchedAt: daysAgo(9) }),
    person({ id: "c4fb60a5-9b66-4db3-a043-88986744abbc", handle: "kel", displayName: "Kel Moreau", vouchedAt: daysAgo(12) }),
    person({ id: "42fa3a4f-a350-4812-bd79-26561c2ffca3", handle: "tobias", displayName: "Tobias Lindqvist", vouchedAt: daysAgo(16) }),
  ].slice(0, count);
}

const peopleRows = () => screen.queryAllByTestId(/^invites\.(person|redactedPerson)$/);
const keyOf = (element: Element) => element.getAttribute("data-testid-key");
const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("People you let in (behavior/Invites.md)", () => {
  // :7 ALWAYS the page reads Applications, then Live links, in that order,
  // with People you let in between them GIVEN the reader has vouched someone in.
  it(":7 People you let in stands between Applications and Live links", async () => {
    show({ people: boardPeople(2) });
    const label = await screen.findByTestId("invites.peopleLabel");
    expect(label).toHaveTextContent("People you let in");
    expect(follows(screen.getByTestId("invites.applicationsLabel"), label)).toBe(true);
    expect(follows(rows().at(-1)!, label)).toBe(true);
    expect(follows(label, screen.getByTestId("invites.linksLabel"))).toBe(true);
  });

  // :9 ALWAYS the section People you let in is absent, its label with it,
  // GIVEN the reader has vouched no one in.
  it(":9 with no one let in the section is absent, label and all", async () => {
    show();
    await screen.findAllByTestId("invites.application");
    expect(screen.queryByTestId("invites.peopleLabel")).toBeNull();
    expect(peopleRows()).toHaveLength(0);
    expect(document.body.textContent).not.toContain("People you let in");
  });

  // :11 one row per person, the newest first, in the application row's
  // anatomy without its control: the picture, else the monogram from their
  // name; their display name, else their handle; the age, as 2d. :13 no
  // control of its own, and the chevron of a row that opens.
  it(":11 :13 one row per person, newest first: picture else monogram, name else handle, the age; no control, the chevron", async () => {
    show({
      people: [
        person({ id: "p-nadia", handle: "nadia", displayName: "Nadia Rask", vouchedAt: daysAgo(2), avatarUrl: "https://media.test/n.jpg" }),
        person({ id: "p-wren", handle: "wren", displayName: null, vouchedAt: daysAgo(5) }),
      ],
    });
    await screen.findByTestId("invites.peopleLabel");
    expect(peopleRows().map(keyOf)).toEqual(["p-nadia", "p-wren"]);
    const [nadia, wren] = peopleRows();
    expect(within(nadia).getByTestId("invites.person.title")).toHaveTextContent(/^Nadia Rask$/);
    expect(within(nadia).getByTestId("invites.person.trailing")).toHaveTextContent(/^2d$/);
    expect(within(nadia).getByTestId("invites.person.disc").querySelector("img")).toHaveAttribute(
      "src",
      "https://media.test/n.jpg",
    );
    // No written name: the handle, and the monogram from it.
    expect(within(wren).getByTestId("invites.person.title")).toHaveTextContent(/^@wren$/);
    expect(within(wren).getByTestId("invites.person.disc")).toHaveTextContent(/^W$/);
    expect(within(wren).getByTestId("invites.person.trailing")).toHaveTextContent(/^5d$/);
    for (const r of [nadia, wren]) {
      // No status line, no control: the row's one press is the row, chevron-marked.
      expect(within(r).queryByTestId("invites.person.second")).toBeNull();
      expect(within(r).getAllByRole("link")).toHaveLength(1);
      expect(within(r).queryByRole("button")).toBeNull();
      expect(within(r).getByTestId("invites.person.chevron")).toBeInTheDocument();
    }
  });

  // :15 ALWAYS three newest rows and under the third invites.peopleDoor, Show
  // all, an inline action under the rows GIVEN more than three let in.
  it(":15 past three, the three newest stand and Show all under the third", async () => {
    show({ people: boardPeople(5) });
    const door = await screen.findByTestId("invites.peopleDoor");
    expect(door).toHaveTextContent(/^Show all$/);
    expect(door.tagName).toBe("BUTTON");
    expect(peopleRows().map((r) => within(r).getByTestId("invites.person.title").textContent)).toEqual([
      "Nadia Rask",
      "Wren Aliyev",
      "Juno Baptiste",
    ]);
    expect(follows(peopleRows()[2], door)).toBe(true);
    expect(follows(door, screen.getByTestId("invites.linksLabel"))).toBe(true);
  });

  // :17 ALWAYS every row and no invites.peopleDoor GIVEN three or fewer.
  it(":17 at three or fewer every row stands and no door", async () => {
    show({ people: boardPeople(3) });
    await screen.findByTestId("invites.peopleLabel");
    expect(peopleRows()).toHaveLength(3);
    expect(screen.queryByTestId("invites.peopleDoor")).toBeNull();
  });

  // :19 WHEN tap invites.peopleDoor -> every person stands in the list, the
  // newest first, in place AND the door leaves AND NEVER anything else leaves
  // the page AND NEVER a control to show fewer appears.
  it(":19 Show all opens every row in place, the door leaves, nothing else does, no show fewer", async () => {
    show({ people: boardPeople(5) });
    const door = await screen.findByTestId("invites.peopleDoor");
    const before = {
      applications: rows().length,
      links: screen.getAllByTestId("invites.link").length,
    };
    fireEvent.click(door);
    expect(peopleRows().map(keyOf)).toEqual(boardPeople(5).map((p) => p.id));
    expect(screen.queryByTestId("invites.peopleDoor")).toBeNull();
    expect(rows()).toHaveLength(before.applications);
    expect(screen.getAllByTestId("invites.link")).toHaveLength(before.links);
    expect(screen.getByTestId("invites.create")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/show fewer|show less/i);
    expect(screen.getByTestId("invites.peopleLabel").parentElement?.querySelectorAll("button")).toHaveLength(0);
    // The door's press is not lost to the page: focus lands on the first row it opened.
    expect(document.activeElement).toBe(within(peopleRows()[3]).getByRole("link"));
  });

  // :21 ALWAYS New invite and People you let in, and neither Applications nor
  // Live links, their labels and empty lines with them, GIVEN no application
  // waits and no link is live and the reader has vouched someone in.
  // InvitesEmpty.md:5 ALWAYS the empty Invites never stands GIVEN the reader
  // has vouched someone in.
  it(":21, InvitesEmpty.md:5 with only people let in: New invite and the people, neither half, never the empty state", async () => {
    show({ queue: [], links: [inviteLink({ id: "dead", usable: false })], people: boardPeople(2) });
    expect(await screen.findByTestId("invites.peopleLabel")).toBeInTheDocument();
    expect(screen.getByTestId("invites.create")).toHaveTextContent("New invite");
    for (const id of ["applicationsLabel", "applicationsEmpty", "linksLabel", "linksEmpty", "empty"]) {
      expect(screen.queryByTestId(`invites.${id}`)).toBeNull();
    }
    expect(document.body.textContent).not.toMatch(/Applications|Live links|No invites out yet/);
    expect(peopleRows()).toHaveLength(2);
  });

  // :23 WHEN tap invites.person -> that person's profile opens AND its back
  // arrow reads Back to Invites (ProfileOther.md:73).
  it.each([
    [null, "/invites"],
    ["notifications", "/invites?from=notifications"],
  ])(":23 a row opens the person's profile, whose arrow reads Back to Invites (Invites opened from %s)", async (from, back) => {
    show({ people: boardPeople(1), from });
    const open = within((await screen.findAllByTestId("invites.person"))[0]).getByRole("link");
    const href = new URL(open.getAttribute("href")!, "http://localhost");
    expect(href.pathname).toBe("/u/nadia");
    const origin = href.searchParams.get("from");
    expect(backFor(origin)).toEqual({ href: back, label: "Back to Invites" });
    // A person let in opens in the Profile stack, as Invites itself stands there.
    expect(detailRoot(origin)).toBe("profile");
  });

  // :25 ALWAYS invites.redactedPerson keeps its place and its age, its disc
  // keeping its space and filled with nothing, its title reading Deleted
  // account in the system's voice and no handle under it GIVEN deleted.
  // :27 WHEN tap invites.redactedPerson -> the deleted account's page opens
  // AND its back arrow reads Back to Invites.
  it(":25 :27 a deleted account keeps its place and age, reads Deleted account, and opens its page", async () => {
    const people = boardPeople(3);
    people[1] = person({ id: "e5a3c2d8-7b14-4f9e-8c06-1d9b4a72f3e5", handle: "wren", redacted: true, vouchedAt: daysAgo(5), avatarUrl: "https://media.test/w.jpg" });
    show({ people });
    await screen.findByTestId("invites.peopleLabel");
    expect(peopleRows().map((r) => r.getAttribute("data-testid"))).toEqual([
      "invites.person",
      "invites.redactedPerson",
      "invites.person",
    ]);
    const gone = peopleRows()[1];
    expect(keyOf(gone)).toBe("e5a3c2d8-7b14-4f9e-8c06-1d9b4a72f3e5");
    const title = within(gone).getByTestId("invites.redactedPerson.title");
    expect(title).toHaveTextContent(/^Deleted account$/);
    expect(title).toHaveClass("text-on-surface-variant");
    expect(gone.textContent).not.toContain("wren");
    expect(within(gone).getByTestId("invites.redactedPerson.trailing")).toHaveTextContent(/^5d$/);
    const disc = within(gone).getByTestId("invites.redactedPerson.disc");
    expect(disc.querySelector("img")).toBeNull();
    expect(disc.textContent).toBe("");
    expect(within(gone).getByTestId("invites.redactedPerson.chevron")).toBeInTheDocument();
    const href = new URL(within(gone).getByRole("link").getAttribute("href")!, "http://localhost");
    expect(href.pathname).toBe("/u/wren");
    expect(backFor(href.searchParams.get("from"))).toEqual({ href: "/invites", label: "Back to Invites" });
  });

  // :93 WHEN a link's Revoke lands GIVEN no application waits and no other
  // link is live and the reader has vouched someone in -> New invite and People
  // you let in stand AND NEVER the empty Invites stands.
  it(":93 the last revoke with someone let in leaves New invite and the people, never the empty state", async () => {
    const { state } = show({ queue: [], links: [inviteLink()], people: boardPeople(1) });
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
    await waitFor(() => expect(screen.queryByTestId("invites.linksLabel")).toBeNull());
    expect(screen.getByTestId("invites.create")).toBeInTheDocument();
    expect(screen.getAllByTestId("invites.person")).toHaveLength(1);
    expect(screen.queryByTestId("invites.empty")).toBeNull();
  });
});

describe("the empty Invites (behavior/InvitesEmpty.md)", () => {
  it(":3-:13 the line, Create invite under it at full width, no error colour; Create opens the sheet", async () => {
    show({ queue: [], links: [] });
    const empty = await screen.findByTestId("invites.empty");
    expect(empty).toHaveTextContent(
      "No invites out yet. A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in.",
    );
    const create = screen.getByTestId("invites.empty.create");
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
    expect(within(sheet).getByTestId("invites.createSheet.options.footnote")).toHaveTextContent(
      "Either way each person still needs your approval, one at a time.",
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
    // Each length wears its registered key (nodes.json InviteExpiry).
    expect(
      within(chooser)
        .getAllByTestId("invites.expirySheet.expiryOption")
        .map((option) => option.getAttribute("data-testid-key")),
    ).toEqual(["24-hours", "7-days", "30-days"]);
    // InviteNew and InviteExpiry: the content stands right under the title, and
    // the lengths are a sheet of rows in their own 8px inset.
    expect(screen.getByTestId("invites-sheet-body").className).not.toMatch(/pt-2/);
    expect(screen.getByTestId("invites-expiry-body").className).not.toMatch(/px-6/);
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
    fireEvent.click(within(sheet).getByTestId("invites.createSheet.create"));
    await waitFor(() => expect(within(sheet).getByTestId("invites.createSheet.create")).toHaveTextContent("Creating invite…"));
    const created = await screen.findByRole("dialog", { name: "Your invite link" });
    expect(input).toEqual({ singleUse: false, expiresAt: new Date(NOW + 7 * 864e5).toISOString() });
    expect(within(created).getByTestId("invites.linkSheet.link")).toHaveTextContent(`${window.location.origin}/join/fresh`);
    expect(within(created).getByTestId("invites.linkSheet.share")).toHaveTextContent("Share link");
    expect(created.textContent).not.toMatch(/token/i);
  });

  it("InviteNew.md:23 a create that does not go through answers in the fault's grammar and keeps the choices", async () => {
    show();
    server.use(gqlLink.mutation("CreateInviteLink", () => HttpResponse.error()));
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("switch"));
    fireEvent.click(within(sheet).getByTestId("invites.createSheet.create"));
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
    fireEvent.click(within(sheet).getByTestId("invites.createSheet.create"));
    fireEvent.click(await screen.findByTestId("invites.linkSheet.share"));
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
      "Vouching is the act. Set signs your opinion on @rafa and brings them in.It is one signed, priced act.",
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
      "It leaves your list and @imke is told. Their account stays as it is.",
    );
    expect(within(dialog).getByTestId("invites.dialog.body")).toHaveTextContent(
      "Any member can still vouch them in, and @imke gets a link to ask with.",
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
    await waitFor(() => expect(screen.queryByTestId("invites.dialog")).not.toBeInTheDocument(), { timeout: 4000 });
    await waitFor(() => expect(row("imke")).toBeUndefined(), { timeout: 4000 });
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
