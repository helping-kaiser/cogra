package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.testing.TestHost
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.WriteState
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.testing.testProposalBytes
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import java.util.Base64
import kotlinx.coroutines.test.runTest
import org.junit.Test

/** The applicant flow, scripted: the test moves the server-side state. */
private class FakeOnboarding(val actor: ActorKey, val host: TestHost) : OnboardingRepository {
    var status: ApplicationStatus? = null
    var claimRefusal: List<UserError>? = null
    val proposal = testProposalBytes(actor, seq = 0u)
    var stagedId = "reg-1"

    fun stagedView(state: WriteState, verifiedAct: ByteArray? = null) = StagedWriteView(
        id = stagedId,
        state = state,
        family = com.cogra.crypto.Family.REGISTRATION,
        canonicalProposal = proposal,
        verifiedAct = verifiedAct,
        recordId = null,
    )

    override suspend fun checkInviteLink(id: String): Outcome<InviteCheck?> = throw UnsupportedOperationException()

    override suspend fun submitApplication(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        actorPubkeyBase64: String,
        l0Address: String,
    ): Outcome<String> = throw UnsupportedOperationException()

    override suspend fun verifyEmail(verificationToken: String): Outcome<Unit> = throw UnsupportedOperationException()

    override suspend fun resendVerificationEmail(email: String): Outcome<Unit> = throw UnsupportedOperationException()

    override suspend fun application(applicantToken: String): Outcome<ApplicationStatus?> = Outcome.Success(status)

    override suspend fun submitRegistration(applicantToken: String, signatureBase64: String): Outcome<StagedWriteView> {
        val sealed = host.seal(proposal, Base64.getDecoder().decode(signatureBase64), actor.publicKeyBytes())
        return Outcome.Success(stagedView(WriteState.AWAITING_APPROVAL, sealed))
    }

    override suspend fun approveRegistration(applicantToken: String, signatureBase64: String): Outcome<StagedWriteView> =
        Outcome.Success(stagedView(WriteState.RELAYING))

    override suspend fun claimLandedSession(applicantToken: String, deviceLabel: String?): Outcome<AuthTokens> {
        claimRefusal?.let { return Outcome.Refused(it) }
        return Outcome.Success(AuthTokens("access", "refresh"))
    }
}

private class FakeWrites(val host: TestHost) : WriteRepository {
    override suspend fun hostPublicKey(): Outcome<ByteArray> = Outcome.Success(host.key.publicKeyBytes())
    override suspend fun prepareStance(targetId: String, pDirected: Double, pInterest: Double) =
        throw UnsupportedOperationException()
    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String) =
        throw UnsupportedOperationException()
    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String) =
        throw UnsupportedOperationException()
    override suspend fun stagedWrite(id: String): Outcome<StagedWriteView?> = throw UnsupportedOperationException()
}

private class FakeAccount : AccountRepository {
    var uploaded: ByteArray? = null
    var failUpload = false

    override suspend fun me(): Outcome<UserProfile?> = throw UnsupportedOperationException()
    override suspend fun keyBackup(): Outcome<ByteArray?> = throw UnsupportedOperationException()

    override suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit> {
        if (failUpload) return Outcome.Failed(java.io.IOException("upload lost"))
        uploaded = blob
        return Outcome.Success(Unit)
    }

    override suspend fun changePassword(currentPassword: String, newPassword: String) =
        throw UnsupportedOperationException()
    override suspend fun changeHandle(handle: String) = throw UnsupportedOperationException()
    override suspend fun requestPasswordReset(email: String) = throw UnsupportedOperationException()
    override suspend fun confirmPasswordReset(resetToken: String, newPassword: String) =
        throw UnsupportedOperationException()
    override suspend fun requestEmailChange(newEmail: String, currentPassword: String) =
        throw UnsupportedOperationException()
    override suspend fun confirmEmailChange(code: String) = throw UnsupportedOperationException()
    override suspend fun inviteLinks(): Outcome<List<InviteLinkInfo>> = throw UnsupportedOperationException()
    override suspend fun createInviteLink(
        expiresAt: Instant,
        prefillPDirected: Double,
        prefillPInterest: Double,
        singleUse: Boolean,
    ): Outcome<InviteLinkInfo> = throw UnsupportedOperationException()
    override suspend fun revokeInviteLink(id: String) = throw UnsupportedOperationException()
    override suspend fun approveApplicant(applicantId: String, pDirected: Double, pInterest: Double) =
        throw UnsupportedOperationException()
}

class RegistrationSignerTest {

    private val actor = ActorKey.generate()
    private val host = TestHost()
    private val onboarding = FakeOnboarding(actor, host)
    private val identity = FakeIdentityStore().apply {
        seed = actor.seed()
        token = "applicant-token"
    }
    private val tokens = FakeTokenStore()
    private val account = FakeAccount()
    private val signer = RegistrationSigner(onboarding, FakeWrites(host), identity, tokens, account)

    private fun status(
        emailVerified: Boolean = true,
        approved: Boolean = false,
        landed: Boolean = false,
        staged: StagedWriteView? = null,
    ) = ApplicationStatus(
        handle = "joiner",
        emailVerified = emailVerified,
        approvedAt = if (approved) Instant.EPOCH else null,
        landedAt = if (landed) Instant.EPOCH else null,
        expiresAt = Instant.MAX,
        stagedRegistration = staged,
    )

