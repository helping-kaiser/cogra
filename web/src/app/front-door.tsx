"use client";

// The signed-out front door: paste an invite (a /join URL or a bare id —
// auth.md "Link URLs": the paste is the universal fallback) or sign in.
// The /join route does the actual check; the door only finds the id.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { extractInviteId } from "@/lib/onboarding/invite-input";

export function FrontDoor() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [malformed, setMalformed] = useState(false);

  const onContinue = (event: React.FormEvent) => {
    event.preventDefault();
    const id = extractInviteId(input);
    if (id === null) {
      setMalformed(true);
      return;
    }
    router.push(`/join/${id}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">CoGra</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        CoGra is invite-only. Paste your invite link to get started.
      </p>
      <form onSubmit={onContinue} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="invite" className="text-sm font-medium">
            Invite link
          </label>
          <input
            id="invite"
            data-testid="invite_input"
            type="text"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setMalformed(false);
            }}
            autoComplete="off"
            spellCheck={false}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </div>
        {malformed && (
          <p role="alert" data-testid="invite_error" className="text-sm text-red-600 dark:text-red-400">
            That doesn&apos;t look like an invite — paste the whole link or its code.
          </p>
        )}
        <button
          type="submit"
          data-testid="invite_continue"
          disabled={input.trim() === ""}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Continue
        </button>
      </form>
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
