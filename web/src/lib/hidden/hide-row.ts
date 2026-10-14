"use client";

// THE HIDE ACTION, STATED ONCE (hidden-actors packet §5.2) for every menu that
// carries it — the post menu on the feed and the detail, the two profile
// menus. Each host brings its own snackbar and decides what its rows do; the
// behaviour is this one:
//
// - the row reads `Hide @ada`, or `Hide this account` for a deleted account,
//   always — hiding is not a toggle (ReaderPostMenu.md:3; ProfileMenu.md:3);
// - a guest is asked to join, and nothing is sent (GuestGate.md:5);
// - otherwise the person joins the hidden set at the tap — no confirm, ever —
//   and the host's snackbar names them with `Undo`, which takes the hide back;
// - a hide of someone already hidden sends nothing and its Undo sends nothing:
//   Undo restores what was, and what was is hidden (packet §15 F1);
// - a failure reverts, and the row the gesture was made from says so — never
//   the snackbar, which the host clears if it still stands (`useHostSnack`).

import type { Notify } from "@/lib/saved/save-row";
import { UNDO } from "@/lib/saved/save-row";
import { hideCause, type HiddenPerson, type HiddenSet } from "./hidden-set";

/** An actor as any read serves it: enough to hide them and to name them after. */
export type ActorLike = {
  readonly id: string;
  readonly handle?: string | null;
  readonly displayName?: { readonly value: string | null; readonly status?: string } | null;
  readonly avatar?: { readonly url: string; readonly status?: string } | null;
};

/**
 * The person a hide names. A deleted account reads REDACTED in its name and
 * serves no handle a row may print (ER-G10, design digest item 19).
 */
export function hiddenPersonOf(actor: ActorLike): HiddenPerson {
  const redacted = actor.displayName?.status === "REDACTED" || !actor.handle;
  return {
    id: actor.id,
    handle: redacted ? null : (actor.handle ?? null),
    displayName: redacted ? null : actor.displayName?.value || null,
    avatarUrl: redacted || actor.avatar?.status === "REDACTED" ? null : (actor.avatar?.url ?? null),
    redacted,
  };
}

/** The hide row's words (`ActorChip.jsx:67`, `HIDE_ACTOR_LABEL`). */
export function hideLabel(person: Pick<HiddenPerson, "handle" | "redacted">): string {
  return person.redacted || person.handle === null ? "Hide this account" : `Hide @${person.handle}`;
}

/** The snackbar a hide answers with (copy-voice "Saved, History and hiding"). */
export function hiddenMessage(person: Pick<HiddenPerson, "handle" | "redacted">): string {
  return person.redacted || person.handle === null
    ? "This account is hidden — its posts stay out of your feed."
    : `@${person.handle} is hidden — their posts stay out of your feed.`;
}

/** The snackbar an unhide answers with; the nameless twin is design digest item 56(b). */
export function unhiddenMessage(person: Pick<HiddenPerson, "handle" | "redacted">): string {
  return person.redacted || person.handle === null
    ? "This account is unhidden — its posts can reach your feed again."
    : `@${person.handle} is unhidden — their posts can reach your feed again.`;
}

/** Hides `person` from the row `origin`, and says so on the host. */
export function hidePerson(set: HiddenSet, person: HiddenPerson, origin: string, notify: Notify): void {
  const already = set.has(person.id);
  if (!already) set.hide(person, origin);
  notify(
    hiddenMessage(person),
    {
      label: UNDO,
      onAction: () => {
        if (!already) set.unhide(person.id, origin, "undoHide");
      },
    },
    hideCause(origin),
  );
}

/** Unhides `person` from their Hidden accounts row, and says so on the host. */
export function unhidePerson(
  set: HiddenSet,
  person: HiddenPerson & { readonly hiddenAt: string },
  notify: Notify,
): void {
  set.unhide(person.id, person.id);
  notify(
    unhiddenMessage(person),
    { label: UNDO, onAction: () => set.hide(person, person.id, person.hiddenAt, "undoUnhide") },
    hideCause(person.id),
  );
}

/** The menu's hide act: the guest's ask, else the hide. */
export function hideAct({
  set,
  person,
  origin,
  notify,
  onGuest,
}: {
  set: HiddenSet;
  person: HiddenPerson;
  origin: string;
  notify: Notify;
  onGuest: (() => void) | null;
}): () => void {
  return () => (onGuest !== null ? onGuest() : hidePerson(set, person, origin, notify));
}
