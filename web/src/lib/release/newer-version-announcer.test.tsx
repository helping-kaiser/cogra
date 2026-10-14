import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { failed, success, type Outcome } from "@/lib/api/outcome";
import { renderWithProviders } from "@/test/providers";
import { Snackbar } from "@/lib/ui/snackbar";
import {
  localAnnouncedFlag,
  NEWER_VERSION_SNACKBAR,
  releaseToAnnounce,
  resetAnnouncerForTests,
  UPDATE_NOW,
  useNewerVersionAnnouncement,
  type AnnouncedFlag,
} from "./newer-version-announcer";
import type { Release } from "./version-status";

// The announcer under the feed's one snackbar, as `feed-view.tsx` hosts it:
// `arrived` is the feed's content in, `own` a snackbar the feed is already
// saying. Each test is one page load (`test/setup.ts` resets the module).

const release = (version: string): Release => ({
  version,
  notes: [`What ${version} brings`],
  patchNotesUrl: `https://github.com/helping-kaiser/cogra/releases/tag/v${version}`,
  releasedAt: "2026-09-30T10:00:00Z",
});
const BEHIND = [release("0.1.3"), release("0.1.2"), release("0.1.1")];

function memoryFlag(start: string | null = null): AnnouncedFlag & { value: string | null } {
  const flag = {
    value: start,
    read: () => flag.value,
    write: (v: string) => {
      flag.value = v;
    },
  };
  return flag;
}

type Deps = {
  load: () => Promise<Outcome<readonly Release[]>>;
  running: string;
  flag: AnnouncedFlag;
  reload: () => void;
};

function Feed({ deps, arrived = true, own = null }: { deps: Deps; arrived?: boolean; own?: string | null }) {
  const [snack, setSnack] = useState<string | null>(own);
  const newer = useNewerVersionAnnouncement(arrived, snack === null, deps);
  return (
    <>
      <button type="button" onClick={() => setSnack("Link copied.")}>
        act
      </button>
      <Snackbar
        testId="feed-snackbar"
        node={{ path: "feed.snackbar" }}
        message={newer.message ?? snack}
        action={newer.action}
        onDismiss={newer.message !== null ? newer.dismiss : () => setSnack(null)}
      />
    </>
  );
}

function deps(over: Partial<Deps> = {}): Deps {
  return {
    load: () => Promise.resolve(success(BEHIND)),
    running: "0.1.2",
    flag: memoryFlag(),
    reload: vi.fn(),
    ...over,
  };
}

const snackbarText = () => screen.queryByTestId("feed.snackbar.message")?.textContent ?? null;

describe("releaseToAnnounce", () => {
  it("announces the newest release when behind and not yet announced", () => {
    expect(releaseToAnnounce(BEHIND, "0.1.2", null)?.version).toBe("0.1.3");
    expect(releaseToAnnounce(BEHIND, "0.1.1", "0.1.2")?.version).toBe("0.1.3");
  });

  it("says nothing when the newest is already announced, when current, or when unlisted", () => {
    expect(releaseToAnnounce(BEHIND, "0.1.2", "0.1.3")).toBeNull();
    expect(releaseToAnnounce(BEHIND, "0.1.3", null)).toBeNull();
    expect(releaseToAnnounce(BEHIND, "0.9.9-dev", null)).toBeNull();
  });
});

