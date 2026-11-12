// Invites and the ask link over the generated client (api-spec.md
// "Invites", "The ask link"). The operation documents mirror the web's by
// name and selection (`invites.graphql` on both trees).

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.flatMap
import com.cogra.domain.invites.ApplicantApplication
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.AskLinkCheck
import com.cogra.domain.invites.AskLinkUnusableReason
import com.cogra.domain.invites.InviteLinkInfo
import com.cogra.domain.invites.InvitesRead
import com.cogra.domain.invites.InvitesRepository
import com.cogra.domain.invites.LetInPerson
import com.cogra.domain.invites.MyApplication
import com.cogra.domain.invites.QueueLink
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.ApproveApplicantsMutation
import com.cogra.network.graphql.AskLinkCheckQuery
import com.cogra.network.graphql.CreateInviteLinkMutation
import com.cogra.network.graphql.InvitesQuery
import com.cogra.network.graphql.MyApplicationQuery
import com.cogra.network.graphql.RejectApplicationMutation
import com.cogra.network.graphql.RejectLinkApplicationsMutation
import com.cogra.network.graphql.RevokeInviteLinkMutation
import com.cogra.network.graphql.StageApplicantMutation
import com.cogra.network.graphql.VouchedInPageQuery
import com.cogra.network.graphql.fragment.InviteLinkFields
import com.cogra.network.graphql.fragment.QueueApplicationFields
import com.cogra.network.graphql.type.ApplicationApprovalInput
import com.cogra.network.graphql.type.ApproveApplicantsInput
import com.cogra.network.graphql.type.CreateInviteLinkInput
import com.cogra.network.graphql.type.RejectApplicationInput
import com.cogra.network.graphql.type.RejectLinkApplicationsInput
import com.cogra.network.graphql.type.RevokeInviteLinkInput
import com.cogra.network.graphql.type.StageApplicantInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.unauthenticatedRefusal
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

internal fun QueueApplicationFields.toDomain(): ApplicationInfo = ApplicationInfo(
    id = id,
    handle = handle,
    emailVerified = emailVerified,
    keyAttached = keyAttached,
    createdAt = createdAt,
    approvedAt = approvedAt,
    rejectedAt = rejectedAt,
    landedAt = landedAt,
    graphId = graphId,
    inviteLink = inviteLink?.let { QueueLink(it.id, it.singleUse) },
)

internal fun InviteLinkFields.toDomain(): InviteLinkInfo = InviteLinkInfo(
    id = id,
    singleUse = singleUse,
    createdAt = createdAt,
    expiresAt = expiresAt,
    revokedAt = revokedAt,
    usable = usable,
)

/** A reason this build cannot name is read as unusable with no drawn case. */
internal fun com.cogra.network.graphql.type.AskLinkUnusableReason.toDomain(): AskLinkUnusableReason =
    runCatching { AskLinkUnusableReason.valueOf(rawValue) }.getOrDefault(AskLinkUnusableReason.UNKNOWN)

