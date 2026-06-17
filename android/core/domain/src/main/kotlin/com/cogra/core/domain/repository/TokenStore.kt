package com.cogra.core.domain.repository

import com.cogra.core.domain.model.AuthTokens
import kotlinx.coroutines.flow.Flow

/**
 * Persistence for the session token pair. The interface lives in the pure
 * domain module so use-cases and tests depend on the contract, not on the
 * encrypted Android-backed implementation in `core:network`.
 */
interface TokenStore {
    /** Emits the current token pair, or null when logged out. Observed by the
     *  app to drive login <-> profile navigation. */
    val tokens: Flow<AuthTokens?>

    suspend fun current(): AuthTokens?

    suspend fun save(tokens: AuthTokens)

    suspend fun clear()
}
