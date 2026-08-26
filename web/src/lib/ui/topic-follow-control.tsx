"use client";

// The topic follow control (roadmap "Slice 2.3 — Topics"; D9, D10).
//
// Follows are Affinity toward a Type — the same stance seam every other
// stance-able node uses (`@/lib/stance`) — but 2.3 ships it as a PLAIN
// TOGGLE, never the pad: D10 defers axis labels and the considered
// gesture to whenever the pad reaches topics, since the roadmap already
// says the tap default suffices for the follow gesture. So this is
// deliberately NOT `StanceControl` cut down — it is the minimum surface
// that reuses the same data seam and the same severance dialog.
//
// FOLLOW commits the repo-wide tap default `(+0.1, +0.1)` (D9), exactly
// like a stance control's plain tap. UNFOLLOW is `prepareSeverance`
// reusing the existing confirm dialog (D9) — the same one the pad's
// "Sever" uses, since severance is generic over every stance-able node.
// The rare case where a follow tap itself would net the bundle to
// `(0, 0)` routes through the same dialog rather than refusing the tap
// (design.md §8.2, "never prevent a choice").

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthPhase } from "@/lib/session/provider";
import { TAP_DEFAULT, type StancePair } from "@/lib/stance/model";
import { useStanceData } from "@/lib/stance/provider";
import type { StanceTarget } from "@/lib/stance/stance-data";
import { buttonClassName } from "@/lib/ui/button";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { SeveranceConfirm } from "@/lib/ui/severance-confirm";
import { Snackbar } from "@/lib/ui/snackbar";
import { signedLine, type BundleState } from "@/lib/ui/stance-readout";
import { TransportError } from "@/lib/ui/transport-error";

const SEVERED_PAIR: StancePair = { pDirected: 0, pInterest: 0 };

/** An open severance confirmation. A null pick is the explicit unfollow. */
type Confirming = { pick: StancePair | null; records: number; alreadySevered: boolean };

export function TopicFollowControl({
  name,
  testIdPrefix,
}: {
  /** The topic's canonical name (hashtag.md §1) — never a UUID. */
  name: string;
  testIdPrefix: string;
}) {
  const data = useStanceData();
  const phase = useAuthPhase();
  const target: StanceTarget = { id: name, kind: "topic" };
  const label = `#${name}`;

  const [bundle, setBundle] = useState<BundleState>(undefined);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [joinPrompt, setJoinPrompt] = useState(false);

  // Drops an older read that answers after a newer one, so the toggle
  // never goes back (stance-control.tsx's own read carries the same
  // guard).
  const generation = useRef(0);

  const readBundle = useCallback(() => {
    if (phase !== "signedIn") return;
    const gen = ++generation.current;
    void data.bundle({ id: name, kind: "topic" }).then((outcome) => {
      if (gen !== generation.current) return;
      setBundle(outcome.kind === "success" ? outcome.value : null);
    });
  }, [data, phase, name]);

  useEffect(() => {
    readBundle();
  }, [readBundle]);

  const following = bundle !== null && bundle !== undefined && bundle.records > 0 && !bundle.severed;

  const runCommit = async (pick: StancePair): Promise<boolean> => {
    setBusy(true);
    const outcome = await data.commit(target, pick);
    setBusy(false);
    if (outcome.kind !== "success") return false;
    setSigned(signedLine(pick, outcome.value.records, false, label));
    readBundle();
    return true;
  };

  const runSever = async (): Promise<boolean> => {
    setBusy(true);
    const outcome = await data.sever(target);
    setBusy(false);
    if (outcome.kind !== "success") return false;
    setSigned(signedLine(SEVERED_PAIR, outcome.value.records, true, label));
    readBundle();
    return true;
  };

  const onFollow = async () => {
    if (busy) return;
    if (phase !== "signedIn") {
      setJoinPrompt(true);
      return;
    }
    setSigned(null);
    setFailed(false);
    // The backend's projection is the authority, even for a toggle this
    // plain: a tap that happens to net the bundle back to zero is
    // confirmed, never refused (design.md §8.2).
    const landed = await data.project(target, TAP_DEFAULT);
    if (landed.kind !== "success") {
      setFailed(true);
      return;
    }
    if (landed.value.severed) {
      setConfirming({ pick: TAP_DEFAULT, records: 1, alreadySevered: false });
      return;
    }
    if (!(await runCommit(TAP_DEFAULT))) setFailed(true);
  };

  const onUnfollow = () => {
    setSigned(null);
    setFailed(false);
    setConfirmFailed(false);
    const records = bundle === null || bundle === undefined ? 0 : bundle.severance.records;
    setConfirming({ pick: null, records, alreadySevered: records === 0 });
  };

  const onConfirm = async () => {
    if (confirming === null) return;
    setConfirmFailed(false);
    const completed = confirming.pick === null ? await runSever() : await runCommit(confirming.pick);
    if (completed) setConfirming(null);
    else setConfirmFailed(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        data-testid={testIdPrefix}
        aria-pressed={following}
        aria-label={following ? `Unfollow ${label}` : `Follow ${label}`}
        aria-busy={busy}
        disabled={busy}
        onClick={() => void (following ? onUnfollow() : onFollow())}
        className={buttonClassName({
          variant: following ? "outline" : "primary",
          size: "sm",
          selfStart: true,
        })}
      >
        {following ? "Following" : "Follow"}
      </button>

      {confirming !== null && (
        <SeveranceConfirm
          pick={confirming.pick}
          targetLabel={label}
          bundle={bundle}
          records={confirming.records}
          alreadySevered={confirming.alreadySevered}
          busy={busy}
          failed={confirmFailed}
          onCancel={() => {
            setConfirming(null);
            setConfirmFailed(false);
          }}
          onConfirm={() => void onConfirm()}
        />
      )}

      <Snackbar message={signed} onDismiss={() => setSigned(null)} testId={`${testIdPrefix}-signed`} />
      {failed && (
        <TransportError testId={`${testIdPrefix}-error`} message="That didn't send. Try again." />
      )}
      {joinPrompt && <JoinPrompt open onClose={() => setJoinPrompt(false)} />}
    </div>
  );
}
