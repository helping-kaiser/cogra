// What the registry says about the version running here (release-registry
// packet §4.3). The list is newest first in the registry's own order
// (`releasedAt`) — never a comparison of version strings.
//
// Behind is the running version found below the head of the list. A running
// version the registry does not list — a dev build, or a release whose row is
// not written yet — is NOT behind and carries no `installed`
// (WhatsNew.md:19; design ruling 61): nothing false is claimed.

package com.cogra.domain.release

import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class VersionStatus(
    /** Whether a release newer than the running one exists. */
    val behind: Boolean,
    /** The newest release when behind: the one `Update now` names and the snackbar announces. */
    val newest: Release?,
    /** Where the running version sits in the list; -1 when the registry does not list it. */
    val installedIndex: Int,
)

/** The word a release's dateline carries: what that version is to this device. */
enum class DatelineWord(val spoken: String) {
    INSTALLED("installed"),
    NEWEST("newest"),
}

fun versionStatus(releases: List<Release>, running: String): VersionStatus {
    val installedIndex = if (running.isEmpty()) -1 else releases.indexOfFirst { it.version == running }
    val behind = installedIndex > 0
    val newest = if (behind) releases.first() else null
    return VersionStatus(behind = behind, newest = newest, installedIndex = installedIndex)
}

/**
 * `installed` on the running version, `newest` on the head of the list only
 * when the running version is behind it, and no word anywhere else — never
 * `current` (WhatsNewBehind.md:7, :13).
 */
fun datelineWord(status: VersionStatus, index: Int): DatelineWord? = when {
    index == status.installedIndex -> DatelineWord.INSTALLED
    index == 0 && status.behind -> DatelineWord.NEWEST
    else -> null
}

private val DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy")

/** `Version 0.1.2 · installed · 30.09.2026` — the drawn dateline, the date in the reader's zone. */
fun datelineText(release: Release, word: DatelineWord?, zone: ZoneId = ZoneId.systemDefault()): String {
    val said = word?.let { " · ${it.spoken}" } ?: ""
    return "Version ${release.version}$said · ${DATE.format(release.releasedAt.atZone(zone))}"
}

/** A registered node key from a version: `0.1.2` keys `0-1-2` (the `whatsNew` registration). */
fun releaseKey(version: String): String = version.lowercase().replace(Regex("[^a-z0-9]+"), "-")

/** The release to announce, or none: behind, and not the one this device already announced. */
fun releaseToAnnounce(releases: List<Release>, running: String, lastAnnounced: String?): Release? =
    versionStatus(releases, running).newest?.takeIf { it.version != lastAnnounced }
