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
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.store.DeviceData
import com.cogra.domain.store.ThemeChoice
import com.cogra.domain.testing.FakeDeviceData
import com.cogra.domain.testing.FakeDeviceLockRepository
import com.cogra.domain.testing.FakeDevicePreferences
import com.cogra.domain.testing.FakeExploreDeviceStore
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingAccountRepository
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.cogra.domain.testing.ThrowingSessionRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.util.Base64

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

    override suspend fun attachActorKey(actorPubkeyBase64: String, realizationAddress: String): Outcome<Unit> {
        attached += actorPubkeyBase64 to realizationAddress
        return outcome
    }
}

class KeyCeremonyTest {

    private val identity = FakeIdentityStore()
    private val onboarding = AttachRecorder()
    private val account = StubAccount()
    private val ceremony = KeyCeremony(identity, onboarding, account)
    private val custody = FakeLockCustodyStore()
    private val locks = FakeDeviceLockRepository()
    private val restoreTokens = FakeTokenStore()

    private fun restorer() = ActorRestorer(identity, account, restoreTokens, DeviceLock(custody, restoreTokens, locks))

    @Test
    fun theCeremonyCreatesAndStoresTheKey() = runTest {
        val public = ceremony.createActorKey()
        val stored = ActorKey.fromSeed(checkNotNull(identity.seed))
        assertThat(public.realizationAddress).isEqualTo(stored.address())
        assertThat(Base64.getDecoder().decode(public.publicKeyBase64))
            .isEqualTo(stored.publicKeyBytes())
    }

    @Test
    fun theAttachSendsTheStoredKeysPublicHalves() = runTest {
        val public = ceremony.createActorKey()
        assertThat(ceremony.attachActorKey()).isEqualTo(Outcome.Success(Unit))
        assertThat(onboarding.attached).containsExactly(public.publicKeyBase64 to public.realizationAddress)
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
        val result = restorer().restore(code.display(), forgetOnSignOut = false)
        assertThat(result).isEqualTo(RestoreResult.Restored)
        assertThat(identity.seed).isEqualTo(seed)
        assertThat(identity.forgetOnSignOut).isFalse()
    }

    @Test
    fun restoreDistinguishesItsFailures() = runTest {
        val restorer = restorer()

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
        val restorer = restorer()

        // The login-time opt-in survives an unchecked restore.
        identity.forgetOnSignOut = true
        restorer.restore(code.display(), forgetOnSignOut = false)
        assertThat(identity.forgetOnSignOut).isTrue()

        // Checked, it opts the account out.
        identity.forgetOnSignOut = false
        restorer.restore(code.display(), forgetOnSignOut = true)
        assertThat(identity.forgetOnSignOut).isTrue()
    }

    private fun signOutOf(
        sessions: SessionRepository,
        tokens: FakeTokenStore,
        device: DeviceData,
        explore: FakeExploreDeviceStore = FakeExploreDeviceStore(),
    ) = SignOut(sessions, identity, tokens, device, DeviceLock(custody, tokens, locks), explore)

    private fun offlineSessions() = object : ThrowingSessionRepository() {
        override suspend fun revokeSession(id: String?): Outcome<Unit> =
            Outcome.Failed(IOException("offline"))
    }

