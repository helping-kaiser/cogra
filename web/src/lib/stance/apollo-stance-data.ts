// `StanceData` over the real operations (stance.graphql).
//
// Both reads are the same field: `viewerStance` answers the standing,
// and answers the landing too when it is asked with a pick. So a
// projection costs one round trip and the standing rides along with it —
// there is no second query, and nothing here folds one into the other.
//
// The standings a page's controls ask together travel together: one
// `PageStances` request per view, whatever the page's size (`standing`
// below). A control asking alone, a projection and a topic keep their own
// root read.
//
// Both go through `viewerField` inside the guard, like every other
// viewer-scoped read (outcome.ts): `viewerStance` answers null rather
// than an error for a reader the request did not authenticate, so unless
// that null is lifted where the guard can see it, a read issued before
// this tab has minted an access token comes back empty and nothing
// refreshes. And the cache is not partitioned by viewer, so a viewer's
// own field is never answered from it — a cached null would outlive the
// refresh that fixes it, and a cached bundle would outlive the account
// that earned it.
//
// Both writes are the ordinary staged-write handshake: prepare, then
// sign what came back. A pick prepares one record; a severance prepares
// the whole counter-record batch, and the gesture signs every element of
// it in one pass — the reader agreed to the batch once, at its stated
// cost, so the signing is not re-asked per record (api-spec.md "A
// prepare may stage a batch"). A write left mid-handshake stays staged
// for `resume()`, the recovery every other multi-write gesture relies on.
//
// THE SIGNER CHECKS THE BATCH AGAINST WHAT WAS ON SCREEN (intent.ts). A
// pick must come back as exactly that pair toward the node the read named
// (`targetGraphId`); a severance must net the bundle the reader was shown
// to (0, 0) in exactly the records its cost stated. The node is
// remembered from the reads that rendered the control — the projection
// read always runs right before a pick is signed.

import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

import {
  CommentBorrowedStanceDocument,
  CommentStanceDocument,
  HashtagBorrowedStanceDocument,
  HashtagStanceDocument,
  KeptPickCommentDocument,
  KeptPickPostDocument,
  KeptPickProfileDocument,
  KeyBackupStateDocument,
  PageStancesDocument,
  type PageStancesQuery,
  PostBorrowedStanceDocument,
  PostStanceDocument,
  ProfileBorrowedStanceDocument,
  ProfileStanceDocument,
} from "@/__generated__/graphql";
import { fetchBorrowedView } from "@/lib/api/auth-api";
import {
  failed,
  fetchOutcome,
  refused,
  success,
  unauthenticated,
  viewerField,
  type Outcome,
} from "@/lib/api/outcome";
import { DeviceRefusalError } from "@/lib/signing/device-refusal";
import {
  fetchStagedWrite,
  prepareSeverance,
  prepareStance,
  type StagedWriteView,
  type StanceSelector,
} from "@/lib/api/writes-api";
import { askAgain } from "@/lib/compose/same-signing";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import type { AuthGuard } from "@/lib/session/guard";
import { tokenStore, type TokenStore } from "@/lib/session/token-store";
import {
  expectation,
  joinExpectations,
  severance,
  stanceRecord,
  type Expectation,
} from "@/lib/signing/intent";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import {
  commentPreview,
  postPreview,
  profilePreview,
  topicPreview,
  type KeptTargetPreview,
} from "./kept-preview";
import type { StancePair } from "./model";
import {
  createStanceAttempts,
  KEPT_BATCH,
  keptBatchIntent,
  severanceIntent,
  stanceIntent,
  type Slot,
  type StanceAttempts,
} from "./stance-attempts";

/** A gesture's pressing account: its own remembered attempts, and whether it is still the active one. */
type Pressed = { readonly attempts: StanceAttempts; readonly still: () => boolean };

