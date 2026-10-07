package com.cogra.domain

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class AgesTest {
    private val now = Instant.parse("2026-10-07T12:00:00Z")

    private fun ago(d: Duration) = ageLadder(now.minus(d), now, ZoneOffset.UTC)

    @Test
    fun theLadderClimbsMinutesHoursDays() {
        assertThat(ago(Duration.ofSeconds(20))).isEqualTo("now")
        assertThat(ago(Duration.ofMinutes(35))).isEqualTo("35m")
        assertThat(ago(Duration.ofHours(2))).isEqualTo("2h")
        assertThat(ago(Duration.ofDays(3))).isEqualTo("3d")
        assertThat(ago(Duration.ofDays(30))).isEqualTo("30d")
    }

    @Test
    fun pastThirtyDaysItIsTheDate() {
        assertThat(ago(Duration.ofDays(31))).isEqualTo("06.09.2026")
        assertThat(dateLine(Instant.parse("2026-08-12T09:00:00Z"), ZoneOffset.UTC)).isEqualTo("12.08.2026")
    }

    @Test
    fun aFutureMomentReadsNow() {
        assertThat(ageLadder(now.plusSeconds(600), now, ZoneOffset.UTC)).isEqualTo("now")
    }
}
