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
  UserProfileDocument,
  type AuthorRecordsQuery,
  type RecordFamily,
  type UserProfileQuery,
} from "@/__generated__/graphql";
import { fetchOutcome, payloadOutcome, success, type Outcome } from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";
import type { Page } from "./content-api";

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
export type ActKind = "post" | "comment" | "opinion" | "profile" | "other";

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

export type RecordNode = AuthorRecordsQuery["records"]["edges"][number]["node"];

/**
 * The honest label for one chronicle row, in the profile's blessed words
 * (copy-voice.md "Carried over", the profile: `Published a post`,
 * `Commented`, `Gave an opinion`, `Updated your profile` · `Updated their
 * profile`). An opinion is the reader's word for both stance families —
 * "stance" belongs to the docs, never to a screen (copy-voice.md, "What a
 * reader gives is an OPINION").
 *
 * Exported because it is a pure decision over the record family, the
 * genesis mark and whose chronicle it is, and a branch matrix that reads
 * wrong is the whole defect.
 */
export function rowLabel(node: RecordNode, genesis: boolean, own = false): string {
  switch (node.family) {
    case "PUBLISH":
      return genesis ? "Published a post" : "Edited a post";
    case "REVIEW":
      return genesis ? "Commented" : "Edited a comment";
    // The anchoring record and its updates share one label — the chain
    // shape is not visible per-row.
    case "REGISTRATION":
      return own ? "Updated your profile" : "Updated their profile";
    case "OPINION":
    case "AFFINITY":
      return "Gave an opinion";
    default:
      return "Did something";
  }
}

const KIND: Record<string, ActKind> = {
  PUBLISH: "post",
  REVIEW: "comment",
  OPINION: "opinion",
  AFFINITY: "opinion",
  REGISTRATION: "profile",
};

function toRow(node: RecordNode, own: boolean): RecordRow {
  const mint = `mint:${node.id}`;
  const genesis = node.targetId === mint || node.terminalId === mint;
  const terminalComment =
    node.terminal?.__typename === "Comment" ? node.terminal : null;
  const targetPost = node.target?.__typename === "Post" ? node.target : null;
  const targetComment = node.target?.__typename === "Comment" ? node.target : null;
  const snippet =
    terminalComment?.content.value ??
    targetPost?.title?.value ??
    targetPost?.content.value ??
    targetComment?.content.value ??
    null;
  // A Review's thread opens at its parent post, when the parent is a
  // post CoGra carries; nested reply chains stay unlinked until a
  // comment permalink exists.
  const postId =
    (terminalComment?.target?.__typename === "Post" ? terminalComment.target.id : null) ??
    targetPost?.id ??
    (targetComment?.target?.__typename === "Post" ? targetComment.target.id : null) ??
    null;
  const kind = KIND[node.family] ?? "other";
  const targetUser = node.target?.__typename === "User" ? node.target : null;
  return {
    id: node.id,
    kind,
    label: rowLabel(node, genesis, own),
    aside: kind === "opinion" && targetUser !== null ? `on @${targetUser.handle}` : null,
    snippet,
    postId,
    landedAt: node.landedAt,
    face:
      kind === "opinion"
        ? { pDirected: node.pDirected, pInterest: node.pInterest, severed: node.severed === true }
        : null,
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
