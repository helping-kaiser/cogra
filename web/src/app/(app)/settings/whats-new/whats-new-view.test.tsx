import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { failed, success } from "@/lib/api/outcome";
import type { Release } from "@/lib/release/version-status";
import { byNode } from "@/test/data-node";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { NEWER_VERSION_LINE, NEWEST_FIRST, WhatsNewView } from "./whats-new-view";

const server = startMswServer();

// Newest first, as the registry serves them. Noon local, so the date holds in any zone.
const release = (version: string, day: number, notes: string[] = [`What ${version} brings`]): Release => ({
  version,
  notes,
  patchNotesUrl: `https://github.com/helping-kaiser/cogra/releases/tag/v${version}`,
  releasedAt: new Date(2026, 8, day, 12).toISOString(),
});
const LIST = [release("0.1.3", 30), release("0.1.2", 28, ["First line.", "Second line."]), release("0.1.1", 25)];

function open(running: string, releases: readonly Release[] = LIST, reload = vi.fn()) {
  renderWithProviders(
    <WhatsNewView load={() => Promise.resolve(success(releases))} running={running} reload={reload} />,
  );
  return reload;
}

const datelines = async () =>
  (await screen.findAllByTestId(byNode("whatsNew.dateline"))).map((e) => e.textContent);
const newerLine = () => screen.queryByTestId(byNode("whatsNew.newerLine"));

