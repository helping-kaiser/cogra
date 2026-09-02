// Build-specific bindings the shell owns (android/CLAUDE.md "Module
// discipline").

package com.cogra.app.di

import android.content.Context
import com.cogra.app.BuildConfig
import com.cogra.core.media.AndroidMediaProcessor
import com.cogra.core.media.MediaStoreMediaSource
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.media.DeviceMediaSource
import com.cogra.domain.media.MediaProcessor
import com.cogra.network.di.GraphqlEndpoint
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
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

    /**
     * The on-device image pipeline (D11, D17).
     *
     * The binding lives here rather than in `core:media` so that module
     * stays a plain library — Bitmap, ExifInterface and nothing else —
     * which is what its own docstring promises and what keeps a DI
     * graph out of the one place the pixels are handled.
     */
    @Provides
    @Singleton
    fun mediaProcessor(@ApplicationContext context: Context): MediaProcessor =
        AndroidMediaProcessor(context.contentResolver)

    /** `ComposePick`'s own grid of the device's newest pictures and clips. */
    @Provides
    @Singleton
    fun deviceMedia(@ApplicationContext context: Context): DeviceMediaSource =
        MediaStoreMediaSource(context.contentResolver)
}
