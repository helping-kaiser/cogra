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
   * nothing but the reserved surface, ringed 1px in `--border-field` inside
   * its box (`REDACTED_RING`), the name slot reads `REDACTED_ACTOR_NAME` in `text-secondary` —
   * the system's voice, not a name somebody chose — and the handle is dropped
   * rather than invented. `displayName`, `handle` and `avatarSrc` are ignored.
   */
  redacted?: boolean;
  /** The data-node name its placer gives this chip (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `avatar`, `name`, `handle`. */
  node?: string;
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
 * The hide row for a person already hidden: `Unhide @ada`, or `Unhide this
 * account` for a redacted actor — the same row in Settings · hidden
 * accounts' word, wherever a hidden person's card or post still stands.
 */
export declare const UNHIDE_ACTOR_LABEL: (handle?: string | null, redacted?: boolean) => string;

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
   *  a monogram from, and a glyph would be imagery with no source — ringed
   *  1px in `--border-field` inside its box (`REDACTED_RING`). */
  redacted?: boolean;
  /** The data-node name its placer gives this avatar (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
}

export declare function MonogramAvatar(props: MonogramAvatarProps): JSX.Element;

/**
 * A one-line place's text with its first `@handle` made the one part that
 * yields (round 40): the words keep their room, the handle is cut with "…".
 * Text with no handle, or anything not a string, returns untouched. Every
 * one-line master (page title, menu row, row title and aside) calls it.
 */
export declare function nameInLine(text: React.ReactNode): React.ReactNode;

/**
 * `nameInLine`'s wrapping-text twin (round 40): the sentence wraps at its
 * spaces, and every `@handle` — and every person's name given in `names` —
 * is one unit that never stands on two lines: it moves whole to the next
 * line, and past a full line it is cut at its end with "…", its trailing
 * punctuation (`?`, `.`, `'s`) kept whole beside it. Text naming nobody, or
 * anything not a string (an array maps part by part), returns untouched.
 */
export declare function nameInText(text: React.ReactNode, names?: string[]): React.ReactNode;

/** `nameInText` as an element, for the screens. */
export declare function NameInText(props: { text: React.ReactNode; names?: string[] }): JSX.Element;

/** The 1px `--border-field` ring, drawn inside the box, every mark whose payload went wears (a deleted account's disc, a removed thing's tile). */
export declare const REDACTED_RING: { border: string; boxSizing: "border-box" };
