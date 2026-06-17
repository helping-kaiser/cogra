package com.cogra.core.network.testutil

import com.cogra.core.domain.model.AuthTokens
import com.cogra.core.domain.repository.TokenStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Minimal in-memory [TokenStore] for network-layer tests. */
class InMemoryTokenStore(initial: AuthTokens? = null) : TokenStore {
    private val state = MutableStateFlow(initial)

    override val tokens: Flow<AuthTokens?> = state.asStateFlow()

    override suspend fun current(): AuthTokens? = state.value

    override suspend fun save(tokens: AuthTokens) {
        state.value = tokens
    }

    override suspend fun clear() {
        state.value = null
    }
}
