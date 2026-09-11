/** A compact actor reference — monogram, display name, handle — opening a profile. */
export interface ActorChipProps {
  handle: string;
  /** Falls back to the handle when absent or blank. */
  displayName?: string | null;
  href?: string;
  onClick?: (event: React.MouseEvent) => void;
  /** The actor's photo, where they have set one. The monogram is the fallback. */
  avatarSrc?: string;
  /**
   * The actor is still there and its identity payloads are gone (a deleted
   * account, `erasure.md` §2–3). The disc keeps its space and fills with
   * nothing, the name slot reads `REDACTED_ACTOR_NAME` in `text-secondary` —
   * the system's voice, not a name somebody chose — and the handle is dropped
   * rather than invented. `displayName`, `handle` and `avatarSrc` are ignored.
   */
  redacted?: boolean;
}

export declare function ActorChip(props: ActorChipProps): JSX.Element;

/** The word that stands in a redacted actor's name slot, assigned once. */
export declare const REDACTED_ACTOR_NAME: string;

/**
 * The label of a menu row that hides an actor: `Hide @ada` where there is a
 * handle to name, `Hide this account` where the actor is redacted and there is
 * none. The row itself stays either way — hiding is about an actor, and a
 * redacted actor still ranks into the reader's feed — so only the wording
 * gives way. Every menu that carries the row takes its label from here.
 */
export declare const HIDE_ACTOR_LABEL: (handle?: string | null, redacted?: boolean) => string;

/**
 * The circular avatar: a photo where there is one, the monogram where there is
 * not. Decorative either way — the adjacent text names the actor, so the photo
 * carries no alt text. A broken image falls back to the monogram silently.
 */
export interface MonogramAvatarProps {
  name: string;
  /** 24px in a row, 32px leading a reference row, 64px on a profile header.
   *  Also takes an exact pixel size (e.g. the profile header's 80). */
  size?: "sm" | "md" | "lg" | number;
  src?: string;
  /** A redacted actor: the disc reserved and empty — there is no name to take
   *  a monogram from, and a glyph would be imagery with no source. */
  redacted?: boolean;
}

export declare function MonogramAvatar(props: MonogramAvatarProps): JSX.Element;
