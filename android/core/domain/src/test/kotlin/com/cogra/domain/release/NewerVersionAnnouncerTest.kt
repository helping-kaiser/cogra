package com.cogra.domain.release

import com.cogra.domain.Outcome
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.time.Instant

class NewerVersionAnnouncerTest {

    private fun release(version: String) =
        Release(version, listOf("What $version brings"), "https://example.test/v$version", Instant.EPOCH)

    private val behind = listOf(release("0.1.3"), release("0.1.2"), release("0.1.1"))

    private class FakeRegistry(var answer: Outcome<List<Release>>) : ReleaseRegistry {
        var reads = 0
        var lastUntil: String? = null

        override suspend fun releases(until: String?): Outcome<List<Release>> {
            reads += 1
            lastUntil = until
            return answer
        }
    }

    /** The DataStore's stand-in: the device's last announced release. */
    private class FakeAnnounced(var value: String? = null) : AnnouncedReleaseStore {
        override suspend fun lastAnnounced(): String? = value

        override suspend fun markAnnounced(version: String) {
            value = version
        }
    }

    private fun announcer(
        registry: ReleaseRegistry = FakeRegistry(Outcome.Success(behind)),
        announced: AnnouncedReleaseStore = FakeAnnounced(),
        running: String = "0.1.2",
    ) = NewerVersionAnnouncer(registry, announced, RunningVersion(running))

    @Test
    fun theFirstFeedArrivalAnnouncesTheNewestReleaseAndMarksItWhenShown() = runTest {
        val announced = FakeAnnounced()
        val registry = FakeRegistry(Outcome.Success(behind))
        val subject = announcer(registry, announced)

        val release = subject.onFeedArrived()
        assertThat(release?.version).isEqualTo("0.1.3")
        assertThat(registry.lastUntil).isEqualTo("0.1.2")
        assertThat(announced.value).isNull()

        subject.onShown(checkNotNull(release))
        assertThat(announced.value).isEqualTo("0.1.3")
    }

    @Test
    fun everyLaterArrivalInTheSameProcessIsSilent() = runTest {
        val registry = FakeRegistry(Outcome.Success(behind))
        val subject = announcer(registry)
        assertThat(subject.onFeedArrived()).isNotNull()
        assertThat(subject.onFeedArrived()).isNull()
        assertThat(registry.reads).isEqualTo(1)
    }

    @Test
    fun aSecondColdOpenAfterTheAnnouncementIsSilent() = runTest {
        val announced = FakeAnnounced()
        val first = announcer(announced = announced)
        first.onShown(checkNotNull(first.onFeedArrived()))
        assertThat(announcer(announced = announced).onFeedArrived()).isNull()
    }

    @Test
    fun aNewerReleaseIsAnnouncedAgain() = runTest {
        val announced = FakeAnnounced("0.1.3")
        val newer = FakeRegistry(Outcome.Success(listOf(release("0.1.4")) + behind))
        assertThat(announcer(newer, announced).onFeedArrived()?.version).isEqualTo("0.1.4")
    }

    @Test
    fun aFailedReadIsSilentAndLeavesTheFlagForTheNextColdOpen() = runTest {
        val announced = FakeAnnounced()
        val failed = FakeRegistry(Outcome.Failed(IllegalStateException("offline")))
        assertThat(announcer(failed, announced).onFeedArrived()).isNull()
        assertThat(announced.value).isNull()
        assertThat(announcer(announced = announced).onFeedArrived()?.version).isEqualTo("0.1.3")
    }

    @Test
    fun anUnlistedRunningVersionAnnouncesNothing() = runTest {
        assertThat(announcer(running = "0.2.0-dev").onFeedArrived()).isNull()
    }

    @Test
    fun theNewestRunningVersionAnnouncesNothing() = runTest {
        assertThat(announcer(running = "0.1.3").onFeedArrived()).isNull()
    }
}
