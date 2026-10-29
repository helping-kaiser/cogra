// WHERE THE READER WAS ON A PROFILE'S CARD VIEWS — the posts view and the
// comments view — so every way back through a card's door lands there exactly.
//
// "WHEN press reel.backDisc GIVEN the stream was opened from anywhere else ->
// the stream closes onto where it was opened, the state the reader left
// exactly" (Reel.md:83), and "WHEN tap the back arrow -> the reader returns to
// where they came from, in the state they left it" (ProfilePosts.md:51,
// ProfileComments.md:45): the profile's posts view is one of the lists the
// stream opens from (Reel.md:3), and both views' cards open their post or
// their thread on a route of its own. The App Router unmounts the profile
// when that route renders, so a remount that started from nothing would land
// on Everything — the tab every profile board opens on — at the top, its cards
// read again. This is the external store the feed's memory is
// (`app/feed/feed-memory.ts` says why it is module scope rather than Cache
// Components): the view left, its cards, its paging, and its place.
//
// WHAT IS HELD, AND WHEN. Only a profile left while one of its CARD VIEWS
// stands — Posts or Comments, the two whose cards have doors that leave the
// page (ProfilePosts.md:39-49, ProfileComments.md:23-27). Everything's
// chronicle keeps its own landing. The header is held beside the cards so the
// page is as tall at its first commit as it was when the reader left; the
// arrival still asks the server for the header beneath it, as every arrival
// does ("a return to the own profile reads the server").
//
// WHICH ARRIVAL IS A RETURN. Every way back to a profile is a link to its
// route — the stream's back disc, the detail's and the trace's back arrows —
// and carries no `from`, while a profile opened from a list names that list
// in its `from`. So an arrival on the same profile, for the same reader,
// with no `from` or the one it was opened with, finds it; and the profile's
// own back arrow keeps the origin it was opened with.
//
// THE MEMORY IS ONE READER'S, ONE PROFILE'S AND ONE VIEW'S. A different
// reader, or another profile, is a profile that has not been left yet; a
// switch to another tab lets the held view go (`forgetProfileView`).

import type { MeUser } from "@/lib/api/auth-api";
import type { PostView } from "@/lib/api/content-api";
import type { ProfileCommentView, ProfileFigures, ProfileView } from "@/lib/api/profile-api";
import type { ScrollPlace } from "@/lib/ui/scroll-pin";

/** The card view left, and its cards in its order. */
export type HeldProfileList =
  | { readonly tab: "posts"; readonly posts: readonly PostView[] }
  | { readonly tab: "comments"; readonly comments: readonly ProfileCommentView[] };

export type ProfileViewMemory = {
  readonly reader: string | null;
  /** The route's profile: null for the reader's own root (`/profile`), the handle for `/u/<handle>`. */
  readonly route: string | null;
  /** The `from` the profile was opened with — what its own back arrow names. */
  readonly from: string | null;
  readonly profile: ProfileView;
  readonly figures: ProfileFigures | null;
  readonly viewer: MeUser | null;
  readonly own: boolean;
  readonly applicant: boolean;
  readonly list: HeldProfileList;
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  /** The reader's place, kept current while they scroll. */
  readonly place: ScrollPlace;
};

const TOP: ScrollPlace = { offset: 0, anchorId: null, anchorTop: 0 };

let memory: ProfileViewMemory | null = null;

/** A handle names one profile whatever its case; the own root is its own route. */
function routeKey(route: string | null): string | null {
  return route === null ? null : route.toLowerCase();
}

function sameProfile(
  held: ProfileViewMemory,
  reader: string | null,
  route: string | null,
): boolean {
  return held.reader === reader && routeKey(held.route) === routeKey(route);
}

/**
 * Keep the card view as it stands. Called whenever what it shows changes; the
 * place the reader scrolled to stays with the same profile's same view.
 */
export function rememberProfileView(left: Omit<ProfileViewMemory, "place">): void {
  const place =
    memory !== null && sameProfile(memory, left.reader, left.route) && memory.list.tab === left.list.tab
      ? memory.place
      : TOP;
  memory = { ...left, place };
}

/**
 * Keep the place on this profile's held view. Called as the reader scrolls,
 * so it costs no render; a scroll on any other profile, or on the chronicle,
 * leaves the held place alone.
 */
export function rememberProfilePlace(
  reader: string | null,
  route: string | null,
  place: ScrollPlace,
): void {
  if (memory !== null && sameProfile(memory, reader, route)) memory = { ...memory, place };
}

/**
 * The card view `reader` left on this profile, or null. A READ, NOT A TAKE:
 * a lazy state initializer may run twice (React StrictMode), and a return
 * left again through the same door finds it again.
 */
export function recallProfileView(
  reader: string | null,
  route: string | null,
  from: string | null,
): ProfileViewMemory | null {
  if (memory === null || !sameProfile(memory, reader, route)) return null;
  return from === null || from === memory.from ? memory : null;
}

/**
 * The reader moved to another tab of this profile, or opened it afresh: its
 * landing is the tab's again. Another profile's held view stays — the stream
 * opened from it may still be on its way back there.
 */
export function forgetProfileView(reader: string | null, route: string | null): void {
  if (memory !== null && sameProfile(memory, reader, route)) memory = null;
}

/** Drop it — a cold start, for a test. */
export function forgetAllProfileViews(): void {
  memory = null;
}
