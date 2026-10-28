"use client";

// A KEPT APPROVAL (Invites.md:63-89, ApprovePad.md:39-41, VouchAskPad.md:29):
// a vouch set on an approval pad while the signing key was elsewhere waits on
// this device as a kept pick of the APPROVAL family toward its application —
// never in the kept picks' review (which lists plain opinions only), and
// signed only through the approval pad on Invites. The pad keeps it (the
// control's `Keep it pending`, `vouchesIn` naming the family); this file is
// where Invites reads and drops it.
//
// An approval's seam target is the application, under the profile kind the
// approval pads mount with: an application id names no profile, and the family
// keeps it apart from any kept opinion besides.

import { useEffect, useState } from "react";

import { dropKeptPicks, keepPick, sameTarget, useKeptPicks } from "@/lib/stance/kept-picks";
import type { StancePair } from "@/lib/stance/model";
import type { StanceTarget } from "@/lib/stance/stance-data";
import { useActiveAccountId } from "@/lib/session/provider";
import { useWriteSigner } from "@/lib/signing/provider";

/** The seam target an approval pad mounts with for `applicationId`. */
export function approvalTarget(applicationId: string): StanceTarget {
  return { kind: "profile", id: applicationId };
}

export type KeptApproval = {
  /** The vouch kept for this application, or null. */
  readonly pick: StancePair | null;
  /** Kept, and the key still elsewhere: the row reads `Waiting for your key`. */
  readonly keyElsewhere: boolean;
};

export function useKeptApproval(applicationId: string): KeptApproval {
  const account = useActiveAccountId();
  const signer = useWriteSigner();
  const picks = useKeptPicks(account);
  const target = approvalTarget(applicationId);
  const pick =
    picks?.find((entry) => entry.family === "approval" && sameTarget(entry.target, target))?.pick ?? null;
  const [keyHere, setKeyHere] = useState<boolean | null>(null);
  const kept = pick !== null;
  useEffect(() => {
    if (!kept) return undefined;
    let live = true;
    void (signer.hasKey?.() ?? Promise.resolve(true)).then((present) => {
      if (live) setKeyHere(present);
    });
    return () => {
      live = false;
    };
  }, [kept, signer]);
  return { pick, keyElsewhere: kept && keyHere === false };
}

/** Keeps a vouch toward a staged application (the ask link's pad, VouchAskPad.md:29, :33). */
export function keepApproval(account: string | null, applicationId: string, pick: StancePair): Promise<void> {
  if (account === null) return Promise.resolve();
  return keepPick(account, approvalTarget(applicationId), pick, "approval");
}

/** Drops the vouches kept for closed applications: nothing is signed (RejectConfirm.md:7). */
export function dropKeptApprovals(account: string | null, applicationIds: readonly string[]): Promise<void> {
  if (account === null || applicationIds.length === 0) return Promise.resolve();
  return dropKeptPicks(account, applicationIds.map(approvalTarget));
}
