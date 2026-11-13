// The menu's hide row as a toggle (design round 41, seam 305): the sidecar
// lines every host's hide row shares, pinned once on the helper.
//
// ReaderPostMenu.md:19 — ALWAYS the hide row reads Unhide with the author's
// handle GIVEN the author is already hidden … and keeps its one name.
// ReaderPostMenu.md:21 — WHEN tap Unhide with the author's handle -> … the
// author is unhidden AND the snackbar reads @ada is unhidden — their posts can
// reach your feed again. with Undo AND NEVER a confirm step appears.
// HistoryProfileMenu.md:11 — WHEN tap Undo on the snackbar GIVEN the unhide
// was made from the menu -> the person is hidden again.
// ProfileDeletedMenu.md:7 — the hide row reads Hide this account … and never
// names a handle.

import { describe, expect, it, vi } from "vitest";

import { HiddenSet, type HiddenEntry, type HiddenIo, type HiddenPerson } from "./hidden-set";
import { hideRow } from "./hide-row";

const ada: HiddenPerson = { id: "a", handle: "ada", displayName: "Ada", avatarUrl: null, redacted: false };
const gone: HiddenPerson = { id: "d", handle: null, displayName: null, avatarUrl: null, redacted: true };
const HIDDEN_AT = "2026-10-01T00:00:00Z";

function setWith(entries: readonly HiddenEntry[]) {
  const sent: string[] = [];
  const io: HiddenIo = {
    load: async () => entries,
    hide: async (actor, at) => {
      sent.push(`hide ${actor} ${at ?? "now"}`);
      return at ?? "2026-10-13T12:00:00Z";
    },
    unhide: async (actor) => {
      sent.push(`unhide ${actor}`);
      return true;
    },
  };
  return { set: new HiddenSet(io, () => "2026-10-13T12:00:00Z"), sent };
}

describe("the hide row", () => {
  it("reads Hide with the handle while the person is not hidden", async () => {
    const { set } = setWith([]);
    await set.ensure();
    const row = hideRow({ set, person: ada, origin: "p1", notify: vi.fn(), onGuest: null });
    expect(row.label).toBe("Hide @ada");
  });

  it("reads Unhide with the handle while the person is hidden", async () => {
    const { set } = setWith([{ ...ada, hiddenAt: HIDDEN_AT }]);
    await set.ensure();
    const row = hideRow({ set, person: ada, origin: "p1", notify: vi.fn(), onGuest: null });
    expect(row.label).toBe("Unhide @ada");
  });

  it("an Unhide tap unhides at once and the snackbar offers Undo, which hides again at the old moment", async () => {
    const { set, sent } = setWith([{ ...ada, hiddenAt: HIDDEN_AT }]);
    await set.ensure();
    const notify = vi.fn();
    hideRow({ set, person: ada, origin: "p1", notify, onGuest: null }).onSelect();
    expect(set.has("a")).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    const [message, action] = notify.mock.calls[0]!;
    expect(message).toBe("@ada is unhidden — their posts can reach your feed again.");
    expect(action.label).toBe("Undo");
    await vi.waitFor(() => expect(sent).toEqual(["unhide a"]));
    action.onAction();
    expect(set.has("a")).toBe(true);
    await vi.waitFor(() => expect(sent).toEqual(["unhide a", `hide a ${HIDDEN_AT}`]));
  });

  it("a guest's Unhide asks to join and sends nothing", async () => {
    const { set, sent } = setWith([{ ...ada, hiddenAt: HIDDEN_AT }]);
    await set.ensure();
    const onGuest = vi.fn();
    hideRow({ set, person: ada, origin: "p1", notify: vi.fn(), onGuest }).onSelect();
    expect(onGuest).toHaveBeenCalledTimes(1);
    expect(set.has("a")).toBe(true);
    expect(sent).toEqual([]);
  });

  it("a deleted account's row reads Hide this account even while it is hidden", async () => {
    const { set } = setWith([{ ...gone, hiddenAt: HIDDEN_AT }]);
    await set.ensure();
    const row = hideRow({ set, person: gone, origin: "d", notify: vi.fn(), onGuest: null });
    expect(row.label).toBe("Hide this account");
  });
});
