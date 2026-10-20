// @vitest-environment node

// The device-lock engine (sign-out-custody L1) over the real custody and
// draft stores on fake-indexeddb, against an in-memory server that plays
// issue / release / discard as `crates/api` does: release behind the CURRENT
// password, NOT_FOUND for an unknown or foreign lock, idempotent. Node's
// WebCrypto (Ed25519, HKDF, AES-GCM), as the crypto suites.
//
// The two ruled branches of seam 179 item 3 are pinned by name:
// - PR-61: `a_remote_end_without_a_held_lock_keeps_everything_and_never_destroys_it`
//   (the residual), `a_forget_on_sign_in_is_not_ready_until_a_lock_is_held`
//   (the sign-in refuses to complete);
// - PR-62: `a_dead_lock_completes_the_sign_in_deletes_the_ciphertext_and_reports_it_once`.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { beforeEach, describe, expect, it } from "vitest";

import { failed, refused, success, type Outcome } from "@/lib/api/outcome";
import type { IssuedLock } from "@/lib/api/device-lock-api";
import { equalBytes, randomBytes } from "@/lib/crypto/bytes";
import { Proposal, StructuralBody } from "@/lib/crypto/handshake";
import { ActId, AddrId } from "@/lib/crypto/identifiers";
import { createComposeDraftStore, type ComposeDraftStore } from "@/lib/compose/draft-store";
import { hasDraftCustody } from "@/lib/compose/draft-custody";
import { createSealedDraftStore, type SealedDraftStore } from "@/lib/compose/sealed-draft";
import { emptyWizard, type WizardState } from "@/lib/compose/wizard";
import { createCarriedExpectationStore } from "@/lib/signing/carried";
import { createDeviceLockEngine, type DeviceLockEngine } from "./device-lock";
import { createIdentityStore, type IdentityStore } from "./store";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "correct horse battery";

/** The server's half: one row per issue, released behind the current password. */
function fakeServer() {
  const locks = new Map<string, { account: string; secret: Uint8Array }>();
  const passwords = new Map<string, string>([
    [A, PASSWORD],
    [B, PASSWORD],
  ]);
  const calls = { issue: 0, release: 0, discard: 0 };
  const state = { online: true };
  // A token names its account; the tab's own session is whoever is active.
  const accountOf = (token: string | undefined, active: () => string | null) =>
    token === undefined ? active() : token.replace(/^token-/, "");

  function api(active: () => string | null) {
    return {
      async issue(token?: string): Promise<Outcome<IssuedLock>> {
        calls.issue += 1;
        if (!state.online) return failed(new Error("offline"));
        const account = accountOf(token, active);
        if (account === null) return failed(new Error("no session"));
        const id = crypto.randomUUID();
        const secret = randomBytes(32);
        locks.set(id, { account, secret });
        return success({ id, secret: secret.slice() });
      },
      async release(lock: string, password: string, token?: string): Promise<Outcome<Uint8Array>> {
        calls.release += 1;
        if (!state.online) return failed(new Error("offline"));
        const account = accountOf(token, active);
        if (account === null || passwords.get(account) !== password) {
          return refused([{ code: "INVALID_CREDENTIALS", message: "no", field: ["password"] }]);
        }
        const row = locks.get(lock);
        if (row === undefined || row.account !== account) {
          return refused([{ code: "NOT_FOUND", message: "no lock", field: ["lock"] }]);
        }
        return success(row.secret.slice());
      },
      async discard(lock: string, token?: string): Promise<Outcome<true>> {
        calls.discard += 1;
        if (!state.online) return failed(new Error("offline"));
        const account = accountOf(token, active);
        if (locks.get(lock)?.account === account) locks.delete(lock);
        return success(true as const);
      },
    };
  }
  return { locks, passwords, calls, state, api };
}

type World = {
  idb: IDBFactory;
  identity: IdentityStore;
  drafts: ComposeDraftStore;
  seals: SealedDraftStore;
  engine: DeviceLockEngine;
  server: ReturnType<typeof fakeServer>;
  active: { account: string | null };
  /** Accounts whose seen record the engine dropped. */
  seenForgotten: string[];
};

