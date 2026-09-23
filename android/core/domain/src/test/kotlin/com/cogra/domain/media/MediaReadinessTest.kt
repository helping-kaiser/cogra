package com.cogra.domain.media

import com.cogra.domain.ErrorCode
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetState
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test

/**
 * `awaitReady`, the gate's own backstop: whether a PROCESSING asset is
 * waited out until it settles, and — the point of the whole thing —
 * whether a READY asset costs nothing extra to answer.
 */
private class ScriptedMediaRepository : MediaRepository {
    /** Each call to `mediaAttachment` pops the next scripted answer. */
    val answers = ArrayDeque<Outcome<MediaReadiness?>>()
    var calls = 0

    override suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView> =
        throw UnsupportedOperationException()

    override suspend fun uploadVideo(
        video: ProcessedVideo,
        destination: MediaDestination,
        onProgress: (UploadProgress) -> Unit,
    ): Outcome<MediaAssetView> = throw UnsupportedOperationException()

    override suspend fun abortUpload(uploadId: String) = Unit

    override suspend fun mediaAttachment(id: String): Outcome<MediaReadiness?> {
        calls += 1
        return answers.removeFirstOrNull() ?: error("mediaAttachment asked for more than scripted")
    }
}

private fun asset(state: MediaAssetState, failureReason: String? = null) = MediaAssetView(
    id = "m1",
    url = "https://media/m1",
    altText = null,
    status = FieldStatus.NORMAL,
    aspectRatio = 1f,
    state = state,
    failureReason = failureReason,
)

class MediaReadinessTest {

    /**
     * THE SHIPPED PATH: Android's own uploads are always within target,
     * so the asset the mutation answers with is already READY — and this
     * is the one behaviour the whole feature is not allowed to cost
     * anything extra for.
     */
    @Test
    fun readyAnswersAtOnceWithNoPollAtAll() = runTest {
        val repo = ScriptedMediaRepository()

        val outcome = repo.awaitReady(Outcome.Success(asset(MediaAssetState.READY)))

        assertThat(outcome).isEqualTo(Outcome.Success(asset(MediaAssetState.READY)))
        assertThat(repo.calls).isEqualTo(0)
    }

    /** A business refusal or a transport fault from the upload itself never reaches the poll. */
    @Test
    fun aNonSuccessUploadNeverPolls() = runTest {
        val repo = ScriptedMediaRepository()
        val refused = Outcome.Refused(listOf(UserError(ErrorCode.BAD_INPUT, "too big")))

        val outcome = repo.awaitReady(refused)

        assertThat(outcome).isEqualTo(refused)
        assertThat(repo.calls).isEqualTo(0)
    }

    /** THE BACKSTOP: a PROCESSING asset is polled, the way `stagedWrite` is, until it settles. */
    @Test
    fun processingPollsUntilReady() = runTest {
        val repo = ScriptedMediaRepository().apply {
            answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.PROCESSING, null))
            answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.PROCESSING, null))
            answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.READY, null))
        }

        val outcome = repo.awaitReady(Outcome.Success(asset(MediaAssetState.PROCESSING)))

        assertThat((outcome as Outcome.Success).value.state).isEqualTo(MediaAssetState.READY)
        assertThat(repo.calls).isEqualTo(3)
    }

    /** A PROCESSING asset that settles FAILED carries the reason back — never a retry-shaped answer. */
    @Test
    fun processingPollsUntilFailedAndCarriesTheReason() = runTest {
        val repo = ScriptedMediaRepository().apply {
            answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.PROCESSING, null))
            answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.FAILED, "not H.264"))
        }

        val outcome = repo.awaitReady(Outcome.Success(asset(MediaAssetState.PROCESSING)))

        val settled = (outcome as Outcome.Success).value
        assertThat(settled.state).isEqualTo(MediaAssetState.FAILED)
        assertThat(settled.failureReason).isEqualTo("not H.264")
    }

    /** A refusal or a fault from the poll itself ends the wait the same way it would end anything else. */
    @Test
    fun aFaultedPollEndsTheWaitAsAFailure() = runTest {
        val repo = ScriptedMediaRepository().apply {
            answers += Outcome.Failed(java.io.IOException("dropped"))
        }

        val outcome = repo.awaitReady(Outcome.Success(asset(MediaAssetState.PROCESSING)))

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
    }

    /**
     * NO ATTEMPT CAP: a real transcode legitimately takes minutes, and the
     * SERVER bounds how long an asset stays PROCESSING (the ingest worker
     * gives it at most three lease-reclaimed attempts before marking the
     * row FAILED), so the client keeps polling rather than guessing a
     * budget of its own. A long run of PROCESSING answers is still
     * outlived — every one of them, not just the first few.
     */
    @Test
    fun aLongRunOfProcessingAnswersIsOutlivedRatherThanCapped() = runTest {
        val repo = ScriptedMediaRepository().apply {
            repeat(200) {
                answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.PROCESSING, null))
            }
            answers += Outcome.Success(MediaReadiness("m1", MediaAssetState.READY, null))
        }

        val outcome = repo.awaitReady(Outcome.Success(asset(MediaAssetState.PROCESSING)))

        assertThat((outcome as Outcome.Success).value.state).isEqualTo(MediaAssetState.READY)
        assertThat(repo.calls).isEqualTo(201)
    }
}
