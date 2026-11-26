// The node half of the stance repository's reads: a page's standings in one
// `PageStances` request (the app's twin of the web's seam), a lone read on
// the one root that holds its id, and the pick-carrying projection.
//
// The control holds an opaque target id. The page read's `__typename` names
// the node's class, so no read ever probes root by root: the first read of a
// target is a page slot, and the class it names is remembered.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.store.TokenStore
import com.cogra.network.GraphQlFaultException
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.CommentStanceQuery
import com.cogra.network.graphql.PageStancesQuery
import com.cogra.network.graphql.PostStanceQuery
import com.cogra.network.graphql.ProfileStanceQuery
import com.cogra.network.graphql.fragment.StanceBundleFields
import com.cogra.network.graphql.type.StancePickInput
import com.cogra.network.unauthenticatedRefusal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.util.concurrent.ConcurrentHashMap

/**
 * Which stance-able root holds a target id — named by the `__typename`
 * a `PageStances` slot answers with.
 *
 * A topic is deliberately absent. This enum answers "which root holds
 * this OPAQUE id", and a topic has no id in the question — it is
 * addressed by name, which names its root outright.
 */
internal enum class TargetKind { POST, COMMENT, USER }

/** The class a `nodes` slot names, or null for a node that carries no stance. */
private fun kindOfClass(typename: String): TargetKind? = when (typename) {
    "Post" -> TargetKind.POST
    "Comment" -> TargetKind.COMMENT
    "User" -> TargetKind.USER
    else -> null
}

/**
 * The most ids one `PageStances` request names: the server's cap on a
 * `nodes(ids:)` lookup (`Query.nodes`, `client-constants.json`
 * `paging.maxPageSize`), the batch its `ID_BATCHES` row is priced at.
 */
internal const val PAGE_STANCES_CHUNK = 100

/**
 * A batch formed under one account met another one active before it left:
 * nothing is asked, so no face of the first account is ever answered with
 * the second's standing (auth.md "Multi-account device custody").
 */
internal class AccountChangedException : IllegalStateException("the account changed before the read left")

/**
 * What one root said about a target.
 *
 * The absent case — no answer at all — is `null` rather than a member
 * here, because "this root does not hold that id" and "this root holds
 * it but there is no viewer" are answered differently: the first is
 * not found, the second is a refusal the guard can act on.
 */
internal class RootAnswer(val bundle: StanceBundleFields?)

/**
 * A root that answered with a null bundle has an unauthenticated reader
 * behind it, or one with no actor on the graph. The first is the common
 * case and the guard refreshes and replays on it; the second costs that
 * one wasted refresh and then reports the same refusal.
 */
internal fun StanceBundleFields?.orRefusal(): Outcome<StanceBundleFields> =
    this?.let { Outcome.Success(it) } ?: unauthenticatedRefusal()

/** No root holds it — the id names nothing stance-able, or the name is unusable. */
internal fun <T> notFound(): Outcome<T> =
    Outcome.Refused(listOf(UserError(ErrorCode.NOT_FOUND, "no such stance target", listOf("target"))))

/** The pick as the wire takes it; absent for a plain standing. */
internal fun StancePickInput?.asInput(): Optional<StancePickInput?> = Optional.presentIfNotNull(this)

/** [read], only while the account a batch was asked under is still the active one. */
private suspend fun <T> TokenStore.asOwner(lane: StanceLane, read: suspend () -> Outcome<T>): Outcome<T> =
    if (current()?.accountId == lane.owner) read() else Outcome.Failed(AccountChangedException())

/** The bundle a `nodes` slot carries, whichever stance-able class it is. */
private fun PageStancesQuery.Node.bundle(): StanceBundleFields? =
    onPost?.viewerStance?.stanceBundleFields
        ?: onComment?.viewerStance?.stanceBundleFields
        ?: onUser?.viewerStance?.stanceBundleFields

/**
 * The page read: every id's slot, or the request's own refusal.
 *
 * Every face null is the request's refusal, not each face's: the server
 * answers a request it did not authenticate with a null on every face, so
 * the guard has to see one UNAUTHENTICATED to refresh and replay the batch,
 * as it does a single read.
 */
private suspend fun ApolloClient.pageRead(
    ids: List<String>,
    includePending: Boolean,
): Outcome<Map<String, PageStancesQuery.Node?>> =
    query(PageStancesQuery(ids, includePending)).fetch().flatMap { data ->
        val slots = data.nodes.filterNotNull().associateBy { it.id }
        if (slots.isNotEmpty() && slots.values.all { it.bundle() == null }) {
            unauthenticatedRefusal()
        } else {
            Outcome.Success(ids.associateWith { slots[it] })
        }
    }

/** One root's answer, or null where that root does not hold the id. */
private suspend fun ApolloClient.rootRead(
    kind: TargetKind,
    target: String,
    pick: Optional<StancePickInput?>,
    includePending: Boolean,
): Outcome<RootAnswer?> = when (kind) {
    TargetKind.POST -> query(PostStanceQuery(target, pick, includePending)).fetch()
        .map { data -> data.post?.let { RootAnswer(it.viewerStance?.stanceBundleFields) } }
    TargetKind.COMMENT -> query(CommentStanceQuery(target, pick, includePending)).fetch()
        .map { data -> data.comment?.let { RootAnswer(it.viewerStance?.stanceBundleFields) } }
    TargetKind.USER -> query(ProfileStanceQuery(target, pick, includePending)).fetch()
        .map { data -> data.user?.let { RootAnswer(it.viewerStance?.stanceBundleFields) } }
}

