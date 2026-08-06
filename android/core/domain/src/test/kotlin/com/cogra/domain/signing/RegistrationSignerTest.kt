package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.ApplicationView
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.identity.KeyCeremony
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.TestHost
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.domain.testing.testProposalBytes
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import java.time.Instant
import java.util.Base64
import kotlinx.coroutines.test.runTest
import org.junit.Test

/** The me-driven status, scripted: the test moves the server-side state. */
private class FakeOnboarding : ThrowingOnboardingRepository() {
    var status: Outcome<ApplicationStatus> =
        Outcome.Failed(IllegalStateException("status not scripted"))
    var attachOutcome: Outcome<Unit> = Outcome.Success(Unit)
    val attachedKeys = mutableListOf<String>()

    override suspend fun applicationStatus(): Outcome<ApplicationStatus> = status

    override suspend fun attachActorKey(actorPubkeyBase64: String, l0Address: String): Outcome<Unit> {
        attachedKeys += actorPubkeyBase64
        return attachOutcome
    }
}

/** The write legs of the Registration handshake: seal, then relay. */
private class RegistrationWrites(
    val actor: ActorKey,
    val host: TestHost,
    val proposal: ByteArray,
) : ThrowingWriteRepository() {
    var tamperSeal = false

    fun stagedView(state: WriteState, verifiedAct: ByteArray? = null) = StagedWriteView(
        id = "reg-1",
        state = state,
        family = com.cogra.crypto.Family.REGISTRATION,
        canonicalProposal = proposal,
        verifiedAct = verifiedAct,
        recordId = null,
    )

    override suspend fun hostPublicKey(): Outcome<ByteArray> = Outcome.Success(host.key.publicKeyBytes())

    override suspend fun submitProposal(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> {
        val sealed = host.seal(proposal, Base64.getDecoder().decode(signatureBase64), actor.publicKeyBytes())
        if (tamperSeal) sealed[sealed.size - 1] = (sealed[sealed.size - 1].toInt() xor 1).toByte()
        return Outcome.Success(stagedView(WriteState.AWAITING_APPROVAL, sealed))
    }

    override suspend fun approveAct(stagedWriteId: String, signatureBase64: String): Outcome<StagedWriteView> =
        Outcome.Success(stagedView(WriteState.RELAYING))
}

private class FakeAccount : ThrowingAccountRepository() {
    var uploaded: ByteArray? = null
    var failUpload = false

    override suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit> {
        if (failUpload) return Outcome.Failed(IOException("upload lost"))
        uploaded = blob
        return Outcome.Success(Unit)
    }
}

class RegistrationSignerTest {

    private val actor = ActorKey.generate()
    private val host = TestHost()
    private val onboarding = FakeOnboarding()
    private val writes = RegistrationWrites(actor, host, testProposalBytes(actor, seq = 0u))
    private val identity = FakeIdentityStore().apply { seed = actor.seed() }
    private val account = FakeAccount()
    private val ceremony = KeyCeremony(identity, onboarding, account)
    private val signer = RegistrationSigner(onboarding, WriteSigner(writes, identity), identity, ceremony)

    private fun application(
        emailVerified: Boolean = true,
        keyAttached: Boolean = true,
        approved: Boolean = false,
        landed: Boolean = false,
        expired: Boolean = false,
    ) = ApplicationView(
        handle = "joiner",
        emailVerified = emailVerified,
        keyAttached = keyAttached,
        approvedAt = if (approved) Instant.EPOCH else null,
        landedAt = if (landed) Instant.EPOCH else null,
        expiresAt = if (expired) Instant.EPOCH else Instant.MAX,
    )

    private fun status(
        accountState: AccountState = AccountState.APPLICANT,
        application: ApplicationView? = null,
        staged: StagedWriteView? = null,
    ) = Outcome.Success(ApplicationStatus(accountState, application, staged))

    @Test
    fun theFlowAdvancesStageByStage() = runTest {
        // Waiting on the email; the key proof is already attached.
        onboarding.status = status(application = application(emailVerified = false))
        assertThat(signer.advance()).isEqualTo(
            RegistrationProgress.AwaitingApproval(emailVerified = false, keyAttached = true, keyOnDevice = true),
        )

        // Both proofs done: waiting on the inviter.
        onboarding.status = status(application = application())
        assertThat(signer.advance()).isEqualTo(
            RegistrationProgress.AwaitingApproval(emailVerified = true, keyAttached = true, keyOnDevice = true),
        )

        // The staged Registration appears: one pass signs both steps
        // through the ordinary write legs.
        onboarding.status = status(
            application = application(approved = true),
            staged = writes.stagedView(WriteState.AWAITING_PRE_SIGN),
        )
        assertThat(signer.advance()).isEqualTo(RegistrationProgress.AwaitingLanding)
        assertThat(identity.handshakes).isEmpty()

        // Signed, staging gone from the poll: still the server's move.
        onboarding.status = status(application = application(approved = true))
        assertThat(signer.advance()).isEqualTo(RegistrationProgress.AwaitingLanding)

        // Landed: the account is a member; nothing is claimed.
        onboarding.status = status(accountState = AccountState.MEMBER, application = application(landed = true))
        assertThat(signer.advance()).isEqualTo(RegistrationProgress.Member)
    }

    @Test
    fun aMintedButUnattachedKeyIsReattachedSilently() = runTest {
        // Crash healing: the device holds a seed the server never saw.
        onboarding.status = status(application = application(keyAttached = false))
        assertThat(signer.advance()).isEqualTo(
            RegistrationProgress.AwaitingApproval(emailVerified = true, keyAttached = true, keyOnDevice = true),
        )
        assertThat(onboarding.attachedKeys).hasSize(1)
    }

    @Test
    fun aFailedRepairAttachStaysUnattached() = runTest {
        onboarding.attachOutcome = Outcome.Failed(IOException("lost"))
        onboarding.status = status(application = application(keyAttached = false))
        assertThat(signer.advance()).isEqualTo(
            RegistrationProgress.AwaitingApproval(emailVerified = true, keyAttached = false, keyOnDevice = true),
        )
    }

    @Test
    fun noKeyAnywhereAsksForTheCeremony() = runTest {
        identity.seed = null
        onboarding.status = status(application = application(keyAttached = false))
        assertThat(signer.advance()).isEqualTo(
            RegistrationProgress.AwaitingApproval(emailVerified = true, keyAttached = false, keyOnDevice = false),
        )
        assertThat(onboarding.attachedKeys).isEmpty()
    }

    @Test
    fun aStagedWriteWithoutTheSeedAwaitsTheSigningKey() = runTest {
        identity.seed = null
        onboarding.status = status(
            application = application(approved = true),
            staged = writes.stagedView(WriteState.AWAITING_PRE_SIGN),
        )
        assertThat(signer.advance()).isEqualTo(RegistrationProgress.AwaitingSigningKey)
    }

    @Test
    fun aDeadApplicationNeedsAFreshInvite() = runTest {
        // Reaped entirely.
        onboarding.status = status(application = null)
        assertThat(signer.advance()).isEqualTo(RegistrationProgress.NeedsInvite)

        // Expired unapproved.
        onboarding.status = status(application = application(expired = true))
        assertThat(signer.advance()).isEqualTo(RegistrationProgress.NeedsInvite)
    }

    @Test
    fun thePendingBlobFlushesOnAnyPassAndSurvivesAFailedUpload() = runTest {
        identity.pendingBlob = byteArrayOf(9)
        account.failUpload = true
        onboarding.status = status(application = application())
        signer.advance()
        assertThat(identity.pendingBlob).isEqualTo(byteArrayOf(9))

        account.failUpload = false
        signer.advance()
        assertThat(account.uploaded).isEqualTo(byteArrayOf(9))
        assertThat(identity.pendingBlob).isNull()
    }

    @Test
    fun aTamperedRegistrationSealIsRefused() = runTest {
        writes.tamperSeal = true
        onboarding.status = status(
            application = application(approved = true),
            staged = writes.stagedView(WriteState.AWAITING_PRE_SIGN),
        )
        assertThat(signer.advance()).isInstanceOf(RegistrationProgress.RejectedByDevice::class.java)
        assertThat(identity.handshakes).isEmpty()
    }

    @Test
    fun lostMaterialAtApproveAsksForTheRestage() = runTest {
        // A sealed act is waiting but the device lost its material (a
        // fresh install, or another device pre-signed).
        val sealed = host.seal(
            writes.proposal,
            com.cogra.crypto.encodePreCommitmentOf(
                actor.preSign(com.cogra.crypto.decodeProposal(writes.proposal)),
            ),
            actor.publicKeyBytes(),
        )
        onboarding.status = status(
            application = application(approved = true),
            staged = writes.stagedView(WriteState.AWAITING_APPROVAL, sealed),
        )
        val progress = signer.advance()
        assertThat(progress).isInstanceOf(RegistrationProgress.Refused::class.java)
        assertThat((progress as RegistrationProgress.Refused).errors.single().code)
            .isEqualTo(ErrorCode.INTERNAL)
    }

    @Test
    fun statusRefusalsAndTransportFaultsSurface() = runTest {
        onboarding.status = Outcome.Refused(listOf(UserError(ErrorCode.UNAUTHENTICATED, "no viewer")))
        assertThat(signer.advance()).isInstanceOf(RegistrationProgress.Refused::class.java)

        onboarding.status = Outcome.Failed(IOException("offline"))
        assertThat(signer.advance()).isInstanceOf(RegistrationProgress.Failed::class.java)
    }
}
