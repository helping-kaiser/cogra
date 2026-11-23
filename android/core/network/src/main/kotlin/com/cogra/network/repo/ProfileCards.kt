// THE PROFILE'S CARD VIEWS' READS (ProfilePosts, ProfileComments;
// `profile.graphql`): the person's posts and comments as the feed's own cards
// read them, a page at a time, a still-settling one among them in the server's
// order (`User.posts`, `User.comments`). web's twin is
// `web/src/lib/api/profile-api.ts` `fetchProfilePosts` / `fetchProfileComments`.

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
 * One page of the posts view, in the listing's own order: the settling posts
 * first, then the landed ones, newest first. A person the server does not know
 * reads empty.
 */
internal suspend fun readProfilePosts(client: ApolloClient, authorId: String, after: String?): Outcome<Page<PostView>> =
    client.query(ProfilePostsQuery(id = authorId, after = Optional.presentIfNotNull(after))).fetch().map { data ->
        val posts = data.user?.posts ?: return@map Page(emptyList(), endCursor = null, hasNextPage = false)
        Page(
            items = posts.edges.map { edge ->
                edge.node.postFields.toDomain().copy(commentCount = edge.node.commentCount.totalCount)
            },
            endCursor = posts.pageInfo.endCursor,
            hasNextPage = posts.pageInfo.hasNextPage,
        )
    }

/**
 * One page of the comments view, in the listing's own order: each comment with
 * what it answers, its thread's post and its replies' count.
 */
internal suspend fun readProfileComments(
    client: ApolloClient,
    authorId: String,
    after: String?,
): Outcome<Page<ProfileComment>> =
    client.query(ProfileCommentsQuery(id = authorId, after = Optional.presentIfNotNull(after))).fetch().map { data ->
        val comments = data.user?.comments ?: return@map Page(emptyList(), endCursor = null, hasNextPage = false)
        Page(
            items = comments.edges.map { edge ->
                val comment = edge.node
                ProfileComment(
                    comment = comment.commentFields.toDomain().copy(replyCount = comment.replies.totalCount),
                    target = comment.target?.commentHeadFields?.toTarget(),
                    threadPostId = comment.post?.id,
                )
            },
            endCursor = comments.pageInfo.endCursor,
            hasNextPage = comments.pageInfo.hasNextPage,
        )
    }
