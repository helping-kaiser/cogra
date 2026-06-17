package com.cogra.app.di

import com.cogra.app.BuildConfig
import com.cogra.core.network.di.GraphQlUrl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** App-level bindings: the build supplies the environment-specific GraphQL
 *  endpoint that `core:network` consumes. */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    @GraphQlUrl
    fun provideGraphQlUrl(): String = BuildConfig.GRAPHQL_URL
}
