package com.cogra.domain.testing

import com.cogra.domain.Outcome
import com.cogra.domain.report.ReportRepository
import java.time.Instant

/**
 * The content report, recording: every target asked, in call order, and a
 * scriptable answer — sent unless a test queues another outcome.
 */
class RecordingReportRepository : ReportRepository {
    val targets = mutableListOf<String>()

    /** Answers for the next calls, in order; empty means sent. */
    val answers = ArrayDeque<Outcome<Instant>>()

    override suspend fun sendReport(target: String): Outcome<Instant> {
        targets += target
        return answers.removeFirstOrNull() ?: Outcome.Success(Instant.parse("2026-10-13T12:00:00Z"))
    }
}
