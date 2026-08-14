// Shared test doubles: in-memory stores, throwing repository bases to
// override per test, and a minimal in-test host sealer that mirrors
// what the backend's relay does — verify nothing, salt, commit, seal —
// so orchestration tests exercise the real crypto chain end to end.

package com.cogra.domain.testing

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.crypto.NodeId
import com.cogra.crypto.PreSignedProposal
import com.cogra.crypto.Proposal
import com.cogra.crypto.SALT_LEN
import com.cogra.crypto.StructuralBody
import com.cogra.crypto.Tags
import com.cogra.crypto.VerifiedAct
import com.cogra.crypto.canonicalDeps
import com.cogra.crypto.commitment
import com.cogra.crypto.decodePreCommitment
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.encodeProposal
import com.cogra.crypto.encodeVerifiedAct
import com.cogra.domain.ActorRef
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.LicenseChoice
import com.cogra.domain.LoginGrant
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.PostDetail
import com.cogra.domain.PostView
import com.cogra.domain.PreparedContentView
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.StorageHealth
import com.cogra.domain.store.TokenStore
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow

class FakeTokenStore : TokenStore {
    override val tokens = MutableStateFlow<AuthTokens?>(null)

    override suspend fun current(): AuthTokens? = tokens.value

    override suspend fun save(tokens: AuthTokens) {
        this.tokens.value = tokens
    }

    override suspend fun clear() {
        tokens.value = null
    }
}

/** Account-implicit like the interface: one active account's slot. */
class FakeIdentityStore : IdentityStore {
    var seed: ByteArray? = null
    var pendingBlob: ByteArray? = null
    var dismissedReciprocation = false
    var forgetOnSignOut = false
    val handshakes = mutableMapOf<String, PreSignedProposal>()

    override suspend fun actorSeed(): ByteArray? = seed

    override suspend fun saveActorSeed(seed: ByteArray) {
        this.seed = seed
    }

    override suspend fun pendingBackupBlob(): ByteArray? = pendingBlob

    override suspend fun savePendingBackupBlob(blob: ByteArray) {
        pendingBlob = blob
    }

    override suspend fun clearPendingBackupBlob() {
        pendingBlob = null
    }

    override suspend fun handshake(stagedWriteId: String): PreSignedProposal? = handshakes[stagedWriteId]

    override suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal) {
        handshakes[stagedWriteId] = pre
    }

    override suspend fun clearHandshake(stagedWriteId: String) {
        handshakes.remove(stagedWriteId)
    }

    override suspend fun handshakeIds(): Set<String> = handshakes.keys.toSet()

    override suspend fun reciprocationDismissed(): Boolean = dismissedReciprocation

    override suspend fun markReciprocationDismissed() {
        dismissedReciprocation = true
    }

    override suspend fun forgetOnSignOut(): Boolean = forgetOnSignOut

    override suspend fun setForgetOnSignOut(value: Boolean) {
        forgetOnSignOut = value
    }

    override suspend fun purge() {
        seed = null
        pendingBlob = null
        dismissedReciprocation = false
        forgetOnSignOut = false
        handshakes.clear()
    }
}

class FakeStorageHealth : StorageHealth {
    val lost = MutableStateFlow(false)

    override val storageLost = lost

    override suspend fun acknowledge() {
        lost.value = false
    }
}

/** The backend's relay side, minimally: salt, commit, seal. */
class TestHost {
    val key: ActorKey = ActorKey.generate()

