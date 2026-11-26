"use client";

// WHAT THIS DEVICE JUST SIGNED INTO ITS OWN PROFILE, laid over the head until
// a read asked after it answers.
//
// "WHEN the signing is taken -> the profile shows the change AND the snackbar
// reads Signed — your profile shows it now, still settling."
// (ProfileEditSeal.md:45, AvatarSeal.md:37), and a return "reads
// profile.identity's facts again beneath them, so a signed edit or a changed
// handle shows on arrival, and the list never moves" (Profile.md:97). The
// server serves the change from its signature on (data-model.md, "Actor
// profiles": the merged version row is "served to every reader from then
// on"), so the arrival's read confirms it — but that read is one round trip
// away, and the return draws the head it held (`profile-memory.ts`) at once
// to keep the page's height. Without this store that first frame wore the
// values from BEFORE the edit under the snackbar that says the profile shows
// it now.
//
// So the device keeps what it signed — it is the device's own act, its values
// in hand — and the head wears them from the first frame. The fresh read then
// replaces them, whatever it answers: the server is the truth about the
// profile, and the store never outlives a read asked after the change.
//
// ONLY A CHANGE TAKEN is laid: one still signing, or one that did not go
// through, leaves the head as it was (ProfileEditSeal.md:75-79, Profile.md:99).
// A handle Settings changed is laid the same way, once the server took it.
//
// THE CHANGE IS THE SIGNING ACCOUNT'S: several accounts share a tab (auth.md
// "Multi-account device custody"), so it is laid beside the account and the
// profile it was signed for, read only under that account on that profile,
// and let go whenever the tab's active account ends or changes.

import { useSyncExternalStore } from "react";

import { onAccountChange } from "@/lib/session/account-change";
import { tokenStore } from "@/lib/session/token-store";

/** The fields one profile change set; a field it left untouched is absent. */
export type SignedProfileFields = {
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly websiteUrl?: string | null;
  /** The new picture as uploaded, or null where the change removed it. */
  readonly avatar?: { readonly id: string; readonly url: string } | null;
  /** The handle Settings changed (`layChangedHandle`) — no signed act, laid the same way. */
  readonly handle?: string;
};

/** One change as signed: the profile it is for and what it set. */
export type SignedProfileChange = {
  /** The profile's own id, the node the payload binds to; null binds nothing. */
  readonly profileId: string | null;
  readonly fields: SignedProfileFields;
};

type Laid = {
  readonly owner: string;
  readonly profileId: string;
  readonly fields: SignedProfileFields;
  /** The order the changes were signed in: a later one's fields win. */
  readonly signing: number;
  /** The generation it was laid at; a read asked at or after it confirms it. */
  readonly generation: number;
};

let laid: Laid | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function publish(next: Laid | null): void {
  laid = next;
  for (const listener of listeners) listener();
}

onAccountChange(() => {
  if (laid !== null) publish(null);
});

/**
 * A change was taken: the head wears its fields from now until a read asked
 * after it answers. `signing` orders it against a change laid earlier and not
 * yet confirmed — its untouched fields keep that one's, and a change signed
 * before the one laid never overrides it.
 */
export function laySignedProfile(owner: string, change: SignedProfileChange, signing: number): void {
  if (change.profileId === null) return;
  const earlier = laid !== null && laid.owner === owner && laid.profileId === change.profileId ? laid : null;
  const fields =
    earlier === null
      ? change.fields
      : signing >= earlier.signing
        ? { ...earlier.fields, ...change.fields }
        : { ...change.fields, ...earlier.fields };
  generation += 1;
  publish({
    owner,
    profileId: change.profileId,
    fields,
    signing: Math.max(signing, earlier?.signing ?? signing),
    generation,
  });
}

/**
 * Settings changed the handle and the server took it: "a changed handle shows
 * on arrival" (Profile.md:97) like a signed edit, worn from now until a read
 * asked after it answers. No signing orders it — the handle is a field no
 * signed change sets — so a change laid earlier keeps its fields and its order.
 */
export function layChangedHandle(owner: string, profileId: string, handle: string): void {
  const earlier = laid !== null && laid.owner === owner && laid.profileId === profileId ? laid : null;
  generation += 1;
  publish({
    owner,
    profileId,
    fields: { ...earlier?.fields, handle },
    signing: earlier?.signing ?? 0,
    generation,
  });
}

/** Marks a read of a profile being asked; hand the answer back to `signedProfileRead`. */
export function signedProfileAsked(): number {
  return generation;
}

/**
 * A read asked at `asked` answered `profileId`: a change laid at or before it
 * is the server's to say now, and the head reads the answer alone.
 */
export function signedProfileRead(asked: number, profileId: string): void {
  if (laid !== null && laid.profileId === profileId && laid.generation <= asked) publish(null);
}

function current(): Laid | null {
  return laid !== null && tokenStore.activeAccountId() === laid.owner ? laid : null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeAccounts = tokenStore.subscribe(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeAccounts();
  };
}

/** What stands laid over `profileId`'s head for the tab's account, or null. */
export function readSignedProfile(profileId: string | null): SignedProfileFields | null {
  const now = current();
  return now !== null && profileId !== null && now.profileId === profileId ? now.fields : null;
}

/** The fields laid over this profile's head, for the active account; null where none are. */
export function useSignedProfile(profileId: string | null): SignedProfileFields | null {
  return useSyncExternalStore(
    subscribe,
    () => readSignedProfile(profileId),
    () => null,
  );
}

/** The profile as read, wearing what was signed over it. */
export function withSigned<
  P extends {
    readonly displayName: { readonly value?: string | null };
    readonly bio: { readonly value?: string | null };
    readonly websiteUrl: { readonly value?: string | null };
    readonly avatar?: { readonly id: string; readonly url: string } | null;
    readonly handle?: string;
  },
>(profile: P, fields: SignedProfileFields | null): P {
  if (fields === null) return profile;
  return {
    ...profile,
    ...(fields.handle !== undefined && { handle: fields.handle }),
    ...(fields.displayName !== undefined && {
      displayName: { ...profile.displayName, value: fields.displayName },
    }),
    ...(fields.bio !== undefined && { bio: { ...profile.bio, value: fields.bio } }),
    ...(fields.websiteUrl !== undefined && { websiteUrl: { ...profile.websiteUrl, value: fields.websiteUrl } }),
    ...(fields.avatar !== undefined && {
      avatar:
        fields.avatar === null
          ? null
          : // A new asset: none of the old picture's facts are its.
            { ...profile.avatar, id: fields.avatar.id, url: fields.avatar.url, altText: null, status: "NORMAL" },
    }),
  } as P;
}

export function resetSignedProfileForTests(): void {
  laid = null;
  generation = 0;
}
