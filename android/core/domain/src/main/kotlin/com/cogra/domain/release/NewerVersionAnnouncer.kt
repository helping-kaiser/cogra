// A NEWER VERSION, SAID ONCE (FeedNewerVersion.md; release-registry packet
// §4.4). On a cold open's feed, a release newer than the one running here
// that this device has not announced raises one quiet snackbar, and the
// device marks that release announced as it shows.
//
// THE COLD OPEN IS A PROCESS START (Android developers, "App startup time":
// cold vs warm/hot). This holder is a process singleton, so its one-shot is
// consumed once per process: a return to the foreground never re-asks.
//
// THE DECISION WAITS FOR THE FEED. The feed's arrival asks; a read still in
// flight when the reader leaves the feed is cancelled with it and asked again
// at the feed's next arrival in the same process, because the law is a feed
// snackbar. A read that answers while the feed is on screen announces as it
// arrives (design ruling 63).
//
// A FAILED READ IS SILENT and leaves the flag alone, so the next cold open
// asks again: the law's GIVEN was never established.

package com.cogra.domain.release

import com.cogra.domain.Outcome
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NewerVersionAnnouncer @Inject constructor(
    private val registry: ReleaseRegistry,
    private val announced: AnnouncedReleaseStore,
    private val running: RunningVersion,
) {
    private val lock = Mutex()
    private var decided = false

    /**
     * The feed has arrived: the release to announce, or null. Answers once
     * per process; every later arrival — a return to the foreground, a
     * navigation back to the feed — reads null.
     */
    suspend fun onFeedArrived(): Release? = lock.withLock {
        if (decided) return null
        val outcome = registry.releases(until = running.name)
        decided = true
        val releases = (outcome as? Outcome.Success)?.value ?: return null
        releaseToAnnounce(releases, running.name, announced.lastAnnounced())
    }

    /** The snackbar is showing: this device has now announced [release]. */
    suspend fun onShown(release: Release) {
        announced.markAnnounced(release.version)
    }
}
