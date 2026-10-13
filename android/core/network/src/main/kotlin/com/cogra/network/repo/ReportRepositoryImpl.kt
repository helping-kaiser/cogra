// The content report over the real contract (api-spec.md `sendReport`). A
// spent budget arrives as a RATE_LIMITED refusal (Mapping.kt's transport
// translation), like every other budget.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.report.ReportRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.graphql.SendReportMutation
import com.cogra.network.payloadOutcome
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReportRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : ReportRepository {

    override suspend fun sendReport(target: String): Outcome<Instant> = guard.run {
        client.mutation(SendReportMutation(target))
            .payloadOutcome({ it.sendReport.userErrors.map { e -> e.userErrorFields } }) {
                // `reportedAt` is null exactly when a userError refused it.
                it.sendReport.reportedAt
            }
    }
}
