// THE PROFILE'S CARD VIEWS' READS (ProfilePosts, ProfileComments;
// `profile.graphql`): the person's posts and comments as the feed's own cards
// read them, a page at a time. web's twin is `web/src/lib/api/profile-api.ts`
// `fetchProfilePosts` / `fetchProfileComments`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.map
import com.cogra.network.fetch
import com.cogra.network.graphql.ProfileCommentsQuery
import com.cogra.network.graphql.ProfilePostsQuery
import com.cogra.network.toDomain

/**
 * One page of the posts view. A record whose target CoGra does not carry as a
 * post is skipped, never drawn as a blank card; a person the server does not
 * know reads empty.
 */
internal suspend fun readProfilePosts(client: ApolloClient, authorId: String, after: String?): Outcome<Page<PostView>> =
    client.query(ProfilePostsQuery(id = authorId, after = Optional.presentIfNotNull(after))).fetch().map { data ->
        val posts = data.user?.posts ?: return@map Page(emptyList(), endCursor = null, hasNextPage = false)
        Page(
            items = posts.edges.mapNotNull { edge ->
                edge.node.target?.onPost?.let { post ->
                    post.postFields.toDomain().copy(commentCount = post.commentCount.totalCount)
                }
            },
            endCursor = posts.pageInfo.endCursor,
            hasNextPage = posts.pageInfo.hasNextPage,
        )
    }

/**
 * One page of the comments view: each comment with what it answers, its
 * thread's post and its replies' count. A record whose terminal CoGra does not
 * carry as a comment is skipped.
 */
internal suspend fun readProfileComments(
    client: ApolloClient,
    authorId: String,
    after: String?,
): Outcome<Page<ProfileComment>> =
    client.query(ProfileCommentsQuery(id = authorId, after = Optional.presentIfNotNull(after))).fetch().map { data ->
        val comments = data.user?.comments ?: return@map Page(emptyList(), endCursor = null, hasNextPage = false)
        Page(
            items = comments.edges.mapNotNull { edge ->
                edge.node.terminal?.onComment?.let { comment ->
                    ProfileComment(
                        comment = comment.commentFields.toDomain().copy(replyCount = comment.replies.totalCount),
                        target = comment.target?.commentHeadFields?.toTarget(),
                        threadPostId = comment.post?.id,
                    )
                }
            },
            endCursor = comments.pageInfo.endCursor,
            hasNextPage = comments.pageInfo.hasNextPage,
        )
    }
