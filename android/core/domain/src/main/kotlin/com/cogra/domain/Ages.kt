// One vocabulary for every timestamp (copy-voice *Ages*, ruled
// 2026-09-09): the minutes/hours/days ladder — `now`, `35m`, `2h`, `3d` —
// up to 30 days, and the date (`06.09.2024`) past it. No other words: no
// "today", no weeks, no months. Recency is a feeling and gets the ladder;
// history is a date.

package com.cogra.domain

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val MINUTES_PER_HOUR = 60L
private const val MINUTES_PER_DAY = 60L * 24
private const val LADDER_DAYS = 30L

private val DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy")

/** The date form, `12.08.2026`, in [zone]. */
fun dateLine(at: Instant, zone: ZoneId = ZoneId.systemDefault()): String = DATE.format(at.atZone(zone))

/**
 * The age of [at] seen from [now]: `now` under a minute, then `Nm`, `Nh`,
 * `Nd` through the thirtieth day, and the date past it. A moment in the
 * future (a skewed clock) reads `now` rather than a negative age.
 */
fun ageLadder(at: Instant, now: Instant, zone: ZoneId = ZoneId.systemDefault()): String {
    val minutes = Duration.between(at, now).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 1 -> "now"
        minutes < MINUTES_PER_HOUR -> "${minutes}m"
        minutes < MINUTES_PER_DAY -> "${minutes / MINUTES_PER_HOUR}h"
        minutes / MINUTES_PER_DAY <= LADDER_DAYS -> "${minutes / MINUTES_PER_DAY}d"
        else -> dateLine(at, zone)
    }
}