function world(): World {
  const idb = new IDBFactory();
  const active = { account: A as string | null };
  const resolve = () => active.account;
  const identity = createIdentityStore({ activeAccountId: resolve, idb: () => idb });
  const drafts = createComposeDraftStore({ activeAccountId: resolve, idb: () => idb });
  const seals = createSealedDraftStore({ activeAccountId: resolve, idb: () => idb });
  const server = fakeServer();
  const seenForgotten: string[] = [];
  const engine = createDeviceLockEngine({
    identity,
    drafts,
    idb: () => idb,
    api: server.api(resolve),
    exclusive: (_account, fn) => fn(),
    forgetSeen: async (account) => {
      seenForgotten.push(account);
    },
  });
  return { idb, identity, drafts, seals, engine, server, active, seenForgotten };
}

function sampleProposal(): Proposal {
  const body = new StructuralBody({
    author: "aa".repeat(20),
    seq: 1n,
    family: "registration",
    middle: null,
    target: new AddrId("bb".repeat(20)),
    pD: 0.5,
    pI: 0.25,
    settlementRef: null,
    license: null,
    assertedParents: [new ActId("cc".repeat(20), 4n, "opinion")],
  });
  return new Proposal(body, new TextEncoder().encode("payload"), []);
}

function words(text: string): WizardState {
  return { ...emptyWizard(), mode: "words", words: text };
}

/**
 * A signed-in "don't remember" account with the whole custody set: an
 * unbacked key (seed retained), a parked blob, a handshake, a sealed copy
 * and a working draft — and, unless told otherwise, a held lock.
 */
async function signedInForget(w: World, opts: { holdLock?: boolean; backed?: boolean } = {}) {
  const seed = randomBytes(32);
  await w.identity.saveActor(seed, !opts.backed);
  await w.identity.setEphemeral(true);
  await w.identity.savePendingBackupBlob(Uint8Array.of(9, 9, 9));
  const pre = await (await w.identity.actorKey())!.preSign(sampleProposal());
  await w.identity.saveHandshake("staged-1", pre);
  await w.seals.seal(words("sealed post"), { node: "node-1", writes: ["write-1"] });
  await w.drafts.save(words("working draft"));
  if (opts.holdLock !== false) expect(await w.engine.ensureHeld(A)).toBe("held");
  return { seed, pre };
}

const clearTokens = (w: World) => () => {
  w.active.account = null;
};

/** Signs back in as the account: the active account returns, the leg runs. */
async function signInAgain(w: World, account: string, forget: boolean, password = PASSWORD) {
  const leg = await w.engine.signIn(account, password, `token-${account}`, forget);
  if (leg.ready) w.active.account = account;
  return leg;
}

let w: World;
beforeEach(() => {
  w = world();
});

describe("the holding invariant (§3.4)", () => {
  it("forget_on_sign_in_obtains_a_device_lock", async () => {
    w.active.account = null;
    const leg = await signInAgain(w, A, true);
    expect(leg).toEqual({ ready: true, lockLost: false });
    const held = await w.identity.heldLock(A);
    expect(held).not.toBeNull();
    expect(held!.key.extractable).toBe(false);
    expect(w.server.locks.get(held!.id)?.account).toBe(A);
  });

  it("forget_switch_on_obtains_a_lock_and_off_discards_it", async () => {
    expect(await w.engine.ensureHeld(A)).toBe("held");
    const id = (await w.identity.lockIdOf(A))!;
    expect(w.server.locks.has(id)).toBe(true);
    await w.engine.discard(A);
    expect(await w.identity.heldLock(A)).toBeNull();
    expect(await w.identity.lockIdOf(A)).toBeNull();
    expect(w.server.locks.has(id)).toBe(false);
  });

  it("a_missing_lock_is_retried_on_signed_in_start", async () => {
    w.server.state.online = false;
    expect(await w.engine.ensureHeld(A)).toBe("failed");
    expect(await w.identity.heldLock(A)).toBeNull();
    w.server.state.online = true;
    // The start's retry (`DeviceLockKeeper`) is the same call.
    expect(await w.engine.ensureHeld(A)).toBe("held");
    expect(w.server.calls.issue).toBe(2);
  });

  it("a held lock is never re-issued", async () => {
    await w.engine.ensureHeld(A);
    await w.engine.ensureHeld(A);
    expect(w.server.calls.issue).toBe(1);
  });
});

