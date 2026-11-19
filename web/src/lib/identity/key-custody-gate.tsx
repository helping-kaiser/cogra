"use client";

// CAN THIS BROWSER HOLD A KEY? — asked before any key ceremony opens
// (KeyCeremony.md: "the ceremony probes this browser for WebCrypto Ed25519
// before anything is minted"; KeyCeremonyUnsupported.md; Restore.md:5).
//
// THE ONE PROBE is `ed25519Available` (lib/crypto/hashing.ts), the same one the
// ceremony itself asks before it mints, read here and never duplicated. It is
// the documented way to ask: WebCrypto has no capability query, and an
// algorithm a user agent does not implement fails the spec's "normalize an
// algorithm" step with a `NotSupportedError` (W3C Web Cryptography Level 2,
// §18.4.4 https://w3c.github.io/webcrypto/#algorithm-normalization-normalize-an-algorithm;
// MDN SubtleCrypto.generateKey, "Exceptions":
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey#exceptions).
// It is read-only: the probe's key is non-extractable, kept in no store, and
// dropped with the promise.
//
// EVERY CEREMONY IS A ROUTE, AND EVERY ROUTE IS GATED. Every door that makes a
// key (`Create my key`, the settings key rows, the fresh-key card) opens `/key`;
// every `Restore the key` opens `/restore`. The gate stands in both pages, so
// a door — drawn, undrawn, or a URL typed by hand — reaches the same answer:
// on a browser that cannot hold a key, `KeyCeremonyUnsupported` opens in the
// ceremony's place, the ceremony never renders, nothing is minted and no
// recovery code is typed. `key-custody-gate.guard.test.ts` fails when a door or
// a ceremony bypasses this.

import { useEffect, useState, type ReactNode } from "react";

import { ed25519Available } from "@/lib/crypto/hashing";
import { KeyCeremonyUnsupported } from "@/lib/ui/key-ceremony-unsupported";

/** The two ceremony routes; every key-ceremony door opens one of them. */
export const KEY_CEREMONY_ROUTE = "/key";
export const RESTORE_ROUTE = "/restore";

/**
 * The settings key rows' door to the ceremony: the `from` tells the refusal
 * where its back arrow goes (KeyCeremonyUnsupported.md: "from a key row in
 * settings -> Settings opens").
 */
export const KEY_CEREMONY_FROM_SETTINGS = `${KEY_CEREMONY_ROUTE}?from=settings`;

/**
 * The refusal's back arrow on the minting route: Settings when a settings row
 * opened it, else the reader's home — the applicant's feed, where the task
 * card and the key-elsewhere card both stand.
 */
export function ceremonyBackHref(from: string | null): string {
  return from === "settings" ? "/settings" : "/";
}

/**
 * The refusal's back arrow in the restore's place: the restore's own home
 * (Restore.md: a member's `KeyElsewhere`, an applicant's
 * `ApplicantKeyElsewhere`) — the feed at `/` in both cases.
 */
export const RESTORE_BACK_HREF = "/";

/** Whether this browser can hold a CoGra key; `null` while the probe runs. */
export function useCanHoldKey(probe: () => Promise<boolean> = ed25519Available): boolean | null {
  const [can, setCan] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void probe().then(
      (answer) => {
        if (live) setCan(answer);
      },
      () => {
        if (live) setCan(false);
      },
    );
    return () => {
      live = false;
    };
  }, [probe]);
  return can;
}

export function KeyCustodyGate({
  backHref,
  probe,
  children,
}: {
  /** Where the refusal's back arrow goes. */
  backHref: string;
  /** Test injection. */
  probe?: () => Promise<boolean>;
  /** The ceremony — rendered only on a browser that can hold a key. */
  children: ReactNode;
}) {
  const can = useCanHoldKey(probe);
  // Nothing while the probe runs: drawing the ceremony for a frame would let a
  // code be typed into a restore that can never finish.
  if (can === null) return null;
  if (!can) return <KeyCeremonyUnsupported backHref={backHref} />;
  return <>{children}</>;
}
