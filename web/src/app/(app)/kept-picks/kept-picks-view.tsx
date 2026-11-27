"use client";

// THE KEPT PICKS' REVIEW AND ITS SEAL (KeptPicksReview.md, KeptPicksSeal.md;
// jakob's rulings B1-B3, 2026-10-01, and the kept-picks rulings of
// 2026-10-02). Picks kept while the key was elsewhere never sign on their own:
// once the key is back they sign together, in one batch the reader looks over
// first. The review is the looking-over; `Sign them` leads to the batch's seal,
// the standard seal with the picks as its acts; one signature lands them all.
//
// - ONE ROW PER KEPT PICK, `StagedReference`'s with its ×: the target's live
//   preview, its kind, the pair spoken as the readout speaks it. A target
//   removed while its pick waited wears the removed-mark face and still signs.
//   A pick that would net its bundle to nothing says so on its row; `Sign the
//   picks` is its confirmation, and no severance dialog follows.
// - PLAIN OPINIONS ONLY. A kept vouch-back or approval never joins the batch;
//   a kept approval is named under the intro, with the door to Invites.
// - THE × DROPS AT ONCE, no confirm and no undo, spoken `Removed — N picks
//   left.` with focus on the next row; the last drop leaves with `Nothing left
//   to sign.`
// - EVERY WAY OUT KEEPS THE PICKS and returns where the review was opened from
//   (`kept-picks-route.tsx`). The seal's arrow and its Back step back to the
//   review; its X leaves the flow.
// - THE SEAL WAITS LIKE EVERY SEAL: inert from the press, `Signing the
//   picks…` past 200ms, the slow line past 5s, never a spinner. From the
//   press Back reads `Close` and the X is named `Close`; every way out only
//   closes the seal and the batch goes on (`kept-batch.ts`: each target's row
//   then reads `Signing…`, and a batch not through stands on Settings'
//   kept-picks row with Retry). Open, no answer: the fault line and
//   Retry; a FORBIDDEN answer, the same foot with `That didn't go through.
//   Try again.` (NetworkError.md:13). The write rule: the notice, `Not now`
//   back to the review. Any other
//   refusal: the bug notice, `Not now` back to the review. Nothing drops a pick
//   but the reader's ×, or the batch landing.
//
// REGISTERED (nodes.json KeptPicksReview, KeptPicksSeal; round 23): a pick is
// `keptPicks.pick` and a seal row `keptPicksSeal.acts.actRow`, each keyed by
// its place from 1.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { hasCode, type Outcome } from "@/lib/api/outcome";
import { useReportProblem } from "@/lib/report/report-problem-layer";
import { useActiveAccountId } from "@/lib/session/provider";
import { bundleReadout, EMPTY_PICK_LABEL } from "@/lib/stance/anchors";
import { closeKeptBatchSeal, signKeptBatch } from "@/lib/stance/kept-batch";
import { dropKeptPicks, keptOpinions, useKeptPicks, type KeptPick } from "@/lib/stance/kept-picks";
import { keptPicksOrigin } from "@/lib/stance/kept-picks-route";
import { fallbackPreview, type KeptTargetPreview } from "@/lib/stance/kept-preview";
import { useStanceData } from "@/lib/stance/provider";
import type { StanceCommit, StanceTarget } from "@/lib/stance/stance-data";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";
import {
  AFFINITY_AXES,
  formatStancePair,
  formatStanceWords,
  severanceWords,
  STANCE_AXES,
  type StanceAxes,
} from "@/lib/ui/stance-format";
import { TransportError } from "@/lib/ui/transport-error";
import { NOT_THROUGH_LINE, outcomeFaultLine, UNVERIFIED_LINE } from "@/lib/ui/error-messages";
import { ActsCard, actsTotal, SLOW_SIGNING_LINE, type ActsRow } from "@/lib/ui2/compose/acts-card";
import { StagedRow } from "@/lib/ui2/compose/staged-reference";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { HELP_TOPICS, HelpDialog, type HelpTopic } from "@/lib/ui2/help-dialog";
import { HelpDot } from "@/lib/ui2/help-dot";
import { InlineAction } from "@/lib/ui2/inline-action";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { PillButton } from "@/lib/ui2/pill-button";
import { SLOW_ANSWER_MS, SLOW_NETWORK_MS, useWaitedPast } from "@/lib/ui2/waiting-commit";