    fun seal(canonicalProposal: ByteArray, preCommitmentBlob: ByteArray, authorPubkey: ByteArray): ByteArray {
        val proposal = decodeProposal(canonicalProposal)
        val pre = decodePreCommitment(preCommitmentBlob)
        val contentSalt = ByteArray(SALT_LEN) { 3 }
        val depsSalt = ByteArray(SALT_LEN) { 4 }
        val unsealed = VerifiedAct(
            proposal = proposal,
            authorPubkey = authorPubkey,
            nonce = pre.nonce,
            preSignature = pre.preSignature,
            contentSalt = contentSalt,
            depsSalt = depsSalt,
            contentCommitment = commitment(Tags.COMMIT_CONTENT, contentSalt, proposal.payload),
            depsCommitment = commitment(Tags.COMMIT_DEPS, depsSalt, canonicalDeps(proposal.deps)),
            hostSeal = ByteArray(0),
        )
        val sealed = VerifiedAct(
            proposal = unsealed.proposal,
            authorPubkey = unsealed.authorPubkey,
            nonce = unsealed.nonce,
            preSignature = unsealed.preSignature,
            contentSalt = unsealed.contentSalt,
            depsSalt = unsealed.depsSalt,
            contentCommitment = unsealed.contentCommitment,
            depsCommitment = unsealed.depsCommitment,
            hostSeal = key.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()),
        )
        return encodeVerifiedAct(sealed)
    }
}

/** A minimal Opinion proposal in its wire form. */
fun testProposalBytes(author: ActorKey, seq: ULong = 1u): ByteArray {
    val body = StructuralBody(
        author = author.address(),
        seq = seq,
        family = Family.OPINION,
        middle = null,
        target = NodeId.parse("prof:bob"),
        pD = 0.5,
        pI = 0.1,
        settlementRef = null,
        license = null,
        assertedParents = emptyList(),
    )
    return encodeProposal(Proposal(body, ByteArray(0), emptyList()))
}

