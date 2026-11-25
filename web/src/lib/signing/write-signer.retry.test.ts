// @vitest-environment node

// CHARACTERISATION, NOT A FIX: what the device does today when a signing
// parks and the surface's Retry is pressed, and Home's Resume is pressed
// after it (audit-parked-acts 2026-11-25, Q1 (c), defect 5).
//
// The REAL write signer runs every leg with real crypto — pre-sign, a real
// host seal, the approve witness — against an MSW host whose prepare rules
// mirror the Rust ones, cited per rule below. Each surface's Retry is a
// fresh prepare followed by `signer.sign` (wizard-view.tsx submit,
// reply-wizard-view.tsx, post-edit-route.tsx:358/453, comment-editor.tsx:482,
// apollo-stance-data.ts:310-321, approval-stance-data.ts:92-110); the tests
// play that pair directly rather than mounting the surfaces.
//
// The proposals carry each kind's real family and shape — own mint, middle,
// chained parent, census-fixed parameters — with an EMPTY payload. The
// payload is checked by the intent step only, identically on both attempts,
// and nothing after it branches on family (write-signer.ts:260-326), so the
// hazard does not depend on it.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it } from "vitest";

import type { StagedWriteState } from "@/__generated__/graphql";
import type { UserError } from "@/lib/api/outcome";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { ActorKey } from "@/lib/crypto/actor-key";
import { fromBase64, randomBytes, toBase64 } from "@/lib/crypto/bytes";
import { Tags } from "@/lib/crypto/hashing";
import {
  CONTENT_EDITION,
  contentCommitment,
  DEPENDENCY_EDITION,
  dependencyCommitment,
  PreSignedProposal,
  Proposal,
  SealedAct,
  StructuralBody,
  VerifiedAct,
} from "@/lib/crypto/handshake";
import { ActId, NodeId, type Family } from "@/lib/crypto/identifiers";
import { decodePreCommitment, encodeProposal, encodeVerifiedAct } from "@/lib/crypto/wire";
import { createIdentityStore, type IdentityStore } from "@/lib/identity/store";
import type { AuthGuard } from "@/lib/session/guard";
import { gqlLink, startMswServer } from "@/test/msw";
import { createCarriedExpectationStore } from "./carried";
import {
  expectation,
  node,
  stanceRecord,
  tagClaim,
  type Expectation,
  type ExpectedWrite,
} from "./intent";
import { createWriteSigner, type WriteResult, type WriteSigner } from "./write-signer";

const server = startMswServer();

const passthroughGuard: AuthGuard = {
  run: (block) => block(),
  prime: async () => {},
  refresh: async () => false,
};

const DEVICE_SEED = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const DEVICE_ADDRESS = await (await ActorKey.fromSeed(DEVICE_SEED)).address();

/** Someone else's post the reply answers, and this author's own post and comment the edits touch. */
const OTHER = "ab".repeat(20);
const PARENT_POST = `mint:act:${OTHER}:3:publish`;
const OWN_POST = `mint:act:${DEVICE_ADDRESS}:1:publish`;
const OWN_COMMENT = `mint:act:${DEVICE_ADDRESS}:2:review`;
const PERSON = `prof:${"bb".repeat(20)}`;
const APPLICANT = `prof:${"cd".repeat(20)}`;

// ---- the simulated host ------------------------------------------------------

type Row = {
  readonly id: string;
  readonly family: Family;
  /** The target the server's in-flight guards key on (staged_writes.target). */
  readonly target: string;
  readonly chained: boolean;
  readonly proposal: Proposal;
  state: StagedWriteState;
  verifiedAct: string | null;
  /** Whether a pre-commitment reached the server (staged_writes.pre_signed_at). */
  preSigned: boolean;
};

function refusal(code: UserError["code"], message: string) {
  return { __typename: "UserError" as const, code, message, field: null };
}

/**
 * The backend's half: staged rows, the submit/seal/approve legs, and the
 * prepare rules of each kind. Faults are injected per staged id, one shot.
 */
