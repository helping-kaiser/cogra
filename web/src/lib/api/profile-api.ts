// The profile surface (api-spec.md "Actors"; roadmap "Slice 2.1"):
// public reads by handle, the viewer's own profile, the authored
// chronicle as labelled rows, and the parallel-Registration update.
// The edit's field set is the full form state — a null bio/websiteUrl
// is the explicit clear; the display name never nulls.

import type { ApolloClient } from "@apollo/client";

import {
  AuthorRecordsDocument,
  MyProfileDocument,
  PrepareProfileUpdateDocument,
  ProfileFiguresDocument,
  ProfilePostsDocument,
  UserProfileDocument,
  type AuthorRecordsQuery,
  type RecordFamily,
  type UserProfileQuery,
} from "@/__generated__/graphql";
import { fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";
import type { Page, PostView } from "./content-api";

export type ProfileView = NonNullable<UserProfileQuery["user"]>;

/**
 * The chronicle's tabs (`CHRONICLE_TABS`). Every profile board draws the
 * reader landing on Everything.
 */
export type ChronicleFilter = "posts" | "comments" | "everything";

const FILTER_FAMILY: Record<ChronicleFilter, RecordFamily | null> = {
  posts: "PUBLISH",
  comments: "REVIEW",
  everything: null,
};

/** What a chronicle act is, which picks its disc (`_shared.jsx` `ProfileOwnBody`). */
export type ActKind =
  | "post"
  | "comment"
  | "opinion"
  | "walkBack"
  | "profile"
  | "tag"
  | "citation"
  | "other";

/**
 * One row of the actor's chronicle — the honest labelled history
 * (roadmap "Slice 2.1"): what the record did, a snippet of what it
 * touched, the post it opens where CoGra carries one, when it landed, and —
 * for an opinion — its own face and the person it was on.
 */
export type RecordRow = {
  id: string;
  kind: ActKind;
  label: string;
  /** The word riding the title, `on @mira` (an opinion on a person). */
  aside: string | null;
  snippet: string | null;
  postId: string | null;
  landedAt: string;
  /** The opinion's own pair, for the face its disc wears. */
  face: { pDirected: number; pInterest: number; severed: boolean } | null;
  /** What a citation cites, which picks its disc: the thing's own glyph, or the person's avatar. */
  cited: "post" | "comment" | "person" | null;
  /** The person a mention names, and their picture, for the avatar its disc wears. */
  mentioned: { readonly handle: string; readonly avatar: string | null } | null;
};

/**
 * One page of the chronicle per fetch — the server's own default, pinned
 * to `client-constants.json` in `lib/client-constants.test.ts`.
 */
export const PROFILE_PAGE_SIZE = 20;

export async function fetchProfileByHandle(
  client: ApolloClient,
  handle: string,
): Promise<Outcome<ProfileView | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: UserProfileDocument,
      variables: { handle },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.user ?? null);
}

export async function fetchMyProfile(
  client: ApolloClient,
): Promise<Outcome<ProfileView | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: MyProfileDocument,
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.me ?? null);
}

/**
 * THE HEADER'S THREE FIGURES (ProfileHeader; open-questions.md Q35, closed
 * toward the drawn figures 2026-10-28, jakob's confirmation pending): record
 * counts, each labelled and never merged — the posts published (their genesis
 * Publish records, never an edit), the Opinion records toward the person, and
 * the Opinion records they gave toward people.
 */
export type ProfileFigures = {
  /** Null where the count cannot be stated — the contract's room; the figure is then not drawn. */
  readonly posts: number | null;
  readonly opinionsOn: number | null;
  readonly opinionsBy: number | null;
};

export async function fetchProfileFigures(
  client: ApolloClient,
  id: string,
): Promise<Outcome<ProfileFigures | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: ProfileFiguresDocument,
      variables: { id },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const user = fetched.value.user;
  if (user === null || user === undefined) return success(null);
  return success({
    posts: user.posts.totalCount ?? null,
    opinionsOn: user.opinionsOn.totalCount ?? null,
    opinionsBy: user.opinionsBy.totalCount ?? null,
  });
}

/**
 * THE POSTS VIEW'S PAGE (ProfilePosts.md:3): the person's posts as the feed
 * card draws them, newest first by landing — the records the `Posts` figure
 * counts, so the list and the figure agree. Ten a page, the document's own
 * literal (`profile.graphql`); a record whose post CoGra does not carry is
 * skipped, never drawn as a blank card.
 */
