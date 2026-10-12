"use client";

// The member's cards in the shell's banner stack (Android's Home member
// branch): the resume card for parked handshake material. The husk warning
// rides the screen's collapsing top, and the vouch card is the feed's own
// first card (`feed/vouch-card.tsx`) — neither lives in this stack.

import { useCallback, useEffect, useState } from "react";

import { identityStore, type IdentityStore } from "@/lib/identity/store";
import { useWriteSigner } from "@/lib/signing/provider";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";

export function MemberStatus({
  store = identityStore,
}: {
  /** Test injection. */
  store?: IdentityStore;
}) {
  const signer = useWriteSigner();

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [resuming, setResuming] = useState(false);

  const readDevice = useCallback(() => {
    return store.handshakeIds().then((pending) => setPendingCount(pending.length));
  }, [store]);

  useEffect(() => {
    void readDevice();
  }, [readDevice]);

  if (pendingCount === null || pendingCount === 0) return null;

  const onResume = async () => {
    if (resuming) return;
    setResuming(true);
    await signer.resume();
    setResuming(false);
    await readDevice();
  };

  return (
    <Card testId="home_pending">
      <p className="text-body-medium text-on-surface-variant">
        {pendingCount} signed act(s) waiting to finish their handshake.
      </p>
      <Button testId="home_resume" variant="outline" size="sm" selfStart onClick={onResume} disabled={resuming}>
        Resume
      </Button>
    </Card>
  );
}