class Host {
  readonly rows = new Map<string, Row>();
  /** Every approval the device submitted that the host accepted, in order. */
  readonly approvals: string[] = [];
  /** Every prepare the device asked for, refused ones included. */
  prepares = 0;
  /** staged_writes seq: author-local, allocated per prepare (prepare.rs `allocate_seq`). */
  private seq = 10n;
  private nextId = 1;
  /** Ids whose next ApproveActs dies on the wire (the server never sees it). */
  readonly approveFault = new Set<string>();
  /** Ids whose next SubmitProposals dies on the wire before the server sees it. */
  readonly submitFault = new Set<string>();
  /** Ids the host is slow to seal: SEALING until `releaseSeals()`. */
  readonly slowSeal = new Set<string>();
  /** Applications already marked approved (auth_applications.approved_at). */
  readonly approvedApplications = new Set<string>();

  constructor(
    private readonly hostKey: ActorKey,
    private readonly actorPub: Uint8Array,
  ) {}

  /** The seq a prepare allocates now — the act id the device will sign. */
  allocate(): bigint {
    this.seq += 1n;
    return this.seq;
  }

  stage(family: Family, target: string, body: StructuralBody, chained = false): StagedWriteView {
    const id = `sw-${this.nextId++}`;
    const proposal = new Proposal(body, new Uint8Array(), []);
    this.rows.set(id, {
      id,
      family,
      target,
      chained,
      proposal,
      state: "AWAITING_PRE_SIGN",
      verifiedAct: null,
      preSigned: false,
    });
    return this.view(id);
  }

  view(id: string): StagedWriteView {
    const row = this.row(id);
    return {
      id,
      state: row.state,
      family: row.family.toUpperCase() as StagedWriteView["family"],
      canonicalProposal: toBase64(encodeProposal(row.proposal)),
      verifiedAct: row.state === "AWAITING_APPROVAL" ? row.verifiedAct : null,
    };
  }

  private json(id: string) {
    return { __typename: "StagedWrite", ...this.view(id), record: null };
  }

  row(id: string): Row {
    const row = this.rows.get(id);
    if (row === undefined) throw new Error(`no staged write ${id}`);
    return row;
  }

  /** The host seals what was held back: SEALING rows move to AWAITING_APPROVAL. */
  releaseSeals() {
    this.slowSeal.clear();
    for (const row of this.rows.values()) {
      if (row.state === "SEALING") row.state = "AWAITING_APPROVAL";
    }
  }

  /** Rows of `family` that reached RELAYING — acts that will land. */
  landed(family: Family): Row[] {
    return [...this.rows.values()].filter((r) => r.family === family && r.state === "RELAYING");
  }

  /**
   * The edit-serialization guard, mirrored from content.rs:1136-1143
   * (`chained_edit_target`): first `supersede_unsigned_targeting`
   * (staged.rs:672-699 — expire the actor's chained rows of the family
   * toward the target still in `awaiting_pre_sign`), then
   * `has_pending_targeting` (staged.rs:632-650 — any row of the family
   * toward the target not in ('expired', 'landed')) refuses BAD_INPUT
   * "an edit of this content is already in flight".
   */
  editGuard(family: Family, target: string): UserError | null {
    for (const row of this.rows.values()) {
      if (
        row.family === family &&
        row.target === target &&
        row.chained &&
        row.state === "AWAITING_PRE_SIGN"
      ) {
        row.state = "EXPIRED";
      }
    }
    // A LANDED row would not count either; this host relays and never lands,
    // so RELAYING (which the Rust guard does count) is the furthest state.
    const pending = [...this.rows.values()].some(
      (r) => r.family === family && r.target === target && r.state !== "EXPIRED",
    );
    return pending
      ? { code: "BAD_INPUT", message: "an edit of this content is already in flight", field: "id" }
      : null;
  }

  async preFrom(row: Row, signature: string): Promise<PreSignedProposal> {
    const blob = decodePreCommitment(fromBase64(signature));
    return new PreSignedProposal({
      proposal: row.proposal,
      authorPubkey: this.actorPub,
      contentNonce: blob.contentNonce,
      dependencyNonce: blob.dependencyNonce,
      preSignature: blob.preSignature,
    });
  }

