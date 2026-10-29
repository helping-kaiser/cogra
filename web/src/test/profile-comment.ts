// A comment as the profile's comments view reads it (`ProfileComments`'s
// terminal Comment: `CommentFields`, what it answers, the thread's post and
// its replies' count), cast once — the wire shape a handler serves.

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

/** One of the person's comments, on the wire (`Record.terminal`). */
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
    replies: { __typename: "CommentConnection", totalCount: 0 },
    ...over,
  };
}

/** A page of the comments view, as the `ProfileComments` read serves it. */
export function commentsPage(
  userId: string,
  /** A null stands for a record whose comment CoGra does not carry. */
  comments: readonly (Record<string, unknown> | null)[],
  next: string | null = null,
) {
  return {
    user: {
      __typename: "User",
      id: userId,
      comments: {
        __typename: "RecordConnection",
        edges: comments.map((comment, index) => ({
          __typename: "RecordEdge",
          node: { __typename: "Record", id: `rec-${String(comment?.id ?? index)}`, terminal: comment },
        })),
        pageInfo: { __typename: "PageInfo", hasNextPage: next !== null, endCursor: next },
      },
    },
  };
}
