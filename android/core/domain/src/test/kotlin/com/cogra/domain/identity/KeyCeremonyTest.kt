package com.cogra.domain.identity

import com.cogra.crypto.ActorKey
import com.cogra.crypto.RecoveryCode
import com.cogra.crypto.UPLOAD_PROOF_TAG
import com.cogra.crypto.openKeyBackup
import com.cogra.crypto.sealKeyBackup
import com.cogra.crypto.sha256Tagged
import com.cogra.crypto.verify
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
    val challenge = ByteArray(32) { 0x71 }
    var uploaded: ByteArray? = null
    var uploadedChallenge: ByteArray? = null
    var uploadedSignature: ByteArray? = null
    var served: ByteArray? = null
    var failUpload = false
    var failChallenge = false

    override suspend fun keyBackup(): Outcome<ByteArray?> = Outcome.Success(served)

    override suspend fun keyBackupChallenge(): Outcome<ByteArray> =
        if (failChallenge) Outcome.Failed(IOException("challenge lost")) else Outcome.Success(challenge)

    override suspend fun uploadKeyBackup(
        blob: ByteArray,
        challenge: ByteArray,
        signature: ByteArray,
    ): Outcome<Unit> {
        if (failUpload) return Outcome.Failed(IOException("upload lost"))
        uploaded = blob
        uploadedChallenge = challenge
        uploadedSignature = signature
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

        identity.seed = ActorKey.generate().seed()
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
    fun theFlushProvesPossessionOfTheActorKey() = runTest {
        ceremony.createActorKey()
        ceremony.createPendingBackup()
        val blob = checkNotNull(identity.pendingBlob)

        assertThat(ceremony.uploadPendingBackup()).isTrue()

        assertThat(account.uploadedChallenge).isEqualTo(account.challenge)
        val proof = sha256Tagged(UPLOAD_PROOF_TAG, listOf(account.challenge, blob))
        assertThat(
            verify(
                ActorKey.fromSeed(checkNotNull(identity.seed)).publicKeyBytes(),
                UPLOAD_PROOF_TAG,
                proof,
                checkNotNull(account.uploadedSignature),
            ),
        ).isTrue()
    }

    @Test
    fun aRefusedChallengeKeepsTheBlobParked() = runTest {
        ceremony.createActorKey()
        ceremony.createPendingBackup()
        account.failChallenge = true

        assertThat(ceremony.uploadPendingBackup()).isFalse()
        assertThat(identity.pendingBlob).isNotNull()
    }

    @Test
    fun mintingAReplacementKeyDropsABlobParkedUnderTheOldOne() = runTest {
        ceremony.createActorKey()
        ceremony.createPendingBackup()
        assertThat(identity.pendingBlob).isNotNull()

        // Pre-approval the attached key is replaceable; the parked
        // blob's proof would never verify against the new key.
        ceremony.createActorKey()
        assertThat(identity.pendingBlob).isNull()
    }

    @Test
    fun enableOrReplaceUploadsABlobTheNewCodeOpens() = runTest {
        identity.seed = ActorKey.generate().seed()
        val outcome = BackupManager(identity, account).enableOrReplace()
        val display = (outcome as Outcome.Success).value
        val opened = openKeyBackup(checkNotNull(account.uploaded), RecoveryCode.fromInput(display))
        assertThat(opened).isEqualTo(identity.seed)

        val proof = sha256Tagged(UPLOAD_PROOF_TAG, listOf(account.challenge, account.uploaded!!))
        assertThat(
            verify(
                ActorKey.fromSeed(checkNotNull(identity.seed)).publicKeyBytes(),
                UPLOAD_PROOF_TAG,
                proof,
                checkNotNull(account.uploadedSignature),
            ),
        ).isTrue()
    }

    @Test
    fun enableOrReplaceSurfacesAChallengeFailure() = runTest {
        identity.seed = ActorKey.generate().seed()
        account.failChallenge = true
        assertThat(BackupManager(identity, account).enableOrReplace())
            .isInstanceOf(Outcome.Failed::class.java)
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
        val result = ActorRestorer(identity, account).restore(code.display(), forgetOnSignOut = false)
        assertThat(result).isEqualTo(RestoreResult.Restored)
        assertThat(identity.seed).isEqualTo(seed)
        assertThat(identity.forgetOnSignOut).isFalse()
    }

    @Test
    fun restoreDistinguishesItsFailures() = runTest {
        val restorer = ActorRestorer(identity, account)

        // Not a code at all.
        assertThat(restorer.restore("nope", forgetOnSignOut = false))
            .isInstanceOf(RestoreResult.MalformedCode::class.java)

        // No backup uploaded.
        val valid = RecoveryCode.generate()
        assertThat(restorer.restore(valid.display(), forgetOnSignOut = false))
            .isEqualTo(RestoreResult.NoBackup)

        // A well-formed but wrong code.
        account.served = sealKeyBackup(ActorKey.generate().seed(), RecoveryCode.generate())
        assertThat(restorer.restore(valid.display(), forgetOnSignOut = false))
            .isEqualTo(RestoreResult.WrongCode)
        assertThat(identity.seed).isNull()

        // One mistyped character — including the last, which the pad
        // bits refuse before the blob is fetched — is a wrong code, not
        // an input the reader should be told isn't a code at all.
        assertThat(restorer.restore(valid.display().dropLast(1) + "Z", forgetOnSignOut = false))
            .isEqualTo(RestoreResult.WrongCode)
    }

    @Test
    fun restoreCheckedFlagsTheAccountUncheckedLeavesTheChoiceStanding() = runTest {
        val seed = ActorKey.generate().seed()
        val code = RecoveryCode.generate()
        account.served = sealKeyBackup(seed, code)
        val restorer = ActorRestorer(identity, account)

        // The login-time opt-in survives an unchecked restore.
        identity.forgetOnSignOut = true
        restorer.restore(code.display(), forgetOnSignOut = false)
        assertThat(identity.forgetOnSignOut).isTrue()

        // Checked, it opts the account out.
        identity.forgetOnSignOut = false
        restorer.restore(code.display(), forgetOnSignOut = true)
        assertThat(identity.forgetOnSignOut).isTrue()
    }

    private fun offlineSessions() = object : ThrowingSessionRepository() {
        override suspend fun revokeSession(id: String?): Outcome<Unit> =
            Outcome.Failed(IOException("offline"))
    }

    @Test
    fun signOutClearsTokensEvenWhenRevocationFails() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        identity.seed = ActorKey.generate().seed()
        SignOut(offlineSessions(), EndLocalSession(identity, tokens)).signOut()
        assertThat(tokens.current()).isNull()
        // Not opted out: the actor stays in its slot.
        assertThat(identity.seed).isNotNull()
    }

    @Test
    fun signOutPurgesTheAccountThatOptedOut() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        identity.seed = ActorKey.generate().seed()
        identity.pendingBlob = byteArrayOf(7)
        identity.dismissedReciprocation = true
        identity.forgetOnSignOut = true
        SignOut(offlineSessions(), EndLocalSession(identity, tokens)).signOut()
        assertThat(tokens.current()).isNull()
        assertThat(identity.seed).isNull()
        assertThat(identity.pendingBlob).isNull()
        assertThat(identity.dismissedReciprocation).isFalse()
        assertThat(identity.handshakes).isEmpty()
    }
}