describe("LOCK (§3.5)", () => {
  it("keep_them_locked_seals_until_online_reauth", async () => {
    const { seed, pre } = await signedInForget(w);
    expect(await w.engine.lock(A, clearTokens(w))).toBe(true);
    expect(w.active.account).toBeNull();
    // Nothing reads back while signed out…
    expect(await w.identity.lockedSet(A)).not.toBeNull();
    expect(await w.identity.heldLock(A)).toBeNull();
    // …and the sign-in with the current password, online, brings it all back.
    expect(await signInAgain(w, A, true)).toEqual({ ready: true, lockLost: false });
    expect(equalBytes((await w.identity.actorSeed())!, seed)).toBe(true);
    expect(await w.identity.actorKey()).not.toBeNull();
    expect(await w.identity.pendingBackupBlob()).toEqual(Uint8Array.of(9, 9, 9));
    expect((await w.identity.handshake("staged-1"))?.preSignature).toEqual(pre.preSignature);
    expect((await w.drafts.load())?.words).toBe("working draft");
    expect((await w.seals.list()).map((s) => s.state.words)).toEqual(["sealed post"]);
    expect(await w.identity.lockedSet(A)).toBeNull();
    // The released lock is held again — no new one was minted.
    expect(w.server.calls.issue).toBe(1);
    expect(await w.identity.heldLock(A)).not.toBeNull();
  });

  it("keep_them_locked_leaves_no_usable_key_draft_or_pick", async () => {
    const { seed } = await signedInForget(w);
    await w.engine.lock(A, clearTokens(w));
    w.active.account = A; // even read as the account, nothing is there
    expect(await w.identity.actorKey()).toBeNull();
    expect(await w.identity.actorSeed()).toBeNull();
    expect(await w.identity.pendingBackupBlob()).toBeNull();
    expect(await w.identity.handshakeIds()).toEqual([]);
    expect(await w.identity.heldLock(A)).toBeNull();
    expect(await w.drafts.load()).toBeNull();
    expect(await w.seals.list()).toEqual([]);
    expect(await hasDraftCustody(w.idb, A)).toBe(false);
    // The locked set holds ciphertext only: the seed's bytes appear nowhere.
    const locked = (await w.identity.lockedSet(A))!;
    expect(locked.map((r) => `${r.kind}/${r.key}`).sort()).toEqual(
      ["draft/" + A, "draft/sealed:" + A + ":write-1", "handshake/staged-1", "identity/actor", "identity/pendingBackup"].sort(),
    );
    for (const { record } of locked) {
      for (let i = 0; i + seed.length <= record.length; i++) {
        expect(equalBytes(record.slice(i, i + seed.length), seed)).toBe(false);
      }
    }
  });

  it("keep_them_locked_works_offline_when_a_lock_is_held", async () => {
    await signedInForget(w);
    w.server.state.online = false;
    const before = { ...w.server.calls };
    expect(await w.engine.lock(A, clearTokens(w))).toBe(true);
    expect(w.server.calls).toEqual(before);
    expect(await w.identity.lockedSet(A)).not.toBeNull();
  });

  it("a lock with no lock held clears the session and changes nothing else", async () => {
    await signedInForget(w, { holdLock: false });
    expect(await w.engine.lock(A, clearTokens(w))).toBe(false);
    expect(w.active.account).toBeNull();
    expect(await w.identity.lockedSet(A)).toBeNull();
    expect(await hasDraftCustody(w.idb, A)).toBe(true);
  });

  it("a_draft_write_racing_the_lock_never_lands_in_plaintext", async () => {
    await signedInForget(w);
    // An autosave that began while signed in, still reading its blobs when
    // the lock clears the tokens.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: WizardState = {
      ...words("late autosave"),
      mode: "media",
      assets: [
        {
          id: "asset-1",
          file: Object.assign(new Blob([Uint8Array.of(1, 2, 3)], { type: "image/webp" }), {
            arrayBuffer: async () => {
              await gate;
              return Uint8Array.of(1, 2, 3).buffer;
            },
          }),
          upload: { kind: "waiting" },
        } as unknown as WizardState["assets"][number],
      ],
    };
    const racing = w.drafts.save(slow);
    await w.engine.lock(A, clearTokens(w));
    release();
    await racing;
    expect(await hasDraftCustody(w.idb, A)).toBe(false);
  });

  it("an_interrupted_lock_completes_on_next_start", async () => {
    await signedInForget(w);
    // A crash right after step 2: pending marked, tokens gone, nothing locked.
    await w.identity.setLockPending(A, true);
    w.active.account = null;
    expect(await w.identity.lockedSet(A)).toBeNull();
    await w.engine.recover();
    expect(await w.identity.lockedSet(A)).not.toBeNull();
    expect(await w.identity.isLockPending(A)).toBe(false);
    expect(await hasDraftCustody(w.idb, A)).toBe(false);
    expect(await w.identity.custodyOf(A)).toMatchObject({ seed: null, hasActor: false, backupBlob: null });
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect((await w.drafts.load())?.words).toBe("working draft");
  });

  it("a_locked_slot_with_a_leftover_plaintext_draft_deletes_it_on_start", async () => {
    await signedInForget(w);
    await w.engine.lock(A, clearTokens(w));
    // A plaintext draft that landed after the lock (another tab's write).
    w.active.account = A;
    await w.drafts.save(words("leftover"));
    w.active.account = null;
    expect(await hasDraftCustody(w.idb, A)).toBe(true);
    await w.engine.recover();
    expect(await hasDraftCustody(w.idb, A)).toBe(false);
    // The locked set is untouched, and unlocks to the draft it locked.
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect((await w.drafts.load())?.words).toBe("working draft");
  });

  it("a second lock racing the first never overwrites the locked set", async () => {
    await signedInForget(w);
    const held = (await w.identity.heldLock(A))!;
    await w.engine.lock(A, clearTokens(w));
    const first = await w.identity.lockedSet(A);
    // A late commit with what an emptied slot reads now.
    expect(await w.identity.commitLock(A, [])).toBe(false);
    expect(await w.identity.lockedSet(A)).toEqual(first);
    expect(held.id).toBe(await w.identity.lockIdOf(A));
  });
});

