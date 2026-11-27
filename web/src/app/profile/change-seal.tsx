"use client";

// The profile's "What you sign" moment — one drawing behind both of the
// profile's seals: `ProfileEditSeal` (the edit's fields, and a picture changed
// through the edit) and `AvatarSeal` (the picture alone, from the head's
// change badge). The two boards draw the same page and differ only in what
// they read back: the head row's words, the acts card's one row, and the "?"
// (ProfileEditSeal.jsx, AvatarSeal.jsx; ProfileEditSeal.md, AvatarSeal.md).
//
// WHAT IT READS BACK: the head row (the picture at 64 and its words), one
// acts-card row saying what the change holds, counted 1, the total `1 thing,
// signed`, no all-or-nothing line, and under the card the public-record line.
//
// THE COMMIT (ProfileEditSeal.md:9-47, AvatarSeal.md:13-55; the failure
// pack's masters):
//  · `Sign the change` refuses a second press until the signing answers and
//    never dims; past 200 ms it reads `Signing the change…`, past 5 s the
//    total's subline reads the slow line; no spinner, no progress.
//  · From the press, Back reads `Close` and the X is named `Close`; either,
//    and the arrow, close the seal and the change goes on — its wait and its
//    answer then stand under the profile's head (`profile-change.ts`).
//  · No answer reached the seal: the fault line and `Retry` take the
//    commit's place, everything above the foot as it was. An answered fault
//    of the whole act (FORBIDDEN, INTERNAL, SIGNATURE_INVALID, a fieldless
//    BAD_INPUT, EMAIL_NOT_VERIFIED) takes the same foot in its own line
//    (NetworkError.md:13-19), never the no-answer line.
//  · The write rule: `You can't sign right now` over its fact, `Not now`
//    back to the seal at rest; never Retry, never the error colour.
//  · Any other refusal, a bug: `This shouldn't have happened` with `Try
//    again`, `Report a problem` and `Not now`, which goes one stage back.
//  · The key not on this browser: the key-absent notice and `Restore the
//    key`, `Not now` back to the seal at rest; nothing kept or signed.
//  · THE UPLOAD GATE (AvatarSeal.md:13-23), where the seal opens with its
//    picture still going up: `Uploading 0 of 1 — signing waits for the
//    picture.` over the foot with the commit live, a press held until the
//    picture is up; a failed upload reads the gate's fault with `Retry` and
//    disables the commit, a held press dropping back to rest; a refused one
//    reads the fact alone, no Retry, the commit disabled and Back the way out.

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useReportProblem } from "@/lib/report/report-problem-layer";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { HelpDot } from "@/lib/ui2/help-dot";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { pillClassName, PillButton } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { ActsCard, actsTotal, SLOW_SIGNING_LINE } from "@/lib/ui2/compose/acts-card";
import { useSlowAnswer, useWaitedPast, SLOW_NETWORK_MS } from "@/lib/ui2/waiting-commit";
import { PINNED_PAGE } from "@/lib/ui2/screen-layer";
import { TransportError } from "@/lib/ui/transport-error";
import { UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import type { DataNode } from "@/lib/ui/data-node";
import { KEY_ABSENT_TITLE } from "@/lib/ui/key-absent-notice";
import {
  closeProfileChangeSeal,
  signProfileChange,
  type ProfileChangeOutcome,
  type SignedChange,
} from "@/lib/profile/profile-change";

export const SEAL_TITLE = "What you sign";
export const SEAL_LEAVE = "Leave";
export const SIGN_THE_CHANGE = "Sign the change";
export const SIGNING_THE_CHANGE = "Signing the change…";
export const PUBLIC_RECORD_LINE =
  "Every change to your profile is signed in your name and stays in your public record.";
/** The failure pack's words (copy-voice, *Faults by code*), the profile seals' clause. */
export const OFFLINE_LINE = "That didn't send. Try again.";
export const WRITE_RULE_TITLE = "You can't sign right now";
export const WRITE_RULE_FACT =
  "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent.";
export const BUG_TITLE = "This shouldn't have happened";
export const BUG_FACT =
  "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it.";

type Foot =
  | { readonly kind: "rest" }
  | { readonly kind: "signing" }
  | { readonly kind: "offline" }
  | { readonly kind: "notThrough"; readonly line: string }
  | { readonly kind: "writeRule" }
  | { readonly kind: "bug" }
  | { readonly kind: "keyAbsent" };

/** The upload gate's reading, where the seal waits on its picture. */
export type SealGate = {
  readonly reading: "uploading" | "upload-failed" | "upload-refused";
  /** The failed reading's Retry: the upload starts again. */
  readonly onRetry: () => void;
  /** The registered gate (`avatarSeal.gate`), keyed by the reading. */
  readonly node?: string;
};

/** What one of the profile's seals reads back; the rest is the drawing both share. */
export type ChangeSealReading = {
  /** The test-id stem every part of this seal is named under. */
  readonly testId: string;
  /** The head row's words beside the picture. */
  readonly head: string;
  /** The acts card's one row. */
  readonly row: { readonly label: string; readonly value: string; readonly countNoun: string };
  /** The header's "?": its spoken name and its topic. */
  readonly help: { readonly label: string; readonly topic: keyof typeof HELP_TOPICS };
};

export function ChangeSeal({
  reading,
  avatar,
  hasKey,
  sign,
  signed,
  onTaken,
  onBack,
  onLeave,
  onClosed,
  gate = null,
}: {
  reading: ChangeSealReading;
  /** The upload gate, while the change's picture is not up yet; null once it is. */
  gate?: SealGate | null;
  /** What the change sets, for the head to wear once it is taken (`signed-profile.ts`). */
  signed?: SignedChange;
  /** The head row's picture, as the change will set it. */
  avatar: ReactNode;
  /** Whether the signing key is on this browser, asked at the press. */
  hasKey: () => Promise<boolean>;
  /** One signing of the change. */
  sign: () => Promise<ProfileChangeOutcome>;
  /** The change was taken while the seal was open. */
  onTaken: () => void;
  /** One stage back, to where the change was made, as it was left. */
  onBack: () => void;
  /** Leaves the flow; nothing signed. */
  onLeave: () => void;
  /** The seal was closed while its change signs: the change goes on. */
  onClosed: () => void;
}) {
  const id = reading.testId;
  const [foot, setFoot] = useState<Foot>({ kind: "rest" });
  const [help, setHelp] = useState<"change" | "key" | null>(null);
  /** The bug notice's `Report a problem`: the one report page, over this seal (ReportProblem.md:3,31). */
  const { openReport, reportLayer } = useReportProblem();
  const signing = foot.kind === "signing";
  const slowAnswer = useSlowAnswer(signing);
  const slowNetwork = useWaitedPast(signing, SLOW_NETWORK_MS);

  // A failed or refused upload is the one thing that disables the commit.
  const gateShut = gate !== null && gate.reading !== "uploading";

  const press = async () => {
    // Refuses a second press until the signing answers; never dims.
    if (signing || gateShut) return;
    if (!(await hasKey())) {
      setFoot({ kind: "keyAbsent" });
      return;
    }
    setFoot({ kind: "signing" });
    const outcome = await signProfileChange(sign, { signed });
    if (outcome.kind === "taken") onTaken();
    // The held press dropped with its upload: the commit and Back read as
    // before the press, nothing signed (AvatarSeal.md:21).
    else if (outcome.kind === "dropped") setFoot({ kind: "rest" });
    else setFoot(outcome);
  };

  // From the press, every way out only closes the seal; the act goes on.
  const close = () => {
    closeProfileChangeSeal();
    onClosed();
  };
  const back = signing ? close : onBack;
  const leave = signing ? close : onLeave;
  const rest = () => setFoot({ kind: "rest" });

  return (
    <main data-testid={id} className={`mx-auto flex ${PINNED_PAGE} w-full max-w-2xl flex-col bg-surface text-on-surface`}>
      <HeaderBar
        title={SEAL_TITLE}
        backLabel={signing ? "Close" : "Back a step"}
        onBack={back}
        onLeave={leave}
        leaveLabel={signing ? "Close" : SEAL_LEAVE}
        help={<HelpDot ariaLabel={reading.help.label} onOpen={() => setHelp("change")} testId={`${id}-help`} />}
        testId={`${id}-header`}
        focusTitle
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto *:shrink-0 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3">
          {avatar}
          <span className="flex flex-1 flex-col gap-0.5 text-label-large">{reading.head}</span>
        </div>

        <ActsCard
          rows={[{ ...reading.row, count: 1, testId: `${id}-row` }]}
          total={actsTotal(1)}
          note={slowNetwork ? SLOW_SIGNING_LINE : null}
          noteTone={slowNetwork ? "slow" : "quiet"}
          testId={`${id}-acts`}
        />

        <QuietNote testId={`${id}-record`}>{PUBLIC_RECORD_LINE}</QuietNote>

        <div className="flex-1" />

        {foot.kind === "keyAbsent" ? (
          <>
            <NoticePanel
              title={KEY_ABSENT_TITLE}
              help={{ label: "Your key", onOpen: () => setHelp("key"), testId: `${id}-key-help` }}
              testId={`${id}-key-absent`}
            >
              <Link href="/restore" data-testid={`${id}-restore`} className={pillClassName({ variant: "inverse", full: true })}>
                Restore the key
              </Link>
            </NoticePanel>
            <PillButton testId={`${id}-not-now`} variant="text" full onClick={rest}>
              Not now
            </PillButton>
          </>
        ) : foot.kind === "offline" || foot.kind === "notThrough" ? (
          <div className="flex flex-col gap-2">
            <TransportError
              testId={`${id}-offline`}
              message={foot.kind === "offline" ? OFFLINE_LINE : foot.line}
            />
            <PillButton testId={`${id}-retry`} variant="outlined" full onClick={() => void press()}>
              Retry
            </PillButton>
            <PillButton testId={`${id}-back`} variant="text" full onClick={onBack}>
              Back
            </PillButton>
          </div>
        ) : foot.kind === "writeRule" ? (
          // A rule working as meant: the tertiary panel, never the error colour,
          // and no Retry.
          <>
            <NoticePanel title={WRITE_RULE_TITLE} testId={`${id}-write-rule`}>
              <NoticeLine>{WRITE_RULE_FACT}</NoticeLine>
            </NoticePanel>
            <PillButton testId={`${id}-not-now`} variant="text" full onClick={rest}>
              Not now
            </PillButton>
          </>
        ) : foot.kind === "bug" ? (
          <>
            <NoticePanel title={BUG_TITLE} testId={`${id}-bug`}>
              <NoticeLine>{BUG_FACT}</NoticeLine>
              <PillButton testId={`${id}-try-again`} variant="inverse" full onClick={() => void press()}>
                Try again
              </PillButton>
            </NoticePanel>
            <div className="flex flex-col">
              <PillButton testId={`${id}-report`} variant="text" full onClick={openReport}>
                Report a problem
              </PillButton>
              <PillButton testId={`${id}-not-now`} variant="text" full onClick={onBack}>
                Not now
              </PillButton>
            </div>
          </>
        ) : (
          <>
          {/* The gate stands over the foot, the column's 16 between them (AvatarSeal.jsx). */}
          {gate !== null && <Gate gate={gate} testId={`${id}-gate`} />}
          <div className="flex flex-col gap-2">
            <PillButton testId={`${id}-sign`} full disabled={gateShut} onClick={() => void press()}>
              {signing && slowAnswer ? SIGNING_THE_CHANGE : SIGN_THE_CHANGE}
            </PillButton>
            <PillButton testId={`${id}-back`} variant="text" full onClick={back}>
              {signing ? "Close" : "Back"}
            </PillButton>
          </div>
          </>
        )}
      </div>

      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help === "key" ? HELP_TOPICS.yourKey : HELP_TOPICS[reading.help.topic]}
        testId={`${id}-help-dialog`}
      />
      {reportLayer}
    </main>
  );
}

/** The gate over the foot, in its reading (UploadNotice.jsx `UploadStatusLine`). */
function Gate({ gate, testId }: { gate: SealGate; testId: string }) {
  const node: DataNode | undefined = gate.node === undefined ? undefined : { path: gate.node, key: gate.reading };
  if (gate.reading === "upload-refused") return <UploadStatusLine done={0} total={1} refused testId={testId} node={node} />;
  if (gate.reading === "upload-failed") {
    return <UploadStatusLine done={0} total={1} failed onRetry={gate.onRetry} testId={testId} node={node} />;
  }
  return <UploadStatusLine done={0} total={1} media="pictures" testId={testId} node={node} />;
}
