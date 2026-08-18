"use client";

// The member's cards in the shell (Android's Home member branch): the
// husk warning, the first-login reciprocation prompt (auth.md "Approval
// and landing"), and the resume card for parked handshake material.

import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { MeUser } from "@/lib/api/auth-api";
import { prepareStance } from "@/lib/api/writes-api";
import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useAuthGuard } from "@/lib/session/runtime";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { StanceSlider } from "@/lib/ui/stance-slider";

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
  /** Test injection. */
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
      {/* The husk warning rides the screen's collapsing top, not this
          stack — it must follow the reader (feed-view/profile-view). */}
      {prompt && (
        <Card testId="home_reciprocation">
          <h2 className="text-title-medium">@{inviter.handle} vouched you in</h2>
          <p className="text-body-medium text-on-surface-variant">
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
            <p role="alert" data-testid="home_signing_failed" className="text-body-medium text-error">
              Signing didn&apos;t complete — check your connection and try again.
            </p>
          )}
          <div className="flex gap-3">
            <Button testId="home_reciprocate" size="sm" onClick={onReciprocate} disabled={signing}>
              Vouch back
            </Button>
            <Button
              testId="home_reciprocate_skip"
              variant="outline"
              size="sm"
              onClick={onSkip}
              disabled={signing}
            >
              Not now
            </Button>
          </div>
        </Card>
      )}
      {reciprocated && (
        <p role="status" data-testid="home_reciprocated" className="text-body-medium">
          Your vouch is on its way onto the graph.
        </p>
      )}
      {device.pendingCount > 0 && (
        <Card testId="home_pending">
          <p className="text-body-medium text-on-surface-variant">
            {device.pendingCount} signed act(s) waiting to finish their handshake.
          </p>
          <Button testId="home_resume" variant="outline" size="sm" selfStart onClick={onResume} disabled={resuming}>
            Resume
          </Button>
        </Card>
      )}
    </div>
  );
}
