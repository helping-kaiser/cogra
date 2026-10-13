package com.cogra.domain.deletion

import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.Outcome
import com.cogra.domain.testing.ScriptedAccountDeletionRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.time.Instant

class AccountDeletionStateTest {

    private val repo = ScriptedAccountDeletionRepository()
    private val state = AccountDeletionState(repo)
    private val grace = AccountDeletion(Instant.parse("2026-10-20T12:00:00Z"), includesContent = false)

    @Test
    fun aReadRecordsTheStanding() = runTest {
        repo.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        state.refresh()
        assertThat(state.standing.value).isEqualTo(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
    }

    @Test
    fun aFailedReadKeepsWhatWasKnown() = runTest {
        repo.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        state.refresh()
        repo.standing = Outcome.Failed(IOException("offline"))
        state.refresh()
        assertThat(state.standing.value?.deletion).isEqualTo(grace)
    }

    @Test
    fun anAnsweredCancelTakesTheDeletionAwayAndKeepsThePath() = runTest {
        repo.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        state.refresh()
        assertThat(state.cancel()).isEqualTo(Outcome.Success(Unit))
        assertThat(state.standing.value).isEqualTo(DeletionStanding(AccountDeletionPath.BY_LINK, null))
    }

    @Test
    fun aCancelWithNoAnswerLeavesTheDeletionStanding() = runTest {
        repo.standing = Outcome.Success(DeletionStanding(AccountDeletionPath.BY_LINK, grace))
        state.refresh()
        repo.cancel = Outcome.Failed(IOException("offline"))
        state.cancel()
        assertThat(state.standing.value?.deletion).isEqualTo(grace)
    }

    @Test
    fun anActsAnswerIsRecordedOnlyOnceThePathIsKnown() {
        state.recordDeletion(grace)
        assertThat(state.standing.value).isNull()
    }

    @Test
    fun theApplicantsDeletionIsSaidOnceAndForgetsTheStanding() = runTest {
        state.refresh()
        state.markAccountDeleted()
        assertThat(state.accountDeleted.value).isTrue()
        assertThat(state.standing.value).isNull()
        state.consumeAccountDeleted()
        assertThat(state.accountDeleted.value).isFalse()
    }

    @Test
    fun signingOutForgetsTheStanding() = runTest {
        state.refresh()
        state.clear()
        assertThat(state.standing.value).isNull()
    }
}
