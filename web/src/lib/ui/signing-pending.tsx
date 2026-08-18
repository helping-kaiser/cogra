// The signing-didn't-finish line, honest about who acts next: with
// the key absent the write waits on the reader restoring it, not on
// time passing — "stays pending" alone read as wait-and-it-happens.

import Link from "next/link";

export function SigningPending({
  needsKey,
  testIdPrefix,
}: {
  needsKey: boolean;
  testIdPrefix: string;
}) {
  return needsKey ? (
    <p
      role="alert"
      data-testid={`${testIdPrefix}-signing-needs-key`}
      className="text-body-medium text-error"
    >
      Signing needs your key, which isn&apos;t in this browser — the write waits as
      pending.{" "}
      <Link href="/restore" className="underline">
        Restore your key
      </Link>{" "}
      to finish it.
    </p>
  ) : (
    <p
      role="alert"
      data-testid={`${testIdPrefix}-signing-failed`}
      className="text-body-medium text-error"
    >
      Signing did not finish — the write stays pending.
    </p>
  );
}