  async seal(pre: PreSignedProposal): Promise<string> {
    const body = pre.proposal.body;
    const contentSalt = randomBytes(32);
    const depsSalt = randomBytes(32);
    const formed = await pre.preCommitment();
    const actId = body.actId();
    const act = new VerifiedAct({
      body,
      preCommitment: formed,
      preSignature: pre.preSignature,
      contentCommitment: await contentCommitment(actId, formed, contentSalt, await pre.contentPreDigest()),
      depsCommitment: await dependencyCommitment(actId, formed, depsSalt, pre.proposal.deps),
      contentEdition: CONTENT_EDITION,
      depsEdition: DEPENDENCY_EDITION,
    });
    const sealed = new SealedAct({
      act,
      contentSalt,
      depsSalt,
      hostSeal: await this.hostKey.signTagged(Tags.HOST_SEAL, act.sealMsg()),
    });
    return toBase64(encodeVerifiedAct(sealed));
  }

  handlers() {
    return [
      gqlLink.query("HostPublicKey", () =>
        HttpResponse.json({ data: { hostPublicKey: toBase64(this.hostKey.publicKeyBytes()) } }),
      ),
      gqlLink.mutation("SubmitProposals", async ({ variables }) => {
        const input = (variables as { input: { proposals: { stagedWriteId: string; signature: string }[] } })
          .input;
        const { stagedWriteId: id, signature } = input.proposals[0];
        if (this.submitFault.delete(id)) return HttpResponse.error();
        const row = this.row(id);
        if (row.state === "EXPIRED") {
          return HttpResponse.json({
            data: {
              submitProposals: {
                __typename: "SubmitProposalsPayload",
                stagedWrites: null,
                userErrors: [refusal("STAGED_WRITE_EXPIRED", "garbage-collected")],
              },
            },
          });
        }
        row.verifiedAct = await this.seal(await this.preFrom(row, signature));
        row.preSigned = true;
        row.state = this.slowSeal.has(id) ? "SEALING" : "AWAITING_APPROVAL";
        return HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [this.json(id)],
              userErrors: [],
            },
          },
        });
      }),
      gqlLink.query("StagedWrite", ({ variables }) => {
        const id = (variables as { id: string }).id;
        return HttpResponse.json({
          data: { stagedWrite: this.rows.has(id) ? this.json(id) : null },
        });
      }),
      gqlLink.mutation("ApproveActs", ({ variables }) => {
        const input = (variables as { input: { approvals: { stagedWriteId: string }[] } }).input;
        const id = input.approvals[0].stagedWriteId;
        if (this.approveFault.delete(id)) return HttpResponse.error();
        const row = this.row(id);
        row.state = "RELAYING";
        this.approvals.push(id);
        return HttpResponse.json({
          data: {
            approveActs: {
              __typename: "ApproveActsPayload",
              stagedWrites: [this.json(id)],
              userErrors: [],
            },
          },
        });
      }),
    ];
  }
}

// ---- the act kinds: each one's prepare and its gesture's expectation --------

type Prepared =
  | { kind: "staged"; writes: StagedWriteView[]; expected: Expectation }
  | { kind: "refused"; errors: UserError[] };

function body(fields: {
  seq: bigint;
  family: Family;
  middle: string | null;
  target: string;
  pD: number;
  pI: number;
  license: string | null;
  parents?: ActId[];
}): StructuralBody {
  return new StructuralBody({
    author: DEVICE_ADDRESS,
    seq: fields.seq,
    family: fields.family,
    middle: fields.middle === null ? null : NodeId.parse(fields.middle),
    target: NodeId.parse(fields.target),
    pD: fields.pD,
    pI: fields.pI,
    settlementRef: null,
    license: fields.license,
    assertedParents: fields.parents ?? [],
  });
}

/** A write the gesture ordered, payload-free (see the header). */
function ordered(write: Omit<ExpectedWrite, "payload">): ExpectedWrite {
  return { ...write, payload: "empty" };
}