/**
 * The node reads. Every pick-less read goes through [loader], so the
 * standings a page's controls ask within one window leave as one request
 * per view and account (StanceLoader.kt).
 */
internal class NodeStanceReads(
    private val client: ApolloClient,
    private val guard: AuthGuard,
    private val tokens: TokenStore,
    scope: CoroutineScope,
) {
    // A node never changes class, so the class a page read named holds for
    // the rest of the process: a later read standing alone asks the one root
    // that holds it. A node fact, not the reader's — the same under every
    // account.
    private val kinds = ConcurrentHashMap<String, TargetKind>()

    private val loader = StanceLoader<Outcome<StanceBundleFields>>(scope, ::dispatch, fault = { Outcome.Failed(it) })

    /** The class a read already named for [id]; null before any read did. */
    fun kindOf(id: String): TargetKind? = kinds[id]

    /** [id]'s plain standing, from the batch its window holds. */
    suspend fun standing(id: String, includePending: Boolean): Outcome<StanceBundleFields> =
        loader.load(StanceLane(tokens.current()?.accountId, includePending), id)

    /**
     * A projection asks the root that holds the id, with the pick riding
     * along. A target whose class no read has named yet is read through
     * the loader first — the standing it answers names the class.
     */
    suspend fun projected(id: String, pick: StancePickInput, includePending: Boolean): Outcome<StanceBundleFields> {
        val kind = kinds[id] ?: run {
            val learned = standing(id, includePending)
            if (learned !is Outcome.Success) return learned
            kinds[id] ?: return notFound()
        }
        return guard.run { rootBundle(kind, id, pick.asInput(), includePending) }
    }

    /**
     * One batch's answers. ONE READ ALONE whose class is known asks its own
     * root, as it always did — the re-read after an act, a deep link, a
     * sheet: the cheapest document there is. Everything else is paged at
     * the server's cap.
     */
    private suspend fun dispatch(lane: StanceLane, ids: List<String>): Map<String, Outcome<StanceBundleFields>> {
        val alone = ids.singleOrNull()
        val known = alone?.let { kinds[it] }
        if (alone != null && known != null) return mapOf(alone to ownRoot(lane, known, alone))
        return coroutineScope {
            ids.chunked(PAGE_STANCES_CHUNK).map { chunk -> async { page(lane, chunk) } }.awaitAll()
        }.fold(emptyMap()) { all, chunk -> all + chunk }
    }

    /**
     * One `PageStances` request's faces.
     *
     * A REQUEST THE SERVER REFUSED AS A WHOLE FAILS NO FACE IT COULD HAVE
     * ANSWERED (the web twin's rule): an errors array — one node's fault, or
     * a budget — would otherwise blank every face on the page where it
     * blanked one before, so each face then asks alone. No answer at all, or
     * a refusal the guard could not cure, is every face's, exactly as each
     * face's own read would have met it.
     */
    private suspend fun page(lane: StanceLane, ids: List<String>): Map<String, Outcome<StanceBundleFields>> =
        when (val read = guard.run { tokens.asOwner(lane) { client.pageRead(ids, lane.includePending) } }) {
            is Outcome.Success -> read.value.mapValues { (id, slot) -> face(id, slot) }
            is Outcome.Refused -> ids.associateWith { read }
            is Outcome.Failed -> if (read.cause is GraphQlFaultException && ids.size > 1) {
                coroutineScope { ids.map { id -> async { id to alone(lane, id) } }.awaitAll() }.toMap()
            } else {
                ids.associateWith { read }
            }
        }

    /** A face of a refused page, asked on its own: its root where the class is known, else a page of one. */
    private suspend fun alone(lane: StanceLane, id: String): Outcome<StanceBundleFields> {
        val known = kinds[id] ?: return page(lane, listOf(id)).getValue(id)
        return ownRoot(lane, known, id)
    }

    /** A plain standing off the one root that holds [id], for the batch's own account. */
    private suspend fun ownRoot(lane: StanceLane, kind: TargetKind, id: String): Outcome<StanceBundleFields> =
        guard.run { tokens.asOwner(lane) { rootBundle(kind, id, Optional.absent(), lane.includePending) } }

    /**
     * One slot read as the target's own root read would have answered it:
     * an unknown id, or a node that carries no stance, is not found; a
     * stance-able node with no bundle is the refusal.
     */
    private fun face(id: String, slot: PageStancesQuery.Node?): Outcome<StanceBundleFields> {
        val kind = slot?.let { kindOfClass(it.__typename) }
        if (slot == null || kind == null) {
            // The id names nothing stance-able, or a remembered class went
            // stale under a vanished node — forget it.
            kinds.remove(id)
            return notFound()
        }
        kinds[id] = kind
        return slot.bundle().orRefusal()
    }

    /** The one root's own read, for a target whose class is known. */
    private suspend fun rootBundle(
        kind: TargetKind,
        id: String,
        pick: Optional<StancePickInput?>,
        includePending: Boolean,
    ): Outcome<StanceBundleFields> = when (val read = client.rootRead(kind, id, pick, includePending)) {
        is Outcome.Failed -> read
        is Outcome.Refused -> read
        is Outcome.Success -> {
            val answer = read.value
            if (answer == null) {
                // The root no longer holds it: the next read pages it again.
                kinds.remove(id)
                notFound()
            } else {
                answer.bundle.orRefusal()
            }
        }
    }
}
