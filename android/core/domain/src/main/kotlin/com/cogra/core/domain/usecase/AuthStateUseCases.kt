package com.cogra.core.domain.usecase

import com.cogra.core.domain.repository.TokenStore
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Observes whether a session is stored, driving the top-level login <->
 * profile navigation. Token *validity* is not checked here — an expired access
 * token is handled by the refresh flow in the network layer; this only asks
 * whether the client currently holds a session at all.
 */
class ObserveAuthStateUseCase @Inject constructor(
    private val tokenStore: TokenStore,
) {
    operator fun invoke(): Flow<Boolean> = tokenStore.tokens.map { it != null }
}

/**
 * Client-side logout: drops the stored tokens. Slice 1 has no server-side
 * session-revocation mutation yet, so this only clears local state.
 */
class LogOutUseCase @Inject constructor(
    private val tokenStore: TokenStore,
) {
    suspend operator fun invoke() = tokenStore.clear()
}
