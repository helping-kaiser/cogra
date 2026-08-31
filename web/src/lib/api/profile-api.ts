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

/** The profile filter chips; every visitor lands on posts. */
export type ChronicleFilter = "posts" | "comments" | "everything";

const FILTER_FAMILY: Record<ChronicleFilter, RecordFamily | null> = {
  posts: "PUBLISH",
  comments: "REVIEW",
  everything: null,
};

/**
 * One row of the actor's chronicle — the honest labelled history
 * (roadmap "Slice 2.1"): what the record did, a snippet of what it
 * touched, and the post it opens where CoGra carries one.
 */
export type RecordRow = {
  id: string;
  label: string;
  snippet: string | null;
  postId: string | null;
};

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

type RecordNode = AuthorRecordsQuery["records"]["edges"][number]["node"];

function rowLabel(node: RecordNode, genesis: boolean): string {
  switch (node.family) {
    case "PUBLISH":
      return genesis ? "Published a post" : "Edited a post";
    case "REVIEW":
      return genesis ? "Commented" : "Edited a comment";
    // The anchoring record and its updates share one honest label —
    // the chain shape is not visible per-row.
    case "REGISTRATION":
      return "Profile update";
    case "OPINION":
    case "AFFINITY":
      return "Shared a stance";
    default:
      return "Did something";
  }
}

function toRow(node: RecordNode): RecordRow {
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
  return { id: node.id, label: rowLabel(node, genesis), snippet, postId };
}

export async function fetchAuthorRecords(
  client: ApolloClient,
  authorId: string,
  filter: ChronicleFilter,
  after: string | null = null,
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
    items: records.edges.map((edge) => toRow(edge.node)),
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

function mediaField(selection: MediaSelection | undefined): string | null | undefined {
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
