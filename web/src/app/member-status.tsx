"use client";

// The member's cards in the shell (Android's Home member branch): the
// husk warning when the actor key lives elsewhere, the first-login
// reciprocation prompt (auth.md "Approval and landing": the joiner's
// own signed Opinion completes the mutual pair; the prompt is an
// offer, not a nag — sign and dismiss both settle it, device-locally),
// and the resume card for handshakes with parked material.

import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { MeUser } from "@/lib/api/auth-api";
import { prepareStance } from "@/lib/api/writes-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { Card } from "@/lib/ui/card";
import { StanceSlider } from "@/lib/ui/stance-slider";
import { RestoreCard } from "./applicant-status";

type DeviceState = {
  keyOnDevice: boolean;
  reciprocationDismissed: boolean;
  pendingCount: number;
};

export function MemberStatus({
  me,
  store = identityStore,
}: {
  me: MeUser;
  /** Test injection, as SessionProvider's store. */
  store?: IdentityStore;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const signer = useWriteSigner();

  const [device, setDevice] = useState<DeviceState | null>(null);
  const [pDirected, setPDirected] = useState(0.1);
  const [pInterest, setPInterest] = useState(0.1);
  const [signing, setSigning] = useState(false);
  const [signingFailed, setSigningFailed] = useState(false);
  const [reciprocated, setReciprocated] = useState(false);
  const [resuming, setResuming] = useState(false);

  const readDevice = useCallback(() => {
    return Promise.all([
      store.actorKey(),
      store.reciprocationDismissed(),
      store.handshakeIds(),
    ]).then(([key, dismissed, pending]) => {
      setDevice({
        keyOnDevice: key !== null,
        reciprocationDismissed: dismissed,
        pendingCount: pending.length,
      });
    });
  }, [store]);

  useEffect(() => {
    void readDevice();
  }, [readDevice]);

  if (device === null) return null;

  // The pair's state is the graph's (hasReciprocated); the device
  // remembers only a dismissal.
  const inviter = me.invitedBy;
  const prompt =
    inviter !== null &&
    device.keyOnDevice &&
    !me.hasReciprocated &&
    !device.reciprocationDismissed &&
    !reciprocated;

  const onReciprocate = async () => {
    if (signing || inviter === null) return;
    setSigning(true);
    setSigningFailed(false);
    const prepared = await guard.run(() => prepareStance(client, inviter.id, pDirected, pInterest));
    if (prepared.kind !== "success") {
      setSigning(false);
      setSigningFailed(true);
      return;
    }
    const results = [];
    for (const staged of prepared.value) {
      results.push(await signer.signStaged(staged));
    }
    if (results.every((result) => result.kind === "done")) {
      // No device mark: the in-flight staged write already answers
      // hasReciprocated on the next profile read.
      setReciprocated(true);
    } else {
      setSigningFailed(true);
    }
    setSigning(false);
    await readDevice();
  };

  const onSkip = async () => {
    await store.markReciprocationDismissed();
    await readDevice();
  };

  const onResume = async () => {
    if (resuming) return;
    setResuming(true);
    await signer.resume();
    setResuming(false);
    await readDevice();
  };

  return (
    <div className="flex flex-col gap-4">
      {!device.keyOnDevice && <RestoreCard />}
      {prompt && (
        <Card testId="home_reciprocation">
          <h2 className="font-medium">@{inviter.handle} vouched you in</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Membership completes when you point back. Choose your stance — it&apos;s your own signed
            act, and you can change it any time.
          </p>
          <StanceSlider
            label="Directed weight"
            value={pDirected}
            onChange={setPDirected}
            testId="home_p_directed"
          />
          <StanceSlider
            label="Interest weight"
            value={pInterest}
            onChange={setPInterest}
            testId="home_p_interest"
          />
          {signingFailed && (
            <p role="alert" data-testid="home_signing_failed" className="text-sm text-red-600 dark:text-red-400">
              Signing didn&apos;t complete — check your connection and try again.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="home_reciprocate"
              onClick={onReciprocate}
              disabled={signing}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Vouch back
            </button>
            <button
              type="button"
              data-testid="home_reciprocate_skip"
              onClick={onSkip}
              disabled={signing}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
            >
              Not now
            </button>
          </div>
        </Card>
      )}
      {reciprocated && (
        <p role="status" data-testid="home_reciprocated" className="text-sm">
          Your vouch is on its way onto the graph.
        </p>
      )}
      {device.pendingCount > 0 && (
        <Card testId="home_pending">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {device.pendingCount} signed act(s) waiting to finish their handshake.
          </p>
          <button
            type="button"
            data-testid="home_resume"
            onClick={onResume}
            disabled={resuming}
            className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Resume
          </button>
        </Card>
      )}
    </div>
  );
}