/**
 * A new post: genesis Publish (own mint, p_i census-fixed 1) plus one Tag on
 * the node it mints — content.rs:687-760 `prepare_post`. No in-flight guard:
 * every call mints a fresh node (`Uuid::new_v4()`, content.rs:713) and a
 * fresh seq.
 */
function preparePost(host: Host): Prepared {
  host.prepares += 1;
  const genesisSeq = host.allocate();
  const mint = `mint:act:${DEVICE_ADDRESS}:${genesisSeq}:publish`;
  const genesis = host.stage(
    "publish",
    mint,
    body({ seq: genesisSeq, family: "publish", middle: null, target: mint, pD: 0.1, pI: 1, license: "a=0;o=0" }),
  );
  const tagSeq = host.allocate();
  const tag = host.stage(
    "tag",
    "name:rust",
    body({ seq: tagSeq, family: "tag", middle: mint, target: "name:rust", pD: 0.3, pI: 1, license: null }),
  );
  return {
    kind: "staged",
    writes: [genesis, tag],
    expected: expectation([
      ordered({
        family: "publish",
        middle: null,
        target: { kind: "ownMint" },
        pDirected: 0.1,
        pInterest: 1,
        license: "a=0;o=0",
        parents: "none",
      }),
      tagClaim({ kind: "mintedBy", write: 0 }, "rust", 0.3, 1),
    ]),
  };
}

/** A reply: genesis Review, A leg at the parent — content.rs:952-1040 `prepare_comment`, no guard. */
function prepareReply(host: Host): Prepared {
  host.prepares += 1;
  const seq = host.allocate();
  const mint = `mint:act:${DEVICE_ADDRESS}:${seq}:review`;
  const write = host.stage(
    "review",
    mint,
    body({ seq, family: "review", middle: PARENT_POST, target: mint, pD: 0.2, pI: 0.1, license: "a=0;o=0" }),
  );
  return {
    kind: "staged",
    writes: [write],
    expected: expectation([
      ordered({
        family: "review",
        middle: node(PARENT_POST),
        target: { kind: "ownMint" },
        pDirected: 0.2,
        pInterest: 0.1,
        license: "a=0;o=0",
        parents: "none",
      }),
    ]),
  };
}

/** A post edit: chained Publish toward the own post — content.rs:870-938, guarded by `chained_edit_target`. */
function preparePostEdit(host: Host): Prepared {
  host.prepares += 1;
  const refused = host.editGuard("publish", OWN_POST);
  if (refused !== null) return { kind: "refused", errors: [refused] };
  const seq = host.allocate();
  const head = new ActId(DEVICE_ADDRESS, 1n, "publish");
  const write = host.stage(
    "publish",
    OWN_POST,
    body({ seq, family: "publish", middle: null, target: OWN_POST, pD: 0, pI: 1, license: null, parents: [head] }),
    true,
  );
  return {
    kind: "staged",
    writes: [write],
    expected: expectation([
      ordered({
        family: "publish",
        middle: null,
        target: node(OWN_POST),
        pDirected: 0,
        pInterest: 1,
        license: null,
        parents: "ownChainHead",
      }),
    ]),
  };
}

/** A comment edit: chained Review at (0,0) — content.rs:1045-1110, the same guard. */
function prepareCommentEdit(host: Host): Prepared {
  host.prepares += 1;
  const refused = host.editGuard("review", OWN_COMMENT);
  if (refused !== null) return { kind: "refused", errors: [refused] };
  const seq = host.allocate();
  const head = new ActId(DEVICE_ADDRESS, 2n, "review");
  const write = host.stage(
    "review",
    OWN_COMMENT,
    body({
      seq,
      family: "review",
      middle: PARENT_POST,
      target: OWN_COMMENT,
      pD: 0,
      pI: 0,
      license: null,
      parents: [head],
    }),
    true,
  );
  return {
    kind: "staged",
    writes: [write],
    expected: expectation([
      ordered({
        family: "review",
        middle: node(PARENT_POST),
        target: node(OWN_COMMENT),
        pDirected: 0,
        pInterest: 0,
        license: null,
        parents: "ownChainHead",
      }),
    ]),
  };
}