    @Test
    fun theFlowAdvancesStageByStage() = runTest {
        // No token on the device.
        identity.token = null
        assertThat(signer.advance(null)).isEqualTo(RegistrationProgress.NoApplication)
        identity.token = "applicant-token"

        // Token authorizes nothing.
        onboarding.status = null
        assertThat(signer.advance(null)).isEqualTo(RegistrationProgress.ApplicationGone)

        // Waiting on the email, then on the inviter.
        onboarding.status = status(emailVerified = false)
        assertThat(signer.advance(null)).isEqualTo(RegistrationProgress.AwaitingEmailVerification)
        onboarding.status = status()
        assertThat(signer.advance(null)).isEqualTo(RegistrationProgress.AwaitingApproval)

        // The staged Registration appears: one pass signs both steps.
        onboarding.status = status(approved = true, staged = onboarding.stagedView(WriteState.AWAITING_PRE_SIGN))
        assertThat(signer.advance(null)).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(identity.handshakes).isEmpty()

        // Landed: the first session is claimed, the pending blob uploads,
        // the applicant token is spent.
        identity.pendingBlob = byteArrayOf(1, 2, 3)
        onboarding.status = status(approved = true, landed = true)
        assertThat(signer.advance("test phone"))
            .isEqualTo(RegistrationProgress.SessionClaimed(backupUploaded = true))
        assertThat(tokens.current()).isEqualTo(AuthTokens("access", "refresh"))
        assertThat(account.uploaded).isEqualTo(byteArrayOf(1, 2, 3))
        assertThat(identity.pendingBlob).isNull()
        assertThat(identity.token).isNull()
    }

    @Test
    fun aFailedBlobUploadKeepsTheBlobAndStillClaims() = runTest {
        identity.pendingBlob = byteArrayOf(9)
        account.failUpload = true
        onboarding.status = status(approved = true, landed = true)
        assertThat(signer.advance(null))
            .isEqualTo(RegistrationProgress.SessionClaimed(backupUploaded = false))
        assertThat(tokens.current()).isNotNull()
        assertThat(identity.pendingBlob).isEqualTo(byteArrayOf(9))

        // The retry path uploads it later.
        account.failUpload = false
        assertThat(signer.uploadPendingBackup()).isTrue()
        assertThat(identity.pendingBlob).isNull()
    }

    @Test
    fun aTamperedRegistrationSealIsRefused() = runTest {
        val tamperingOnboarding = object : OnboardingRepository by onboarding {
            override suspend fun submitRegistration(
                applicantToken: String,
                signatureBase64: String,
            ): Outcome<StagedWriteView> {
                val sealed = host.seal(
                    onboarding.proposal,
                    Base64.getDecoder().decode(signatureBase64),
                    actor.publicKeyBytes(),
                )
                sealed[sealed.size - 1] = (sealed[sealed.size - 1].toInt() xor 1).toByte()
                return Outcome.Success(onboarding.stagedView(WriteState.AWAITING_APPROVAL, sealed))
            }
        }
        val tamperedSigner =
            RegistrationSigner(tamperingOnboarding, FakeWrites(host), identity, tokens, account)
        onboarding.status = status(approved = true, staged = onboarding.stagedView(WriteState.AWAITING_PRE_SIGN))
        assertThat(tamperedSigner.advance(null))
            .isInstanceOf(RegistrationProgress.RejectedByDevice::class.java)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun anExpiredStagingWaitsForTheAutomaticRestage() = runTest {
        val pre = actor.preSign(com.cogra.crypto.decodeProposal(onboarding.proposal))
        identity.saveHandshake("reg-1", pre)
        onboarding.status = status(approved = true, staged = onboarding.stagedView(WriteState.EXPIRED))
        assertThat(signer.advance(null)).isEqualTo(RegistrationProgress.AwaitingApproval)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun lostMaterialAtApproveAsksForTheRestage() = runTest {
        // A sealed act is waiting but the device lost its material (fresh
        // install without the seed's handshake state).
        val sealed = host.seal(
            onboarding.proposal,
            Base64.getDecoder().decode(
                Base64.getEncoder().encodeToString(
                    com.cogra.crypto.encodePreCommitmentOf(
                        actor.preSign(com.cogra.crypto.decodeProposal(onboarding.proposal)),
                    ),
                ),
            ),
            actor.publicKeyBytes(),
        )
        onboarding.status = status(approved = true, staged = onboarding.stagedView(WriteState.AWAITING_APPROVAL, sealed))
        val progress = signer.advance(null)
        assertThat(progress).isInstanceOf(RegistrationProgress.Refused::class.java)
        assertThat((progress as RegistrationProgress.Refused).errors.single().code)
            .isEqualTo(ErrorCode.INTERNAL)
    }

    @Test
    fun aRefusedClaimSurfaces() = runTest {
        onboarding.claimRefusal = listOf(UserError(ErrorCode.BAD_INPUT, "not landed yet"))
        onboarding.status = status(approved = true, landed = true)
        val progress = signer.advance(null)
        assertThat(progress).isInstanceOf(RegistrationProgress.Refused::class.java)
        // The applicant token survives a refused claim.
        assertThat(identity.token).isEqualTo("applicant-token")
    }
}
