package com.cogra.core.media

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import com.cogra.domain.CograLog
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowMediaMetadataRetriever
import org.robolectric.shadows.util.DataSource
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.coroutines.CoroutineContext

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class AndroidVideoProcessorTest {

    private val lines = CopyOnWriteArrayList<String>()

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        CograLog.uninstall()
        ShadowMediaMetadataRetriever.reset()
    }

    /**
     * The export hops to the main dispatcher, which is where a caller that
     * leaves (a closed composer, a replaced pick) cancels it. Here that hop is
     * held open so the cancellation lands exactly there, and the log records
     * whether the processor mistook it for a fault.
     */
    @Test
    fun aCancelledTranscodePropagatesInsteadOfBeingLoggedAsAFault() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val uri = Uri.parse("file:///clip.mp4")
        val source = DataSource.toDataSource(context, uri)
        ShadowMediaMetadataRetriever.addMetadata(source, MediaMetadataRetriever.METADATA_KEY_DURATION, "4000")
        ShadowMediaMetadataRetriever.addMetadata(source, MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH, "1080")
        ShadowMediaMetadataRetriever.addMetadata(source, MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT, "1920")
        CograLog.install { _, message, _ -> lines += message }

        val held = CompletableDeferred<Runnable>()
        Dispatchers.setMain(
            object : CoroutineDispatcher() {
                override fun dispatch(context: CoroutineContext, block: Runnable) {
                    held.complete(block)
                }
            },
        )

        val transcode = async(Dispatchers.Default) {
            AndroidVideoProcessor(context).transcode(uri.toString(), capBytes = 50_000_000L) {}
        }
        val export = held.await()
        transcode.cancel()
        // The held hop runs now, finds its job cancelled, and resumes the
        // export with the cancellation.
        export.run()

        val failure = runCatching { transcode.await() }.exceptionOrNull()
        assertThat(failure).isInstanceOf(CancellationException::class.java)
        assertThat(lines).isEmpty()
    }
}