/**
 * A tag added inside an edit whose record is unchanged: a standalone Tag —
 * topics.rs:295-321 `prepare_tag`, no in-flight guard (only the standing
 * cap, over live names).
 */
function prepareEditTag(host: Host): Prepared {
  host.prepares += 1;
  const seq = host.allocate();
  const write = host.stage(
    "tag",
    "name:rust",
    body({ seq, family: "tag", middle: OWN_POST, target: "name:rust", pD: 0.3, pI: 1, license: null }),
  );
  return {
    kind: "staged",
    writes: [write],
    expected: expectation([tagClaim(node(OWN_POST), "rust", 0.3, 1)]),
  };
}

/** A stance pick: one Opinion carrying exactly the pick — stance.rs:241-275, no guard. */
function prepareStance(host: Host): Prepared {
  host.prepares += 1;
  const seq = host.allocate();
  const write = host.stage(
    "opinion",
    PERSON,
    body({ seq, family: "opinion", middle: null, target: PERSON, pD: 0.4, pI: 0.2, license: null }),
  );
  return { kind: "staged", writes: [write], expected: expectation([stanceRecord(PERSON, 0.4, 0.2)]) };
}

/**
 * The approval vouch: `approve_applicants` (onboarding.rs:434-495) refuses
 * an application already marked approved — `validate_approval` →
 * `still_waiting` (onboarding.rs:530-541, :636) answers BAD_INPUT "already
 * approved"; the mark is set at the prepare (postgres-store auth.rs:938-952)
 * and cleared only when no live vouch remains (auth.rs:1246-1258).
 */
function prepareApproval(host: Host): Prepared {
  host.prepares += 1;
  if (host.approvedApplications.has("app-1")) {
    return { kind: "refused", errors: [{ code: "BAD_INPUT", message: "already approved", field: "application" }] };
  }
  host.approvedApplications.add("app-1");
  const seq = host.allocate();
  const write = host.stage(
    "opinion",
    APPLICANT,
    body({ seq, family: "opinion", middle: null, target: APPLICANT, pD: 0.5, pI: 0.5, license: null }),
  );
  return { kind: "staged", writes: [write], expected: expectation([stanceRecord(APPLICANT, 0.5, 0.5)]) };
}

// ---- the sequence ------------------------------------------------------------

type Attempt = { kind: "refused"; errors: UserError[] } | { kind: "signed"; results: WriteResult[] };