const REVIEW: DataNode = { path: "keptPicks" };
const SEAL: DataNode = { path: "keptPicksSeal" };

// Every string blessed in copy-voice, *The kept picks' review* (jakob
// 2026-10-01/02/05) and *Faults by code*.
export const KEPT_PICKS_TITLE = "Kept picks";
export const KEPT_PICKS_INTRO =
  "These waited on this device for your key, and nothing is signed yet. Remove any you no longer mean — the rest sign together.";
/**
 * Invites opened from here names its door: its back arrow reads `Back to Kept
 * picks` (Invites.md:97).
 */
export const KEPT_PICKS_INVITES = "/invites?from=kept-picks";

export const KEPT_APPROVAL_LINE = "An approval waits in your invites.";
export const NOTHING_LEFT = "Nothing left to sign.";
const WRITE_RULE_TITLE = "You can't sign right now";
const WRITE_RULE_FACT =
  "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your picks are still kept.";
const BUG_TITLE = "This shouldn't have happened";
const BUG_FACT =
  "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it.";
const OFFLINE_LINE = "That didn't send. Try again.";

/** `Removed — 2 picks left.` (`Removed — 1 pick left.` in the singular). */
export function removedAnnouncement(left: number): string {
  return `Removed — ${left} ${left === 1 ? "pick" : "picks"} left.`;
}

const keyOf = (target: StanceTarget) => `${target.kind}:${target.id}`;

/** The seal's row label and count noun, by the family the pick signs (`_shared.jsx` `keptPickFamily`). */
function keptPickFamily(target: StanceTarget): { label: string; countNoun: string } {
  return target.kind === "topic" ? { label: "Feeling", countNoun: "feeling" } : { label: "Opinion", countNoun: "opinion" };
}

/** A topic's pick is an Affinity, and speaks in its family's words. */
function axesOf(target: StanceTarget): StanceAxes {
  return target.kind === "topic" ? AFFINITY_AXES : STANCE_AXES;
}

type SealFault = "offline" | "notThrough" | "unverified" | "writeRule" | "bug";

/** An answered fault of the whole act reads its own line (NetworkError.md:13-19), never the no-answer one. */
function faultOf(outcome: Outcome<StanceCommit>): SealFault {
  if (hasCode(outcome, "WRITE_RULE_FAILED")) return "writeRule";
  const line = outcomeFaultLine(outcome);
  if (line === UNVERIFIED_LINE) return "unverified";
  if (line === NOT_THROUGH_LINE) return "notThrough";
  return outcome.kind === "refused" ? "bug" : "offline";
}

/** The line a fault with Retry in the commit's slot reads, if any. */
function retryLineOf(fault: SealFault | null): string | null {
  if (fault === "offline") return OFFLINE_LINE;
  if (fault === "notThrough") return NOT_THROUGH_LINE;
  if (fault === "unverified") return UNVERIFIED_LINE;
  return null;
}

