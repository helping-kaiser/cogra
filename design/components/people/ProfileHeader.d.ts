import type { StanceBundle, StancePair } from "../stance/StanceReadout";

/**
 * The top of a profile. Not a card — it sits on the page ground, because a card
 * would imply a second card beside it.
 *
 * The two counts say what a reader can place: how many people have taken a stance
 * on this person, and how many they have taken. Never one merged "followers"
 * figure — there is no following here, and the repo's own word for the thing is on
 * the banned list (readme §3).
 */
export interface ProfileHeaderProps {
  handle: string;
  displayName?: string | null;
  /** Their photo, where they have set one. The monogram is the fallback. */
  avatarSrc?: string;
  /** Their own words, body-medium, unclamped. Omit when there are none. */
  bio?: string;
  /** How many people have taken a stance on them. Already formatted. */
  stancesOn?: string | number;
  /** How many stances they have taken. Already formatted. */
  stancesTaken?: string | number;
  /** The viewer's own profile: no stance to take, so the row carries edit + settings. */
  own?: boolean;
  signedIn?: boolean;
  /** Owned by the shell, like `PostCard.taught`. */
  taught?: boolean;
  bundle?: StanceBundle | null;
  onCommit?: (pick: StancePair, bundle: StanceBundle) => void;
  onEdit?: () => void;
  onSettings?: () => void;
  /** The rare interactions on a person — report, open a proposal, copy a link. */
  menuItems?: readonly { label: string; onSelect?: () => void }[];
}

export declare function ProfileHeader(props: ProfileHeaderProps): JSX.Element;
