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

    private fun ahead(d: Duration) = forwardLadder(now.plus(d), now)

    @Test
    fun aDeadlineSevenDaysOutReadsSevenTheMomentItIsSet() {
        assertThat(ahead(Duration.ofDays(7))).isEqualTo(ForwardCount(7, ForwardUnit.DAYS))
    }

    @Test
    fun daysRoundToTheNearestWholeDayWhileADayRemains() {
        assertThat(ahead(Duration.ofDays(6).plusHours(13))).isEqualTo(ForwardCount(7, ForwardUnit.DAYS))
        assertThat(ahead(Duration.ofDays(6).plusHours(12))).isEqualTo(ForwardCount(7, ForwardUnit.DAYS))
        assertThat(ahead(Duration.ofDays(6).plusHours(11))).isEqualTo(ForwardCount(6, ForwardUnit.DAYS))
        assertThat(ahead(Duration.ofHours(24))).isEqualTo(ForwardCount(1, ForwardUnit.DAYS))
        assertThat(ahead(Duration.ofHours(35))).isEqualTo(ForwardCount(1, ForwardUnit.DAYS))
        assertThat(ahead(Duration.ofHours(36))).isEqualTo(ForwardCount(2, ForwardUnit.DAYS))
    }

    @Test
    fun underADayTheHoursCountRoundedUp() {
        assertThat(ahead(Duration.ofHours(23).plusMinutes(59))).isEqualTo(ForwardCount(24, ForwardUnit.HOURS))
        assertThat(ahead(Duration.ofHours(4).plusSeconds(1))).isEqualTo(ForwardCount(5, ForwardUnit.HOURS))
        assertThat(ahead(Duration.ofHours(5))).isEqualTo(ForwardCount(5, ForwardUnit.HOURS))
        assertThat(ahead(Duration.ofMinutes(1))).isEqualTo(ForwardCount(1, ForwardUnit.HOURS))
    }

    @Test
    fun aDeadlineThatHasNotRunYetReadsOneHour() {
        assertThat(ahead(Duration.ZERO)).isEqualTo(ForwardCount(1, ForwardUnit.HOURS))
        assertThat(forwardLadder(now.minusSeconds(600), now)).isEqualTo(ForwardCount(1, ForwardUnit.HOURS))
    }
}