export function KeptPicksView() {
  const router = useRouter();
  const from = keptPicksOrigin(useSearchParams().get("from"));
  const account = useActiveAccountId();
  const data = useStanceData();
  const picks = useKeptPicks(account);
  const opinions = useMemo(() => keptOpinions(picks), [picks]);
  const approvalKept = picks?.some((pick) => pick.family === "approval") ?? false;

  const [stage, setStage] = useState<"review" | "seal">("review");
  const [previews, setPreviews] = useState<ReadonlyMap<string, KeptTargetPreview>>(new Map());
  /** The picks that would net their bundle to nothing, by target. */
  const [severing, setSevering] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [signing, setSigning] = useState(false);
  const [fault, setFault] = useState<SealFault | null>(null);
  const retryLine = retryLineOf(fault);
  /** The bug notice's `Report a problem`: the one report page, over this seal (ReportProblem.md:3,27). */
  const { openReport, reportLayer } = useReportProblem();
  const [help, setHelp] = useState<HelpTopic | null>(null);
  /** The batch landed; the view is leaving and must not read its emptiness as a last drop. */
  const leaving = useRef(false);
  const removeButtons = useRef(new Map<string, HTMLDivElement | null>());

  const swapped = useWaitedPast(signing, SLOW_ANSWER_MS);
  const slow = useWaitedPast(signing, SLOW_NETWORK_MS);
  /** The seal was closed while its batch signs: the answer is the runner's readers'. */
  const closedRef = useRef(false);
  /** The account the batch was pressed as: the one whose batch a Close closes. */
  const pressedAs = useRef<string | null>(null);
  // The system's Back leaves the route mid-signing: the seal is closed, the
  // batch goes on (KeptPicksSeal.md:59). A seal not signing closes nothing.
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
      closeKeptBatchSeal(pressedAs.current);
    };
  }, []);

  const leave = () => {
    leaving.current = true;
    router.replace(from);
  };

  // THE REVIEW NEEDS THE KEY HERE: with it gone again, the waiting-for-key
  // state owns every surface and this one has nothing to sign with
  // (KeptPicksReview.md:39).
  useEffect(() => {
    let live = true;
    void data.keyOnDevice().then((present) => {
      if (live && !present) {
        leaving.current = true;
        router.replace(from);
      }
    });
    return () => {
      live = false;
    };
  }, [data, from, router]);

  // Nothing kept to review: back where it was opened from.
  useEffect(() => {
    if (picks !== null && opinions.length === 0 && !leaving.current) {
      leaving.current = true;
      router.replace(from);
    }
  }, [picks, opinions.length, from, router]);

  // Each row's live preview and its consequence, read when the row appears.
  const opinionKeys = opinions.map((pick) => keyOf(pick.target)).join("|");
  useEffect(() => {
    let live = true;
    for (const kept of opinions) {
      const key = keyOf(kept.target);
      void data.preview(kept.target).then((read) => {
        if (!live) return;
        const preview = read.kind === "success" ? read.value : fallbackPreview(kept.target);
        setPreviews((current) => new Map(current).set(key, preview));
      });
      void data.project(kept.target, kept.pick).then((landed) => {
        if (!live || landed.kind !== "success") return;
        // Netting to nothing over a standing is a walk-back; over nothing
        // standing it is an empty sign, which takes nothing back.
        const { standing } = landed.value;
        const severs = landed.value.severed && standing.records > 0 && !standing.severed;
        setSevering((current) => {
          const next = new Set(current);
          if (severs) next.add(key);
          else next.delete(key);
          return next;
        });
      });
    }
    return () => {
      live = false;
    };
    // The set of rows is what matters, not the array's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opinionKeys, data]);

  const previewOf = (kept: KeptPick) => previews.get(keyOf(kept.target)) ?? fallbackPreview(kept.target);

  const onRemove = async (kept: KeptPick, index: number) => {
    if (account === null) return;
    const left = opinions.length - 1;
    if (left === 0) {
      // The last drop leaves the review with the snackbar, where it was
      // opened from (KeptPicksReview.md:17).
      leaving.current = true;
      await dropKeptPicks(account, [kept.target]);
      carrySnackbar(NOTHING_LEFT);
      router.replace(from);
      return;
    }
    const next = opinions[index + 1] ?? opinions[index - 1];
    await dropKeptPicks(account, [kept.target]);
    setAnnouncement(removedAnnouncement(left));
    // Focus moves to the next row's ×, else the previous one's.
    if (next !== undefined) {
      queueMicrotask(() =>
        removeButtons.current.get(keyOf(next.target))?.querySelector<HTMLButtonElement>("button:last-of-type")?.focus(),
      );
    }
  };

  const onSign = async () => {
    if (signing || account === null) return;
    setFault(null);
    setSigning(true);
    pressedAs.current = account;
    const batch = opinions.map((kept) => ({ target: kept.target, pick: kept.pick }));
    // The batch runner owns the signing (`kept-batch.ts`): closing the seal
    // never cancels it. TAKEN, the runner lands it — the picks kept no longer,
    // each target settling, the batch snackbar — and the open seal leaves.
    const outcome = await signKeptBatch((entries) => data.commitBatch(entries), batch);
    if (closedRef.current) return;
    if (outcome.kind !== "success") {
      setSigning(false);
      setFault(faultOf(outcome));
      return;
    }
    leaving.current = true;
    router.replace(from);
  };

  /**
   * From the press, every way out only closes the seal (KeptPicksSeal.md:57,
   * :59): it leaves for where the review was opened from, and the batch goes on.
   */
  const close = () => {
    closedRef.current = true;
    closeKeptBatchSeal(pressedAs.current);
    leave();
  };

  /** Back to the review, every pick still kept — the seal's arrow, Back, and `Not now`. */
  const backToReview = () => {
    if (signing) return;
    setFault(null);
    setStage("review");
  };

  if (picks === null || opinions.length === 0) {
    return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col" />;
  }

  if (stage === "review") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        <PageHeader title={KEPT_PICKS_TITLE} backHref={from} backLabel="Back" node={part(REVIEW, "header")} />
        <div className="flex flex-1 flex-col gap-4 px-6 pt-2">
          <p className="m-0 text-body-medium text-on-surface-variant" {...testAttributes(part(REVIEW, "intro"))}>
            {KEPT_PICKS_INTRO}
          </p>
          {approvalKept && (
            <p className="m-0 text-body-medium text-on-surface-variant" {...testAttributes(part(REVIEW, "approval"))}>
              {KEPT_APPROVAL_LINE}{" "}
              <InlineAction size="sm" onClick={() => router.push(KEPT_PICKS_INVITES)} node={part(REVIEW, "approval.open")}>
                Open Invites
              </InlineAction>
            </p>
          )}
          <div className="flex flex-col gap-2">
            {opinions.map((kept, index) => {
              const preview = previewOf(kept);
              const key = keyOf(kept.target);
              return (
                <div
                  key={key}
                  ref={(element) => {
                    removeButtons.current.set(key, element);
                  }}
                >
                  <StagedRow
                    kind={preview.kind}
                    name={preview.name}
                    sub={preview.sub}
                    src={preview.src}
                    pair={kept.pick}
                    stance
                    axes={axesOf(kept.target)}
                    removed={preview.removed}
                    consequence={severing.has(key) ? severanceWords(axesOf(kept.target)).landing : null}
                    onRemove={() => void onRemove(kept, index)}
                    node={{ path: "keptPicks.pick", key: String(index + 1) }}
                  />
                </div>
              );
            })}
          </div>
          {/* The pickers' status idiom (`PickAnnouncement`): the drop said once. */}
          <p role="status" aria-live="polite" className="sr-only" data-testid="keptPicks.announcement">
            {announcement}
          </p>
          <div className="flex-1" />
          {/* THE FOOT IS PINNED (ruling A2's wizard reading), as `Save` is on
              the profile's edit: the commit leads to the seal. Its 24px
              count from the safe edge, so an edge-to-edge Chrome's
              navigation bar never covers Sign them (screen-layer.ts). */}
          <div className="sticky bottom-0 bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
            <PillButton testId="keptPicks.sign" node={part(REVIEW, "sign")} full onClick={() => setStage("seal")}>
              Sign them
            </PillButton>
          </div>
        </div>
      </main>
    );
  }

  const rows: ActsRow[] = opinions.map((kept) => {
    const preview = previewOf(kept);
    const face = bundleReadout(kept.pick, EMPTY_PICK_LABEL);
    return {
      // KeptPicksSeal.md:7 — the row names what is SIGNED, the record's
      // family: a pick on a post or a person is an Opinion, a pick on a topic
      // a Feeling (copy-voice, seam 248: `Topic` on the review, `Feeling` here).
      ...keptPickFamily(kept.target),
      count: 1,
      key: keyOf(kept.target),
      value: (
        <span className="flex min-w-0 flex-col py-1.5">
          <span
            className={`truncate${preview.removed ? " text-on-surface-variant" : ""}`}
          >
            {preview.removed || preview.name}
          </span>
          <span className="inline-flex flex-none items-baseline gap-2">
            <span aria-hidden="true">{face.emoji}</span>
            <span aria-hidden="true" className="cg-exact whitespace-nowrap text-body-small text-on-surface-variant">
              {formatStancePair(kept.pick)}
            </span>
            <span className="sr-only">
              {face.label}, {formatStanceWords(kept.pick, axesOf(kept.target))}
            </span>
          </span>
        </span>
      ),
    };
  });
  const note = slow ? SLOW_SIGNING_LINE : null;
  // From the press, Back reads Close and the X is named Close, never dimmed;
  // every way out only closes the seal (KeptPicksSeal.md:57, :59).
  const back = signing ? close : backToReview;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <HeaderBar
        title="What you sign"
        onBack={back}
        backLabel={signing ? "Close" : "Back a step"}
        onLeave={signing ? close : leave}
        leaveLabel={signing ? "Close" : "Leave — your picks are kept"}
        help={
          <HelpDot
            ariaLabel="How signing works"
            onOpen={() => setHelp(HELP_TOPICS.howSigningWorks)}
            node={part(part(SEAL, "header"), "help")}
          />
        }
        node={part(SEAL, "header")}
      />
      <div className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-2">
        <ActsCard
          rows={rows}
          total={actsTotal(rows.length)}
          note={note}
          noteTone={slow ? "slow" : "quiet"}
          node={part(SEAL, "acts")}
        />
        {approvalKept && (
          <p className="m-0 text-body-medium text-on-surface-variant" {...testAttributes(part(SEAL, "approval"))}>
            {KEPT_APPROVAL_LINE}{" "}
            <InlineAction size="sm" onClick={() => router.push(KEPT_PICKS_INVITES)} node={part(SEAL, "approval.open")}>
              Open Invites
            </InlineAction>
          </p>
        )}
        <div className="flex-1" />
        {fault === "writeRule" ? (
          <>
            <NoticePanel
              title={WRITE_RULE_TITLE}
              help={{
                label: "Why signing waits",
                onOpen: () => setHelp(HELP_TOPICS.whySigningWaitsKept),
                testId: "keptPicksSeal.writeRule.help",
              }}
              testId="keptPicksSeal.writeRule"
            >
              <NoticeLine>{WRITE_RULE_FACT}</NoticeLine>
            </NoticePanel>
            <PillButton testId="keptPicksSeal.notNow" variant="text" full onClick={backToReview}>
              Not now
            </PillButton>
          </>
        ) : fault === "bug" ? (
          <>
            <NoticePanel title={BUG_TITLE} testId="keptPicksSeal.bug">
              <NoticeLine>{BUG_FACT}</NoticeLine>
              <PillButton testId="keptPicksSeal.tryAgain" variant="inverse" full onClick={() => void onSign()}>
                Try again
              </PillButton>
            </NoticePanel>
            <div className="flex flex-col">
              <PillButton testId="keptPicksSeal.report" variant="text" full onClick={openReport}>
                Report a problem
              </PillButton>
              <PillButton testId="keptPicksSeal.notNow" variant="text" full onClick={backToReview}>
                Not now
              </PillButton>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2" {...testAttributes(part(SEAL, "foot"))}>
            {retryLine !== null && <TransportError testId="keptPicksSeal.fault" message={retryLine} />}
            {/* SealFooter: the commit names what it signs; inert from the
                press, its participle past 200ms, never dimmed, no spinner. */}
            <PillButton
              testId="keptPicksSeal.sign"
              node={part(SEAL, "foot.sign")}
              variant={retryLine !== null ? "outlined" : "filled"}
              full
              onClick={() => void onSign()}
            >
              {swapped ? "Signing the picks…" : retryLine !== null ? "Retry" : "Sign the picks"}
            </PillButton>
            <PillButton
              testId="keptPicksSeal.back"
              node={part(SEAL, "foot.back")}
              variant="text"
              full
              onClick={back}
            >
              {signing ? "Close" : "Back"}
            </PillButton>
          </div>
        )}
      </div>
      {help !== null && <HelpDialog open onClose={() => setHelp(null)} topic={help} testId="keptPicksSeal.help-dialog" />}
      {reportLayer}
    </main>
  );
}