/** Every method throws; tests override what they script. */
open class ThrowingAccountRepository : AccountRepository {
    override suspend fun me(): Outcome<UserProfile?> = throw UnsupportedOperationException()
    override suspend fun keyBackup(): Outcome<ByteArray?> = throw UnsupportedOperationException()
    override suspend fun keyBackupChallenge(): Outcome<ByteArray> = throw UnsupportedOperationException()
    override suspend fun uploadKeyBackup(
        blob: ByteArray,
        challenge: ByteArray,
        signature: ByteArray,
    ): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun changePassword(currentPassword: String, newPassword: String): Outcome<Unit> =
        throw UnsupportedOperationException()
    override suspend fun changeHandle(handle: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun requestPasswordReset(email: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun confirmPasswordReset(resetToken: String, newPassword: String): Outcome<Unit> =
        throw UnsupportedOperationException()
    override suspend fun requestEmailChange(newEmail: String, currentPassword: String): Outcome<Unit> =
        throw UnsupportedOperationException()
    override suspend fun confirmEmailChange(code: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun inviteLinks(): Outcome<List<InviteLinkInfo>> = throw UnsupportedOperationException()
    override suspend fun createInviteLink(
        expiresAt: Instant,
        prefillPDirected: Double,
        prefillPInterest: Double,
        singleUse: Boolean,
    ): Outcome<InviteLinkInfo> = throw UnsupportedOperationException()
    override suspend fun revokeInviteLink(id: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun approveApplication(
        applicationId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
}

open class ThrowingSessionRepository : SessionRepository {
    override suspend fun logIn(email: String, password: String, deviceLabel: String?): Outcome<LoginGrant> =
        throw UnsupportedOperationException()
    override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> = throw UnsupportedOperationException()
    override suspend fun sessions(): Outcome<List<SessionInfo>> = throw UnsupportedOperationException()
    override suspend fun revokeSession(id: String?): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun revokeOtherSessions(): Outcome<Int> = throw UnsupportedOperationException()
}

open class ThrowingOnboardingRepository : OnboardingRepository {
    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> = throw UnsupportedOperationException()
    override suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> = throw UnsupportedOperationException()
    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun attachActorKey(actorPubkeyBase64: String, l0Address: String): Outcome<Unit> =
        throw UnsupportedOperationException()
    override suspend fun applyWithInvite(inviteLink: String): Outcome<Unit> = throw UnsupportedOperationException()
    override suspend fun applicationStatus(): Outcome<ApplicationStatus> = throw UnsupportedOperationException()
}

open class ThrowingWriteRepository : WriteRepository {
    override suspend fun hostPublicKey(): Outcome<ByteArray> = throw UnsupportedOperationException()
    override suspend fun prepareStance(
        targetId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = throw UnsupportedOperationException()
    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        throw UnsupportedOperationException()
    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        throw UnsupportedOperationException()
    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = throw UnsupportedOperationException()
}

/**
 * A write repository over the real crypto chain: submit seals through
 * the TestHost, approve flips to RELAYING.
 */
class SealingWriteRepository(private val actor: ActorKey) : ThrowingWriteRepository() {
    val host = TestHost()
    val staged = mutableMapOf<String, StagedWriteView>()
    private var nextSeq = 1uL

    override suspend fun hostPublicKey(): Outcome<ByteArray> = Outcome.Success(host.key.publicKeyBytes())

    override suspend fun prepareStance(
        targetId: String,
        pDirected: Double,
        pInterest: Double,
    ): Outcome<List<PreparedWriteView>> = Outcome.Success(listOf(stage()))

    /**
     * Stages one signable write — the generic entry content fakes
     * delegate to, so any prepare verb's result runs the real signing
     * chain. The family is display metadata; the proposal bytes are the
     * fixture's canonical test proposal either way.
     */
    fun stage(family: Family = Family.OPINION): PreparedWriteView {
        val id = "w${nextSeq}"
        val view = PreparedWriteView(
            id = id,
            family = family,
            canonicalProposal = testProposalBytes(actor, nextSeq),
            gcAfterEpochs = 8,
        )
        nextSeq += 1u
        return view
    }

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        val seq = stagedWriteId.removePrefix("w").toULong()
        val proposal = testProposalBytes(actor, seq)
        val sealed = host.seal(
            proposal,
            java.util.Base64.getDecoder().decode(signatureBase64),
            actor.publicKeyBytes(),
        )
        val view = StagedWriteView(
            id = stagedWriteId,
            state = com.cogra.domain.WriteState.AWAITING_APPROVAL,
            family = Family.OPINION,
            canonicalProposal = proposal,
            verifiedAct = sealed,
            recordId = null,
        )
        staged[stagedWriteId] = view
        return Outcome.Success(view)
    }

    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        val current = staged.getValue(stagedWriteId).copy(state = com.cogra.domain.WriteState.RELAYING)
        staged[stagedWriteId] = current
        return Outcome.Success(current)
    }

    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = Outcome.Success(staged[id])
}

/** Content-repository base: every call throws until overridden. */
open class ThrowingContentRepository : ContentRepository {
    override suspend fun posts(first: Int, after: String?): Outcome<Page<PostView>> =
        throw UnsupportedOperationException()
    override suspend fun post(
        id: String,
        commentsFirst: Int,
        commentsAfter: String?,
    ): Outcome<PostDetail?> = throw UnsupportedOperationException()
    override suspend fun comments(postId: String, first: Int, after: String?): Outcome<Page<CommentView>> =
        throw UnsupportedOperationException()
    override suspend fun preparePost(
        title: String?,
        description: String?,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun preparePostEdit(
        id: String,
        title: String?,
        description: String?,
        content: String,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun prepareComment(
        target: String,
        content: String,
        license: LicenseChoice,
    ): Outcome<PreparedContentView> = throw UnsupportedOperationException()
    override suspend fun prepareCommentEdit(id: String, content: String): Outcome<PreparedContentView> =
        throw UnsupportedOperationException()
}

fun testModeratedField(value: String?) = ModeratedField(value, FieldStatus.NORMAL)

fun testPost(
    id: String,
    title: String? = "Title $id",
    body: String = "Body $id",
    author: ActorRef? = ActorRef("author-1", "author"),
): PostView = PostView(
    id = id,
    title = testModeratedField(title),
    description = testModeratedField(null),
    content = testModeratedField(body),
    author = author,
    createdAt = Instant.EPOCH,
    updatedAt = Instant.EPOCH,
)

fun testComment(
    id: String,
    body: String = "Comment $id",
    author: ActorRef? = ActorRef("author-2", "commenter"),
): CommentView = CommentView(
    id = id,
    content = testModeratedField(body),
    author = author,
    createdAt = Instant.EPOCH,
    updatedAt = Instant.EPOCH,
)
