/** A compact actor reference — monogram, display name, handle — opening a profile. */
export interface ActorChipProps {
  handle: string;
  /** Falls back to the handle when absent or blank. */
  displayName?: string | null;
  href?: string;
  onClick?: (event: React.MouseEvent) => void;
  /** The actor's photo, where they have set one. The monogram is the fallback. */
  avatarSrc?: string;
}

export declare function ActorChip(props: ActorChipProps): JSX.Element;

/**
 * The circular avatar: a photo where there is one, the monogram where there is
 * not. Decorative either way — the adjacent text names the actor, so the photo
 * carries no alt text. A broken image falls back to the monogram silently.
 */
export interface MonogramAvatarProps {
  name: string;
  /** 24px in a row, 32px leading a reference row, 64px on a profile header. */
  size?: "sm" | "md" | "lg";
  src?: string;
}

export declare function MonogramAvatar(props: MonogramAvatarProps): JSX.Element;
