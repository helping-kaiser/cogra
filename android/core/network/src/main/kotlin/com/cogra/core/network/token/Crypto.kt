package com.cogra.core.network.token

import android.content.Context
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import java.util.Base64

/**
 * Symmetric encryption for the token store. Kept behind an interface so the
 * persistence logic in [EncryptedTokenStore] is unit-testable with a fake,
 * while the real, Keystore-backed implementation runs only where an Android
 * Keystore exists (device / emulator).
 */
interface Crypto {
    fun encrypt(plaintext: String): String

    fun decrypt(ciphertext: String): String
}

/**
 * Tink AEAD whose keyset is wrapped by an Android-Keystore master key, so the
 * token-encryption key never leaves hardware-backed storage. Replaces the
 * deprecated EncryptedSharedPreferences path.
 */
class TinkCrypto(context: Context) : Crypto {

    private val aead: Aead

    init {
        AeadConfig.register()
        val keysetHandle = AndroidKeysetManager.Builder()
            .withSharedPref(context, KEYSET_NAME, KEYSET_PREFS_FILE)
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri(MASTER_KEY_URI)
            .build()
            .keysetHandle
        aead = keysetHandle.getPrimitive(Aead::class.java)
    }

    override fun encrypt(plaintext: String): String {
        val ciphertext = aead.encrypt(plaintext.toByteArray(Charsets.UTF_8), ASSOCIATED_DATA)
        return Base64.getEncoder().encodeToString(ciphertext)
    }

    override fun decrypt(ciphertext: String): String {
        val decoded = Base64.getDecoder().decode(ciphertext)
        return String(aead.decrypt(decoded, ASSOCIATED_DATA), Charsets.UTF_8)
    }

    private companion object {
        const val KEYSET_NAME = "cogra_token_keyset"
        const val KEYSET_PREFS_FILE = "cogra_token_keyset_prefs"
        const val MASTER_KEY_URI = "android-keystore://cogra_token_master_key"
        val ASSOCIATED_DATA = "cogra.tokens".toByteArray(Charsets.UTF_8)
    }
}
