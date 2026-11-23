// A comment as the profile's comments view reads it (`ProfileComments`'s
// edge node: `CommentFields`, what it answers and the thread's post),
// cast once — the wire shape a handler serves.

const moderated = (value: string | null, status = "NORMAL") => ({ __typename: "ModeratedText", value, status });

export const ADA_AUTHOR = {
  __typename: "User",
  id: "u-ada",
  handle: "ada",
  displayName: { __typename: "ModeratedText", value: "Ada Okonkwo" },
  avatar: null,
};

/** What a comment answers: a post by its title and author, or another comment. */
export function answersPost(id: string, title: string | null, handle = "ada") {
  return {
    __typename: "Post",
    id,
    title: moderated(title),
    content: moderated(`${title ?? "Untitled"} words`),
    attachments: [],
    author: { __typename: "User", id: `u-${handle}`, handle },
    moderationStatus: "NORMAL",
    removal: null,
  };
}

export function answersComment(id: string, handle: string, words = "The third headland light is real") {
  return {
    __typename: "Comment",
    id,
    content: moderated(words),
    author: { __typename: "User", id: `u-${handle}`, handle },
    moderationStatus: "NORMAL",
    removal: null,
  };
}

/** One of the person's comments, on the wire (a `User.comments` edge's node). */
export function profileComment(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    __typename: "Comment",
    id,
    content: moderated(`Words of ${id}`),
    attachments: [],
    attachmentsStatus: "NORMAL",
    sensitiveSelfMark: false,
    sensitiveReason: null,
    author: ADA_AUTHOR,
    createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    removal: null,
    genesisRecordId: `rec-${id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    viewerBookmarkedAt: null,
    target: answersPost("p1", "The long way home"),
    post: { __typename: "Post", id: "p1" },
    ...over,
  };
}

/**
 * A tagged comment as the tag page's `TaggedComments` read serves it
 * (`topics.graphql`): the comment whole, what it answers and its thread's
 * post — the profile's own shape.
 */
export function taggedCommentWire(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return profileComment(id, over);
}

/** One of the person's comments still settling — signed, not yet ordered on L1. */
export function settlingComment(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return profileComment(id, {
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    landing: { __typename: "Landing", state: "PENDING" },
    ...over,
  });
}

/**
 * A page of the comments view, as the `ProfileComments` read serves it
 * (`User.comments`): each edge's node is the comment itself.
 */
export function commentsPage(
  userId: string,
  comments: readonly Record<string, unknown>[],
  next: string | null = null,
) {
  return {
    user: {
      __typename: "User",
      id: userId,
      comments: {
        __typename: "CommentConnection",
        edges: comments.map((comment) => ({ __typename: "CommentEdge", node: comment })),
        pageInfo: { __typename: "PageInfo", hasNextPage: next !== null, endCursor: next },
      },
    },
  };
}
