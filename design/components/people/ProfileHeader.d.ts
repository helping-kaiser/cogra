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
  website?: string;
  /** Leads the figures row. Already formatted. */
  posts?: string | number;
  /** How many people have taken a stance on them. Already formatted. */
  stancesOn?: string | number;
  /** How many stances they have taken. Already formatted. */
  stancesTaken?: string | number;
  /** The viewer's own profile: no opinion to give, so the row carries edit + invites. */
  own?: boolean;
  signedIn?: boolean;
  /** Owned by the shell, like `PostCard.taught`. */
  taught?: boolean;
  bundle?: StanceBundle | null;
  onCommit?: (pick: StancePair, bundle: StanceBundle) => void;
  /** Someone else's profile only, beside the stance control. Sized by its own
   *  word, not by the row — the width the ⋮ needs comes from here. */
  onMessage?: () => void;
  onEdit?: () => void;
  /** The viewer's own profile only, beside Edit profile. */
  onInvites?: () => void;
  /** The viewer's own avatar only: the change badge over the monogram/photo. */
  onAvatarChange?: () => void;
  /** Opens the figures as one tap target, both directions, on the stances page. */
  onCounts?: () => void;
  /** The page's own overflow, closing the actions row — an `OverflowMenu` with
   *  `placement="row"`. No band carries a ⋮ (the band law), so a profile's
   *  rare acts hang off the row that holds its other acts. */
  menu?: React.ReactNode;
  /** Off where the screen's own top bar already carries @handle. Defaults to true. */
  showHandle?: boolean;
}

export declare function ProfileHeader(props: ProfileHeaderProps): JSX.Element;