export async function fetchProfilePosts(
  client: ApolloClient,
  id: string,
  after: string | null = null,
): Promise<Outcome<Page<PostView>>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: ProfilePostsDocument,
      variables: { id, after },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const posts = fetched.value.user?.posts;
  if (posts === undefined) return success({ items: [], endCursor: null, hasNextPage: false });
  return success({
    items: posts.edges.flatMap((edge) => {
      const target = edge.node.target;
      return target?.__typename === "Post" ? [target] : [];
    }),
    endCursor: posts.pageInfo.endCursor ?? null,
    hasNextPage: posts.pageInfo.hasNextPage,
  });
}

export type RecordNode = AuthorRecordsQuery["records"]["edges"][number]["node"];

/** What a row's target is, in the chronicle's own words (`on a post`). */
type TargetWords = { aside: string | null; snippet: string | null };

/** The node a record names, read for the row's aside and second line. */
function targetWords(node: RecordNode["target"] | RecordNode["terminal"]): TargetWords {
  switch (node?.__typename) {
    case "User":
      return { aside: `@${node.handle}`, snippet: null };
    case "Post":
      return { aside: "a post", snippet: node.title?.value ?? node.content.value ?? null };
    case "Comment":
      return { aside: "a comment", snippet: node.content.value ?? null };
    default:
      return { aside: null, snippet: null };
  }
}

/**
 * THE CHRONICLE'S VERBS, ONE PER FAMILY IT LISTS (copy-voice, *The
 * chronicle's verbs*, round 22; seam 247 rider 2). A row's title is the act,
 * past tense, its actor the profile's owner and never named; the aside names
 * the target; the second line, where there is one, is the target's own words.
 * A record is one row, whatever gesture signed it.
 *
 * THE VERB READS THE SERVER'S `act` (`RecordAct`, #324), never a shape the
 * client derives: GENESIS is a post published, a comment made or the
 * account's registration; WALK_BACK every record a walk-back signed; VOUCH the
 * opinion that vouched someone in. An opinion is the reader's word for both
 * stance families — "stance" belongs to the docs, never to a screen.
 *
 * Exported because it is a pure decision over the family, the act, the record
 * and whose chronicle it is, and a branch matrix that reads wrong is the whole
 * defect.
 */
export function rowLabel(node: RecordNode, own = false): string {
  const genesis = node.act === "GENESIS";
  switch (node.family) {
    case "PUBLISH":
      return genesis ? "Published a post" : "Edited a post";
    case "REVIEW":
      return genesis ? "Commented" : "Edited a comment";
    case "REGISTRATION":
      // The first record, the account's own registration, is the joining.
      if (genesis) return "Joined";
      return own ? "Updated your profile" : "Updated their profile";
    case "OPINION":
    case "AFFINITY":
      if (node.act === "WALK_BACK") return "Walked back an opinion";
      if (node.act === "VOUCH") return "Vouched for";
      return "Gave an opinion";
    case "TAG": {
      // A tag at (0, 0) is its withdrawal — `Un-tag`'s past (api-spec.md:
      // "(0, 0) is the un-tag, read as withdrawn").
      const what = node.target?.__typename === "Comment" ? "a comment" : "a post";
      return node.pDirected === 0 && node.pInterest === 0 ? `Un-tagged ${what}` : `Tagged ${what}`;
    }
    case "REFERENCE":
      // The cited node's class is the whole distinction (edges.md): a person
      // cited is a mention.
      if (node.terminal?.__typename === "User") return "Mentioned";
      return node.terminal?.__typename === "Comment" ? "Cited a comment" : "Cited a post";
    default:
      // Unblessed (seam 247): families beyond these have no verb yet.
      return "Did something";
  }
}

const KIND: Record<string, ActKind> = {
  PUBLISH: "post",
  REVIEW: "comment",
  OPINION: "opinion",
  AFFINITY: "opinion",
  REGISTRATION: "profile",
  TAG: "tag",
  REFERENCE: "citation",
};

