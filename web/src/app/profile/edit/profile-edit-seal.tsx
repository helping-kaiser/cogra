"use client";

// ProfileEditSeal — the profile change's "What you sign" moment
// (design/designs/canonical/screens/ProfileEditSeal.jsx, ProfileEditSeal.md).
// Every profile change is a signed act, so Save opens this seal and nothing
// is signed before its own commit (ProfileEdit.md:15).
//
// WHAT IT READS BACK: the profile's head row (the picture at 64 and `Your
// profile`), one acts-card row `Profile` saying what the change holds,
// counted `1 profile change`, the total `1 thing, signed`, no all-or-nothing
// line, and under the card the public-record line; the "?" in the header is
// `Changing your profile`.
//
// THE COMMIT (ProfileEditSeal.md:9-47; the failure pack's masters):
//  · `Sign the change` refuses a second press until the signing answers and
//    never dims; past 200 ms it reads `Signing the change…`, past 5 s the
//    total's subline reads the slow line; no spinner, no progress.
//  · From the press, Back reads `Close` and the X is named `Close`; either,
//    and the arrow, close the seal and the change goes on — its wait and its
//    answer then stand under the profile's head (`profile-change.ts`).
//  · No answer reached the seal: the fault line and `Retry` take the
//    commit's place, everything above the foot as it was.
//  · The write rule: `You can't sign right now` over its fact, `Not now`
//    back to the seal at rest; never Retry, never the error colour.
//  · Any other refusal, a bug: `This shouldn't have happened` with `Try
//    again`, `Report a problem` and `Not now`, which returns to the edit.
//  · The key not on this browser: the key-absent notice and `Restore the
//    key`, `Not now` back to the seal at rest; nothing kept or signed.

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";
import { HelpDot } from "@/lib/ui2/help-dot";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";
import { pillClassName, PillButton } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { ActsCard, actsTotal, SLOW_SIGNING_LINE } from "@/lib/ui2/compose/acts-card";
import { useSlowAnswer, useWaitedPast, SLOW_NETWORK_MS } from "@/lib/ui2/waiting-commit";
import { TransportError } from "@/lib/ui/transport-error";
import { KEY_ABSENT_TITLE } from "@/lib/ui/key-absent-notice";
import {
  closeProfileChangeSeal,
  signProfileChange,
  type ProfileChangeOutcome,
} from "@/lib/profile/profile-change";

export const SEAL_TITLE = "What you sign";
export const SEAL_LEAVE = "Leave";
export const SIGN_THE_CHANGE = "Sign the change";
export const SIGNING_THE_CHANGE = "Signing the change…";
export const PUBLIC_RECORD_LINE =
  "Every change to your profile is signed in your name and stays in your public record.";
/** The failure pack's words (copy-voice, *Faults by code*), the profile seal's clause. */
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
  | { readonly kind: "writeRule" }
  | { readonly kind: "bug" }
  | { readonly kind: "keyAbsent" };

