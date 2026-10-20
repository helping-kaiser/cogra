// The MVP's content report (api-spec.md `sendReport`; ruling 75): no report
// machinery, a mail to the people who run CoGra naming who reported what,
// and when. Nothing lands on the graph and no row is kept.

package com.cogra.domain.report

import com.cogra.domain.Outcome
import java.time.Instant

/** The report over the contract. */
interface ReportRepository {
    /**
     * Reports one post, comment or profile — never the reader's own. Success
     * answers when it was sent. A spent daily budget is a RATE_LIMITED
     * refusal and an unknown or own target a refusal at `target`: nothing
     * was mailed either way.
     */
    suspend fun sendReport(target: String): Outcome<Instant>
}