describe("the remote path (§3.6)", () => {
  it("remote_session_end_never_purges_and_never_asks", async () => {
    const { seed } = await signedInForget(w);
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("locked");
    // Nothing destroyed: the whole set comes back at the next sign-in.
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect(equalBytes((await w.identity.actorSeed())!, seed)).toBe(true);
  });

  it("remote_end_locks_an_unbacked_key_draft_and_kept_picks", async () => {
    await signedInForget(w);
    await w.engine.endLocalSession(A, clearTokens(w));
    const kinds = (await w.identity.lockedSet(A))!.map((r) => `${r.kind}/${r.key}`);
    expect(kinds).toContain("identity/actor");
    expect(kinds).toContain(`draft/${A}`);
    expect(kinds).toContain(`draft/sealed:${A}:write-1`);
    expect(await hasDraftCustody(w.idb, A)).toBe(false);
  });

  it("remote_end_purges_a_backed_key_but_locks_draft_and_kept_picks", async () => {
    await signedInForget(w, { backed: true });
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("locked");
    const kinds = (await w.identity.lockedSet(A))!.map((r) => r.kind);
    expect(kinds.every((k) => k === "draft")).toBe(true);
    expect(kinds.length).toBe(2);
    expect(await w.identity.custodyOf(A)).toMatchObject({ hasActor: false, backupBlob: null, handshakes: [] });
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect(await w.identity.actorKey()).toBeNull();
    expect((await w.drafts.load())?.words).toBe("working draft");
  });

  it("remote_end_with_unknown_backup_state_locks", async () => {
    // The account's read may say backed, but a retained seed proves
    // nothing (the post-upload wipe is best effort): unknown → lock.
    await signedInForget(w);
    await w.engine.endLocalSession(A, clearTokens(w));
    expect((await w.identity.lockedSet(A))!.map((r) => r.key)).toContain("actor");
  });

  it("remote_end_of_a_remembered_account_changes_nothing", async () => {
    const seed = randomBytes(32);
    await w.identity.saveActor(seed, true);
    await w.drafts.save(words("kept"));
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("kept");
    expect(w.active.account).toBeNull();
    expect(await w.identity.lockedSet(A)).toBeNull();
    w.active.account = A;
    expect(equalBytes((await w.identity.actorSeed())!, seed)).toBe(true);
    expect((await w.drafts.load())?.words).toBe("kept");
  });

  it("a_remote_end_without_a_held_lock_keeps_everything_and_never_destroys_it", async () => {
    // PR-61's residual: the issue never landed and the session died first.
    const { seed } = await signedInForget(w, { holdLock: false });
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("refused");
    // Refused: signed out, no custody read resolves to the account…
    expect(await w.identity.actorKey()).toBeNull();
    expect(await w.drafts.load()).toBeNull();
    // …and nothing destroyed: the material waits for this account's next sign-in.
    expect(await w.identity.lockedSet(A)).toBeNull();
    expect(equalBytes((await w.identity.custodyOf(A)).seed!, seed)).toBe(true);
    expect(await hasDraftCustody(w.idb, A)).toBe(true);
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect((await w.drafts.load())?.words).toBe("working draft");
  });

  it("a_forget_on_remote_end_clears_that_accounts_seen_record_and_never_locks_it", async () => {
    // PR-69 beside the lock: the seen record is a cache of the server's view
    // log, dropped for this account alone, and the lock set never carries it.
    await signedInForget(w);
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("locked");
    expect(w.seenForgotten).toEqual([A]);
    const kinds = (await w.identity.lockedSet(A))!.map((r) => r.kind);
    expect(kinds.every((k) => k !== "seen")).toBe(true);
  });

  it("the residual remote end clears the seen record too, and a remembered end keeps it", async () => {
    await signedInForget(w, { holdLock: false });
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("refused");
    expect(w.seenForgotten).toEqual([A]);
    w.active.account = B;
    expect(await w.engine.endLocalSession(B, clearTokens(w))).toBe("kept");
    expect(w.seenForgotten).toEqual([A]);
  });

  it("the backed-key purge never removes an unbacked key, whoever calls it", async () => {
    const { seed } = await signedInForget(w, { holdLock: false });
    await w.identity.purgeBackedKeyMaterial(A);
    expect(equalBytes((await w.identity.actorSeed())!, seed)).toBe(true);
    expect(await w.identity.pendingBackupBlob()).not.toBeNull();
  });

  it("a remote end without a lock still purges a backed key, and keeps the draft", async () => {
    await signedInForget(w, { backed: true, holdLock: false });
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("refused");
    expect((await w.identity.custodyOf(A)).hasActor).toBe(false);
    expect(await hasDraftCustody(w.idb, A)).toBe(true);
  });
});

