// Build-specific bindings the shell owns (android/CLAUDE.md "Module
// discipline"): the GraphQL endpoint comes from the build config
// (`cogra.graphqlUrl`).

package com.cogra.app.di

import com.cogra.app.BuildConfig
import com.cogra.domain.di.WebOrigin
import com.cogra.network.di.GraphqlEndpoint
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @GraphqlEndpoint
    fun graphqlEndpoint(): String = BuildConfig.GRAPHQL_URL

    @Provides
    @WebOrigin
    fun webOrigin(): String = BuildConfig.WEB_ORIGIN
}
