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

    /** The pair of stores over one encrypted layer, as production wires them. */
    private class Stores(store: EncryptedStore) {
        val tokens = TokenStoreImpl(store)
        val identity = IdentityStoreImpl(store, tokens)
    }

    private suspend fun Stores.signIn(account: String) =
        tokens.save(AuthTokens("a-$account", "r-$account", account))

    @Test
    fun tokensOverwriteAndClear() = runTest {
        val tokens = TokenStoreImpl(store())
        assertThat(tokens.current()).isNull()
        tokens.save(AuthTokens("a1", "r1", "u1"))
        // The rotating refresh overwrites in place.
        tokens.save(AuthTokens("a2", "r2", "u1"))
        assertThat(tokens.current()).isEqualTo(AuthTokens("a2", "r2", "u1"))
        assertThat(tokens.tokens.first()).isEqualTo(AuthTokens("a2", "r2", "u1"))
        tokens.clear()
        assertThat(tokens.current()).isNull()
        assertThat(tokens.tokens.first()).isNull()
    }

    @Test
    fun aLegacyTokenRecordWithoutAnAccountIsNoSession() = runTest {
        // Written by a pre-multi-account build: no account id. Treated
        // as signed out — the accepted one-time re-login.
        val store = store()
        store.put("session_tokens", """{"access":"a","refresh":"r"}""".encodeToByteArray())
        val tokens = TokenStoreImpl(store)
        assertThat(tokens.current()).isNull()
        assertThat(tokens.tokens.first()).isNull()
    }

    @Test
    fun identityValuesRoundTrip() = runTest {
        val stores = Stores(store())
        stores.signIn("u1")
        val identity = stores.identity
        val seed = ActorKey.generate().seed()
        identity.saveActorSeed(seed)
        identity.savePendingBackupBlob(byteArrayOf(7, 8))
        assertThat(identity.actorSeed()).isEqualTo(seed)
        assertThat(identity.pendingBackupBlob()).isEqualTo(byteArrayOf(7, 8))
        identity.clearPendingBackupBlob()
        assertThat(identity.pendingBackupBlob()).isNull()
        assertThat(identity.forgetOnSignOut()).isFalse()
        identity.setForgetOnSignOut(true)
        assertThat(identity.forgetOnSignOut()).isTrue()
        identity.setForgetOnSignOut(false)
        assertThat(identity.forgetOnSignOut()).isFalse()
    }

    @Test
    fun identityMaterialIsKeyedByAccount() = runTest {
        val stores = Stores(store())
        val seedA = ActorKey.generate().seed()

        stores.signIn("account-a")
        stores.identity.saveActorSeed(seedA)
        stores.identity.markReciprocationDismissed()

        // Account B sees none of A's material — the originating defect
        // was B repair-attaching A's device-global key.
        stores.signIn("account-b")
        assertThat(stores.identity.actorSeed()).isNull()
        assertThat(stores.identity.reciprocationDismissed()).isFalse()
        val seedB = ActorKey.generate().seed()
        stores.identity.saveActorSeed(seedB)

        // Both slots coexist; switching back serves A's own material.
        stores.signIn("account-a")
        assertThat(stores.identity.actorSeed()).isEqualTo(seedA)
        assertThat(stores.identity.reciprocationDismissed()).isTrue()
        stores.signIn("account-b")
        assertThat(stores.identity.actorSeed()).isEqualTo(seedB)
    }

    @Test
    fun withoutAnActiveAccountReadsAreEmptyAndWritesAreDropped() = runTest {
        val stores = Stores(store())
        stores.identity.saveActorSeed(ActorKey.generate().seed())
        assertThat(stores.identity.actorSeed()).isNull()
        assertThat(stores.identity.handshakeIds()).isEmpty()
        assertThat(stores.identity.pendingBackupBlob()).isNull()
        assertThat(stores.identity.reciprocationDismissed()).isFalse()
        assertThat(stores.identity.forgetOnSignOut()).isFalse()

        // The dropped write did not land in anyone's slot.
        stores.signIn("account-a")
        assertThat(stores.identity.actorSeed()).isNull()
    }

    @Test
    fun purgeClearsOnlyTheActiveAccountsSlot() = runTest {
        val stores = Stores(store())
        val seedA = ActorKey.generate().seed()
        stores.signIn("account-a")
        stores.identity.saveActorSeed(seedA)

        stores.signIn("account-b")
        stores.identity.saveActorSeed(ActorKey.generate().seed())
        stores.identity.savePendingBackupBlob(byteArrayOf(9))
        stores.identity.setForgetOnSignOut(true)
        stores.identity.purge()
        assertThat(stores.identity.actorSeed()).isNull()
        assertThat(stores.identity.pendingBackupBlob()).isNull()
        assertThat(stores.identity.forgetOnSignOut()).isFalse()

        stores.signIn("account-a")
        assertThat(stores.identity.actorSeed()).isEqualTo(seedA)
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
        val stores = Stores(store())
        stores.signIn("u1")
        val identity = stores.identity
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

    @Test
    fun handshakesAreKeyedByAccount() = runTest {
        val stores = Stores(store())
        val actor = ActorKey.generate()
        val pre = actor.preSign(decodeProposal(proposalOf(actor)))
        stores.signIn("account-a")
        stores.identity.saveHandshake("w1", pre)

        stores.signIn("account-b")
        assertThat(stores.identity.handshakeIds()).isEmpty()
        assertThat(stores.identity.handshake("w1")).isNull()

        stores.signIn("account-a")
        assertThat(stores.identity.handshakeIds()).containsExactly("w1")
    }

    /**
     * Adopt-on-sign-in (auth.md "Multi-account device custody"): the
     * flat records of a pre-multi-account build belong to the first
     * account that signs in after the update — once.
     */
    @Test
    fun legacyRecordsAreAdoptedByTheFirstSignedInAccount() = runTest {
        val encrypted = store()
        val seed = ActorKey.generate().seed()
        // A pre-multi-account build left flat records behind.
        encrypted.put("actor_seed", seed)
        encrypted.put("pending_backup_blob", byteArrayOf(7))
        encrypted.put("reciprocation_dismissed", byteArrayOf(1))

        val stores = Stores(encrypted)
        stores.signIn("account-a")
        assertThat(stores.identity.actorSeed()).isEqualTo(seed)
        assertThat(stores.identity.pendingBackupBlob()).isEqualTo(byteArrayOf(7))
        assertThat(stores.identity.reciprocationDismissed()).isTrue()

        // One-shot: the move consumed the flat records, so a second
        // account adopts nothing.
        stores.signIn("account-b")
        assertThat(stores.identity.actorSeed()).isNull()
        assertThat(stores.identity.pendingBackupBlob()).isNull()
        assertThat(stores.identity.reciprocationDismissed()).isFalse()

        stores.signIn("account-a")
        assertThat(stores.identity.actorSeed()).isEqualTo(seed)
    }

    @Test
    fun aLegacySeedIsConsumedByAWriteToo() = runTest {
        val encrypted = store()
        encrypted.put("actor_seed", ActorKey.generate().seed())

        val stores = Stores(encrypted)
        stores.signIn("account-a")
        // The ceremony overwrites without reading first; the legacy
        // record must still be consumed, not left for a later account.
        val fresh = ActorKey.generate().seed()
        stores.identity.saveActorSeed(fresh)
        assertThat(stores.identity.actorSeed()).isEqualTo(fresh)

        stores.signIn("account-b")
        assertThat(stores.identity.actorSeed()).isNull()
    }

    @Test
    fun legacyHandshakesAreAdoptedAsASet() = runTest {
        val encrypted = store()
        val actor = ActorKey.generate()
        val pre = actor.preSign(decodeProposal(proposalOf(actor)))
        // Seed the legacy records through a store wired to the flat
        // keys' shape: sign in, save, then strip the scoping by hand.
        run {
            val seeding = Stores(encrypted)
            seeding.signIn("seeder")
            seeding.identity.saveHandshake("w1", pre)
            seeding.identity.saveHandshake("w2", pre)
            for (name in encrypted.names("acct:seeder:handshake:")) {
                val bytes = checkNotNull(encrypted.get(name))
                encrypted.put(name.removePrefix("acct:seeder:"), bytes)
                encrypted.remove(name)
            }
        }

        val stores = Stores(encrypted)
        stores.signIn("account-a")
        assertThat(stores.identity.handshakeIds()).containsExactly("w1", "w2")
        assertThat(stores.identity.handshake("w1")).isNotNull()

        stores.signIn("account-b")
        assertThat(stores.identity.handshakeIds()).isEmpty()
    }
}
