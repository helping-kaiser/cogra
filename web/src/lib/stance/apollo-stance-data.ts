// `StanceData` over the real operations (stance.graphql).
//
// Both reads are the same field: `viewerStance` answers the standing,
// and answers the landing too when it is asked with a pick. So a
// projection costs one round trip and the standing rides along with it —
// there is no second query, and nothing here folds one into the other.
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

import {
  CommentBorrowedStanceDocument,
  CommentStanceDocument,
  HashtagBorrowedStanceDocument,
  HashtagStanceDocument,
  KeptPickCommentDocument,
  KeptPickPostDocument,
  KeptPickProfileDocument,
  KeyBackupStateDocument,
  PostBorrowedStanceDocument,
  PostStanceDocument,
  ProfileBorrowedStanceDocument,
  ProfileStanceDocument,
} from "@/__generated__/graphql";
import { fetchBorrowedView } from "@/lib/api/auth-api";
import { failed, fetchOutcome, refused, success, viewerField, type Outcome } from "@/lib/api/outcome";
import { DeviceRefusalError } from "@/lib/signing/device-refusal";
import {
  prepareSeverance,
  prepareStance,
  type StagedWriteView,
  type StanceSelector,
} from "@/lib/api/writes-api";
import type { AuthGuard } from "@/lib/session/guard";
import {
  expectation,
  joinExpectations,
  severance,
  stanceRecord,
  type Expectation,
} from "@/lib/signing/intent";
import type { WriteSigner } from "@/lib/signing/write-signer";
import {
  commentPreview,
  postPreview,
  profilePreview,
  topicPreview,
  type KeptTargetPreview,
} from "./kept-preview";
import type { StancePair } from "./model";
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

export function createApolloStanceData(deps: {
  client: ApolloClient;
  guard: AuthGuard;
  signer: WriteSigner;
}): StanceData {
  const { client, guard, signer } = deps;

  /** The node each target's last read named — what its acts must point at. */
  const graphIds = new Map<string, string>();
  const keyOf = (target: StanceTarget) => `${target.kind}:${target.id}`;

  const read = async (
    target: StanceTarget,
    pick: StancePair | null,
    options?: StanceReadOptions,
  ): Promise<Outcome<WireBundle>> => {
    const outcome = await guard.run(() => wireBundle(client, target, pick, options));
    if (outcome.kind === "success") graphIds.set(keyOf(target), outcome.value.targetGraphId);
    return outcome;
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
  const signAll = async (
    writes: readonly StagedWriteView[],
    expected: Expectation,
  ): Promise<Outcome<StanceCommit>> => {
    const results = await signer.sign(writes, expected);
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
    return success({ records: writes.length });
  };

  return {
    async bundle(target, options): Promise<Outcome<StanceBundle>> {
      const outcome = await read(target, null, options);
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

    async commit(target, pick): Promise<Outcome<StanceCommit>> {
      const node = await graphIdOf(target);
      if (node.kind !== "success") return node;
      // Exactly the pick, verbatim — the bundle is the fold's business.
      const prepared = await guard.run(() =>
        prepareStance(client, selectorOf(target), pick.pDirected, pick.pInterest),
      );
      if (prepared.kind !== "success") return prepared;
      return signAll(
        prepared.value,
        expectation([stanceRecord(node.value, pick.pDirected, pick.pInterest)]),
      );
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

    async commitBatch(entries): Promise<Outcome<StanceCommit>> {
      // EACH PICK IS ITS OWN PREPARE (there is no prepare that stages
      // stances toward several targets at once), and NOTHING IS SIGNED
      // UNTIL EVERY ONE IS STAGED: a refused prepare stops the batch before
      // its first pre-signature, so no pick signs without the others.
      const staged: StagedWriteView[] = [];
      const expected: Expectation[] = [];
      for (const { target, pick } of entries) {
        const node = await graphIdOf(target);
        if (node.kind !== "success") return node;
        const prepared = await guard.run(() =>
          prepareStance(client, selectorOf(target), pick.pDirected, pick.pInterest),
        );
        if (prepared.kind !== "success") return prepared;
        staged.push(...prepared.value);
        expected.push(expectation([stanceRecord(node.value, pick.pDirected, pick.pInterest)]));
      }
      // One pass over the whole set, checked whole against the picks the
      // seal read back (write-signer.ts `sign`).
      return signAll(staged, joinExpectations(expected));
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

    async sever(target, shown): Promise<Outcome<StanceCommit>> {
      const node = await graphIdOf(target);
      if (node.kind !== "success") return node;
      const prepared = await guard.run(() => prepareSeverance(client, selectorOf(target)));
      if (prepared.kind !== "success") return prepared;
      return signAll(
        prepared.value,
        expectation(
          [],
          [
            severance(node.value, {
              rawPDirected: shown.rawSum.pDirected,
              rawPInterest: shown.rawSum.pInterest,
              cost: shown.severance.records,
            }),
          ],
        ),
      );
    },
  };
}
