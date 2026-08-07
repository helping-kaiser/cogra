// The signed-out front door. The invite-paste entry arrives with the
// /join flow it feeds; until then the door carries the sign-in path.

import Link from "next/link";

export function FrontDoor() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">CoGra</h1>
      <Link
        href="/login"
        data-testid="invite_login"
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        Already a member? Sign in
      </Link>
    </main>
  );
}
