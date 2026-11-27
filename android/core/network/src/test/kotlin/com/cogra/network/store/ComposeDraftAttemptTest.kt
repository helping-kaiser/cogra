// The kept draft's pending signing at rest (SealSigning.md:31: a Retry asks the
// same signing again, also after the composer was left and opened again), over
// a real (JVM) Preferences DataStore with a fake cipher, as StoresTest does.

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.domain.AuthTokens
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.signing.SigningAttempt
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/** Invertible and visibly not a no-op. */
private class XorCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray = plaintext.map { (it.toInt() xor 0x55).toByte() }.toByteArray()

    override fun open(sealed: ByteArray): ByteArray = seal(sealed)
}

class ComposeDraftAttemptTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @After
    fun tearDown() = scope.cancel()

    private val encrypted by lazy {
        val file = File(tmp.newFolder(), "test.preferences_pb")
        EncryptedStore(PreferenceDataStoreFactory.create(scope = scope) { file }, XorCipher())
    }
    private val tokens by lazy { TokenStoreImpl(encrypted) }
    private val drafts by lazy { ComposeDraftStoreImpl(encrypted, tokens) }

    private suspend fun signIn(account: String) = tokens.save(AuthTokens("a-$account", "r-$account", account))

    private fun attempt(owner: String) = SigningAttempt(owner, "node-1", listOf("w1", "w2"), "intent")

    private fun draft(owner: String) =
        ComposeDraft(DraftBodyKind.Words, body = "Salt maps of the coast road", attempt = attempt(owner))

    @Test
    fun theAttemptRoundTripsWithItsDraft() = runTest {
        signIn("account-a")
        drafts.save(draft("account-a"))

        assertThat(drafts.draft()).isEqualTo(draft("account-a"))
    }

    @Test
    fun anotherAccountsAttemptIsNeverWrittenIntoThisAccountsDraft() = runTest {
        signIn("account-b")
        drafts.save(draft("account-a"))

        val held = drafts.draft()
        assertThat(held?.body).isEqualTo("Salt maps of the coast road")
        assertThat(held?.attempt).isNull()
    }

    @Test
    fun theAttemptStandsUnderItsOwnAccountAcrossASwitch() = runTest {
        signIn("account-a")
        drafts.save(draft("account-a"))
        signIn("account-b")

        assertThat(drafts.draft()).isNull()

        signIn("account-a")
        assertThat(drafts.draft()?.attempt).isEqualTo(attempt("account-a"))
    }

    @Test
    fun aDraftKeptBeforeAttemptsExistedReadsWithNone() = runTest {
        signIn("account-a")
        encrypted.put(
            composeDraftKey("account-a"),
            "{\"bodyKind\":\"Words\",\"body\":\"older\"}".encodeToByteArray(),
        )

        assertThat(drafts.draft()).isEqualTo(ComposeDraft(DraftBodyKind.Words, body = "older"))
    }
}
