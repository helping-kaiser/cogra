package com.cogra.core.network.token

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import com.cogra.core.domain.model.AuthTokens
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** Reversible stand-in for the Keystore-backed crypto, so the persistence
 *  logic is exercised without an Android Keystore. The "enc:" prefix lets the
 *  test assert values are actually run through encryption before storage. */
private class FakeCrypto : Crypto {
    override fun encrypt(plaintext: String) = "enc:$plaintext"
    override fun decrypt(ciphertext: String) = ciphertext.removePrefix("enc:")
}

class EncryptedTokenStoreTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var scope: CoroutineScope
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var store: EncryptedTokenStore

    private val tokens = AuthTokens(accessToken = "access-1", refreshToken = "refresh-1")

    @Before
    fun setUp() {
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
        dataStore = PreferenceDataStoreFactory.create(scope = scope) {
            tempFolder.newFile("tokens.preferences_pb")
        }
        store = EncryptedTokenStore(dataStore, FakeCrypto())
    }

    @After
    fun tearDown() {
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
    }

    @Test
    fun `current is null before anything is saved`() = runTest {
        assertThat(store.current()).isNull()
    }

    @Test
    fun `save then current round-trips the pair`() = runTest {
        store.save(tokens)
        assertThat(store.current()).isEqualTo(tokens)
    }

    @Test
    fun `values are encrypted at rest`() = runTest {
        store.save(tokens)

        val raw = dataStore.data.first()[stringPreferencesKey("access_token")]
        assertThat(raw).isEqualTo("enc:access-1")
    }

    @Test
    fun `clear removes the pair`() = runTest {
        store.save(tokens)
        store.clear()
        assertThat(store.current()).isNull()
    }

    @Test
    fun `tokens flow reflects save then clear`() = runTest {
        assertThat(store.tokens.first()).isNull()
        store.save(tokens)
        assertThat(store.tokens.first()).isEqualTo(tokens)
        store.clear()
        assertThat(store.tokens.first()).isNull()
    }
}