describe("UNLOCK (§3.5)", () => {
  it("sign_in_with_current_credentials_unlocks_before_the_shell_renders", async () => {
    await signedInForget(w);
    await w.engine.lock(A, clearTokens(w));
    // The leg runs with no active account — the tokens are not committed yet.
    const leg = await w.engine.signIn(A, PASSWORD, `token-${A}`, true);
    expect(w.active.account).toBeNull();
    expect(leg.ready).toBe(true);
    expect(await w.identity.lockedSet(A)).toBeNull();
    expect((await w.identity.custodyOf(A)).seed).not.toBeNull();
  });

  it("an old password never unlocks after a reset", async () => {
    await signedInForget(w);
    await w.engine.lock(A, clearTokens(w));
    w.server.passwords.set(A, "the new one");
    expect((await signInAgain(w, A, true, PASSWORD)).ready).toBe(false);
    expect(await w.identity.lockedSet(A)).not.toBeNull();
    expect((await signInAgain(w, A, true, "the new one")).ready).toBe(true);
  });

  it("sign_in_unlock_without_an_answer_reads_didnt_send_and_retries_without_a_second_login", async () => {
    // The engine half: no answer keeps everything locked and the leg can run
    // again on the same session (the form's half is in login-form.test).
    await signedInForget(w);
    await w.engine.lock(A, clearTokens(w));
    w.server.state.online = false;
    expect(await w.engine.signIn(A, PASSWORD, `token-${A}`, true)).toEqual({ ready: false, lockLost: false });
    expect(await w.identity.lockedSet(A)).not.toBeNull();
    w.server.state.online = true;
    expect((await w.engine.signIn(A, PASSWORD, `token-${A}`, true)).ready).toBe(true);
  });

  it("sign_in_with_the_box_unchecked_unlocks_and_discards_the_lock", async () => {
    await signedInForget(w);
    const id = (await w.identity.lockIdOf(A))!;
    await w.engine.lock(A, clearTokens(w));
    expect((await signInAgain(w, A, false)).ready).toBe(true);
    expect(await w.identity.lockedSet(A)).toBeNull();
    expect(await w.identity.heldLock(A)).toBeNull();
    expect(await w.identity.lockIdOf(A)).toBeNull();
    expect(w.server.locks.has(id)).toBe(false);
    expect((await w.drafts.load())?.words).toBe("working draft");
  });

  it("another_accounts_sign_in_never_touches_a_locked_slot", async () => {
    await signedInForget(w);
    await w.engine.lock(A, clearTokens(w));
    const lockedA = await w.identity.lockedSet(A);
    expect((await signInAgain(w, B, true)).ready).toBe(true);
    await w.drafts.save(words("B's draft"));
    await w.engine.endLocalSession(B, clearTokens(w));
    expect(await w.identity.lockedSet(A)).toEqual(lockedA);
    expect(await hasDraftCustody(w.idb, A)).toBe(false);
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect((await w.drafts.load())?.words).toBe("working draft");
  });

  it("a_forget_on_sign_in_is_not_ready_until_a_lock_is_held", async () => {
    // PR-61: the issue gets no answer, so the sign-in does not complete.
    w.active.account = null;
    w.server.state.online = false;
    w.server.passwords.set(A, PASSWORD);
    expect(await w.engine.signIn(A, PASSWORD, `token-${A}`, true)).toEqual({ ready: false, lockLost: false });
    expect(await w.identity.heldLock(A)).toBeNull();
    w.server.state.online = true;
    expect((await w.engine.signIn(A, PASSWORD, `token-${A}`, true)).ready).toBe(true);
    expect(await w.identity.heldLock(A)).not.toBeNull();
  });

  it("a_dead_lock_completes_the_sign_in_deletes_the_ciphertext_and_reports_it_once", async () => {
    // PR-62: the server can no longer open the lock (its row is gone).
    await signedInForget(w);
    const id = (await w.identity.lockIdOf(A))!;
    await w.engine.lock(A, clearTokens(w));
    w.server.locks.delete(id);
    const leg = await w.engine.signIn(A, PASSWORD, `token-${A}`, true);
    expect(leg).toEqual({ ready: true, lockLost: true });
    expect(await w.identity.lockedSet(A)).toBeNull();
    // A fresh lock is held for the forget-on account going forward.
    const held = await w.identity.heldLock(A);
    expect(held).not.toBeNull();
    expect(held!.id).not.toBe(id);
    // Once: the set is gone, so a later sign-in has nothing to report.
    expect(await w.engine.signIn(A, PASSWORD, `token-${A}`, true)).toEqual({ ready: true, lockLost: false });
  });

  it("a wrong-account release is NOT_FOUND and so a dead lock, never a foreign unlock", async () => {
    await signedInForget(w);
    const id = (await w.identity.lockIdOf(A))!;
    await w.engine.lock(A, clearTokens(w));
    // The row exists but belongs to B: the server answers NOT_FOUND.
    w.server.locks.set(id, { account: B, secret: randomBytes(32) });
    expect((await w.engine.signIn(A, PASSWORD, `token-${A}`, false)).lockLost).toBe(true);
  });

  it("a locked slot's lock is never discarded", async () => {
    await signedInForget(w);
    const id = (await w.identity.lockIdOf(A))!;
    await w.engine.lock(A, clearTokens(w));
    await w.engine.discard(A);
    expect(w.server.locks.has(id)).toBe(true);
    expect(await w.identity.lockIdOf(A)).toBe(id);
    expect(await w.engine.ensureHeld(A)).toBe("failed");
  });
});