/** A gesture's batch as staged: its node, its writes, and what the signer checks them against. */
type Staged = {
  readonly node: string;
  readonly writes: readonly StagedWriteView[];
  readonly expected: Expectation;
};
import {
  INCLUDE_PENDING_DEFAULT,
  type BorrowedStance,
  type StanceBundle,
  type StanceCommit,
  type StanceData,
  type StanceProjection,
  type StanceReadOptions,
  type StanceTarget,
} from "./stance-data";

/** Every viewer-scoped read in the app asks the server (outcome.ts). */
const READ_POLICY = "network-only";

/** The `viewerStance` selection, identically shaped across the three roots. */
type WireBundle = {
  readonly targetGraphId: string;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly rawPDirected: number;
  readonly rawPInterest: number;
  readonly recordCount: number;
  readonly inert: boolean;
  readonly severed: boolean;
  readonly severanceCost: number;
  readonly projected: {
    readonly pDirected: number;
    readonly pInterest: number;
    readonly inert: boolean;
    readonly severed: boolean;
  } | null;
};

/** The served standing, as the seam carries it. */
function bundleOf(wire: WireBundle): StanceBundle {
  return {
    current: { pDirected: wire.pDirected, pInterest: wire.pInterest },
    // Carried through unclipped: the landing line folds against these, and
    // the clip is what would lose the history (§8.3).
    rawSum: { pDirected: wire.rawPDirected, pInterest: wire.rawPInterest },
    records: wire.recordCount,
    inert: wire.inert,
    severed: wire.severed,
    severance: { records: wire.severanceCost },
  };
}

/** `{ target: id }` for the id-keyed roots; a topic's own name for the rest. */
function selectorOf(target: StanceTarget): StanceSelector {
  return target.kind === "topic" ? { topicName: target.id } : { target: target.id };
}

function wireBundle(
  client: ApolloClient,
  target: StanceTarget,
  pick: StancePair | null,
  options?: StanceReadOptions,
): Promise<Outcome<WireBundle>> {
  const pickVar = pick === null ? null : { pDirected: pick.pDirected, pInterest: pick.pInterest };
  const includePending = options?.includePending ?? INCLUDE_PENDING_DEFAULT;

  switch (target.kind) {
    case "post":
      return viewerField(
        () =>
          client.query({
            query: PostStanceDocument,
            variables: { id: target.id, pick: pickVar, includePending },
            fetchPolicy: READ_POLICY,
          }),
        (data) => data.post?.viewerStance,
      );
    case "comment":
      return viewerField(
        () =>
          client.query({
            query: CommentStanceDocument,
            variables: { id: target.id, pick: pickVar, includePending },
            fetchPolicy: READ_POLICY,
          }),
        (data) => data.comment?.viewerStance,
      );
    case "profile":
      return viewerField(
        () =>
          client.query({
            query: ProfileStanceDocument,
            variables: { id: target.id, pick: pickVar, includePending },
            fetchPolicy: READ_POLICY,
          }),
        (data) => data.user?.viewerStance,
      );
    // A topic's identity is its name, not a UUID (hashtag.md §1) — the
    // one root that takes `name` where the other three take `id`.
    case "topic":
      return viewerField(
        () =>
          client.query({
            query: HashtagStanceDocument,
            variables: { name: target.id, pick: pickVar, includePending },
            fetchPolicy: READ_POLICY,
          }),
        (data) => data.hashtag?.viewerStance,
      );
  }
}

/** A target as the seam keys it: its kind and id together, since the id alone names no root. */
const keyOfTarget = (target: StanceTarget) => `${target.kind}:${target.id}`;

/**
 * The most ids one `PageStances` request names: the server's cap on a
 * `nodes(ids:)` lookup (`Query.nodes`, `client-constants.json`
 * `paging.maxPageSize`), past which it refuses the whole request.
 */
export const PAGE_STANCES_CHUNK = 100;

/**
 * THE PAGE READ WRITES NOTHING TO THE CACHE (`no-cache`, Apollo's "similar to
 * network-only, except the query's result is not stored in the cache"): it
 * asks the server every time, as every viewer-scoped read does (web.md, "a
 * viewer-scoped read always asks the server"), and since no read answers a
 * face from the cache, storing one would only leave the reader's private
 * standing in a cache that outlives their sign-out.
 */
