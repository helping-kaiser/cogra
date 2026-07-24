package com.cogra.domain.identity

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.openKeyBackup
import com.cogra.crypto.sealKeyBackup
import com.cogra.domain.ApplicationStatus
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.InviteCheck
import com.cogra.domain.InviteLinkInfo
import com.cogra.domain.Outcome
import com.cogra.domain.SessionInfo
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.UserProfile
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.SessionRepository
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import java.time.Instant
import java.util.Base64
import kotlinx.coroutines.test.runTest
import org.junit.Test

private open class StubAccount : AccountRepository {
    var uploaded: ByteArray? = null
    var served: ByteArray? = null
    var failUpload = false

    override suspend fun me(): Outcome<UserProfile?> = throw UnsupportedOperationException()
    override suspend fun keyBackup(): Outcome<ByteArray?> = Outcome.Success(served)

    override suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit> {
        if (failUpload) return Outcome.Failed(IOException("upload lost"))
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

class KeyCeremonyTest {

    private val identity = FakeIdentityStore()

    @Test
    fun theCeremonyCreatesAndStoresTheKey() = runTest {
        val public = KeyCeremony(identity).createActorKey()
        val stored = ActorKey.fromSeed(checkNotNull(identity.seed))
        assertThat(public.l0Address).isEqualTo(stored.address())
        assertThat(Base64.getDecoder().decode(public.publicKeyBase64))
            .isEqualTo(stored.publicKeyBytes())
    }

    @Test
    fun theBackupOfferSealsTheSeedUnderAFreshCode() = runTest {
        val ceremony = KeyCeremony(identity)
        ceremony.createActorKey()
        val display = ceremony.createPendingBackup()
        // The parked blob opens under the displayed code and carries the seed.
        val opened = openKeyBackup(
            checkNotNull(identity.pendingBlob),
            RecoveryCode.fromInput(display),
        )
        assertThat(opened).isEqualTo(identity.seed)
    }

    @Test
    fun enableOrReplaceUploadsABlobTheNewCodeOpens() = runTest {
        identity.seed = ActorKey.generate().seed()
        val account = StubAccount()
        val outcome = BackupManager(identity, account).enableOrReplace()
        val display = (outcome as Outcome.Success).value
        val opened = openKeyBackup(checkNotNull(account.uploaded), RecoveryCode.fromInput(display))
        assertThat(opened).isEqualTo(identity.seed)
    }

    @Test
    fun enableOrReplaceWithoutAKeyFails() = runTest {
        assertThat(BackupManager(identity, StubAccount()).enableOrReplace())
            .isInstanceOf(Outcome.Failed::class.java)
    }

    @Test
    fun restoreRoundTripsTheActor() = runTest {
        val seed = ActorKey.generate().seed()
        val code = RecoveryCode.generate()
        val account = StubAccount().apply { served = sealKeyBackup(seed, code) }
        val result = ActorRestorer(identity, account).restore(code.display())
        assertThat(result).isEqualTo(RestoreResult.Restored)
        assertThat(identity.seed).isEqualTo(seed)
    }

    @Test
    fun restoreDistinguishesItsFailures() = runTest {
        val account = StubAccount()
        val restorer = ActorRestorer(identity, account)

        // Not a code at all.
        assertThat(restorer.restore("nope")).isInstanceOf(RestoreResult.MalformedCode::class.java)

        // No backup uploaded.
        val valid = RecoveryCode.generate()
        assertThat(restorer.restore(valid.display())).isEqualTo(RestoreResult.NoBackup)

        // A well-formed but wrong code.
        account.served = sealKeyBackup(ActorKey.generate().seed(), RecoveryCode.generate())
        assertThat(restorer.restore(valid.display())).isEqualTo(RestoreResult.WrongCode)
        assertThat(identity.seed).isNull()
    }

    @Test
    fun signOutClearsTokensEvenWhenRevocationFails() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r")) }
        val sessions = object : SessionRepository {
            override suspend fun logIn(email: String, password: String, deviceLabel: String?) =
                throw UnsupportedOperationException()
            override suspend fun refresh(refreshToken: String): Outcome<AuthTokens> =
                throw UnsupportedOperationException()
            override suspend fun sessions(): Outcome<List<SessionInfo>> = throw UnsupportedOperationException()
            override suspend fun revokeSession(id: String?): Outcome<Unit> =
                Outcome.Failed(IOException("offline"))
            override suspend fun revokeOtherSessions(): Outcome<Int> = throw UnsupportedOperationException()
        }
        SignOut(sessions, tokens).signOut()
        assertThat(tokens.current()).isNull()
    }
}
