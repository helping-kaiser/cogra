// The stores over a real (JVM) Preferences DataStore with a fake
// cipher — the Tink/Keystore path is device-only and carries the hand
// test (android/CLAUDE.md "Tests ship with the code").

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.crypto.ActorKey
import com.cogra.crypto.decodeProposal
import com.cogra.domain.AuthTokens
import com.google.common.truth.Truth.assertThat
import java.io.File
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

/** Invertible and visibly not a no-op: prefix marker + byte flip. */
private class FakeCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray =
        byteArrayOf(0x5A) + plaintext.map { (it.toInt() xor 0x55).toByte() }.toByteArray()

    override fun open(sealed: ByteArray): ByteArray {
        check(sealed[0] == 0x5A.toByte()) { "not sealed by this cipher" }
        return sealed.drop(1).map { (it.toInt() xor 0x55).toByte() }.toByteArray()
    }
}

class StoresTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private fun store(): EncryptedStore {
        val file = File(tmp.newFolder(), "test.preferences_pb")
        return EncryptedStore(
            PreferenceDataStoreFactory.create(scope = scope) { file },
            FakeCipher(),
        )
    }

    @After
    fun tearDown() {
        scope.cancel()
    }

    @Test
    fun valuesAreSealedAtRestAndRoundTrip() = runTest {
        val store = store()
        store.put("k", byteArrayOf(1, 2, 3))
        assertThat(store.get("k")).isEqualTo(byteArrayOf(1, 2, 3))
        store.remove("k")
        assertThat(store.get("k")).isNull()
    }

    @Test
    fun tokensOverwriteAndClear() = runTest {
        val tokens = TokenStoreImpl(store())
        assertThat(tokens.current()).isNull()
        tokens.save(AuthTokens("a1", "r1"))
        // The rotating refresh overwrites in place.
        tokens.save(AuthTokens("a2", "r2"))
        assertThat(tokens.current()).isEqualTo(AuthTokens("a2", "r2"))
        assertThat(tokens.tokens.first()).isEqualTo(AuthTokens("a2", "r2"))
        tokens.clear()
        assertThat(tokens.current()).isNull()
        assertThat(tokens.tokens.first()).isNull()
    }

    @Test
    fun identityValuesRoundTrip() = runTest {
        val identity = IdentityStoreImpl(store())
        val seed = ActorKey.generate().seed()
        identity.saveActorSeed(seed)
        identity.saveApplicantToken("tok")
        identity.savePendingBackupBlob(byteArrayOf(7, 8))
        assertThat(identity.actorSeed()).isEqualTo(seed)
        assertThat(identity.applicantToken()).isEqualTo("tok")
        assertThat(identity.pendingBackupBlob()).isEqualTo(byteArrayOf(7, 8))
        identity.clearApplicantToken()
        identity.clearPendingBackupBlob()
        assertThat(identity.applicantToken()).isNull()
        assertThat(identity.pendingBackupBlob()).isNull()
    }

    private fun proposalOf(actor: ActorKey): ByteArray = com.cogra.crypto.encodeProposal(
        com.cogra.crypto.Proposal(
            body = com.cogra.crypto.StructuralBody(
                author = actor.address(),
                seq = 1u,
                family = com.cogra.crypto.Family.OPINION,
                middle = null,
                target = com.cogra.crypto.NodeId.parse("prof:bob"),
                pD = 0.5,
                pI = 0.1,
                settlementRef = null,
                license = null,
                assertedParents = emptyList(),
            ),
            payload = ByteArray(0),
            deps = emptyList(),
        ),
    )

    @Test
    fun handshakeMaterialSurvivesExactly() = runTest {
        val identity = IdentityStoreImpl(store())
        val actor = ActorKey.generate()
        val pre = actor.preSign(decodeProposal(proposalOf(actor)))
        identity.saveHandshake("w1", pre)
        identity.saveHandshake("w2", pre)
        assertThat(identity.handshakeIds()).containsExactly("w1", "w2")

        val restored = checkNotNull(identity.handshake("w1"))
        assertThat(restored.proposal).isEqualTo(pre.proposal)
        assertThat(restored.nonce).isEqualTo(pre.nonce)
        assertThat(restored.preSignature).isEqualTo(pre.preSignature)
        assertThat(restored.authorPubkey).isEqualTo(pre.authorPubkey)

        identity.clearHandshake("w1")
        assertThat(identity.handshakeIds()).containsExactly("w2")
        assertThat(identity.handshake("w1")).isNull()
    }
}
