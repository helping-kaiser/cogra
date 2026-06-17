package com.cogra.core.network.token

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.repository.TokenStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Persists the token pair in DataStore with each value encrypted by [crypto].
 * Both tokens are written and cleared together, so [tokens] never emits a
 * half-populated pair (the access token without its refresh token or vice
 * versa).
 */
class EncryptedTokenStore(
    private val dataStore: DataStore<Preferences>,
    private val crypto: Crypto,
) : TokenStore {

    override val tokens: Flow<AuthTokens?> = dataStore.data.map { prefs ->
        val access = prefs[ACCESS_KEY]?.let(crypto::decrypt)
        val refresh = prefs[REFRESH_KEY]?.let(crypto::decrypt)
        if (access != null && refresh != null) AuthTokens(access, refresh) else null
    }

    override suspend fun current(): AuthTokens? = tokens.first()

    override suspend fun save(tokens: AuthTokens) {
        dataStore.edit { prefs ->
            prefs[ACCESS_KEY] = crypto.encrypt(tokens.accessToken)
            prefs[REFRESH_KEY] = crypto.encrypt(tokens.refreshToken)
        }
    }

    override suspend fun clear() {
        dataStore.edit { prefs ->
            prefs.remove(ACCESS_KEY)
            prefs.remove(REFRESH_KEY)
        }
    }

    private companion object {
        val ACCESS_KEY = stringPreferencesKey("access_token")
        val REFRESH_KEY = stringPreferencesKey("refresh_token")
    }
}
