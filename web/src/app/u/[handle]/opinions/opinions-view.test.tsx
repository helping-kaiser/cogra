import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { byNode } from "@/test/data-node";
import { opinionGiven, opinionRecord, userOpinions } from "@/test/inbound";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { OpinionsScreen } from "./opinions-view";

// THE OPINIONS PAGE (behavior/ProfileStances.md, every line; ProfileStances.jsx).
// Reads only: the page signs nothing.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const server = startMswServer();

function moderated(value: string | null, status = "NORMAL") {
  return { __typename: "ModeratedText", value, status };
}

function user(id: string, handle: string, redacted = false) {
  return {
    __typename: "User",
    id,
    handle,
    displayName: redacted ? moderated(null, "REDACTED") : moderated("Ada Okonkwo"),
    bio: moderated(null),
    websiteUrl: moderated(null),
    viewerBookmarkedAt: null,
  };
}

/** The profile the page is under, read by handle. */
function theirProfile(id = "u-ada", handle = "ada", redacted = false) {
  return gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: user(id, handle, redacted) } }));
}

function me(id: string, handle: string) {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id,
          handle,
          displayName: { __typename: "ModeratedText", value: null },
          accountState: "MEMBER",
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

function myProfile(id = "u-me", handle = "me") {
  return gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: user(id, handle) } }));
}

function signedInStore(accountId = "u-me") {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId });
  return store;
}

/** The board's own five (ProfileStances.jsx), drawn in a scrambled arrival order. */
function theBoardsFive() {
  return [
    opinionRecord("juno", -0.2, 0.1, { displayName: "Juno Baptiste" }),
    opinionRecord("kel", 0, 0.35, { displayName: "Kel Moreau" }),
    opinionRecord("tobias", 0.7, 0.4, { displayName: "Tobias Lindqvist" }),
    opinionRecord("mira", 0.4, 0.5, { displayName: "Mira Voss" }),
    opinionRecord("sol", 0.6, 0.3, { displayName: "Sol Ferreira" }),
  ];
}

function rowNames() {
  return screen.getAllByTestId(byNode("profileStances.row.name")).map((el) => el.textContent);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/u/ada/opinions");
});

