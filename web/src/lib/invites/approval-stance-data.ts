// APPROVING IS VOUCHING (ApprovePad.md:5): the approval pad IS the opinion
// pad — the same anchor, the same acts, never a button labelled Approve — so
// the pads on Invites and on an ask link mount the ordinary `StanceControl`
// over THIS seam rather than the generic stance one. Only what a vouch-in
// signs through differs; the gesture law, the waits, the write rule's notice,
// the key notice and the empty sign's vouch-in ask are the control's.
//
// - THE STANDING IS EMPTY. An applicant has no node anyone has stanced yet —
//   no opinion toward someone before their admission exists — so the standing
//   is a bundle of no records, and a (0, 0) pick is an EMPTY SIGN, never a
//   walk-back (ApprovePad.md:43: `Sign an empty opinion?`, never `Walk it all
//   back?`). The landing of a pick over nothing is the pick itself.
// - THE COMMIT IS THE APPROVAL: `approveApplicants` with exactly the pick,
//   then the device signs the approver's Opinion it returns, checked against
//   the applicant the row named (intent.ts). A refusal keeps its codes, so
//   the write rule stays a notice and not a fault.
// - THE ASK LINK STAGES FIRST (api-spec.md "The ask link": `stageApplicant`
//   then the ordinary approval). The staged row is HELD, so a Retry after a
//   fault retries the approval only — a second stage would answer
//   WAITING_ON_VIEWER (packet residual flag "Kept-approval retry").

import type { ApolloClient } from "@apollo/client";

import {
  approveApplicant,
  stageApplicant,
  type ApplicationView,
} from "@/lib/api/invites-api";
import { failed, refused, success, type Outcome } from "@/lib/api/outcome";
import type { AuthGuard } from "@/lib/session/guard";
import { expectation, stanceRecord } from "@/lib/signing/intent";
import type { WriteSigner } from "@/lib/signing/write-signer";
import type { StancePair } from "@/lib/stance/model";
import type {
  StanceBundle,
  StanceCommit,
  StanceData,
  StanceProjection,
} from "@/lib/stance/stance-data";
import { approvable } from "./queue";

/** No record ever signed toward an applicant: the standing every approval opens on. */
export const NO_STANDING: StanceBundle = {
  current: { pDirected: 0, pInterest: 0 },
  rawSum: { pDirected: 0, pInterest: 0 },
  records: 0,
  inert: true,
  severed: false,
  severance: { records: 0 },
};

/** Where a pick lands over nothing standing: the pick itself, as the fold reports it. */
export function landingOver(pick: StancePair): StanceProjection {
  return {
    landing: pick,
    inert: pick.pDirected === 0 || pick.pInterest === 0,
    severed: pick.pDirected === 0 && pick.pInterest === 0,
    standing: NO_STANDING,
  };
}

/**
 * What the commit could not sign because the act took another road first —
 * the host routes on it from `onTaken` (VouchAskPad.md:27, :33).
 */
export type ApprovalDetour =
  /** Staged, but the asker is not fully registered: keep the vouch, nothing signed. */
  | { readonly kind: "notRegistered"; readonly application: ApplicationView }
  /** The ask link stages nobody for this reader any more: re-read it. */
  | { readonly kind: "unusable" };

type Deps = {
  readonly client: ApolloClient;
  readonly guard: AuthGuard;
  readonly signer: WriteSigner;
};

function approvalData(
  deps: Deps,
  resolve: () => Promise<Outcome<ApplicationView> | "detoured">,
): StanceData {
  const { client, guard, signer } = deps;
  return {
    bundle: async () => success(NO_STANDING),
    project: async (_target, pick) => success(landingOver(pick)),
    async commit(_target, pick): Promise<Outcome<StanceCommit>> {
      const resolved = await resolve();
      // A detour was taken: nothing to sign, and the host routes on.
      if (resolved === "detoured") return success({ records: 0 });
      if (resolved.kind !== "success") return resolved;
      const application = resolved.value;
      // A row without the applicant's node has no key attached, and nothing
      // approvable to bind a vouch to.
      if (application.graphId === null || application.graphId === undefined) {
        return failed(new Error("the application names no node to vouch for"));
      }
      const prepared = await guard.run(() =>
        approveApplicant(client, application.id, pick.pDirected, pick.pInterest),
      );
      if (prepared.kind !== "success") return prepared;
      const results = await signer.sign(
        prepared.value,
        expectation([stanceRecord(application.graphId, pick.pDirected, pick.pInterest)]),
      );
      const incomplete = results.find((result) => result.kind !== "done");
      if (incomplete !== undefined && incomplete.kind === "refused") {
        return refused(incomplete.errors);
      }
      if (incomplete !== undefined) {
        return failed(new Error(`staged write ${incomplete.id} did not complete: ${incomplete.kind}`));
      }
      return success({ records: prepared.value.length });
    },
    // No walk-back stands on an approval pad (ApprovePad.md:9), and over
    // nothing standing the control never asks for one.
    sever: async () => failed(new Error("an approval has nothing to walk back")),
    keyOnDevice: () => signer.hasKey?.() ?? Promise.resolve(true),
  };
}

/** The approval pad on Invites: one application already in the reader's queue. */
export function createApprovalStanceData(deps: Deps, application: ApplicationView): StanceData {
  return approvalData(deps, async () => success(application));
}

/**
 * The ask link's pad (VouchAskPad): Set stages the asker, then approves the
 * staged row — or, where the asker is not fully registered yet, stops at the
 * stage and hands the host the detour.
 */
export function createAskStanceData(
  deps: Deps,
  askLink: string,
  onDetour: (detour: ApprovalDetour) => void,
): StanceData & { staged: () => ApplicationView | null; stage: () => Promise<Outcome<ApplicationView>> } {
  let held: ApplicationView | null = null;
  const stage = async (): Promise<Outcome<ApplicationView>> => {
    if (held !== null) return success(held);
    const outcome = await deps.guard.run(() => stageApplicant(deps.client, askLink));
    if (outcome.kind === "success") held = outcome.value;
    return outcome;
  };
  const data = approvalData(deps, async () => {
    const staged = await stage();
    if (staged.kind === "refused" && staged.errors.some((e) => e.code === "ASK_LINK_UNUSABLE")) {
      onDetour({ kind: "unusable" });
      return "detoured";
    }
    if (staged.kind !== "success") return staged;
    if (!approvable(staged.value)) {
      onDetour({ kind: "notRegistered", application: staged.value });
      return "detoured";
    }
    return staged;
  });
  return { ...data, staged: () => held, stage };
}