function toRow(node: RecordNode, own: boolean): RecordRow {
  const terminalComment =
    node.terminal?.__typename === "Comment" ? node.terminal : null;
  const targetPost = node.target?.__typename === "Post" ? node.target : null;
  const targetComment = node.target?.__typename === "Comment" ? node.target : null;
  const family = KIND[node.family] ?? "other";
  // A WALK-BACK WEARS 🤷, never the counter-record's own face, which would
  // read as an opinion against (copy-voice, *A walk-back*).
  const kind: ActKind = family === "opinion" && node.act === "WALK_BACK" ? "walkBack" : family;
  const target = targetWords(node.target);
  const cited = targetWords(node.terminal);
  // The aside names the target: an opinion's `on @mira` · `on a post` ·
  // `on a comment`, a vouch's `@rafa`, a mention's `@ada`. A topic's
  // `#saltmaps` (an Affinity's or a Tag's) is not on the wire: its Type is no
  // Node the read resolves.
  const aside =
    family === "opinion"
      ? node.act === "VOUCH"
        ? target.aside
        : target.aside === null
          ? null
          : `on ${target.aside}`
      : family === "citation" && node.terminal?.__typename === "User"
        ? cited.aside
        : null;
  // The second line is the target's own words: a review its comment, a
  // citation the cited thing's, anything else the post or comment it names.
  const snippet =
    terminalComment?.content.value ??
    (family === "citation" ? cited.snippet : null) ??
    targetPost?.title?.value ??
    targetPost?.content.value ??
    targetComment?.content.value ??
    null;
  // A Review's thread opens at its parent post, when the parent is a
  // post CoGra carries; nested reply chains stay unlinked until a
  // comment permalink exists.
  const citedPost = family === "citation" && node.terminal?.__typename === "Post" ? node.terminal : null;
  const postId =
    (terminalComment?.target?.__typename === "Post" ? terminalComment.target.id : null) ??
    citedPost?.id ??
    targetPost?.id ??
    (targetComment?.target?.__typename === "Post" ? targetComment.target.id : null) ??
    null;
  const mentioned =
    node.terminal?.__typename === "User"
      ? { handle: node.terminal.handle, avatar: node.terminal.avatar?.url ?? null }
      : null;
  return {
    id: node.id,
    kind,
    label: rowLabel(node, own),
    aside,
    snippet,
    postId,
    landedAt: node.landedAt,
    face:
      kind === "opinion"
        ? { pDirected: node.pDirected, pInterest: node.pInterest, severed: node.severed === true }
        : null,
    cited: family === "citation" ? (mentioned !== null ? "person" : node.terminal?.__typename === "Comment" ? "comment" : "post") : null,
    mentioned,
  };
}

export async function fetchAuthorRecords(
  client: ApolloClient,
  authorId: string,
  filter: ChronicleFilter,
  after: string | null = null,
  /** The reader's own chronicle, whose profile updates say `your`. */
  own = false,
): Promise<Outcome<Page<RecordRow>>> {
  const fetched = await fetchOutcome(() =>
    client.query({
      query: AuthorRecordsDocument,
      variables: {
        author: authorId,
        family: FILTER_FAMILY[filter],
        first: PROFILE_PAGE_SIZE,
        after,
      },
      fetchPolicy: "network-only",
    }),
  );
  if (fetched.kind !== "success") return fetched;
  const records = fetched.value.records;
  return success({
    items: records.edges.map((edge) => toRow(edge.node, own)),
    endCursor: records.pageInfo.endCursor ?? null,
    hasNextPage: records.pageInfo.hasNextPage,
  });
}

/**
 * A profile field the update leaves alone, clears, or replaces.
 *
 * The three-valued rule is the profile's own and differs from the two-valued
 * one every content edit uses, which is exactly why it is spelled out in a type
 * rather than left to `undefined` discipline: omitted = untouched, explicit
 * null = cleared, a value = replaced. `undefined` in a GraphQL variables object
 * serialises to an absent field, which is the "untouched" the contract means.
 */
export type MediaSelection = "unchanged" | { readonly clear: true } | { readonly mediaId: string };

/** The three-valued rule above, as the value the variables object carries. */
export function mediaField(selection: MediaSelection | undefined): string | null | undefined {
  if (selection === undefined || selection === "unchanged") return undefined;
  return "clear" in selection ? null : selection.mediaId;
}

export async function prepareProfileUpdate(
  client: ApolloClient,
  fields: {
    displayName: string;
    bio: string | null;
    websiteUrl: string | null;
    avatar?: MediaSelection;
  },
): Promise<Outcome<readonly StagedWriteView[]>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: PrepareProfileUpdateDocument,
        variables: {
          input: {
            displayName: fields.displayName,
            bio: fields.bio,
            websiteUrl: fields.websiteUrl,
            avatarMediaId: mediaField(fields.avatar),
          },
        },
      }),
    (data) => data.prepareProfileUpdate.userErrors,
    (data) => data.prepareProfileUpdate.writes?.map(stagedFromPrepared) ?? null,
  );
}
