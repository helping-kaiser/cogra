// The at-rest encryption layer: values sealed by a Tink AEAD whose
// master key lives in the Android Keystore, persisted as base64 strings
// in a Preferences DataStore (android/CLAUDE.md "Auth / tokens").
// Crypto rides behind [StoreCipher] so every store tests with a fake;
// the Keystore-backed path is device-only by nature and carries only
// the hand test.

package com.cogra.network.store

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import java.io.IOException
import java.security.GeneralSecurityException
import java.util.Base64
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/** Seals and opens store values; the fake in tests, Tink in production. */
interface StoreCipher {
    fun seal(plaintext: ByteArray): ByteArray

    fun open(sealed: ByteArray): ByteArray
}

/**
 * The production cipher: an AES-256-GCM Tink keyset wrapped by an
 * Android-Keystore master key, per Tink's documented Android
 * integration.
 */
class TinkStoreCipher(private val context: Context) : StoreCipher {
    private val aead: Aead by lazy {
        AeadConfig.register()
        AndroidKeysetManager.Builder()
            .withSharedPref(context, "cogra_keyset", "cogra_keyset_prefs")
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://cogra_master_key")
            .build()
            .keysetHandle
            .getPrimitive(Aead::class.java)
    }

    override fun seal(plaintext: ByteArray): ByteArray = aead.encrypt(plaintext, EMPTY_AAD)

    override fun open(sealed: ByteArray): ByteArray = aead.decrypt(sealed, EMPTY_AAD)

    private companion object {
        val EMPTY_AAD = ByteArray(0)
    }
}

/**
 * What one named value reads as. Absent and unopenable are the same
 * thing to most callers — [EncryptedStore.get] collapses them — and a
 * different thing to a caller whose fallback is acting as somebody
 * else: the session read tells them apart.
 */
sealed interface StoredValue {
    class Present(val bytes: ByteArray) : StoredValue

    data object Absent : StoredValue

    data object Unreadable : StoredValue
}

/** Named encrypted values over one Preferences DataStore. */
class EncryptedStore(
    private val dataStore: DataStore<Preferences>,
    private val cipher: StoreCipher,
) {
    suspend fun put(name: String, value: ByteArray) {
        val sealed = Base64.getEncoder().encodeToString(cipher.seal(value))
        dataStore.edit { it[stringPreferencesKey(name)] = sealed }
    }

    /**
     * The value, or null for either "not there" and "could not be
     * opened" — the read for callers who treat the two alike.
     *
     * Like every read here it suspends until the DataStore has finished
     * its first load: the store answers what it holds, never "nothing
     * yet".
     */
    suspend fun get(name: String): ByteArray? = (read(name) as? StoredValue.Present)?.bytes

    /** The same read, keeping absent and unopenable apart. */
    suspend fun read(name: String): StoredValue = openOrMark(dataStore.data.first(), name)

    suspend fun remove(name: String) {
        dataStore.edit { it.remove(stringPreferencesKey(name)) }
    }

    fun watch(name: String): Flow<ByteArray?> = dataStore.data.map { prefs ->
        (openOrMark(prefs, name) as? StoredValue.Present)?.bytes
    }

    /**
     * A value that cannot be opened (master-key loss, tampering) is
     * never fatal here: the ciphertext stays in place in case the
     * failure is transient, and the loss is marked for the shell to
     * surface ([markStorageLost]). What the caller does with the
     * failure is the caller's own call.
     */
    private suspend fun openOrMark(prefs: Preferences, name: String): StoredValue {
        val sealed = prefs[stringPreferencesKey(name)] ?: return StoredValue.Absent
        return try {
            StoredValue.Present(cipher.open(Base64.getDecoder().decode(sealed)))
        } catch (_: GeneralSecurityException) {
            markStorageLost()
            StoredValue.Unreadable
        } catch (_: IOException) {
            markStorageLost()
            StoredValue.Unreadable
        } catch (_: IllegalArgumentException) {
            markStorageLost()
            StoredValue.Unreadable
        }
    }

    /** Also the domain stores' mark for a value that decodes to garbage. */
    suspend fun markStorageLost() {
        dataStore.edit { if (it[STORAGE_LOST_KEY] != true) it[STORAGE_LOST_KEY] = true }
    }

    suspend fun names(prefix: String): Set<String> =
        dataStore.data.first().asMap().keys
            .map { it.name }
            .filter { it.startsWith(prefix) }
            .toSet()
}
