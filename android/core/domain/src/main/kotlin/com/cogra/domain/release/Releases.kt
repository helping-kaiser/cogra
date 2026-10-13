// The release registry, as the app reads it (api-spec.md `appVersions`;
// the release-registry packet §4). The app reads its own component: "behind"
// has to mean a release this platform can actually get.

package com.cogra.domain.release

import com.cogra.domain.Outcome
import java.time.Instant

/** One release, as the What's new cards and the announcer read it. */
data class Release(
    val version: String,
    val notes: List<String>,
    val patchNotesUrl: String,
    val releasedAt: Instant,
)

/**
 * The version running here — `BuildConfig.VERSION_NAME`, bound by the app
 * module. One source for its three readers: the Settings row's value, the
 * `installed` dateline and the announcer, so the row and the page cannot
 * disagree.
 */
data class RunningVersion(val name: String)

interface ReleaseRegistry {
    /**
     * The app's releases, newest first in the registry's own order. [until]
     * stops the walk once that version has been read — all the announcer
     * needs. Anonymous: a stale session reads as a guest.
     */
    suspend fun releases(until: String? = null): Outcome<List<Release>>
}

/** The device's record of the last release it announced (FeedNewerVersion.md:3). */
interface AnnouncedReleaseStore {
    suspend fun lastAnnounced(): String?

    suspend fun markAnnounced(version: String)
}