const PAGE_POLICY = "no-cache";

/**
 * The class each id-keyed kind's own root answers (`post`, `comment`, `user`),
 * typed against the page read's own slots so it cannot name a class the
 * document does not.
 */
const PAGE_CLASS = {
  post: "Post",
  comment: "Comment",
  profile: "User",
} as const satisfies Record<Exclude<StanceTarget["kind"], "topic">, NonNullable<PageStancesQuery["nodes"][number]>["__typename"]>;

/**
 * The standings of many id-keyed targets in one request, each target's own
 * outcome. A slot answers its target only when it is that very id AND of the
 * class the target's kind names — what the target's own root read would have
 * answered (`post(id:)` is null for a comment's id) — so the bundle, and the
 * `targetGraphId` an act toward it will name, is never another class's. An
 * unknown id, a node of another kind, or one that carries no stance, is the
 * refusal the target's own root read gives it.
 *
 * Every target null is the request's own refusal, not each target's: the
 * server answers a request it did not authenticate with a null on every
 * face, so the guard has to see one UNAUTHENTICATED to refresh and replay
 * the batch, as it does a single read.
 */
async function pageRead(
  client: ApolloClient,
  targets: readonly StanceTarget[],
  includePending: boolean,
): Promise<Outcome<ReadonlyMap<string, Outcome<WireBundle>>>> {
  const ids = [...new Set(targets.map((target) => target.id))];
  const fetched = await fetchOutcome(() =>
    client.query({ query: PageStancesDocument, variables: { ids, includePending }, fetchPolicy: PAGE_POLICY }),
  );
  if (fetched.kind !== "success") return fetched;
  const answered = new Map<string, { readonly class: string; readonly wire: WireBundle }>();
  for (const node of fetched.value.nodes) {
    if (node !== null && "viewerStance" in node && node.viewerStance != null) {
      answered.set(node.id, { class: node.__typename, wire: node.viewerStance });
    }
  }
  if (answered.size === 0) return unauthenticated();
  const outcomes = new Map<string, Outcome<WireBundle>>();
  for (const target of targets) {
    if (target.kind === "topic") continue;
    const slot = answered.get(target.id);
    outcomes.set(
      keyOfTarget(target),
      slot !== undefined && slot.class === PAGE_CLASS[target.kind] ? success(slot.wire) : unauthenticated(),
    );
  }
  return success(outcomes);
}

/** The `borrowedStance` selection (`BorrowedStanceFields`). */
type WireBorrowed = {
  readonly pDirected: number;
  readonly pInterest: number;
  readonly recordCount: number;
  readonly inert: boolean;
  readonly severed: boolean;
};

/**
 * A GUEST'S READ NEVER TOUCHES THE CACHE (`no-cache`, Apollo's "doesn't check
 * the cache before making a network request, and doesn't write the result to
 * the cache"): the cache is not partitioned by reader, so a borrowed stance
 * written there could outlive the sign-in that ends the guest's visit.
 *
 * Not through the guard: the read is a guest's by definition — there is no
 * token to refresh and nothing to replay — and its null is an answer (the
 * view holds none), never a refusal.
 */
const BORROWED_POLICY = "no-cache";

