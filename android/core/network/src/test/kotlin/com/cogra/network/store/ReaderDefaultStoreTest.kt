// The reader's feed default on the device (SettingsReading.md: "ALWAYS the
// reader's saved default stays on this device"; "ALWAYS every feed opens with
// the reader's saved default"): per account, sealed, round-tripped axis for
// axis, never holding a topic, followed across a sign-in, and erased with the
// rest of the device's data.

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.domain.AuthTokens
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedForm
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.feed.ReaderDefaults
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
private class ShiftCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray = byteArrayOf(0x3C) + plaintext.map { (it + 1).toByte() }

    override fun open(sealed: ByteArray): ByteArray {
        check(sealed[0] == 0x3C.toByte()) { "not sealed by this cipher" }
        return sealed.drop(1).map { (it - 1).toByte() }.toByteArray()
    }
}

class ReaderDefaultStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val store: EncryptedStore by lazy {
        val file = File(tmp.newFolder(), "test.preferences_pb")
        EncryptedStore(PreferenceDataStoreFactory.create(scope = scope) { file }, ShiftCipher())
    }

    private val tokens by lazy { TokenStoreImpl(store) }

    private val defaults by lazy { ReaderDefaults(ReaderDefaultStoreImpl(store), tokens) }

    private val far = FeedFilter(
        kinds = setOf(FeedKind.POST, FeedKind.TAG),
        topic = FeedTopic("t", "saltmaps"),
        forms = setOf(FeedForm.PHOTOS),
        order = FeedOrder.NEWEST,
        people = PeopleScope.YOUR_PEOPLE,
        peopleSign = PeopleSign.AGAINST,
        showSeen = true,
        showSensitive = true,
        showRemoved = true,
        stillSettling = false,
    )

    @After
    fun tearDown() {
        scope.cancel()
    }

    private suspend fun signIn(account: String) = tokens.save(AuthTokens("a-$account", "r-$account", account))

    @Test
    fun aReaderWhoSetNoneReadsCoGrasOwn() = runTest {
        assertThat(defaults.now()).isEqualTo(FeedFilter.DEFAULT)
        signIn("u1")
        assertThat(defaults.now()).isEqualTo(FeedFilter.DEFAULT)
    }

    @Test
    fun aSavedDefaultRoundTripsEveryAxisAndNeverHoldsATopic() = runTest {
        signIn("u1")
        defaults.save(far)
        assertThat(defaults.now()).isEqualTo(far.copy(topic = null))
    }

    @Test
    fun eachAccountKeepsItsOwnAndASignInBringsIt() = runTest {
        signIn("u1")
        defaults.save(far)
        signIn("u2")
        assertThat(defaults.current.first()).isEqualTo(FeedFilter.DEFAULT)
        signIn("u1")
        assertThat(defaults.current.first()).isEqualTo(far.copy(topic = null))
    }

    @Test
    fun aGuestKeepsNothing() = runTest {
        defaults.save(far)
        assertThat(store.names("feed_default:")).isEmpty()
        assertThat(defaults.now()).isEqualTo(FeedFilter.DEFAULT)
    }

    @Test
    fun theDefaultIsSealedAtRestAndAnUnreadableValueIsNone() = runTest {
        signIn("u1")
        defaults.save(far)
        assertThat(store.names("feed_default:")).containsExactly("feed_default:u1")
        store.put("feed_default:u1", "not json".encodeToByteArray())
        assertThat(defaults.now()).isEqualTo(FeedFilter.DEFAULT)
    }

    // FeedSheet.md, round 25: a Done's filter lasts on this device, topic and all,
    // per account and the guest's apart, and never as the saved default.
    @Test
    fun aCommittedFilterRoundTripsWithItsTopicPerAccountAndApartFromTheDefault() = runTest {
        val committed = CommittedFilterStoreImpl(store)
        signIn("u1")
        committed.commit("u1", far)
        committed.commit(null, FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST))
        assertThat(committed.committed("u1")).isEqualTo(far)
        assertThat(committed.committed(null)).isEqualTo(FeedFilter.DEFAULT.copy(order = FeedOrder.NEWEST))
        assertThat(committed.committed("u2")).isNull()
        assertThat(defaults.now()).isEqualTo(FeedFilter.DEFAULT)
        assertThat(store.names("feed_filter:")).containsExactly("feed_filter:u1", "feed_filter:guest")
        committed.forget("u1")
        assertThat(committed.committed("u1")).isNull()
        DeviceDataImpl(store).eraseEverything()
        assertThat(store.names("feed_filter:")).isEmpty()
    }

    @Test
    fun eraseEverythingTakesTheDefault() = runTest {
        signIn("u1")
        defaults.save(far)
        DeviceDataImpl(store).eraseEverything()
        assertThat(store.names("feed_default:")).isEmpty()
    }
}
