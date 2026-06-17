package com.cogra.core.network.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStoreFile
import com.apollographql.apollo.ApolloClient
import com.cogra.core.domain.repository.AuthRepository
import com.cogra.core.domain.repository.TokenStore
import com.cogra.core.network.AuthRepositoryImpl
import com.cogra.core.network.auth.ApolloTokenRefresher
import com.cogra.core.network.auth.AuthorizationInterceptor
import com.cogra.core.network.auth.TokenRefreshInterceptor
import com.cogra.core.network.auth.TokenRefresher
import com.cogra.core.network.token.Crypto
import com.cogra.core.network.token.EncryptedTokenStore
import com.cogra.core.network.token.TinkCrypto
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton

/** The GraphQL endpoint URL, supplied by the app module (it varies by build). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class GraphQlUrl

/** A bare Apollo client with no auth/refresh interceptors, used only by the
 *  token refresher so a refresh never recurses through them. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class RefreshApollo

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideTokenDataStore(
        @ApplicationContext context: Context,
    ): DataStore<Preferences> =
        PreferenceDataStoreFactory.create {
            context.preferencesDataStoreFile("cogra_tokens")
        }

    @Provides
    @Singleton
    fun provideCrypto(@ApplicationContext context: Context): Crypto = TinkCrypto(context)

    @Provides
    @Singleton
    fun provideTokenStore(
        dataStore: DataStore<Preferences>,
        crypto: Crypto,
    ): TokenStore = EncryptedTokenStore(dataStore, crypto)

    @Provides
    @Singleton
    @RefreshApollo
    fun provideRefreshApolloClient(@GraphQlUrl url: String): ApolloClient =
        ApolloClient.Builder().serverUrl(url).build()

    @Provides
    @Singleton
    fun provideTokenRefresher(
        @RefreshApollo refreshClient: ApolloClient,
        tokenStore: TokenStore,
    ): TokenRefresher = ApolloTokenRefresher(refreshClient, tokenStore)

    @Provides
    @Singleton
    fun provideApolloClient(
        @GraphQlUrl url: String,
        tokenStore: TokenStore,
        refresher: TokenRefresher,
    ): ApolloClient =
        ApolloClient.Builder()
            .serverUrl(url)
            // Refresh is added first so it sits outermost: on a 401 it refreshes
            // and replays the request back through the authorization interceptor,
            // which then attaches the rotated token.
            .addInterceptor(TokenRefreshInterceptor(tokenStore, refresher))
            .addInterceptor(AuthorizationInterceptor(tokenStore))
            .build()

    @Provides
    @Singleton
    fun provideAuthRepository(apolloClient: ApolloClient): AuthRepository =
        AuthRepositoryImpl(apolloClient)
}