describe("Retry after a parked signing, then Resume (characterisation)", () => {
  let store: IdentityStore;
  let signer: WriteSigner;
  let host: Host;

  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore({ activeAccountId: () => "acct-1" });
    const saved = await store.saveActor(DEVICE_SEED.slice(), true);
    host = new Host(await ActorKey.generate(), saved.publicKeyBytes());
    server.use(
      ...host.handlers(),
      gqlLink.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "acct-1",
              handle: "ada",
              displayName: { __typename: "DisplayField", value: "Ada" },
              actorPubkey: toBase64(saved.publicKeyBytes()),
              accountState: "MEMBER",
              hasReciprocated: true,
              vouchBackDismissed: false,
              invitedBy: null,
            },
          },
        }),
      ),
    );
    signer = createWriteSigner({
      client: new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({ uri: "http://localhost/graphql" }),
      }),
      guard: passthroughGuard,
      store,
      carried: createCarriedExpectationStore({ activeAccountId: () => "acct-1" }),
      sleep: () => Promise.resolve(),
    });
  });

  /** What a surface's commit (and so its Retry) does: a fresh prepare, then sign. */
  async function press(prepare: (host: Host) => Prepared): Promise<Attempt> {
    const prepared = prepare(host);
    if (prepared.kind === "refused") return prepared;
    return { kind: "signed", results: await signer.sign(prepared.writes, prepared.expected) };
  }

  /** Attempt 1 parks at AWAITING_APPROVAL: its approve dies on the wire. */
  async function parkAtApproval(prepare: (host: Host) => Prepared): Promise<string[]> {
    const before = new Set(host.rows.keys());
    const prepared = prepare(host);
    if (prepared.kind !== "staged") throw new Error("attempt 1 must stage");
    for (const w of prepared.writes) host.approveFault.add(w.id);
    const results = await signer.sign(prepared.writes, prepared.expected);
    expect(results.every((r) => r.kind === "failed")).toBe(true);
    const ids = [...host.rows.keys()].filter((id) => !before.has(id));
    for (const id of ids) expect(host.row(id).state).toBe("AWAITING_APPROVAL");
    return ids;
  }

  // ---- post ----

  it("a retried post leaves its first attempt parked and Resume approves it too: two posts land", async () => {
    const first = await parkAtApproval(preparePost);
    expect(await store.handshakeIds()).toEqual(expect.arrayContaining(first));

    const retry = await press(preparePost);
    expect(retry.kind === "signed" && retry.results.every((r) => r.kind === "done")).toBe(true);
    // The retry staged a NEW batch: a second genesis, a second tag.
    expect(host.prepares).toBe(2);
    expect(await store.handshakeIds()).toEqual(expect.arrayContaining(first));

    const resumed = await signer.resume();
    expect(resumed.map((r) => r.kind)).toEqual(["done", "done"]);
    expect(resumed.map((r) => r.id).sort()).toEqual([...first].sort());

    // Four approvals for one gesture: two genesis Publishes, two Tags.
    expect(host.approvals).toHaveLength(4);
    expect(host.landed("publish")).toHaveLength(2);
    expect(host.landed("tag")).toHaveLength(2);
    expect(new Set(host.landed("publish").map((r) => r.target)).size).toBe(2);
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("a post parked at SEALING (seal budget spent) is approved by Resume after the retry landed: two posts", async () => {
    const before = new Set(host.rows.keys());
    const prepared = preparePost(host);
    if (prepared.kind !== "staged") throw new Error("attempt 1 must stage");
    for (const w of prepared.writes) host.slowSeal.add(w.id);
    const results = await signer.sign(prepared.writes, prepared.expected);
    expect(results.map((r) => r.kind)).toEqual(["awaitingSeal", "awaitingSeal"]);
    const first = [...host.rows.keys()].filter((id) => !before.has(id));

    const retry = await press(preparePost);
    expect(retry.kind === "signed" && retry.results.every((r) => r.kind === "done")).toBe(true);

    host.releaseSeals();
    const resumed = await signer.resume();
    expect(resumed.map((r) => r.kind)).toEqual(["done", "done"]);
    expect(resumed.map((r) => r.id).sort()).toEqual([...first].sort());
    expect(host.landed("publish")).toHaveLength(2);
  });

  it("a post whose submit died before the server saw it is re-submitted by Resume after the retry: two posts", async () => {
    const prepared = preparePost(host);
    if (prepared.kind !== "staged") throw new Error("attempt 1 must stage");
    // The genesis's submit dies on the wire; the material was saved first (write-signer.ts:278).
    host.submitFault.add(prepared.writes[0].id);
    host.submitFault.add(prepared.writes[1].id);
    const results = await signer.sign(prepared.writes, prepared.expected);
    expect(results.map((r) => r.kind)).toEqual(["failed", "failed"]);
    expect(host.row(prepared.writes[0].id).state).toBe("AWAITING_PRE_SIGN");

    await press(preparePost);
    const resumed = await signer.resume();
    expect(resumed.map((r) => r.kind)).toEqual(["done", "done"]);
    expect(host.landed("publish")).toHaveLength(2);
  });

  // ---- reply ----

  it("a retried reply leaves its first attempt parked and Resume approves it too: two replies land", async () => {
    const first = await parkAtApproval(prepareReply);
    await press(prepareReply);
    expect(host.prepares).toBe(2);
    const resumed = await signer.resume();
    expect(resumed).toEqual([{ kind: "done", id: first[0], state: "RELAYING" }]);
    expect(host.landed("review")).toHaveLength(2);
    expect(host.approvals).toHaveLength(2);
  });

  // ---- post edit and comment edit ----

  it("a retried post edit is refused while the first is in flight, and Resume lands the first: one edit", async () => {
    const first = await parkAtApproval(preparePostEdit);
    const retry = await press(preparePostEdit);
    // The server's serialization refuses the second prepare; nothing new is signed.
    expect(retry).toEqual({
      kind: "refused",
      errors: [expect.objectContaining({ code: "BAD_INPUT", message: "an edit of this content is already in flight" })],
    });
    expect(host.rows.size).toBe(1);
    const resumed = await signer.resume();
    expect(resumed).toEqual([{ kind: "done", id: first[0], state: "RELAYING" }]);
    expect(host.landed("publish")).toHaveLength(1);
  });

  it("a post edit whose submit died unseen is superseded by the retry, and Resume clears it: one edit", async () => {
    const prepared = preparePostEdit(host);
    if (prepared.kind !== "staged") throw new Error("attempt 1 must stage");
    host.submitFault.add(prepared.writes[0].id);
    const [result] = await signer.sign(prepared.writes, prepared.expected);
    expect(result.kind).toBe("failed");
    expect(await store.handshakeIds()).toEqual([prepared.writes[0].id]);

    const retry = await press(preparePostEdit);
    expect(retry.kind === "signed" && retry.results[0].kind === "done").toBe(true);
    // supersede_unsigned_targeting expired attempt 1 at the retry's prepare.
    expect(host.row(prepared.writes[0].id).state).toBe("EXPIRED");

    const resumed = await signer.resume();
    expect(resumed).toEqual([
      expect.objectContaining({ kind: "refused", id: prepared.writes[0].id }),
    ]);
    expect(host.landed("publish")).toHaveLength(1);
    expect(await store.handshakeIds()).toEqual([]);
  });

  it("a retried comment edit is refused while the first is in flight, and Resume lands the first: one edit", async () => {
    const first = await parkAtApproval(prepareCommentEdit);
    const retry = await press(prepareCommentEdit);
    expect(retry.kind).toBe("refused");
    const resumed = await signer.resume();
    expect(resumed).toEqual([{ kind: "done", id: first[0], state: "RELAYING" }]);
    expect(host.landed("review")).toHaveLength(1);
  });

  it("a retried tag added inside an edit is not serialized, and Resume approves the first too: two Tag acts", async () => {
    const first = await parkAtApproval(prepareEditTag);
    await press(prepareEditTag);
    const resumed = await signer.resume();
    expect(resumed).toEqual([{ kind: "done", id: first[0], state: "RELAYING" }]);
    expect(host.landed("tag")).toHaveLength(2);
  });

  // ---- stance ----

  it("a retried stance pick leaves its first attempt parked and Resume approves it too: the pick is summed twice", async () => {
    const first = await parkAtApproval(prepareStance);
    await press(prepareStance);
    const resumed = await signer.resume();
    expect(resumed).toEqual([{ kind: "done", id: first[0], state: "RELAYING" }]);
    const opinions = host.landed("opinion");
    expect(opinions).toHaveLength(2);
    // The bundle is the SUM of the author's records toward the target
    // (postgres-store stance.rs:82-125 `standing`): one pick, counted twice.
    const sum = opinions.reduce(
      (acc, r) => ({ pD: acc.pD + r.proposal.body.pD, pI: acc.pI + r.proposal.body.pI }),
      { pD: 0, pI: 0 },
    );
    expect(sum.pD).toBeCloseTo(0.8);
    expect(sum.pI).toBeCloseTo(0.4);
  });

  // ---- the approval vouch ----

  it("a retried approval is refused as already approved, and Resume lands the first vouch: one vouch", async () => {
    const first = await parkAtApproval(prepareApproval);
    const retry = await press(prepareApproval);
    expect(retry).toEqual({
      kind: "refused",
      errors: [expect.objectContaining({ code: "BAD_INPUT", message: "already approved" })],
    });
    const resumed = await signer.resume();
    expect(resumed).toEqual([{ kind: "done", id: first[0], state: "RELAYING" }]);
    expect(host.landed("opinion")).toHaveLength(1);
  });
});
