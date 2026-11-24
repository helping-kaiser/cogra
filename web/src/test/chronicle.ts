// The profile's chronicle as `ProfileChronicle` serves it (`User.chronicle`):
// one page of entries — a landed act's `Record`, or a post or comment still
// settling — under the person it belongs to. The wire shape a handler serves.

const moderated = (value: string | null) => ({ __typename: "ModeratedText", value });

/** One page of entries, in the order the server pages them. */
export function chroniclePage(
  nodes: readonly unknown[],
  {
    userId = "u-chronicle",
    hasNextPage = false,
    endCursor = null,
  }: { userId?: string; hasNextPage?: boolean; endCursor?: string | null } = {},
) {
  return {
    data: {
      user: {
        __typename: "User",
        id: userId,
        chronicle: {
          __typename: "ChronicleEntryConnection",
          edges: nodes.map((node) => ({ __typename: "ChronicleEntryEdge", node })),
          pageInfo: { __typename: "PageInfo", hasNextPage, endCursor },
        },
      },
    },
  };
}

/** A post the person signed that is still settling: the light row the read selects. */
export function settlingPostEntry({
  id,
  genesisRecordId = `act:${id}`,
  title = "The long way home",
  content = "Body",
  createdAt = new Date().toISOString(),
  state = "PENDING",
}: {
  id: string;
  genesisRecordId?: string;
  title?: string | null;
  content?: string | null;
  createdAt?: string;
  state?: "PENDING" | "LANDED";
}) {
  return {
    __typename: "Post",
    postId: id,
    genesisRecordId,
    createdAt,
    landing: { __typename: "Landing", state },
    title: moderated(title),
    content: moderated(content),
  };
}

/** A comment the person signed that is still settling, with its thread's post. */
export function settlingCommentEntry({
  id,
  postId,
  genesisRecordId = `act:${id}`,
  content = "The third headland light is real",
  createdAt = new Date().toISOString(),
}: {
  id: string;
  postId: string;
  genesisRecordId?: string;
  content?: string | null;
  createdAt?: string;
}) {
  return {
    __typename: "Comment",
    commentId: id,
    genesisRecordId,
    createdAt,
    landing: { __typename: "Landing", state: "PENDING" },
    content: moderated(content),
    post: { __typename: "Post", id: postId },
  };
}