function borrowedRead(client: ApolloClient, target: StanceTarget): Promise<Outcome<WireBorrowed | null>> {
  const lift = <T,>(outcome: Outcome<T>, pick: (data: T) => WireBorrowed | null | undefined) =>
    outcome.kind === "success" ? success(pick(outcome.value) ?? null) : outcome;
  switch (target.kind) {
    case "post":
      return fetchOutcome(() =>
        client.query({ query: PostBorrowedStanceDocument, variables: { id: target.id }, fetchPolicy: BORROWED_POLICY }),
      ).then((outcome) => lift(outcome, (data) => data.post?.borrowedStance));
    case "comment":
      return fetchOutcome(() =>
        client.query({ query: CommentBorrowedStanceDocument, variables: { id: target.id }, fetchPolicy: BORROWED_POLICY }),
      ).then((outcome) => lift(outcome, (data) => data.comment?.borrowedStance));
    case "profile":
      return fetchOutcome(() =>
        client.query({ query: ProfileBorrowedStanceDocument, variables: { id: target.id }, fetchPolicy: BORROWED_POLICY }),
      ).then((outcome) => lift(outcome, (data) => data.user?.borrowedStance));
    case "topic":
      return fetchOutcome(() =>
        client.query({ query: HashtagBorrowedStanceDocument, variables: { name: target.id }, fetchPolicy: BORROWED_POLICY }),
      ).then((outcome) => lift(outcome, (data) => data.hashtag?.borrowedStance));
  }
}

/** A standing read held for the next batch, and how to answer it. */
type Waiting = {
  readonly target: StanceTarget;
  readonly settle: (outcome: Outcome<WireBundle>) => void;
};

