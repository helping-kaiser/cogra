// The Saved overlay's ordering law (saved-surface packet, "Optimistic write
// queue"): one write in flight per node, the newest intent wins, and a
// failure reverts to what the server last confirmed.

import { describe, expect, it } from "vitest";

import { SavedWrites, type Intent, type SendResult } from "./saved-writes";

/** A send whose answers the test releases one by one, in order. */
function scriptedSend() {
  const sent: { node: string; intent: Intent }[] = [];
  const pending: ((result: SendResult) => void)[] = [];
  const send = (node: string, intent: Intent) => {
    sent.push({ node, intent });
    return new Promise<SendResult>((resolve) => pending.push(resolve));
  };
  const answer = async (result: SendResult) => {
    pending.shift()?.(result);
    // Let the store's `.then` run.
    await Promise.resolve();
    await Promise.resolve();
  };
  return { sent, send, answer };
}

const NOW = "2026-10-13T12:00:00.000Z";

describe("SavedWrites", () => {
  it("answers_at_the_tap_before_the_server_does", () => {
    const { send } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.keep("p1", null);
    expect(writes.kept("p1", null)).toBe(NOW);
    writes.drop("p2", "2026-10-01T00:00:00Z");
    expect(writes.kept("p2", "2026-10-01T00:00:00Z")).toBeNull();
  });

  it("unsave_then_undo_sends_in_order", async () => {
    const { sent, send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    const at = "2026-10-01T00:00:00Z";
    writes.drop("p1", at);
    writes.keep("p1", null, at, "restore");
    // The Undo waits behind the unsave: never two writes on one node at once.
    expect(sent.map((s) => s.intent.kind)).toEqual(["drop"]);
    await answer({ ok: true, kept: null });
    expect(sent.map((s) => s.intent)).toEqual([{ kind: "drop" }, { kind: "keep", at }]);
    await answer({ ok: true, kept: at });
    expect(writes.kept("p1", null)).toBe(at);
  });

  it("a_newer_intent_supersedes_a_queued_one", async () => {
    const { sent, send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.keep("p1", null);
    writes.drop("p1", null);
    writes.keep("p1", null);
    writes.drop("p1", null);
    await answer({ ok: true, kept: NOW });
    // The two in the middle were never sent: the last one says where the
    // reader wants the node to end up.
    expect(sent.map((s) => s.intent.kind)).toEqual(["keep", "drop"]);
    await answer({ ok: true, kept: null });
    expect(writes.kept("p1", null)).toBeNull();
  });

  it("a_failed_unsave_reverts_the_row", async () => {
    const { send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    const reverted: string[] = [];
    writes.onRevert((node, kind) => reverted.push(`${node}:${kind}`));
    const at = "2026-10-01T00:00:00Z";
    writes.drop("p1", at);
    await answer({ ok: false });
    expect(writes.kept("p1", at)).toBe(at);
    expect(writes.failure("p1")?.kind).toBe("unsave");
    expect(reverted).toEqual(["p1:unsave"]);
  });

  it("retry_asks_the_same_comfort_again", async () => {
    const { sent, send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.keep("p1", null);
    await answer({ ok: false });
    expect(writes.kept("p1", null)).toBeNull();
    writes.failure("p1")?.retry();
    // The line goes the moment the comfort is asked again, and it answers at
    // the tap again.
    expect(writes.failure("p1")).toBeNull();
    expect(writes.kept("p1", null)).toBe(NOW);
    expect(sent.map((s) => s.intent.kind)).toEqual(["keep", "keep"]);
    await answer({ ok: true, kept: NOW });
    expect(writes.kept("p1", null)).toBe(NOW);
  });

  it("a_failed_undo_records_a_restore_failure", async () => {
    const { send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    const at = "2026-10-01T00:00:00Z";
    writes.drop("p1", at);
    await answer({ ok: true, kept: null });
    writes.keep("p1", null, at, "restore");
    await answer({ ok: false });
    expect(writes.kept("p1", at)).toBeNull();
    expect(writes.failure("p1")?.kind).toBe("restore");
  });

  it("another_act_on_the_same_target_clears_its_line", async () => {
    const { send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.keep("p1", null);
    await answer({ ok: false });
    writes.keep("p1", null);
    expect(writes.failure("p1")).toBeNull();
  });

  it("a_fresh_load_clears_the_lines_and_steps_aside", async () => {
    const { send, answer } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.keep("p1", null);
    await answer({ ok: false });
    writes.settle();
    expect(writes.failure("p1")).toBeNull();
    expect(writes.touched("p1")).toBe(false);
    // The read now says what is true.
    expect(writes.kept("p1", "2026-10-02T00:00:00Z")).toBe("2026-10-02T00:00:00Z");
  });

  it("a_fresh_load_keeps_a_write_still_on_its_way", () => {
    const { send } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.drop("p1", "2026-10-01T00:00:00Z");
    writes.settle();
    expect(writes.kept("p1", "2026-10-01T00:00:00Z")).toBeNull();
  });

  it("the_overlay_belongs_to_the_signed_in_account", () => {
    const { send } = scriptedSend();
    const writes = new SavedWrites(send, () => NOW);
    writes.keep("p1", null);
    writes.reset();
    expect(writes.kept("p1", null)).toBeNull();
    expect(writes.touched("p1")).toBe(false);
  });
});