describe("the announcer", () => {
  it("feedNewerVersion_3_a_cold_open_feed_announces_a_newer_release_once_and_marks_it", async () => {
    const d = deps();
    renderWithProviders(<Feed deps={d} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    expect(screen.getByTestId("feed.snackbar.action")).toHaveTextContent(UPDATE_NOW);
    // The mark is the shown snackbar's effect: it lands after the commit that
    // drew the words, so it is awaited rather than read in the same tick.
    await waitFor(() => expect((d.flag as ReturnType<typeof memoryFlag>).value).toBe("0.1.3"));
  });

  it("feedNewerVersion_5_a_late_read_announces_as_it_arrives", async () => {
    let answer: (o: Outcome<readonly Release[]>) => void = () => {};
    const d = deps({ load: () => new Promise((resolve) => (answer = resolve)) });
    renderWithProviders(<Feed deps={d} />);
    expect(snackbarText()).toBeNull();
    await act(async () => answer(success(BEHIND)));
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
  });

  it("a read that lands while the feed is away is heard at the feed's next arrival", async () => {
    let answer: (o: Outcome<readonly Release[]>) => void = () => {};
    const d = deps({ load: () => new Promise((resolve) => (answer = resolve)) });
    const first = renderWithProviders(<Feed deps={d} />);
    first.unmount();
    await act(async () => answer(success(BEHIND)));
    renderWithProviders(<Feed deps={d} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
  });

  it("feedNewerVersion_7_announces_without_a_session_to_guests_as_to_members", async () => {
    // The announcer reads no viewer: the registry read is anonymous and every
    // reader's feed is the one view. The provider stack here has no session.
    renderWithProviders(<Feed deps={deps()} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
  });

  it("feedNewerVersion_9_an_unlisted_running_version_announces_nothing", async () => {
    const load = vi.fn(() => Promise.resolve(success(BEHIND)));
    renderWithProviders(<Feed deps={deps({ load, running: "0.2.0-dev" })} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(async () => {});
    expect(snackbarText()).toBeNull();
  });

  it("feedNewerVersion_11_a_return_to_the_foreground_announces_nothing", async () => {
    const d = deps();
    renderWithProviders(<Feed deps={d} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    fireEvent.click(screen.getByTestId("feed.snackbar.action"));
    await waitFor(() => expect(snackbarText()).toBeNull());
    (d.flag as ReturnType<typeof memoryFlag>).value = null;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {});
    expect(snackbarText()).toBeNull();
  });

  it("feedNewerVersion_13_an_already_announced_release_is_not_announced_again", async () => {
    const load = vi.fn(() => Promise.resolve(success(BEHIND)));
    renderWithProviders(<Feed deps={deps({ load, flag: memoryFlag("0.1.3") })} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(async () => {});
    expect(snackbarText()).toBeNull();
  });

  it("feedNewerVersion_15_a_dismissed_announcement_never_comes_back", async () => {
    const flag = memoryFlag();
    const first = renderWithProviders(<Feed deps={deps({ flag })} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    first.unmount();
    resetAnnouncerForTests();
    const load = vi.fn(() => Promise.resolve(success(BEHIND)));
    renderWithProviders(<Feed deps={deps({ flag, load })} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(async () => {});
    expect(snackbarText()).toBeNull();
  });

  it("feedNewerVersion_17_each_release_is_announced_at_most_once_and_a_newer_one_again", async () => {
    const flag = memoryFlag("0.1.3");
    const newer = [release("0.1.4"), ...BEHIND];
    renderWithProviders(<Feed deps={deps({ flag, load: () => Promise.resolve(success(newer)) })} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    await waitFor(() => expect(flag.value).toBe("0.1.4"));
  });

  it("feedNewerVersion_21_update_now_on_the_web_reloads_into_the_new_version", async () => {
    const reload = vi.fn();
    renderWithProviders(<Feed deps={deps({ reload })} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    fireEvent.click(screen.getByTestId("feed.snackbar.action"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("feedNewerVersion_23_update_now_opens_neither_the_repository_nor_the_notes", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithProviders(<Feed deps={deps()} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    fireEvent.click(screen.getByTestId("feed.snackbar.action"));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
    open.mockRestore();
  });

  it("feedNewerVersion_25_update_now_is_one_string_with_no_platform_noun", async () => {
    renderWithProviders(<Feed deps={deps()} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    expect(screen.getByTestId("feed.snackbar.action").textContent).toBe("Update now");
  });

  it("feedNewerVersion_27_no_update_is_forced", async () => {
    renderWithProviders(<Feed deps={deps()} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // The feed stays usable underneath.
    fireEvent.click(screen.getByText("act"));
  });

  it("feedNewerVersion_29_the_announcement_is_a_quiet_status_queued_behind_the_feeds_own", async () => {
    const d = deps();
    renderWithProviders(<Feed deps={d} own="Link copied." />);
    // The feed's own snackbar was there first; the announcement waits for it.
    await act(async () => {});
    expect(snackbarText()).toBe("Link copied.");
    expect((d.flag as ReturnType<typeof memoryFlag>).value).toBeNull();
    expect(screen.getByTestId("feed-snackbar-region")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("feed-snackbar-region")).toHaveAttribute("aria-live", "polite");
  });

  it("feedNewerVersion_31_the_notes_are_never_reached_from_the_snackbar", async () => {
    const reload = vi.fn();
    renderWithProviders(<Feed deps={deps({ reload })} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    expect(screen.queryByText(/See it on GitHub/)).toBeNull();
    expect(screen.queryByText("What 0.1.3 brings")).toBeNull();
  });

  it("a failed read is silent and leaves the flag for the next cold open", async () => {
    const flag = memoryFlag();
    const load = vi.fn(() => Promise.resolve(failed(new Error("offline"))));
    renderWithProviders(<Feed deps={deps({ flag, load })} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(async () => {});
    expect(snackbarText()).toBeNull();
    expect(flag.value).toBeNull();
  });

  it("a second feed arrival in the same page load is silent", async () => {
    const d = deps();
    const first = renderWithProviders(<Feed deps={d} />);
    await waitFor(() => expect(snackbarText()).toBe(NEWER_VERSION_SNACKBAR));
    first.unmount();
    (d.flag as ReturnType<typeof memoryFlag>).value = null;
    renderWithProviders(<Feed deps={d} />);
    await act(async () => {});
    expect(snackbarText()).toBeNull();
  });

  it("blocked storage never throws: it reads as never announced and writes nothing", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const put = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(localAnnouncedFlag.read()).toBeNull();
    expect(() => localAnnouncedFlag.write("0.1.3")).not.toThrow();
    get.mockRestore();
    put.mockRestore();
  });
});
