package com.cogra.domain.identity

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.openKeyBackup
import com.cogra.crypto.sealKeyBackup
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingSessionRepository
import com.google.common.truth.Truth.assertThat
import java.io.IOException
import java.util.Base64
import kotlinx.coroutines.test.runTest
import org.junit.Test

private class StubAccount : ThrowingAccountRepository() {
    var uploaded: ByteArray? = null
    var served: ByteArray? = null
    var failUpload = false

    override suspend fun keyBackup(): Outcome<ByteArray?> = Outcome.Success(served)

    override suspend fun uploadKeyBackup(blob: ByteArray): Outcome<Unit> {
        if (failUpload) return Outcome.Failed(IOException("upload lost"))
        uploaded = blob
        return Outcome.Success(Unit)
    }
}

private class AttachRecorder : ThrowingOnboardingRepository() {
    val attached = mutableListOf<Pair<String, String>>()
    var outcome: Outcome<Unit> = Outcome.Success(Unit)

    override suspend fun attachActorKey(actorPubkeyBase64: String, l0Address: String): Outcome<Unit> {
        attached += actorPubkeyBase64 to l0Address
        return outcome
    }
}

class KeyCeremonyTest {

    private val identity = FakeIdentityStore()
    private val onboarding = AttachRecorder()
    private val account = StubAccount()
    private val ceremony = KeyCeremony(identity, onboarding, account)

    @Test
    fun theCeremonyCreatesAndStoresTheKey() = runTest {
        val public = ceremony.createActorKey()
        val stored = ActorKey.fromSeed(checkNotNull(identity.seed))
        assertThat(public.l0Address).isEqualTo(stored.address())
        assertThat(Base64.getDecoder().decode(public.publicKeyBase64))
            .isEqualTo(stored.publicKeyBytes())
    }

    @Test
    fun theAttachSendsTheStoredKeysPublicHalves() = runTest {
        val public = ceremony.createActorKey()
        assertThat(ceremony.attachActorKey()).isEqualTo(Outcome.Success(Unit))
        assertThat(onboarding.attached).containsExactly(public.publicKeyBase64 to public.l0Address)
    }

    @Test
    fun theBackupOfferSealsTheSeedUnderAFreshCode() = runTest {
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
    fun theFlushUploadsThenClearsAndAFailureKeepsTheBlob() = runTest {
        // Nothing parked: trivially done.
        assertThat(ceremony.uploadPendingBackup()).isTrue()

        identity.pendingBlob = byteArrayOf(7)
        account.failUpload = true
        assertThat(ceremony.uploadPendingBackup()).isFalse()
        assertThat(identity.pendingBlob).isEqualTo(byteArrayOf(7))

        account.failUpload = false
        assertThat(ceremony.uploadPendingBackup()).isTrue()
        assertThat(account.uploaded).isEqualTo(byteArrayOf(7))
        assertThat(identity.pendingBlob).isNull()
    }

    @Test
    fun enableOrReplaceUploadsABlobTheNewCodeOpens() = runTest {
        identity.seed = ActorKey.generate().seed()
        val outcome = BackupManager(identity, account).enableOrReplace()
        val display = (outcome as Outcome.Success).value
        val opened = openKeyBackup(checkNotNull(account.uploaded), RecoveryCode.fromInput(display))
        assertThat(opened).isEqualTo(identity.seed)
    }

    @Test
    fun enableOrReplaceWithoutAKeyFails() = runTest {
        assertThat(BackupManager(identity, account).enableOrReplace())
            .isInstanceOf(Outcome.Failed::class.java)
    }

    @Test
    fun restoreRoundTripsTheActor() = runTest {
        val seed = ActorKey.generate().seed()
        val code = RecoveryCode.generate()
        account.served = sealKeyBackup(seed, code)
        val result = ActorRestorer(identity, account).restore(code.display())
        assertThat(result).isEqualTo(RestoreResult.Restored)
        assertThat(identity.seed).isEqualTo(seed)
    }

    @Test
    fun restoreDistinguishesItsFailures() = runTest {
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
        val sessions = object : ThrowingSessionRepository() {
            override suspend fun revokeSession(id: String?): Outcome<Unit> =
                Outcome.Failed(IOException("offline"))
        }
        SignOut(sessions, tokens).signOut()
        assertThat(tokens.current()).isNull()
    }
}
