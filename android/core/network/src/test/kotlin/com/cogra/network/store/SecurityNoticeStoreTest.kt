// The security notice at rest (FeedSecurityNotice.md:17 "stands until Got it
// is pressed … across an app restart"; auth.md "Multi-account device custody"):
// kept in the account's own slot, sealed, read back by a fresh store over the
// same file, hidden under another account and standing again under its own,
// gone for good on `Got it`, and purged with the slot by a forgetting sign-out.

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.domain.AuthTokens
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.Instant

/** Invertible and visibly not a no-op. */
private class NoticeCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray = byteArrayOf(0x5A) + plaintext.map { (it + 3).toByte() }

    override fun open(sealed: ByteArray): ByteArray {
        check(sealed[0] == 0x5A.toByte()) { "not sealed by this cipher" }
        return sealed.drop(1).map { (it - 3).toByte() }.toByteArray()
    }
}

class SecurityNoticeStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val file by lazy { File(tmp.newFolder(), "test.preferences_pb") }

    private val store: EncryptedStore by lazy {
        EncryptedStore(PreferenceDataStoreFactory.create(scope = scope) { file }, NoticeCipher())
    }

    private val tokens by lazy { TokenStoreImpl(store) }

    private val identity by lazy { IdentityStoreImpl(store, tokens) }

    private val detectedAt = Instant.parse("2026-11-25T09:30:00Z")

    @After
    fun tearDown() {
        scope.cancel()
    }

    private suspend fun signIn(account: String) = tokens.save(AuthTokens("a-$account", "r-$account", account))

    @Test
    fun theNoticeIsKeptBeforeItsAccountIsActiveAndSurvivesARestart() = runTest {
        // Kept the moment the sign-in's answer carries it, before the tokens land.
        identity.keepSecurityNotice("u1", detectedAt)
        signIn("u1")
        assertThat(identity.securityNotice.first()).isEqualTo(detectedAt)

        // Sealed at rest, like every value of the store.
        assertThat(file.readBytes().decodeToString()).doesNotContain("2026-11-25")

        // A fresh store over the same file: the process died and came back.
        assertThat(IdentityStoreImpl(store, tokens).securityNotice.first()).isEqualTo(detectedAt)
    }

    @Test
    fun anotherAccountNeverSeesItAndASwitchNeverErasesIt() = runTest {
        identity.keepSecurityNotice("u1", detectedAt)
        signIn("u2")
        assertThat(identity.securityNotice.first()).isNull()
        // `Got it` under u2 dismisses u2's notice, not u1's.
        identity.dropSecurityNotice()

        signIn("u1")
        assertThat(identity.securityNotice.first()).isEqualTo(detectedAt)
    }

    @Test
    fun gotItRemovesItForGood() = runTest {
        identity.keepSecurityNotice("u1", detectedAt)
        signIn("u1")
        identity.dropSecurityNotice()

        assertThat(identity.securityNotice.first()).isNull()
        assertThat(IdentityStoreImpl(store, tokens).securityNotice.first()).isNull()
    }

    @Test
    fun signedOutThereIsNoNoticeToShow() = runTest {
        identity.keepSecurityNotice("u1", detectedAt)
        assertThat(identity.securityNotice.first()).isNull()
    }

    @Test
    fun aForgettingSignOutsPurgeTakesItWithTheSlot() = runTest {
        identity.keepSecurityNotice("u1", detectedAt)
        signIn("u1")
        identity.purgeCustodySet()
        assertThat(identity.securityNotice.first()).isNull()
    }

    @Test
    fun aValueThatIsNoTimeIsNoNotice() = runTest {
        signIn("u1")
        store.put("acct:u1:security_notice", "not a time".encodeToByteArray())
        assertThat(identity.securityNotice.first()).isNull()
    }
}
