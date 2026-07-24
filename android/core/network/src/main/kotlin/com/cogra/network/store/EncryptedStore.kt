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

/** Named encrypted values over one Preferences DataStore. */
class EncryptedStore(
    private val dataStore: DataStore<Preferences>,
    private val cipher: StoreCipher,
) {
    suspend fun put(name: String, value: ByteArray) {
        val sealed = Base64.getEncoder().encodeToString(cipher.seal(value))
        dataStore.edit { it[stringPreferencesKey(name)] = sealed }
    }

    suspend fun get(name: String): ByteArray? =
        dataStore.data.first()[stringPreferencesKey(name)]?.let { cipher.open(Base64.getDecoder().decode(it)) }

    suspend fun remove(name: String) {
        dataStore.edit { it.remove(stringPreferencesKey(name)) }
    }

    fun watch(name: String): Flow<ByteArray?> = dataStore.data.map { prefs ->
        prefs[stringPreferencesKey(name)]?.let { cipher.open(Base64.getDecoder().decode(it)) }
    }

    suspend fun names(prefix: String): Set<String> =
        dataStore.data.first().asMap().keys
            .map { it.name }
            .filter { it.startsWith(prefix) }
            .toSet()
}