describe("OpinionsScreen", () => {
  it("is titled with the person's handle and Opinions (ProfileStances.md:3)", async () => {
    server.use(theirProfile(), userOpinions("on", [[]]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    expect(await screen.findByRole("heading", { name: "@ada · Opinions" })).toBeInTheDocument();
  });

  it("stands the two directions on two tabs named in words, On them and By them (:5, :7)", async () => {
    server.use(theirProfile(), userOpinions("on", [[]]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    const tabs = await screen.findByRole("group", { name: "Which direction" });
    const cells = within(tabs).getAllByRole("button");
    expect(cells.map((cell) => cell.textContent)).toEqual(["On them", "By them"]);
    // Words are the cells' own names: no second name on top.
    for (const cell of cells) expect(cell).not.toHaveAttribute("aria-label");
    expect(screen.getByTestId(byNode("profileStances.tabRow.onTab"))).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(byNode("profileStances.tabRow.byTab"))).toHaveAttribute("aria-pressed", "false");
  });

  it("draws each row as a person, the face leading and the pair spoken (:9)", async () => {
    server.use(theirProfile(), userOpinions("on", [theBoardsFive()]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    const first = await screen.findByTestId("opinions-row-1");
    expect(first).toHaveTextContent("Tobias Lindqvist");
    expect(first).toHaveTextContent("@tobias");
    expect(within(first).getByRole("img", { name: "Like this, +0.70 / +0.40" })).toBeInTheDocument();
    expect(within(screen.getByTestId("opinions-row-3")).getByRole("img")).toHaveAccessibleName(
      "Show me more, +0.40 / +0.50",
    );
  });

  it("wears 🤔 at exactly one zero, spoken Interested, never a table face (:11)", async () => {
    server.use(theirProfile(), userOpinions("on", [theBoardsFive()]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    const kel = await screen.findByTestId("opinions-row-4");
    const value = within(kel).getByRole("img");
    expect(value).toHaveAccessibleName("Interested, no side taken, +0.00 / +0.35");
    expect(value).toHaveTextContent("🤔");
  });

  it("keeps every row read-only: one door to the person, no control on the opinion (:13)", async () => {
    server.use(theirProfile(), userOpinions("on", [theBoardsFive()]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    const list = await screen.findByTestId(byNode("profileStances.list"));
    expect(within(list).queryAllByRole("button")).toHaveLength(0);
    expect(within(list).queryAllByRole("slider")).toHaveLength(0);
    expect(within(list).getAllByRole("link")).toHaveLength(5);
  });

  it("stands the rows strongest first, down past nothing into the ones held against (:15)", async () => {
    server.use(theirProfile(), userOpinions("on", [theBoardsFive()]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    await screen.findByTestId("opinions-row-5");
    expect(rowNames()).toEqual(["Tobias Lindqvist", "Sol Ferreira", "Mira Voss", "Kel Moreau", "Juno Baptiste"]);
  });

  it("lists on On them the people holding an opinion on this person (:17)", async () => {
    const asked: string[] = [];
    server.use(
      theirProfile("u-ada"),
      userOpinions("on", [[opinionRecord("sol", 0.6, 0.3, { displayName: "Sol Ferreira" })]], (id) => asked.push(id)),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    expect(await screen.findByTestId("opinions-row-1")).toHaveTextContent("Sol Ferreira");
    expect(asked).toEqual(["u-ada"]);
  });

  it("lists on By them the people this person holds an opinion on, and keeps the tab in the address (:19)", async () => {
    const asked: string[] = [];
    server.use(
      theirProfile("u-ada"),
      userOpinions("on", [[opinionRecord("sol", 0.6, 0.3, { displayName: "Sol Ferreira" })]]),
      userOpinions("by", [[opinionGiven("rafa", 0.3, 0.2, { displayName: "Rafa Quintero" })]], (id) => asked.push(id)),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    await screen.findByTestId("opinions-row-1");
    fireEvent.click(screen.getByTestId(byNode("profileStances.tabRow.byTab")));
    await waitFor(() => expect(screen.getByTestId("opinions-row-1")).toHaveTextContent("Rafa Quintero"));
    expect(screen.queryByText("Sol Ferreira")).not.toBeInTheDocument();
    expect(asked).toEqual(["u-ada"]);
    expect(screen.getByTestId(byNode("profileStances.tabRow.byTab"))).toHaveAttribute("aria-pressed", "true");
    expect(window.location.pathname + window.location.search).toBe("/u/ada/opinions?tab=by");
  });

  it("opens on By them when the address says so", async () => {
    server.use(theirProfile(), userOpinions("by", [[opinionGiven("rafa", 0.3, 0.2)]]));
    renderWithProviders(<OpinionsScreen handle="ada" tab="by" />);
    expect(await screen.findByTestId("opinions-row-1")).toHaveTextContent("@rafa");
    expect(screen.getByTestId(byNode("profileStances.tabRow.byTab"))).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the row's person, whose way back names the opinions on the tab left (:21)", async () => {
    server.use(
      theirProfile(),
      userOpinions("on", [theBoardsFive()]),
      userOpinions("by", [[opinionGiven("rafa", 0.3, 0.2)]]),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    expect(await screen.findByTestId("opinions-row-1")).toHaveAttribute("href", "/u/tobias?from=opinions%3Aada");
    fireEvent.click(screen.getByTestId(byNode("profileStances.tabRow.byTab")));
    await waitFor(() =>
      expect(screen.getByTestId("opinions-row-1")).toHaveAttribute("href", "/u/rafa?from=opinions.by%3Aada"),
    );
  });

  it("reads Back to the profile from another's, back to it as it was opened (:23, :25)", async () => {
    server.use(theirProfile(), userOpinions("on", [[]]));
    renderWithProviders(<OpinionsScreen handle="ada" from="saved" />);
    const back = await screen.findByTestId(byNode("profileStances.header.back"));
    expect(back).toHaveAccessibleName("Back to the profile");
    expect(back).toHaveAttribute("href", "/u/ada?from=saved");
  });

  it("reads Back to your profile from the reader's own root (:27)", async () => {
    server.use(me("u-me", "me"), myProfile(), userOpinions("on", [[]]));
    renderWithProviders(<OpinionsScreen handle={null} />, { store: signedInStore() });
    const back = await screen.findByTestId(byNode("profileStances.header.back"));
    expect(back).toHaveAccessibleName("Back to your profile");
    expect(back).toHaveAttribute("href", "/profile");
    expect(await screen.findByRole("heading", { name: "@me · Opinions" })).toBeInTheDocument();
  });

  it("reads Back to your profile when the reader's own drill-in opened it", async () => {
    server.use(me("u-me", "me"), theirProfile("u-me", "me"), userOpinions("on", [[]]));
    renderWithProviders(<OpinionsScreen handle="me" />, { store: signedInStore() });
    await waitFor(() => expect(screen.getByTestId(byNode("profileStances.header.back"))).toHaveAccessibleName("Back to your profile"));
    expect(screen.getByTestId(byNode("profileStances.header.back"))).toHaveAttribute("href", "/u/me");
  });

  // THE RECORDS ARE NOT THE ROWS (open-questions.md Q35; seam 247 rider 1):
  // the figure counts three records for a twice-revised opinion, the page
  // draws one row at the opinion held now.
  it("folds a revised opinion into one row at its standing value", async () => {
    server.use(
      theirProfile(),
      userOpinions("on", [
        [
          opinionRecord("mira", 0.5, 0.2, { displayName: "Mira Voss" }),
          opinionRecord("mira", -0.2, 0.1, { displayName: "Mira Voss" }),
          opinionRecord("mira", 0.1, 0.05, { displayName: "Mira Voss" }),
        ],
      ]),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    const row = await screen.findByTestId("opinions-row-1");
    expect(screen.queryByTestId("opinions-row-2")).not.toBeInTheDocument();
    expect(within(row).getByRole("img")).toHaveAccessibleName(/\+0\.40 \/ \+0\.35$/);
  });

  it("folds a bundle whose records span two pages, reading every page first", async () => {
    const after: (string | null)[] = [];
    server.use(
      theirProfile(),
      userOpinions(
        "on",
        [
          [opinionRecord("sol", 0.6, 0.3, { displayName: "Sol Ferreira" }), opinionRecord("kel", 0.2, 0.2, { displayName: "Kel Moreau" })],
          [opinionRecord("kel", 0.6, 0.2, { displayName: "Kel Moreau" })],
        ],
        (_, cursor) => after.push(cursor),
      ),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    await screen.findByTestId("opinions-row-2");
    expect(after).toEqual([null, "p1"]);
    // Kel's two records sum past Sol's one: the second page moved the order.
    expect(rowNames()).toEqual(["Kel Moreau", "Sol Ferreira"]);
  });

  it("folds By them per person it is about", async () => {
    server.use(
      theirProfile(),
      userOpinions("by", [[opinionGiven("rafa", 0.3, 0.2), opinionGiven("rafa", 0.2, 0.1), opinionGiven("wren", 0.1, 0.1)]]),
    );
    renderWithProviders(<OpinionsScreen handle="ada" tab="by" />);
    await screen.findByTestId("opinions-row-2");
    expect(screen.queryByTestId("opinions-row-3")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("opinions-row-1")).getByRole("img")).toHaveAccessibleName(/\+0\.50 \/ \+0\.30$/);
  });

  // WHICH (0, 0) THE ROW SPEAKS IS THE ROW'S DATA (StanceRow `severed`, round 20).
  it("speaks a walked-back opinion as Walked back, and one at nothing as Says nothing", async () => {
    server.use(
      theirProfile(),
      userOpinions("on", [
        [
          opinionRecord("wren", 0.1, 0.1),
          opinionRecord("wren", -0.1, -0.1, { severed: true }),
          opinionRecord("nadia", 0, 0),
        ],
      ]),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    await screen.findByTestId("opinions-row-2");
    const names = screen
      .getAllByTestId(byNode("profileStances.row.value"))
      .map((value) => value.getAttribute("aria-label"));
    expect(names.sort()).toEqual(["Says nothing, +0.00 / +0.00", "Walked back, +0.00 / +0.00"]);
  });

  it("names a deleted account's rows by the reserved name, opening nothing", async () => {
    server.use(theirProfile(), userOpinions("on", [[opinionRecord("gone", 0.3, 0.3, { redacted: true })]]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    const row = await screen.findByTestId("opinions-row-1");
    expect(row.tagName).not.toBe("A");
    expect(row).not.toHaveTextContent("@gone");
  });

  it("says why each list is empty, in calm words and never the error colour", async () => {
    server.use(theirProfile(), userOpinions("on", [[]]), userOpinions("by", [[]]));
    renderWithProviders(<OpinionsScreen handle="ada" />);
    expect(await screen.findByTestId(byNode("profileStances.empty.title"))).toHaveTextContent(
      "No opinions yet — yours would be the first.",
    );
    fireEvent.click(screen.getByTestId(byNode("profileStances.tabRow.byTab")));
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profileStances.empty.title"))).toHaveTextContent(
        "@ada hasn't given an opinion on anyone yet.",
      ),
    );
    expect(screen.getByTestId(byNode("profileStances.empty.title")).className).not.toContain("error");
  });

  it("says the reader's own empty lists in the second person", async () => {
    server.use(me("u-me", "me"), myProfile(), userOpinions("on", [[]]), userOpinions("by", [[]]));
    renderWithProviders(<OpinionsScreen handle={null} />, { store: signedInStore() });
    expect(await screen.findByTestId(byNode("profileStances.empty.title"))).toHaveTextContent("No opinions on you yet.");
    fireEvent.click(screen.getByTestId(byNode("profileStances.tabRow.byTab")));
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profileStances.empty.title"))).toHaveTextContent(
        "You haven't given an opinion on anyone yet.",
      ),
    );
  });

  it("titles a deleted account's page with what it holds alone", async () => {
    server.use(theirProfile("u-gone", "gone", true), userOpinions("on", [[]]));
    renderWithProviders(<OpinionsScreen handle="gone" />);
    expect(await screen.findByRole("heading", { name: "Opinions" })).toBeInTheDocument();
    expect(screen.queryByText(/@gone/)).not.toBeInTheDocument();
  });

  it("offers Retry where the list did not arrive", async () => {
    let fail = true;
    server.use(
      theirProfile(),
      gqlLink.query("UserOpinionsOn", ({ variables }) =>
        fail
          ? HttpResponse.error()
          : HttpResponse.json({
              data: {
                user: {
                  __typename: "User",
                  id: variables.id,
                  incomingRecords: {
                    __typename: "RecordConnection",
                    edges: [{ __typename: "RecordEdge", node: opinionRecord("sol", 0.6, 0.3) }],
                    pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
                  },
                },
              },
            }),
      ),
    );
    renderWithProviders(<OpinionsScreen handle="ada" />);
    expect(await screen.findByTestId("opinions-transport-error")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByTestId("opinions-retry"));
    expect(await screen.findByTestId("opinions-row-1")).toHaveTextContent("@sol");
  });

  describe("pulling down at the top (:29)", () => {
    function touch(type: string, clientY: number): Event {
      const event = new Event(type, { bubbles: true });
      const points = [{ clientY }];
      Object.defineProperty(event, "touches", { value: points });
      Object.defineProperty(event, "changedTouches", { value: points });
      return event;
    }

    it("asks the server again for the list standing", async () => {
      let reads = 0;
      server.use(
        theirProfile(),
        userOpinions("on", [[opinionRecord("sol", 0.6, 0.3)]], () => {
          reads += 1;
        }),
      );
      const scroller = document.createElement("div");
      document.body.append(scroller);
      renderWithProviders(
        <ScrollHostProvider value={{ current: scroller }}>
          <OpinionsScreen handle="ada" />
        </ScrollHostProvider>,
      );
      await screen.findByTestId("opinions-row-1");
      expect(reads).toBe(1);
      fireEvent(scroller, touch("touchstart", 100));
      fireEvent(scroller, touch("touchmove", 100 + PULL_THRESHOLD));
      fireEvent(scroller, touch("touchend", 100 + PULL_THRESHOLD));
      await waitFor(() => expect(reads).toBe(2));
      // The list already on screen stays while the read is out.
      expect(screen.getByTestId("opinions-row-1")).toBeInTheDocument();
      scroller.remove();
    });
  });
});