describe("the carried expectation rides the draft (PR-88)", () => {
  function carriedOf(world: World) {
    return createCarriedExpectationStore({
      activeAccountId: () => world.active.account,
      idb: () => world.idb,
    });
  }

  it("a_carried_expectation_is_locked_with_the_draft_and_put_back_by_the_unlock", async () => {
    await signedInForget(w);
    const carried = carriedOf(w);
    await carried.save("carried-1", Uint8Array.of(7, 7, 7));
    expect(await w.engine.lock(A, clearTokens(w))).toBe(true);
    const keys = (await w.identity.lockedSet(A))!.map((r) => `${r.kind}/${r.key}`);
    expect(keys).toContain(`draft/carried:${A}:carried-1`);
    // No plaintext left behind, even read as the account.
    w.active.account = A;
    expect(await carried.get("carried-1")).toBeNull();
    w.active.account = null;
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect(await carried.get("carried-1")).toEqual(Uint8Array.of(7, 7, 7));
  });

  it("a_backed_remote_end_purges_the_key_but_locks_the_carried_expectation_with_the_draft", async () => {
    await signedInForget(w, { backed: true });
    await carriedOf(w).save("carried-1", Uint8Array.of(7, 7, 7));
    expect(await w.engine.endLocalSession(A, clearTokens(w))).toBe("locked");
    const keys = (await w.identity.lockedSet(A))!.map((r) => `${r.kind}/${r.key}`);
    expect(keys).toContain(`draft/carried:${A}:carried-1`);
    expect((await signInAgain(w, A, true)).ready).toBe(true);
    expect(await carriedOf(w).get("carried-1")).toEqual(Uint8Array.of(7, 7, 7));
  });
});
