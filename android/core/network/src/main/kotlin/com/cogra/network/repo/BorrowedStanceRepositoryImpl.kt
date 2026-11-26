// A guest's faces over the real contract (FeedBare.md:7, GuestGate.md:11):
// the borrowed view's own stance toward a node, `borrowedStance` on Post,
// Comment, User and Hashtag — read-only, null where the view holds none and
// for any session.
//
// Its own class, apart from `StanceRepositoryImpl` on purpose: it shares no
// memory with the member's seam, so nothing a guest borrows can ever become
// the node a stance or severance is signed toward (Intent.kt).

package com.cogra.network.repo

import com.apollographql.apollo.ApolloCall
import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Operation
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.map
import com.cogra.domain.repo.BorrowedStanceRepository
import com.cogra.domain.stance.BorrowedStance
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.cogra.network.auth.ANONYMOUS_HEADER
import com.cogra.network.fetch
import com.cogra.network.graphql.CommentBorrowedStanceQuery
import com.cogra.network.graphql.HashtagBorrowedStanceQuery
import com.cogra.network.graphql.PostBorrowedStanceQuery
import com.cogra.network.graphql.ProfileBorrowedStanceQuery
import com.cogra.network.graphql.fragment.BorrowedStanceFields
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** Which root holds an opaque id, in probe order: a post first, since a feed is made of posts. */
private enum class LentRoot { POST, COMMENT, USER }

/**
 * What one root said: it holds the id (the probe stops), and the view's
 * stance toward it — null where the view holds none, which is an answer,
 * never a refusal.
 */
private class LentAnswer(fields: BorrowedStanceFields?) {
    val face: BorrowedStance? = fields?.let {
        BorrowedStance(
            net = StancePair(it.pDirected, it.pInterest),
            records = it.recordCount,
            inert = it.inert,
            severed = it.severed,
        )
    }
}

/**
 * The borrowed read.
 *
 * - Without a token ([ANONYMOUS_HEADER]) and outside `AuthGuard`: the read is
 *   a guest's by definition, its null is an answer (the view holds none) and
 *   never a refusal to refresh on.
 * - Never cached: "the normalized cache is optional", installed only by the
 *   builder's `.cache(…)` with its own artifact
 *   (https://www.apollographql.com/docs/kotlin/caching/normalized-cache), and
 *   this client installs none (NetworkModule), so every call is a round trip
 *   whose answer lives only in the caller. A cache added later defaults to
 *   `CacheFirst` client-wide: these four documents would then need
 *   `FetchPolicy.NetworkOnly` and no store write.
 * - An opaque id is probed post → comment → user, as the member's read
 *   probes, and which root held it is remembered — a fact about the node,
 *   the same for every reader.
 */
@Singleton
class BorrowedStanceRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
) : BorrowedStanceRepository {

    private val roots = ConcurrentHashMap<String, LentRoot>()

    override suspend fun borrowedStance(target: StanceTarget): Outcome<BorrowedStance?> = when (target) {
        is StanceTarget.Topic -> topic(target.name)
        is StanceTarget.Node -> node(target.id)
    }

    /** A name says which root to ask, as the topic's bundle read does: no probe. */
    private suspend fun topic(name: String): Outcome<BorrowedStance?> {
        val read = lent(client.query(HashtagBorrowedStanceQuery(name))) { data ->
            data.hashtag?.let { LentAnswer(it.borrowedStance?.borrowedStanceFields) }
        }
        return when (read) {
            is Outcome.Failed -> read
            is Outcome.Refused -> read
            is Outcome.Success -> read.value?.let { Outcome.Success(it.face) } ?: notFound()
        }
    }

    private suspend fun node(id: String): Outcome<BorrowedStance?> {
        for (root in roots[id]?.let { listOf(it) } ?: LentRoot.entries) {
            when (val read = ask(root, id)) {
                is Outcome.Failed -> return read
                is Outcome.Refused -> return read
                is Outcome.Success -> {
                    val answer = read.value ?: continue
                    roots[id] = root
                    return Outcome.Success(answer.face)
                }
            }
        }
        // No root holds it, or a remembered root went stale: probe afresh next time.
        roots.remove(id)
        return notFound()
    }

    private suspend fun ask(root: LentRoot, id: String): Outcome<LentAnswer?> = when (root) {
        LentRoot.POST -> lent(client.query(PostBorrowedStanceQuery(id))) { data ->
            data.post?.let { LentAnswer(it.borrowedStance?.borrowedStanceFields) }
        }
        LentRoot.COMMENT -> lent(client.query(CommentBorrowedStanceQuery(id))) { data ->
            data.comment?.let { LentAnswer(it.borrowedStance?.borrowedStanceFields) }
        }
        LentRoot.USER -> lent(client.query(ProfileBorrowedStanceQuery(id))) { data ->
            data.user?.let { LentAnswer(it.borrowedStance?.borrowedStanceFields) }
        }
    }

    /** One borrowed read, sent without a token; null where the root does not hold the id. */
    private suspend fun <D : Operation.Data> lent(
        call: ApolloCall<D>,
        pick: (D) -> LentAnswer?,
    ): Outcome<LentAnswer?> = call.addHttpHeader(ANONYMOUS_HEADER, "1").fetch().map(pick)

    private fun <T> notFound(): Outcome<T> =
        Outcome.Refused(listOf(UserError(ErrorCode.NOT_FOUND, "no such stance target", listOf("target"))))
}
