package com.cogra.domain.testing

import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.AskLinkCheck
import com.cogra.domain.invites.InviteLinkInfo
import com.cogra.domain.invites.InvitesRead
import com.cogra.domain.invites.InvitesRepository
import com.cogra.domain.invites.MyApplication
import java.time.Instant

/**
 * Invites, scripted and recording: an in-memory queue and link list the
 * verbs act on as the server does — a close takes the row out of the queue,
 * a revoke turns the link unusable, a create adds a usable one — every call
 * recorded, and any verb's next answer queueable. Nothing here signs: an
 * approval stages its vouch through [writes] (a [SealingWriteRepository]),
 * so the device's own signer is what the tests exercise.
 */
class ScriptedInvitesRepository(private val writes: SealingWriteRepository? = null) : InvitesRepository {
    val queue = mutableListOf<ApplicationInfo>()
    val links = mutableListOf<InviteLinkInfo>()

    /** What `askLinkCheck` answers, by ask link id; an id not here names nobody. */
    val askLinks = mutableMapOf<String, AskLinkCheck>()

    /** What `stageApplicant` stages, by ask link id. */
    val stageable = mutableMapOf<String, ApplicationInfo>()

    var myApplication: Outcome<MyApplication?> = Outcome.Success(null)

    val reads = mutableListOf<Unit>()
    val created = mutableListOf<Pair<Instant, Boolean>>()
    val revoked = mutableListOf<String>()
    val approved = mutableListOf<Triple<String, Double, Double>>()
    val rejected = mutableListOf<String>()
    val swept = mutableListOf<String>()
    val staged = mutableListOf<String>()

    val readAnswers = ArrayDeque<Outcome<InvitesRead>>()
    val createAnswers = ArrayDeque<Outcome<InviteLinkInfo>>()
    val revokeAnswers = ArrayDeque<Outcome<Unit>>()
    val approveAnswers = ArrayDeque<Outcome<List<PreparedWriteView>>>()
    val rejectAnswers = ArrayDeque<Outcome<Unit>>()
    val sweepAnswers = ArrayDeque<Outcome<Int>>()
    val stageAnswers = ArrayDeque<Outcome<ApplicationInfo>>()
    val checkAnswers = ArrayDeque<Outcome<AskLinkCheck?>>()

    private var nextLink = 1

    override suspend fun invites(): Outcome<InvitesRead> {
        reads += Unit
        return readAnswers.removeFirstOrNull() ?: Outcome.Success(InvitesRead(queue.toList(), links.toList()))
    }

    override suspend fun createInviteLink(expiresAt: Instant, singleUse: Boolean): Outcome<InviteLinkInfo> {
        created += expiresAt to singleUse
        createAnswers.removeFirstOrNull()?.let { return it }
        val link = InviteLinkInfo(
            id = "link-${nextLink++}",
            singleUse = singleUse,
            createdAt = Instant.EPOCH,
            expiresAt = expiresAt,
            revokedAt = null,
            usable = true,
        )
        links += link
        return Outcome.Success(link)
    }

    override suspend fun revokeInviteLink(id: String): Outcome<Unit> {
        revoked += id
        revokeAnswers.removeFirstOrNull()?.let { return it }
        val index = links.indexOfFirst { it.id == id }
        if (index < 0) return Outcome.Refused(listOf(UserError(ErrorCode.NOT_FOUND, "no such live invite link")))
        links[index] = links[index].copy(revokedAt = Instant.EPOCH, usable = false)
        return Outcome.Success(Unit)
    }

    override suspend fun approveApplication(
        applicationId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> {
        approved += Triple(applicationId, pDirected, pInterest)
        approveAnswers.removeFirstOrNull()?.let { return it }
        val prepared = checkNotNull(writes) { "an approval needs a sealing write repository" }
            .prepareStance(applicationId, pDirected, pInterest)
        if (prepared is Outcome.Success) queue.removeAll { it.id == applicationId }
        return prepared
    }

    override suspend fun rejectApplication(applicationId: String): Outcome<Unit> {
        rejected += applicationId
        rejectAnswers.removeFirstOrNull()?.let { return it }
        queue.removeAll { it.id == applicationId }
        return Outcome.Success(Unit)
    }

    override suspend fun rejectLinkApplications(linkId: String): Outcome<Int> {
        swept += linkId
        sweepAnswers.removeFirstOrNull()?.let { return it }
        val closed = queue.count { it.inviteLink?.id == linkId && it.waiting }
        queue.removeAll { it.inviteLink?.id == linkId && it.waiting }
        return Outcome.Success(closed)
    }

    override suspend fun askLinkCheck(askLinkId: String): Outcome<AskLinkCheck?> =
        checkAnswers.removeFirstOrNull() ?: Outcome.Success(askLinks[askLinkId])

    override suspend fun stageApplicant(askLinkId: String): Outcome<ApplicationInfo> {
        staged += askLinkId
        stageAnswers.removeFirstOrNull()?.let { return it }
        val application = stageable[askLinkId]
            ?: return Outcome.Refused(listOf(UserError(ErrorCode.ASK_LINK_UNUSABLE, "the ask link stages nobody")))
        if (queue.none { it.id == application.id }) queue += application
        return Outcome.Success(application)
    }

    override suspend fun myApplication(): Outcome<MyApplication?> = myApplication
}
