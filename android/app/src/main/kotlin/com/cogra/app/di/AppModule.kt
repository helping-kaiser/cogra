// Build-specific bindings the shell owns (android/CLAUDE.md "Module
// discipline"): the GraphQL endpoint comes from the build config
// (`cogra.graphqlUrl`), and the platform-flavored values core:domain
// declares as qualifiers — the app-lifetime scope, the device label —
// are provided here.

package com.cogra.app.di

import android.os.Build
import com.cogra.app.BuildConfig
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.di.DeviceLabel
import com.cogra.domain.di.WebOrigin
import com.cogra.network.di.GraphqlEndpoint
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @GraphqlEndpoint
    fun graphqlEndpoint(): String = BuildConfig.GRAPHQL_URL

    @Provides
    @WebOrigin
    fun webOrigin(): String = BuildConfig.WEB_ORIGIN

    /**
     * The app-lifetime scope (the documented external-scope pattern:
     * a SupervisorJob so one failed child never kills the rest).
     */
    @Provides
    @Singleton
    @ApplicationScope
    fun applicationScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Provides
    @DeviceLabel
    fun deviceLabel(): String? = Build.MODEL
}
