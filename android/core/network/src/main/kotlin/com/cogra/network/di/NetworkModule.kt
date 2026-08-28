// The module's Hilt wiring: the Apollo client (endpoint supplied by the
// app module via the qualifier), the encrypted DataStore layer, and the
// repository/store bindings for core:domain's interfaces.

package com.cogra.network.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStoreFile
import com.apollographql.apollo.ApolloClient
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.repo.AccountRepository
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ProfileRepository
import com.cogra.domain.repo.OnboardingRepository
import com.cogra.domain.repo.SessionRepository
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.StorageHealth
import com.cogra.domain.store.TokenStore
import com.cogra.network.auth.BearerInterceptor
import com.cogra.network.repo.AccountRepositoryImpl
import com.cogra.network.repo.ContentRepositoryImpl
import com.cogra.network.repo.MediaRepositoryImpl
import com.cogra.network.repo.ProfileRepositoryImpl
import com.cogra.network.repo.OnboardingRepositoryImpl
import com.cogra.network.repo.SessionRepositoryImpl
import com.cogra.network.repo.StanceRepositoryImpl
import com.cogra.network.repo.ReferenceRepositoryImpl
import com.cogra.network.repo.TopicRepositoryImpl
import com.cogra.network.repo.WriteRepositoryImpl
import com.cogra.network.store.EncryptedStore
import com.cogra.network.store.IdentityStoreImpl
import com.cogra.network.store.StorageHealthImpl
import com.cogra.network.store.StoreCipher
import com.cogra.network.store.TinkStoreCipher
import com.cogra.network.store.TokenStoreImpl
import com.cogra.network.store.secureDataStore
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton

/** The GraphQL endpoint URL — provided by the app module (build config). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class GraphqlEndpoint

@Module
@InstallIn(SingletonComponent::class)
internal object NetworkProvidesModule {

    @Provides
    @Singleton
    fun apolloClient(@GraphqlEndpoint endpoint: String, tokens: TokenStore): ApolloClient =
        ApolloClient.Builder()
            .serverUrl(endpoint)
            .addHttpInterceptor(BearerInterceptor(tokens))
            .build()

    @Provides
    @Singleton
    fun dataStore(@ApplicationContext context: Context): DataStore<Preferences> =
        secureDataStore {
            context.preferencesDataStoreFile("cogra_secure")
        }

    @Provides
    @Singleton
    fun storeCipher(@ApplicationContext context: Context): StoreCipher = TinkStoreCipher(context)

    @Provides
    @Singleton
    fun encryptedStore(dataStore: DataStore<Preferences>, cipher: StoreCipher): EncryptedStore =
        EncryptedStore(dataStore, cipher)
}

// Public, not internal: test code replaces this module wholesale via
// @TestInstallIn, which needs to name the class.
@Module
@InstallIn(SingletonComponent::class)
abstract class NetworkBindsModule {

    @Binds
    abstract fun tokenStore(impl: TokenStoreImpl): TokenStore

    @Binds
    abstract fun identityStore(impl: IdentityStoreImpl): IdentityStore

    @Binds
    abstract fun storageHealth(impl: StorageHealthImpl): StorageHealth

    @Binds
    abstract fun onboardingRepository(impl: OnboardingRepositoryImpl): OnboardingRepository

    @Binds
    abstract fun sessionRepository(impl: SessionRepositoryImpl): SessionRepository

    @Binds
    abstract fun writeRepository(impl: WriteRepositoryImpl): WriteRepository

    @Binds
    abstract fun accountRepository(impl: AccountRepositoryImpl): AccountRepository

    @Binds
    abstract fun contentRepository(impl: ContentRepositoryImpl): ContentRepository

    @Binds
    abstract fun profileRepository(impl: ProfileRepositoryImpl): ProfileRepository

    @Binds
    abstract fun stanceRepository(impl: StanceRepositoryImpl): StanceRepository

    @Binds
    abstract fun topicRepository(impl: TopicRepositoryImpl): TopicRepository

    @Binds
    abstract fun referenceRepository(impl: ReferenceRepositoryImpl): ReferenceRepository

    @Binds
    abstract fun mediaRepository(impl: MediaRepositoryImpl): MediaRepository
}
