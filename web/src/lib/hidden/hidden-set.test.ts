import { describe, expect, it } from "vitest";

import { HiddenSet, type HiddenEntry, type HiddenIo, type HiddenPerson } from "./hidden-set";

const ada: HiddenPerson = { id: "a", handle: "ada", displayName: "Ada", avatarUrl: null, redacted: false };
const juno: HiddenPerson = { id: "j", handle: "juno", displayName: "Juno", avatarUrl: null, redacted: false };

function entry(person: HiddenPerson, hiddenAt: string): HiddenEntry {
  return { ...person, hiddenAt };
}

/** An io whose answers the test releases one by one. */
function scripted(initial: readonly HiddenEntry[] | null = []) {
  const sent: string[] = [];
  const answers: ((ok: boolean) => void)[] = [];
  let loads: (readonly HiddenEntry[] | null)[] = [initial];
  const io: HiddenIo = {
    load: async () => (loads.length > 1 ? loads.shift()! : loads[0]!),
    hide: (actor, at) => {
      sent.push(`hide ${actor} ${at ?? "now"}`);
      return new Promise((resolve) => answers.push((ok) => resolve(ok ? (at ?? "2026-10-13T12:00:00Z") : null)));
    },
    unhide: (actor) => {
      sent.push(`unhide ${actor}`);
      return new Promise((resolve) => answers.push(resolve));
    },
  };
  const answer = async (ok: boolean) => {
    answers.shift()!(ok);
    await Promise.resolve();
    await Promise.resolve();
  };
  const nextLoads = (next: (readonly HiddenEntry[] | null)[]) => {
    loads = next;
  };
  return { io, sent, answer, nextLoads };
}

const NOW = "2026-10-13T12:00:00Z";

describe("the hidden set", () => {
  it("reads whole and lists most recently hidden first", async () => {
    const { io } = scripted([entry(ada, "2026-10-01T00:00:00Z"), entry(juno, "2026-10-01T00:00:00.5Z")]);
    const set = new HiddenSet(io, () => NOW);
    expect(set.status).toBe("unread");
    expect(await set.ensure()).toBe(true);
    expect(set.status).toBe("read");
    expect(set.list().map((e) => e.id)).toEqual(["j", "a"]);
    expect(set.count).toBe(2);
    expect(set.has("a")).toBe(true);
  });

  it("a failed first read says so and hides nobody", async () => {
    const { io } = scripted(null);
    const set = new HiddenSet(io, () => NOW);
    expect(await set.ensure()).toBe(false);
    expect(set.status).toBe("failed");
    expect(set.has("a")).toBe(false);
  });

  it("a hide joins the set at the tap and holds the server's moment", async () => {
    const { io, sent, answer } = scripted();
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.hide(ada, "post-1");
    expect(set.has("a")).toBe(true);
    expect(sent).toEqual(["hide a now"]);
    await answer(true);
    expect(set.entry("a")?.hiddenAt).toBe("2026-10-13T12:00:00Z");
    expect(set.failure("post-1")).toBeNull();
  });

  it("a failed hide reverts and its origin row says so, Retry asking again", async () => {
    const { io, sent, answer } = scripted();
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.hide(ada, "post-1");
    await answer(false);
    expect(set.has("a")).toBe(false);
    const failure = set.failure("post-1");
    expect(failure?.kind).toBe("hide");
    expect(set.failure("post-2")).toBeNull();
    failure!.retry();
    expect(set.has("a")).toBe(true);
    expect(set.failure("post-1")).toBeNull();
    expect(sent).toEqual(["hide a now", "hide a now"]);
  });

  it("an Undo tapped while the hide is in flight goes after it, and the newest intent wins", async () => {
    const { io, sent, answer } = scripted();
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.hide(ada, "post-1");
    set.unhide("a", "post-1", "undoHide");
    set.hide(ada, "post-1");
    set.unhide("a", "post-1", "undoHide");
    expect(set.has("a")).toBe(false);
    await answer(true);
    expect(sent).toEqual(["hide a now", "unhide a"]);
    await answer(true);
    expect(set.has("a")).toBe(false);
  });

  it("a failed Undo of a hide keeps the person hidden and the origin carries the line", async () => {
    const { io, answer } = scripted();
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.hide(ada, "post-1");
    await answer(true);
    set.unhide("a", "post-1", "undoHide");
    await answer(false);
    expect(set.has("a")).toBe(true);
    expect(set.failure("post-1")?.kind).toBe("undoHide");
  });

  it("an Undo of an unhide puts the row back with its old age", async () => {
    const { io, sent, answer } = scripted([entry(juno, "2026-08-12T09:00:00Z")]);
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.unhide("j", "j");
    expect(set.count).toBe(0);
    await answer(true);
    set.hide(juno, "j", "2026-08-12T09:00:00Z", "undoUnhide");
    expect(set.entry("j")?.hiddenAt).toBe("2026-08-12T09:00:00Z");
    expect(sent).toEqual(["unhide j", "hide j 2026-08-12T09:00:00Z"]);
  });

  it("a failed unhide reverts and keeps the row's entry for its line", async () => {
    const { io, answer } = scripted([entry(juno, "2026-08-12T09:00:00Z")]);
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.unhide("j", "j");
    await answer(false);
    expect(set.has("j")).toBe(true);
    expect(set.failure("j")?.person.handle).toBe("juno");
  });

  it("a fresh read clears the lines and lets the read speak", async () => {
    const { io, answer, nextLoads } = scripted();
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.hide(ada, "post-1");
    await answer(false);
    nextLoads([[entry(ada, "2026-10-12T00:00:00Z")]]);
    await set.refetch();
    expect(set.failure("post-1")).toBeNull();
    expect(set.has("a")).toBe(true);
  });

  it("an account change drops everything, an answer in flight included", async () => {
    const { io, answer } = scripted([entry(juno, "2026-08-12T09:00:00Z")]);
    const set = new HiddenSet(io, () => NOW);
    await set.ensure();
    set.hide(ada, "post-1");
    set.reset();
    await answer(false);
    expect(set.status).toBe("unread");
    expect(set.count).toBe(0);
    expect(set.failure("post-1")).toBeNull();
  });
});