@Singleton
class InvitesRepositoryImpl @Inject constructor(private val client: ApolloClient, private val guard: AuthGuard) :
    InvitesRepository {

    /**
     * The whole page in one outcome: the queue and the links in one round
     * trip, the people beside it. Either read failing is the page's fault
     * line — a page that drew the halves without the people could stand as
     * its empty state for a reader who has let someone in (InvitesEmpty.md:5).
     */
    override suspend fun invites(): Outcome<InvitesRead> = coroutineScope {
        val people = async { vouchedIn() }
        val halves = guard.run {
            client.query(InvitesQuery()).fetch().flatMap { data ->
                val me = data.me ?: return@flatMap unauthenticatedRefusal()
                val queue = me.approvalQueue?.edges?.map { it.node.queueApplicationFields.toDomain() }
                    ?: return@flatMap unauthenticatedRefusal()
                val links = me.inviteLinks?.edges?.map { it.node.inviteLinkFields.toDomain() }
                    ?: return@flatMap unauthenticatedRefusal()
                Outcome.Success(InvitesRead(queue, links))
            }
        }
        halves.flatMap { read -> people.await().map { read.copy(people = it) } }
    }

    /** Everyone the reader vouched in, newest first, paged to the end (the hidden set's precedent). */
    private suspend fun vouchedIn(): Outcome<List<LetInPerson>> {
        val people = mutableListOf<LetInPerson>()
        var after: String? = null
        repeat(MAX_PEOPLE_PAGES) {
            val page = guard.run {
                client.query(VouchedInPageQuery(after = Optional.presentIfNotNull(after))).fetch()
            }
            val connection = when (page) {
                is Outcome.Success -> page.value.me?.vouchedIn ?: return unauthenticatedRefusal()
                is Outcome.Refused -> return page
                is Outcome.Failed -> return page
            }
            people += connection.edges.map { it.toPerson() }
            after = connection.pageInfo.endCursor
            if (!connection.pageInfo.hasNextPage || after == null) return Outcome.Success(people)
        }
        return Outcome.Success(people)
    }

    override suspend fun createInviteLink(expiresAt: Instant, singleUse: Boolean): Outcome<InviteLinkInfo> =
        guard.run {
            client.mutation(
                CreateInviteLinkMutation(
                    CreateInviteLinkInput(expiresAt = expiresAt, singleUse = Optional.present(singleUse)),
                ),
            ).payloadOutcome({ it.createInviteLink.userErrors.map { e -> e.userErrorFields } }) {
                it.createInviteLink.inviteLink?.inviteLinkFields?.toDomain()
            }
        }

    override suspend fun revokeInviteLink(id: String): Outcome<Unit> = guard.run {
        client.mutation(RevokeInviteLinkMutation(RevokeInviteLinkInput(id)))
            .payloadOutcome({ it.revokeInviteLink.userErrors.map { e -> e.userErrorFields } }) {
                it.revokeInviteLink.inviteLink?.let { Unit }
            }
    }

    override suspend fun approveApplication(
        applicationId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            ApproveApplicantsMutation(
                ApproveApplicantsInput(listOf(ApplicationApprovalInput(applicationId, pDirected, pInterest))),
            ),
        ).payloadOutcome({ it.approveApplicants.userErrors.map { e -> e.userErrorFields } }) {
            it.approveApplicants.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }

    override suspend fun rejectApplication(applicationId: String): Outcome<Unit> = guard.run {
        client.mutation(RejectApplicationMutation(RejectApplicationInput(applicationId)))
            .payloadOutcome({ it.rejectApplication.userErrors.map { e -> e.userErrorFields } }) {
                it.rejectApplication.application?.let { Unit }
            }
    }

    override suspend fun rejectLinkApplications(linkId: String): Outcome<Int> = guard.run {
        client.mutation(RejectLinkApplicationsMutation(RejectLinkApplicationsInput(linkId)))
            .payloadOutcome({ it.rejectLinkApplications.userErrors.map { e -> e.userErrorFields } }) {
                it.rejectLinkApplications.rejectedCount
            }
    }

    // Viewer-relative only through WAITING_ON_VIEWER: the session rides
    // along when there is one, and a guest reads it anonymously.
    override suspend fun askLinkCheck(askLinkId: String): Outcome<AskLinkCheck?> = guard.run {
        client.query(AskLinkCheckQuery(askLinkId)).fetch().map { data ->
            data.askLinkCheck?.let { AskLinkCheck(it.usable, it.applicantHandle, it.reason?.toDomain()) }
        }
    }

    override suspend fun stageApplicant(askLinkId: String): Outcome<ApplicationInfo> = guard.run {
        client.mutation(StageApplicantMutation(StageApplicantInput(askLinkId)))
            .payloadOutcome({ it.stageApplicant.userErrors.map { e -> e.userErrorFields } }) {
                it.stageApplicant.application?.queueApplicationFields?.toDomain()
            }
    }

    override suspend fun myApplication(): Outcome<MyApplication?> = guard.run {
        client.query(MyApplicationQuery()).fetch().map { data ->
            data.me?.let { me ->
                MyApplication(
                    askLink = me.askLink,
                    application = me.application?.let { application ->
                        ApplicantApplication(
                            id = application.id,
                            approvedAt = application.approvedAt,
                            rejectedAt = application.rejectedAt,
                            landedAt = application.landedAt,
                            approver = application.approver?.let { ActorRef(it.id, it.handle) },
                        )
                    },
                )
            }
        }
    }
}

/** How many pages People you let in may take before the read stops (100 apiece). */
private const val MAX_PEOPLE_PAGES = 50

/**
 * One row as the list draws it. A deleted account reads REDACTED in its name
 * (ER-G10) and serves no name, picture or handle the row may print; the
 * handle stays only as the door to the deleted account's page.
 */
internal fun VouchedInPageQuery.Edge.toPerson(): LetInPerson {
    val redacted = node.displayName.status.rawValue == "REDACTED"
    val written = node.displayName.value?.trim()?.takeIf { it.isNotEmpty() }
    val avatar = node.onUser?.avatar?.takeIf { it.status.rawValue != "REDACTED" }
    return LetInPerson(
        id = node.id,
        door = node.handle,
        name = if (redacted) null else written ?: "@${node.handle}",
        monogram = if (redacted) "" else written ?: node.handle,
        avatarUrl = if (redacted) null else avatar?.url,
        redacted = redacted,
        vouchedAt = vouchedAt,
    )
}
