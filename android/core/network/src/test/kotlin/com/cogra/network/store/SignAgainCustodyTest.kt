// The re-sign's spending paths against the REAL account-scoped custody
// (`IdentityStoreImpl`, every handshake under `acct:<account>:handshake:`):
// an ask of one account's staged ids while another account is active — the
// caller's pressing-account guard skipped — spends nothing of the first's.

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.crypto.ActorKey
import com.cogra.domain.AuthTokens
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.stanceRecord
import com.cogra.domain.testing.AnswerLosingWriteRepository
import com.cogra.domain.testing.SealingWriteRepository
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
private class CustodyCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray = plaintext.map { (it.toInt() xor 0x5A).toByte() }.toByteArray()

    override fun open(sealed: ByteArray): ByteArray = seal(sealed)
}

class SignAgainCustodyTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @After
    fun tearDown() = scope.cancel()

    private val encrypted by lazy {
        val file = File(tmp.newFolder(), "test.preferences_pb")
        EncryptedStore(PreferenceDataStoreFactory.create(scope = scope) { file }, CustodyCipher())
    }
    private val tokens by lazy { TokenStoreImpl(encrypted) }
    private val identity by lazy { IdentityStoreImpl(encrypted, tokens) }

    private val actorA = ActorKey.generate()
    private val sealer = SealingWriteRepository(actorA)
    private val host = AnswerLosingWriteRepository(sealer)
    private val ordered = Expectation(listOf(stanceRecord("prof:bob", 0.5, 0.1)))

    private suspend fun signIn(account: String) = tokens.save(AuthTokens("a-$account", "r-$account", account))

    /** Account A signs one write whose submit answer is lost: A holds its material. */
    private suspend fun aParksOneWrite(): String {
        signIn("account-a")
        identity.saveActorSeed(actorA.seed())
        val batch = sealer.stageFaithful(ordered)
        host.loseSubmits = 1
        val first = WriteSigner(host, identity).sign(batch, ordered).single()
        assertThat(first).isInstanceOf(WriteResult.Failed::class.java)
        assertThat(identity.handshake(batch.single().id)).isNotNull()
        return batch.single().id
    }

    @Test
    fun aDeviceRejectionUnderAnotherAccountLeavesTheFirstAccountsMaterial() = runTest {
        val id = aParksOneWrite()
        signIn("account-b")
        identity.saveActorSeed(ActorKey.generate().seed())

        // B's key is not the proposal's author: the intent check rejects the batch and "spends" it.
        val again = WriteSigner(host, identity).signAgain(listOf(id), ordered).single()

        assertThat(again).isInstanceOf(WriteResult.RejectedByDevice::class.java)
        assertThat(host.approved).isEmpty()
        signIn("account-a")
        assertThat(identity.handshake(id)).isNotNull()
    }

    @Test
    fun aGoneWriteUnderAnotherAccountLeavesTheFirstAccountsMaterial() = runTest {
        val id = aParksOneWrite()
        signIn("account-b")
        identity.saveActorSeed(ActorKey.generate().seed())
        sealer.staged.remove(id)

        val again = WriteSigner(host, identity).signAgain(listOf(id), ordered).single()

        assertThat(again).isInstanceOf(WriteResult.Refused::class.java)
        signIn("account-a")
        assertThat(identity.handshake(id)).isNotNull()
    }
}
