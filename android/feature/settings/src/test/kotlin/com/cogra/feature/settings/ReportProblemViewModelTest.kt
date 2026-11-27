// The report's holder: the kept words and the facts the press hands the
// reader's mail (ReportProblem.md, ReportProblemEmpty.md).

package com.cogra.feature.settings

import com.cogra.domain.release.RunningVersion
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Instant
import java.time.ZoneOffset

class ReportProblemViewModelTest {

    private val names = ReportFactNames(version = "Version", runningOn = "Running on", time = "Time")

    private fun viewModel(kept: ReportWords = ReportWords(), at: String = "2026-10-01T14:32:00Z") =
        ReportProblemViewModel(kept, RunningVersion("0.1.2")).apply {
            zone = ZoneOffset.UTC
            clock = { Instant.parse(at) }
            onTick()
        }

    // ReportProblemEmpty.md:36 — no words kept, the field stands empty.
    @Test
    fun aFirstVisitOpensOnAnEmptyField() {
        assertThat(viewModel().state.value.words).isEmpty()
    }

    // ReportProblem.md:9 — Version and Time are read back.
    @Test
    fun theFactsReadTheRunningVersionAndTheTime() {
        val state = viewModel().state.value
        assertThat(state.version).isEqualTo("0.1.2")
        assertThat(state.time).isEqualTo("01.10.2026, 14:32")
    }

    // ReportProblem.md:31 — Back keeps the words for the next time the report opens.
    @Test
    fun theWordsOutliveThePageForItsNextOpening() {
        val kept = ReportWords()
        viewModel(kept).onWords("The seal said this shouldn't have happened.")

        // The page was popped; a fresh one opens over the same holder.
        assertThat(viewModel(kept).state.value.words).isEqualTo("The seal said this shouldn't have happened.")
    }

    // ReportProblem.md:29 — the handoff never clears the words.
    @Test
    fun theHandoffKeepsTheWords() {
        val kept = ReportWords()
        val vm = viewModel(kept)
        vm.onWords("Try again said the same thing.")

        vm.onSend("Pixel 6", names)

        assertThat(vm.state.value.words).isEqualTo("Try again said the same thing.")
        assertThat(viewModel(kept).state.value.words).isEqualTo("Try again said the same thing.")
    }

    // ReportProblem.md:21 — Time reads the moment Send by email is pressed.
    @Test
    fun thePressStampsTimeWithItsOwnMoment() {
        val vm = viewModel(at = "2026-10-01T14:32:00Z")
        vm.clock = { Instant.parse("2026-10-01T14:47:10Z") }

        val mail = vm.onSend("Pixel 6", names)

        assertThat(vm.state.value.time).isEqualTo("01.10.2026, 14:47")
        assertThat(mail.body).contains("Time: 01.10.2026, 14:47")
    }

    // ReportProblem.md:25 — the words, the four facts and the report address filled in.
    @Test
    fun theDraftCarriesTheWordsTheFactsAndTheAddress() {
        val vm = viewModel()
        vm.onWords("I tried to post with a citation.")

        val mail = vm.onSend("Pixel 6", names)

        assertThat(mail.to).isEqualTo("reports@cogra.local")
        assertThat(mail.body).isEqualTo(
            "I tried to post with a citation.\n\n" +
                "Version: 0.1.2\nRunning on: Pixel 6\nTime: 01.10.2026, 14:32",
        )
    }

    // ReportProblemEmpty.md:42 — empty, the draft still carries the facts and the address.
    @Test
    fun anEmptyReportStillCarriesTheFacts() {
        val mail = viewModel().onSend("Pixel 6", names)

        assertThat(mail.to).isEqualTo(REPORT_ADDRESS)
        assertThat(mail.body).isEqualTo("Version: 0.1.2\nRunning on: Pixel 6\nTime: 01.10.2026, 14:32")
    }

    // ReportProblemEmpty.md:38 — words of only spaces send as an empty report.
    @Test
    fun onlySpacesTravelAsNoWords() {
        val vm = viewModel()
        vm.onWords("   \n  ")

        assertThat(vm.onSend("Pixel 6", names).body).startsWith("Version: ")
    }

    // ReportProblemEmpty.md:46 — deleting the last character leaves nothing kept.
    @Test
    fun clearingTheFieldKeepsNothing() {
        val kept = ReportWords()
        val vm = viewModel(kept)
        vm.onWords("x")
        vm.onWords("")

        assertThat(viewModel(kept).state.value.words).isEmpty()
    }
}
