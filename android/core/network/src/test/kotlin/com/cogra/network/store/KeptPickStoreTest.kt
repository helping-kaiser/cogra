// The kept picks at rest (PadKeyAbsent.md:31-:39): per account, sealed, one
// per target and family, kept in the order they were made, surviving a fresh
// store over the same file (a restart), and cleared with the draft by the
// explicit sign-out's purge.

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.domain.AuthTokens
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
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

/** Invertible and visibly not a no-op. */
private class FlipCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray = byteArrayOf(0x5A) + plaintext.map { (it + 3).toByte() }

    override fun open(sealed: ByteArray): ByteArray {
        check(sealed[0] == 0x5A.toByte()) { "not sealed by this cipher" }
        return sealed.drop(1).map { (it - 3).toByte() }.toByteArray()
    }
}

class KeptPickStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val file by lazy { File(tmp.newFolder(), "test.preferences_pb") }

    private val store: EncryptedStore by lazy {
        EncryptedStore(PreferenceDataStoreFactory.create(scope = scope) { file }, FlipCipher())
    }

    private val tokens by lazy { TokenStoreImpl(store) }

    private val kept by lazy { KeptPickStoreImpl(store, tokens).also { it.now = { 1_000L } } }

    private val post = StanceTarget.Node("post-1")
    private val topic = StanceTarget.Topic("saltmaps")

    @After
    fun tearDown() {
        scope.cancel()
    }

    private suspend fun signIn(account: String) = tokens.save(AuthTokens("a-$account", "r-$account", account))

    @Test
    fun nobodySignedInKeepsNothing() = runTest {
        kept.keep(post, StancePair(0.3, 0.2), KeptFamily.OPINION, StanceKind.POST)
        assertThat(kept.list()).isEmpty()
        assertThat(kept.watch().first()).isEmpty()
    }

    @Test
    fun aPickKeptOnTheSameTargetReplacesTheOldOneAndSeveralWaitInTheirOrder() = runTest {
        signIn("acct-1")
        kept.keep(post, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.POST)
        kept.keep(topic, StancePair(0.6, 0.35), KeptFamily.OPINION, StanceKind.TOPIC)
        kept.keep(post, StancePair(0.55, 0.2), KeptFamily.OPINION, StanceKind.POST)

        val picks = kept.list()
        assertThat(picks.map { it.target }).containsExactly(topic, post).inOrder()
        assertThat(picks.last().pick).isEqualTo(StancePair(0.55, 0.2))
        // Kept in the same millisecond, still strictly after.
        assertThat(picks.map { it.keptAt }).isStrictlyOrdered()
    }

    @Test
    fun aFamilyKeepsItsOwnPickBesideAnOpinionOnTheSameTarget() = runTest {
        signIn("acct-1")
        val person = StanceTarget.Node("user-1")
        kept.keep(person, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.PERSON)
        kept.keep(person, StancePair(0.3, 0.2), KeptFamily.VOUCH_BACK, StanceKind.PERSON)
        assertThat(kept.list().map { it.family }).containsExactly(KeptFamily.OPINION, KeptFamily.VOUCH_BACK)

        kept.drop(listOf(person), KeptFamily.VOUCH_BACK)
        assertThat(kept.list().map { it.family }).containsExactly(KeptFamily.OPINION)
    }

    @Test
    fun thePicksSurviveARestartSealedAndPerAccount() = runTest {
        signIn("acct-1")
        kept.keep(post, StancePair(-0.15, 0.15), KeptFamily.OPINION, null)

        // The value at rest is sealed, never the pair in the clear.
        val raw = file.readBytes().decodeToString()
        assertThat(raw).doesNotContain("post-1")

        val again = KeptPickStoreImpl(store, tokens)
        assertThat(again.list().single().pick).isEqualTo(StancePair(-0.15, 0.15))
        assertThat(again.list().single().kind).isNull()

        signIn("acct-2")
        assertThat(again.list()).isEmpty()
    }

    @Test
    fun theExplicitSignOutsPurgeClearsThePicksWithTheDraft() = runTest {
        signIn("acct-1")
        kept.keep(post, StancePair(0.1, 0.1), KeptFamily.OPINION, StanceKind.POST)
        IdentityStoreImpl(store, tokens).purgeCustodySet()
        assertThat(kept.list()).isEmpty()
    }
}
