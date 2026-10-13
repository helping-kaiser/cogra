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

/** The unit a forward count speaks in. */
enum class ForwardUnit { DAYS, HOURS }

/** A forward-ladder count — `in 6 days`, `in 5 hours` — before it is put in words. */
data class ForwardCount(val count: Int, val unit: ForwardUnit)

private const val SECONDS_PER_HOUR = 60L * 60
private const val SECONDS_PER_DAY = SECONDS_PER_HOUR * 24

/**
 * How far off [deadline] is from [now], on copy-voice's forward ladder
 * (*Ages*, ruled 2026-09-14; the rounding jakob 2026-10-07): while 24 hours
 * or more remain, the nearest whole day — so a deadline seven days out
 * reads 7 the moment it is set, and half a day rounds up — then the hours
 * left, rounded up. A deadline at or past [now] that has not run yet (the
 * executor runs behind its clock) reads one hour: a count of none would
 * say it already happened.
 */
fun forwardLadder(deadline: Instant, now: Instant): ForwardCount {
    val seconds = Duration.between(now, deadline).seconds
    return if (seconds >= SECONDS_PER_DAY) {
        ForwardCount(((seconds + SECONDS_PER_DAY / 2) / SECONDS_PER_DAY).toInt(), ForwardUnit.DAYS)
    } else {
        val hours = (seconds + SECONDS_PER_HOUR - 1).floorDiv(SECONDS_PER_HOUR).coerceAtLeast(1)
        ForwardCount(hours.toInt(), ForwardUnit.HOURS)
    }
}