    @Test
    fun signOutClearsTokensEvenWhenRevocationFails() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        identity.seed = ActorKey.generate().seed()
        signOutOf(offlineSessions(), tokens, FakeDeviceData()).signOut()
        assertThat(tokens.current()).isNull()
        // Not opted out: the actor stays in its slot.
        assertThat(identity.seed).isNotNull()
        assertThat(identity.custodyPurges).isEqualTo(0)
    }

    /** EraseConfirm.md:21 — revoked first, everything on the device gone, the session ended. */
    @Test
    fun eraseEverythingRevokesWipesTheDeviceAndEndsTheSession() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        val prefs = FakeDevicePreferences().apply { setTheme(ThemeChoice.DARK) }
        val device = FakeDeviceData(tokens, identity, prefs)
        identity.seed = ActorKey.generate().seed()
        var revokedWithSession = false
        val sessions = object : ThrowingSessionRepository() {
            override suspend fun revokeSession(id: String?): Outcome<Unit> {
                revokedWithSession = id == null && tokens.current() != null
                return Outcome.Success(Unit)
            }
        }
        signOutOf(sessions, tokens, device).eraseEverything()
        assertThat(revokedWithSession).isTrue()
        assertThat(device.erases).isEqualTo(1)
        assertThat(tokens.current()).isNull()
        assertThat(identity.seed).isNull()
        assertThat(prefs.theme.value).isEqualTo(ThemeChoice.AUTO)
    }

    @Test
    fun eraseEverythingEndsTheSessionEvenOffline() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        val device = FakeDeviceData()
        signOutOf(offlineSessions(), tokens, device).eraseEverything()
        assertThat(device.erases).isEqualTo(1)
        assertThat(tokens.current()).isNull()
    }

    /** Explore.md:31 — the recent searches are per account and cleared at sign-out. */
    @Test
    fun signOutForgetsTheLeavingAccountsRecentSearchesAndNoOneElses() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        val explore = FakeExploreDeviceStore().apply {
            rememberSearch("u1", "salt")
            rememberSearch("u2", "coast")
            rememberSearch(null, "tide")
        }
        signOutOf(offlineSessions(), tokens, FakeDeviceData(), explore).signOut()
        assertThat(explore.recentsNow("u1")).isEmpty()
        assertThat(explore.recentsNow("u2")).containsExactly("coast")
        assertThat(explore.recentsNow(null)).containsExactly("tide")
    }

    @Test
    fun signOutPurgesTheAccountThatOptedOut() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        identity.seed = ActorKey.generate().seed()
        identity.pendingBlob = byteArrayOf(7)
        identity.stancePadTaught = true
        identity.forgetOnSignOut = true
        signOutOf(offlineSessions(), tokens, FakeDeviceData()).signOut()
        assertThat(tokens.current()).isNull()
        assertThat(identity.seed).isNull()
        assertThat(identity.pendingBlob).isNull()
        assertThat(identity.stancePadTaught).isFalse()
        assertThat(identity.handshakes).isEmpty()
        // The explicit path clears the whole custody set, draft included.
        assertThat(identity.custodyPurges).isEqualTo(1)
    }

    @Test
    fun aForgottenSignOutDiscardsTheLockBeforeItPurges() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        locks.sessionAccount = "u1"
        identity.forgetOnSignOut = true
        DeviceLock(custody, tokens, locks).ensureHeld("u1")
        val id = custody.lockId("u1")!!
        signOutOf(offlineSessions(), tokens, FakeDeviceData()).signOut()
        assertThat(locks.rows).doesNotContainKey(id)
        assertThat(custody.lockId("u1")).isNull()
    }

    @Test
    fun `erase_discards_the_device_lock`() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        locks.sessionAccount = "u1"
        DeviceLock(custody, tokens, locks).ensureHeld("u1")
        val id = custody.lockId("u1")!!
        signOutOf(offlineSessions(), tokens, FakeDeviceData()).eraseEverything()
        assertThat(locks.rows).doesNotContainKey(id)
    }

    /**
     * The remote path never purges an only copy (sign-out-custody §3.6): a
     * forget account holding its lock is LOCKED. The pins over the real
     * stores are `LockCustodyStoreTest`'s.
     */
    @Test
    fun theRemoteEndLocksAForgetAccountHoldingItsLock() = runTest {
        val tokens = FakeTokenStore().apply { save(AuthTokens("a", "r", "u1")) }
        custody.forget += "u1"
        custody.custodyOf("u1")["key-seed"] = byteArrayOf(1)
        custody.holdLock("u1", com.cogra.domain.store.HeldLock("lock-1", ByteArray(32)))
        assertThat(EndLocalSession(custody, tokens).end()).isEqualTo(LocalSessionEnd.LOCKED)
        assertThat(tokens.current()).isNull()
        assertThat(custody.custodyOf("u1")).isEmpty()
        assertThat(custody.isLocked("u1")).isTrue()
        assertThat(custody.isLockPending("u1")).isFalse()
    }

    @Test
    fun theBackedFlagFollowsTheKeysBackup() = runTest {
        ceremony.createActorKey()
        assertThat(identity.keyBacked).isFalse()
        ceremony.createPendingBackup()
        assertThat(ceremony.uploadPendingBackup()).isTrue()
        assertThat(identity.keyBacked).isTrue()
        // A fresh key has no backup until one uploads.
        ceremony.createActorKey()
        assertThat(identity.keyBacked).isFalse()
    }

    @Test
    fun aRestoreIsBackedAndATickedRestoreObtainsItsLock() = runTest {
        val seed = ActorKey.generate().seed()
        val code = RecoveryCode.generate()
        account.served = sealKeyBackup(seed, code)
        restoreTokens.save(AuthTokens("token-u1", "r", "u1"))
        locks.sessionAccount = "u1"
        val restorer = restorer()
        restorer.restore(code.display(), forgetOnSignOut = true)
        assertThat(identity.keyBacked).isTrue()
        assertThat(custody.heldLock("u1")).isNotNull()
    }
}