export function createApolloStanceData(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  signer: WriteSigner;
  /** Where a retired attempt's device material is forgotten; tests inject a double. */
  store?: Pick<IdentityStore, "clearHandshake">;
  /** The tab's active account, which every gesture is pressed as; tests inject a double. */
  accounts?: Pick<TokenStore, "activeAccountId" | "subscribe">;
}): StanceData {
  const { client, guard, signer } = deps;
  const store = deps.store ?? identityStore;
  /** Each account's picks whose signing has not answered done (stance-attempts.ts). */
  const attempts = createStanceAttempts();
  const accounts = deps.accounts ?? tokenStore;

  /** The node each target's last read named — what its acts must point at. */
  const graphIds = new Map<string, string>();
  const keyOf = keyOfTarget;

  const read = async (
    target: StanceTarget,
    pick: StancePair | null,
    options?: StanceReadOptions,
  ): Promise<Outcome<WireBundle>> => {
    const outcome = await guard.run(() => wireBundle(client, target, pick, options));
    if (outcome.kind === "success") graphIds.set(keyOf(target), outcome.value.targetGraphId);
    return outcome;
  };

  /**
   * THE STANDINGS ASKED TOGETHER GO TOGETHER. Every control reads its own
   * standing when it mounts, and a page mounts its cards in one commit, so
   * the reads a commit's effects start are held until the microtask after
   * them and sent as one `PageStances` per view — the L2 and the L1 view
   * never share a request, so neither is ever answered from the other. A
   * read asked after a batch left joins the next one, never the one in
   * flight: a re-read after the reader's own act always asks after the act.
   * Nothing is kept once a batch answers.
   */
  const waiting = new Map<boolean, Waiting[]>();

  const standing = (target: StanceTarget, includePending: boolean): Promise<Outcome<WireBundle>> =>
    new Promise((settle) => {
      let queue = waiting.get(includePending);
      if (queue === undefined) {
        const opened: Waiting[] = [];
        waiting.set(includePending, opened);
        queueMicrotask(() => {
          waiting.delete(includePending);
          dispatch(opened, includePending).then(
            (answers) => {
              for (const entry of opened) entry.settle(answers.get(keyOf(entry.target)) ?? unauthenticated());
            },
            (error: unknown) => {
              for (const entry of opened) entry.settle(failed(error));
            },
          );
        });
        queue = opened;
      }
      queue.push({ target, settle });
    });

  /** Each distinct target's answer, keyed as `keyOf` keys it. */
  const dispatch = async (
    queue: readonly Waiting[],
    includePending: boolean,
  ): Promise<ReadonlyMap<string, Outcome<WireBundle>>> => {
    const distinct = [...new Map(queue.map((entry) => [keyOf(entry.target), entry.target])).values()];
    const own = async (target: StanceTarget) =>
      [keyOf(target), await read(target, null, { includePending })] as const;
    // ONE CONTROL ALONE READS AS IT ALWAYS DID — a deep link, a sheet, the
    // re-read after an act: its own root, its own request.
    if (distinct.length === 1) return new Map([await own(distinct[0])]);
    const chunks: StanceTarget[][] = [];
    for (let from = 0; from < distinct.length; from += PAGE_STANCES_CHUNK) {
      chunks.push(distinct.slice(from, from + PAGE_STANCES_CHUNK));
    }
    const answered = await Promise.all(
      chunks.map(async (chunk) => {
        const page = await guard.run(() => pageRead(client, chunk, includePending));
        // A REQUEST THE SERVER REFUSED AS A WHOLE FAILS NO FACE IT COULD
        // HAVE ANSWERED: an error one node raised, or a budget, would
        // otherwise blank every face on the page where it blanked one
        // before — so each falls back to its own read.
        if (page.kind === "failed" && CombinedGraphQLErrors.is(page.cause)) {
          return Promise.all(chunk.map(own));
        }
        return chunk.map((target) => {
          const outcome = page.kind === "success" ? (page.value.get(keyOf(target)) ?? unauthenticated()) : page;
          // The node an act toward this target names, from this very slot.
          if (outcome.kind === "success") graphIds.set(keyOf(target), outcome.value.targetGraphId);
          return [keyOf(target), outcome] as const;
        });
      }),
    );
    return new Map(answered.flat());
  };

  /** The node a gesture toward `target` names, read now when no read named it yet. */
  const graphIdOf = async (target: StanceTarget): Promise<Outcome<string>> => {
    const known = graphIds.get(keyOf(target));
    if (known !== undefined) return success(known);
    const fresh = await read(target, null);
    return fresh.kind === "success" ? success(fresh.value.targetGraphId) : fresh;
  };

  /**
   * Signs a prepared batch against the gesture's expectation. Every
   * element must complete for the gesture to have happened.
   */
  /**
   * EVERY SIGNED GESTURE IS THE PRESSING ACCOUNT'S (auth.md "Multi-account
   * device custody"). A pad, a row or the kept picks' seal closes mid-signing
   * and the act goes on, so the tab's account can change before a prepare or
   * between it and the signing: a prepare under the next account's session
   * is that account's own stance, and its key would sign it. Each gesture
   * takes the account as it starts and asks `still` before each prepare and
   * before the signing pass; a change stops it there. It remembers, reads
   * and settles only that account's attempts, whichever account is active
   * when it answers.
   */
  const pressedAs = (): Pressed => {
    const owner = accounts.activeAccountId();
    return { attempts: attempts.of(owner), still: () => accounts.activeAccountId() === owner };
  };
  /** The tab's account changed under a gesture: stopped, answered as a failure. */
  const accountChanged = (): Outcome<never> =>
    failed(new Error("the tab's account changed before the gesture was signed"));

  const signAll = async (
    writes: readonly StagedWriteView[],
    expected: Expectation,
  ): Promise<Outcome<StanceCommit>> => outcomeOf(await signer.sign(writes, expected));

  /** What a batch's results say the gesture did. */
  const outcomeOf = (results: readonly WriteResult[]): Outcome<StanceCommit> => {
    const incomplete = results.find((result) => result.kind !== "done");
    // A REFUSAL KEEPS ITS CODES. The write rule's is a notice and not a
    // fault (PadWriteRule.md, RowWriteRule.md): the control says `You can't
    // sign right now` with no Retry, which it can only do if the refusal
    // reaches it as one rather than as a generic failure.
    if (incomplete !== undefined && incomplete.kind === "refused") {
      return refused(incomplete.errors);
    }
    // A FAILED LEG KEEPS ITS CAUSE: an INTERNAL the server answered is read as
    // an answer, never as no answer (NetworkError.md:13).
    if (incomplete !== undefined && incomplete.kind === "failed") return failed(incomplete.cause);
    if (incomplete !== undefined && incomplete.kind === "rejectedByDevice") {
      return failed(new DeviceRefusalError(incomplete.reason));
    }
    if (incomplete !== undefined) {
      return failed(
        new Error(`staged write ${incomplete.id} did not complete: ${incomplete.kind}`),
      );
    }
    return success({ records: results.length });
  };

  /**
   * One gesture's batch, staged and signed. With an `intent` the gesture
   * holds the target's slot, and its batch is remembered before the first
   * pre-signature — so a Retry after any answer, or none, finds it — and
   * forgotten once it signs. Without one it is an act beside another still
   * asking, and touches no memory.
   */
  const stageAndSign = async (
    target: Slot,
    stage: () => Promise<Outcome<Staged>>,
    intent: string | null,
    { attempts: mine, still }: Pressed,
  ): Promise<Outcome<StanceCommit>> => {
    const staged = await stage();
    if (staged.kind !== "success") return staged;
    const { node, writes, expected } = staged.value;
    if (intent !== null) {
      mine.remember(target, { node, writes: writes.map((write) => write.id), intent, expected });
    }
    // Staged under the account that pressed, signed only under it.
    if (!still()) return accountChanged();
    const outcome = await signAll(writes, expected);
    if (intent !== null && outcome.kind === "success") mine.forget(target);
    return outcome;
  };

  /**
   * EVERY SIGNED GESTURE GOES THROUGH ITS KIND'S SLOT — a target's pick
   * slot, or its walk-back slot (stance-attempts.ts `Slot`). A gesture is
   * only ever compared with an earlier attempt of its own kind; one of the
   * other kind toward the same target goes main's road beside it.
   *
   * - A GESTURE WHOSE SIGNING HAS NOT ANSWERED DONE IS ASKED AGAIN, never
   *   staged beside (stance-attempts.ts): the same gesture re-signs the first
   *   attempt from where it stands; a changed one finds it landing, or
   *   retires it before the new one is staged.
   * - A GESTURE WHILE ANOTHER TOWARD THE TARGET IS STILL ASKING IS NOT A
   *   RETRY: it is an act of its own, staged and signed as any is, and the
   *   first attempt's memory and material are left alone.
   */
  const slotted = async (
    target: Slot,
    intent: string,
    stage: () => Promise<Outcome<Staged>>,
    pressed: Pressed,
  ): Promise<Outcome<StanceCommit>> => {
    const { attempts: mine, still } = pressed;
    if (mine.asking(target)) return stageAndSign(target, stage, null, pressed);
    const remembered = mine.answered(target);
    // Held from here, before anything is awaited, so a gesture that arrives
    // meanwhile finds this one asking.
    mine.begin(target);
    try {
      if (remembered !== null) {
        if (!still()) return accountChanged();
        const asked = await askAgain(
          {
            signer,
            read: (id) => guard.run(() => fetchStagedWrite(client, id)),
            retire: (id) => store.clearHandshake(id),
          },
          remembered,
          intent,
          remembered.expected,
        );
        switch (asked.kind) {
          case "unread":
            // Nothing decided, nothing signed: the read's own fault
            // stands, and the next Retry asks again.
            return asked.outcome.kind === "refused"
              ? refused(asked.outcome.errors)
              : failed(asked.outcome.kind === "failed" ? asked.outcome.cause : undefined);
          case "landing":
            // The first gesture is relaying: it is what lands, and nothing
            // else is signed (SigningAfterClose.md:27).
            mine.forget(target);
            return success({ records: remembered.writes.length });
          case "signed": {
            const outcome = outcomeOf(asked.results);
            if (outcome.kind === "success") mine.forget(target);
            return outcome;
          }
          case "fresh":
            // Retired: the slot stays held for the fresh prepare.
            mine.forget(target);
            mine.begin(target);
        }
      }
      return await stageAndSign(target, stage, intent, pressed);
    } finally {
      // Not done: the attempt, if one was staged, waits for a Retry.
      mine.settle(target);
    }
  };

  /** A pick's one record toward `target`, exactly the pick. */
  const stagePick = (target: StanceTarget, pick: StancePair, still: () => boolean) => async (): Promise<
    Outcome<Staged>
  > => {
    const node = await graphIdOf(target);
    if (node.kind !== "success") return node;
    if (!still()) return accountChanged();
    // Exactly the pick, verbatim — the bundle is the fold's business.
    const prepared = await guard.run(() =>
      prepareStance(client, selectorOf(target), pick.pDirected, pick.pInterest),
    );
    if (prepared.kind !== "success") return prepared;
    return success({
      node: node.value,
      writes: prepared.value,
      expected: expectation([stanceRecord(node.value, pick.pDirected, pick.pInterest)]),
    });
  };

  return {
    async bundle(target, options): Promise<Outcome<StanceBundle>> {
      // A topic is not a `Node`: its face keeps its own `HashtagStance`.
      const outcome =
        target.kind === "topic"
          ? await read(target, null, options)
          : await standing(target, options?.includePending ?? INCLUDE_PENDING_DEFAULT);
      if (outcome.kind !== "success") return outcome;
      return success(bundleOf(outcome.value));
    },

    async project(target, pick, options): Promise<Outcome<StanceProjection>> {
      const outcome = await read(target, pick, options);
      if (outcome.kind !== "success") return outcome;
      const projected = outcome.value.projected;
      if (projected === null) {
        return failed(new Error("viewerStance answered a pick without a projection"));
      }
      return success({
        landing: { pDirected: projected.pDirected, pInterest: projected.pInterest },
        inert: projected.inert,
        severed: projected.severed,
        // The standing rode along on the same read: what splits a (0, 0)
        // landing into a walk-back or an empty sign.
        standing: bundleOf(outcome.value),
      });
    },

    commit(target, pick): Promise<Outcome<StanceCommit>> {
      const pressed = pressedAs();
      return slotted(target, stanceIntent(target, pick), stagePick(target, pick, pressed.still), pressed);
    },

    keyOnDevice(): Promise<boolean> {
      // A signer that cannot say is read as holding one: the signature
      // itself remains the check.
      return signer.hasKey?.() ?? Promise.resolve(true);
    },

    async keyBackedUp(): Promise<boolean | null> {
      const outcome = await guard.run(() =>
        viewerField(
          () => client.query({ query: KeyBackupStateDocument, fetchPolicy: READ_POLICY }),
          (data) => data.me,
        ),
      );
      // Unknown is not "no backup": a read that did not answer keeps the
      // restore on offer, the way the notice reads when a backup exists.
      return outcome.kind === "success" ? outcome.value.keyBackupCreatedAt != null : null;
    },

    async borrowedViewHandle(): Promise<string | null> {
      // The band's own read (auth-api.ts): a read that did not answer names
      // nobody, so the anchor draws no name rather than guessing one. Every
      // guest anchor asks it; the ones a page mounts together share one
      // request through Apollo's in-flight deduplication (`queryDeduplication`,
      // on by default), and nothing is kept once it answers.
      const outcome = await guard.run(() => fetchBorrowedView(client));
      return outcome.kind === "success" ? (outcome.value?.handle ?? null) : null;
    },

    async borrowedStance(target): Promise<Outcome<BorrowedStance | null>> {
      // Its own read, outside `read`: it names no node, so `graphIds` — what
      // an act points at — never learns anything from it.
      const outcome = await borrowedRead(client, target);
      if (outcome.kind !== "success") return outcome;
      const wire = outcome.value;
      return success(
        wire === null
          ? null
          : {
              current: { pDirected: wire.pDirected, pInterest: wire.pInterest },
              records: wire.recordCount,
              inert: wire.inert,
              severed: wire.severed,
            },
      );
    },

    commitBatch(entries): Promise<Outcome<StanceCommit>> {
      // THE SEAL'S RETRY IS THE SAME BATCH (KeptPicksSeal.md:33, :63): each
      // pick is a record of its own in a bundle that sums, so a batch
      // prepared afresh beside one the server took sums every pick twice.
      //
      // THE BATCH IS THE PRESSING ACCOUNT'S (`pressedAs`): its seal closes
      // from the press and the batch goes on (KeptPicksSeal.md:59), so the
      // account is checked before every leg too, not only before the signing.
      const pressed = pressedAs();
      const { still } = pressed;
      return slotted(
        KEPT_BATCH,
        keptBatchIntent(entries),
        async () => {
          // EACH PICK IS ITS OWN PREPARE (there is no prepare that stages
          // stances toward several targets at once), and NOTHING IS SIGNED
          // UNTIL EVERY ONE IS STAGED: a refused prepare stops the batch
          // before its first pre-signature, so no pick signs without the others.
          const staged: StagedWriteView[] = [];
          const expected: Expectation[] = [];
          const nodes: string[] = [];
          for (const { target, pick } of entries) {
            if (!still()) return accountChanged();
            const node = await graphIdOf(target);
            if (node.kind !== "success") return node;
            if (!still()) return accountChanged();
            const prepared = await guard.run(() =>
              prepareStance(client, selectorOf(target), pick.pDirected, pick.pInterest),
            );
            if (prepared.kind !== "success") return prepared;
            staged.push(...prepared.value);
            nodes.push(node.value);
            expected.push(expectation([stanceRecord(node.value, pick.pDirected, pick.pInterest)]));
          }
          // One pass over the whole set, checked whole against the picks the
          // seal read back (write-signer.ts `sign`).
          return success({ node: nodes.join(" "), writes: staged, expected: joinExpectations(expected) });
        },
        pressed,
      );
    },

    async preview(target): Promise<Outcome<KeptTargetPreview>> {
      switch (target.kind) {
        case "post": {
          const read = await guard.run(() =>
            fetchOutcome(() =>
              client.query({ query: KeptPickPostDocument, variables: { id: target.id }, fetchPolicy: READ_POLICY }),
            ),
          );
          if (read.kind !== "success") return read;
          const post = read.value.post;
          return post ? success(postPreview(post)) : failed(new Error("the kept pick's post did not resolve"));
        }
        case "comment": {
          const read = await guard.run(() =>
            fetchOutcome(() =>
              client.query({ query: KeptPickCommentDocument, variables: { id: target.id }, fetchPolicy: READ_POLICY }),
            ),
          );
          if (read.kind !== "success") return read;
          const comment = read.value.comment;
          return comment
            ? success(commentPreview(comment))
            : failed(new Error("the kept pick's comment did not resolve"));
        }
        case "profile": {
          const read = await guard.run(() =>
            fetchOutcome(() =>
              client.query({ query: KeptPickProfileDocument, variables: { id: target.id }, fetchPolicy: READ_POLICY }),
            ),
          );
          if (read.kind !== "success") return read;
          const user = read.value.user;
          return user ? success(profilePreview(user)) : failed(new Error("the kept pick's person did not resolve"));
        }
        case "topic":
          return success(topicPreview(target));
      }
    },

    sever(target, shown): Promise<Outcome<StanceCommit>> {
      // THE WALK-BACK'S RETRY IS THE SAME BATCH (SeveranceConfirm.md:33-35).
      // The server stages a walk-back against the pending-inclusive standing
      // (crates/api stance.rs `prepare_severance`): one it holds nets the
      // bundle to (0, 0), so a fresh prepare beside it is refused as already
      // netted, and one it never saw is staged a second time — two walk-backs
      // that Home's Resume would both land.
      const pressed = pressedAs();
      const { still } = pressed;
      return slotted({ walkBack: target }, severanceIntent(target), async () => {
        const node = await graphIdOf(target);
        if (node.kind !== "success") return node;
        if (!still()) return accountChanged();
        const prepared = await guard.run(() => prepareSeverance(client, selectorOf(target)));
        if (prepared.kind !== "success") return prepared;
        return success({
          node: node.value,
          writes: prepared.value,
          expected: expectation(
            [],
            [
              severance(node.value, {
                rawPDirected: shown.rawSum.pDirected,
                rawPInterest: shown.rawSum.pInterest,
                cost: shown.severance.records,
              }),
            ],
          ),
        });
      }, pressed);
    },
  };
}
