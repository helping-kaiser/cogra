package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.release.AnnouncedReleaseStore
import com.cogra.domain.release.Release
import com.cogra.domain.release.ReleaseRegistry

/**
 * The release registry, scripted: an empty registry unless a test sets one,
 * so a surface that reads it announces nothing by default.
 */
class ScriptedReleaseRegistry(var answer: Outcome<List<Release>> = Outcome.Success(emptyList())) : ReleaseRegistry {
    var reads = 0

    override suspend fun releases(until: String?): Outcome<List<Release>> {
        reads += 1
        return answer
    }
}

/** The device's announced-release flag, in memory. */
class InMemoryAnnouncedReleaseStore(var value: String? = null) : AnnouncedReleaseStore {
    override suspend fun lastAnnounced(): String? = value

    override suspend fun markAnnounced(version: String) {
        value = version
    }
}