describe("What's new", () => {
  it("whatsNew_3_whole_releases_newest_first_one_card_each_then_the_footnote", async () => {
    open("0.1.3");
    const cards = await screen.findAllByTestId(byNode("whatsNew.release"));
    expect(cards.map((c) => c.getAttribute("data-testid-key"))).toEqual(["0-1-3", "0-1-2", "0-1-1"]);
    expect(screen.getByTestId(byNode("whatsNew.footnote"))).toHaveTextContent(NEWEST_FIRST);
  });

  it("whatsNew_5_each_dateline_reads_version_and_date", async () => {
    open("0.1.3");
    expect((await datelines())[1]).toBe("Version 0.1.2 · 28.09.2026");
  });

  it("whatsNew_7_the_running_version_carries_installed", async () => {
    open("0.1.3");
    expect((await datelines())[0]).toBe("Version 0.1.3 · installed · 30.09.2026");
  });

  it("whatsNew_9_every_other_dateline_carries_no_word", async () => {
    open("0.1.3");
    expect((await datelines()).slice(1)).toEqual(["Version 0.1.2 · 28.09.2026", "Version 0.1.1 · 25.09.2026"]);
  });

  it("whatsNew_11_a_release_is_its_own_notes_never_a_difference", async () => {
    open("0.1.3");
    const card = (await screen.findAllByTestId(byNode("whatsNew.release")))[1];
    const paragraphs = within(card).getAllByText(/line\.$/);
    expect(paragraphs.map((p) => p.textContent)).toEqual(["First line.", "Second line."]);
    expect(card.textContent).not.toMatch(/[+−-] |was |changed from/);
  });

  it("whatsNew_13_every_card_ends_in_its_door_named_for_its_release", async () => {
    open("0.1.3");
    const doors = await screen.findAllByTestId(byNode("whatsNew.release.door"));
    expect(doors.map((d) => d.textContent)).toEqual(["See it on GitHub", "See it on GitHub", "See it on GitHub"]);
    expect(doors.map((d) => d.getAttribute("aria-label"))).toEqual([
      "See version 0.1.3 on GitHub",
      "See version 0.1.2 on GitHub",
      "See version 0.1.1 on GitHub",
    ]);
  });

  it("whatsNew_15_the_door_opens_the_releases_page_outside_never_the_download", async () => {
    open("0.1.3");
    const door = (await screen.findAllByTestId(byNode("whatsNew.release.door")))[0];
    expect(door.tagName).toBe("A");
    expect(door).toHaveAttribute("href", "https://github.com/helping-kaiser/cogra/releases/tag/v0.1.3");
    expect(door).toHaveAttribute("target", "_blank");
    expect(door).toHaveAttribute("rel", "noopener noreferrer");
    expect(door.getAttribute("href")).not.toMatch(/play\.google|market:/);
  });

  it("whatsNew_17_no_newer_line_stands_when_the_running_version_is_the_newest", async () => {
    open("0.1.3");
    await datelines();
    expect(newerLine()).toBeNull();
  });

  it("whatsNew_19_an_unlisted_running_version_wears_nothing_and_no_line_stands", async () => {
    open("0.2.0-dev");
    expect(await datelines()).toEqual([
      "Version 0.1.3 · 30.09.2026",
      "Version 0.1.2 · 28.09.2026",
      "Version 0.1.1 · 25.09.2026",
    ]);
    expect(newerLine()).toBeNull();
  });

  it("whatsNew_21_no_bottom_bar_and_the_back_arrow_stays", async () => {
    open("0.1.3");
    await datelines();
    expect(screen.getByTestId(byNode("whatsNew.header.back"))).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("whatsNew_23_the_back_arrow_returns_to_settings", async () => {
    open("0.1.3");
    await datelines();
    const back = screen.getByTestId(byNode("whatsNew.header.back"));
    expect(back.closest("a")).toHaveAttribute("href", "/settings");
    expect(back.closest("a") ?? back).toHaveAccessibleName("Back to settings");
  });

  it("a read that fails with nothing loaded says the server cannot be reached", async () => {
    renderWithProviders(<WhatsNewView load={() => Promise.resolve(failed(new Error("offline")))} running="0.1.3" />);
    expect(await screen.findByTestId("whats-new-error")).toHaveTextContent(
      "Can't reach the server. Check your connection and try again.",
    );
  });
});

describe("What's new, behind the newest", () => {
  it("whatsNewBehind_3_one_quiet_line_atop_the_list_with_newest_and_installed", async () => {
    open("0.1.2");
    expect(await datelines()).toEqual([
      "Version 0.1.3 · newest · 30.09.2026",
      "Version 0.1.2 · installed · 28.09.2026",
      "Version 0.1.1 · 25.09.2026",
    ]);
    const line = newerLine();
    expect(line).toHaveTextContent(`${NEWER_VERSION_LINE} — Update now`);
    // The line stands atop the list: before the first dateline in the document.
    const first = screen.getAllByTestId(byNode("whatsNew.dateline"))[0];
    expect(line!.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("whatsNewBehind_5_more_than_one_behind_every_newer_release_above_and_only_the_head_newest", async () => {
    open("0.1.1");
    expect(await datelines()).toEqual([
      "Version 0.1.3 · newest · 30.09.2026",
      "Version 0.1.2 · 28.09.2026",
      "Version 0.1.1 · installed · 25.09.2026",
    ]);
    expect(screen.getByTestId(byNode("whatsNew.newerLine.update"))).toHaveAccessibleName("Update to version 0.1.3");
  });

  it("whatsNewBehind_7_no_dateline_reads_current", async () => {
    open("0.1.1");
    for (const line of await datelines()) expect(line).not.toMatch(/current/);
  });

  it("whatsNewBehind_9_update_now_is_named_for_the_newer_version", async () => {
    open("0.1.2");
    await datelines();
    const update = screen.getByTestId(byNode("whatsNew.newerLine.update"));
    expect(update).toHaveTextContent("Update now");
    expect(update).toHaveAccessibleName("Update to version 0.1.3");
  });

  it("whatsNewBehind_11_the_line_and_the_newer_release_are_the_only_changes", async () => {
    open("0.1.2");
    await datelines();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByTestId(byNode("whatsNew.release"))).toHaveLength(3);
  });

  it("whatsNewBehind_13_every_other_dateline_carries_no_word", async () => {
    open("0.1.1", [release("0.1.4", 30), ...LIST.map((r, i) => ({ ...r, releasedAt: new Date(2026, 8, 29 - i, 12).toISOString() }))]);
    const words = (await datelines()).map((d) => d!.split(" · ").slice(1, -1));
    expect(words).toEqual([["newest"], [], [], ["installed"]]);
  });

  it("whatsNewBehind_17_update_now_on_the_web_reloads_and_never_opens_github", async () => {
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    const reload = open("0.1.2");
    await datelines();
    fireEvent.click(screen.getByTestId(byNode("whatsNew.newerLine.update")));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(opened).not.toHaveBeenCalled();
    expect(screen.getByTestId(byNode("whatsNew.newerLine.update")).tagName).toBe("BUTTON");
    opened.mockRestore();
  });

  it("whatsNewBehind_19_every_card_keeps_its_door_the_newest_included", async () => {
    open("0.1.2");
    await datelines();
    const doors = screen.getAllByTestId(byNode("whatsNew.release.door"));
    expect(doors.map((d) => d.getAttribute("data-testid-key"))).toEqual(["0-1-3", "0-1-2", "0-1-1"]);
  });

  it("whatsNewBehind_21_the_door_opens_the_releases_page_outside_never_the_download", async () => {
    open("0.1.2");
    await datelines();
    const door = screen.getAllByTestId(byNode("whatsNew.release.door"))[0];
    expect(door).toHaveAttribute("href", "https://github.com/helping-kaiser/cogra/releases/tag/v0.1.3");
    expect(door).toHaveAttribute("target", "_blank");
  });

  it("whatsNewBehind_23_the_back_arrow_returns_to_settings", async () => {
    open("0.1.2");
    await datelines();
    expect(screen.getByTestId(byNode("whatsNew.header.back")).closest("a")).toHaveAttribute("href", "/settings");
  });
});

describe("the registry read", () => {
  it("reads the web's own component and follows the cursor to the end", async () => {
    const asked: unknown[] = [];
    server.use(
      graphql.query("AppVersions", ({ variables }) => {
        asked.push(variables);
        const second = variables.after === "c1";
        const node = (version: string) => ({
          component: "WEB",
          version,
          notes: [`What ${version} brings`],
          patchNotesUrl: `https://github.com/helping-kaiser/cogra/releases/tag/v${version}`,
          releasedAt: "2026-09-28T10:00:00Z",
        });
        return HttpResponse.json({
          data: {
            appVersions: {
              pageInfo: { hasNextPage: !second, endCursor: second ? "c2" : "c1" },
              edges: [{ node: node(second ? "0.1.0" : "0.1.1") }],
            },
          },
        });
      }),
    );
    renderWithProviders(<WhatsNewView running="0.1.1" />);
    await waitFor(async () => expect(await datelines()).toHaveLength(2));
    expect(asked).toEqual([
      { component: "WEB", after: null },
      { component: "WEB", after: "c1" },
    ]);
  });
});