export function ProfileEditSeal({
  avatar,
  change,
  hasKey,
  sign,
  onTaken,
  onBack,
  onLeave,
  onClosed,
}: {
  /** The head row's picture, as the edit last left it. */
  avatar: ReactNode;
  /** What the change holds, the acts row's value. */
  change: string;
  /** Whether the signing key is on this browser, asked at the press. */
  hasKey: () => Promise<boolean>;
  /** One signing of the change. */
  sign: () => Promise<ProfileChangeOutcome>;
  /** The change was taken while the seal was open. */
  onTaken: () => void;
  /** One stage back, to the edit as it was left. */
  onBack: () => void;
  /** Leaves the flow; nothing signed. */
  onLeave: () => void;
  /** The seal was closed while its change signs: the change goes on. */
  onClosed: () => void;
}) {
  const [foot, setFoot] = useState<Foot>({ kind: "rest" });
  const [help, setHelp] = useState<"profile" | "key" | null>(null);
  const signing = foot.kind === "signing";
  const slowAnswer = useSlowAnswer(signing);
  const slowNetwork = useWaitedPast(signing, SLOW_NETWORK_MS);

  const press = async () => {
    // Refuses a second press until the signing answers; never dims.
    if (signing) return;
    if (!(await hasKey())) {
      setFoot({ kind: "keyAbsent" });
      return;
    }
    setFoot({ kind: "signing" });
    const outcome = await signProfileChange(sign);
    if (outcome.kind === "taken") onTaken();
    else setFoot({ kind: outcome.kind });
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
    <main
      data-testid="profile-edit-seal"
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-surface text-on-surface"
    >
      <HeaderBar
        title={SEAL_TITLE}
        backLabel={signing ? "Close" : "Back a step"}
        onBack={back}
        onLeave={leave}
        leaveLabel={signing ? "Close" : SEAL_LEAVE}
        help={<HelpDot ariaLabel="Changing your profile" onOpen={() => setHelp("profile")} testId="profile-edit-seal-help" />}
        testId="profile-edit-seal-header"
        focusTitle
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-2">
        <div className="flex items-center gap-3">
          {avatar}
          <span className="flex flex-1 flex-col gap-0.5 text-label-large">Your profile</span>
        </div>

        <ActsCard
          rows={[{ label: "Profile", value: change, count: 1, countNoun: "profile change", testId: "profile-edit-seal-row" }]}
          total={actsTotal(1)}
          note={slowNetwork ? SLOW_SIGNING_LINE : null}
          noteTone={slowNetwork ? "slow" : "quiet"}
          testId="profile-edit-seal-acts"
        />

        <QuietNote testId="profile-edit-seal-record">{PUBLIC_RECORD_LINE}</QuietNote>

        <div className="flex-1" />

        {foot.kind === "keyAbsent" ? (
          <>
            <NoticePanel
              title={KEY_ABSENT_TITLE}
              help={{ label: "Your key", onOpen: () => setHelp("key"), testId: "profile-edit-seal-key-help" }}
              testId="profile-edit-seal-key-absent"
            >
              <Link
                href="/restore"
                data-testid="profile-edit-seal-restore"
                className={pillClassName({ variant: "inverse", full: true })}
              >
                Restore the key
              </Link>
            </NoticePanel>
            <PillButton testId="profile-edit-seal-not-now" variant="text" full onClick={rest}>
              Not now
            </PillButton>
          </>
        ) : foot.kind === "offline" ? (
          <div className="flex flex-col gap-2">
            <TransportError testId="profile-edit-seal-offline" message={OFFLINE_LINE} />
            <PillButton testId="profile-edit-seal-retry" variant="outlined" full onClick={() => void press()}>
              Retry
            </PillButton>
            <PillButton testId="profile-edit-seal-back" variant="text" full onClick={onBack}>
              Back
            </PillButton>
          </div>
        ) : foot.kind === "writeRule" ? (
          // A rule working as meant: the tertiary panel, never the error colour,
          // and no Retry.
          <>
            <NoticePanel title={WRITE_RULE_TITLE} testId="profile-edit-seal-write-rule">
              <NoticeLine>{WRITE_RULE_FACT}</NoticeLine>
            </NoticePanel>
            <PillButton testId="profile-edit-seal-not-now" variant="text" full onClick={rest}>
              Not now
            </PillButton>
          </>
        ) : foot.kind === "bug" ? (
          <>
            <NoticePanel title={BUG_TITLE} testId="profile-edit-seal-bug">
              <NoticeLine>{BUG_FACT}</NoticeLine>
              <PillButton testId="profile-edit-seal-try-again" variant="inverse" full onClick={() => void press()}>
                Try again
              </PillButton>
            </NoticePanel>
            <div className="flex flex-col">
              {/* Report a problem is wired nowhere yet on web (its packet is
                  undrawn, the settings row's precedent); the control stands. */}
              <PillButton testId="profile-edit-seal-report" variant="text" full onClick={() => {}}>
                Report a problem
              </PillButton>
              <PillButton testId="profile-edit-seal-not-now" variant="text" full onClick={onBack}>
                Not now
              </PillButton>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <PillButton testId="profile-edit-seal-sign" full onClick={() => void press()}>
              {signing && slowAnswer ? SIGNING_THE_CHANGE : SIGN_THE_CHANGE}
            </PillButton>
            <PillButton testId="profile-edit-seal-back" variant="text" full onClick={back}>
              {signing ? "Close" : "Back"}
            </PillButton>
          </div>
        )}
      </div>

      <HelpDialog
        open={help !== null}
        onClose={() => setHelp(null)}
        topic={help === "key" ? HELP_TOPICS.yourKey : HELP_TOPICS.changingYourProfile}
        testId="profile-edit-seal-help-dialog"
      />
    </main>
  );
}
