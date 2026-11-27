package com.cogra.feature.settings

import androidx.lifecycle.ViewModel
import com.cogra.domain.release.RunningVersion
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.updateAndGet
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Where a report goes — a placeholder until CoGra is on a server
 * (`design/staged-surfaces.md`, *Placeholders swapped at publication*:
 * `REPORT_ADDRESS`), swapped there in one motion with the web's.
 */
const val REPORT_ADDRESS = "reports@cogra.local"

/**
 * THE KEPT WORDS (ReportProblem.md:29, :31). The page's ViewModel is scoped
 * to its back-stack entry and cleared on pop, so the words live here, once
 * for the app's life: Back keeps them, and so does the handoff to mail, until
 * the reader clears them in the field.
 */
@Singleton
class ReportWords @Inject constructor() {
    internal val words = MutableStateFlow("")
}

/** The report's read-back: the words, and the facts that travel with them. */
data class ReportProblemUiState(
    val words: String = "",
    val version: String = "",
    /** `Time` — the moment of the press, or now while nothing has been pressed. */
    val time: String = "",
)

/** What the press hands the reader's own mail: the address and a prefilled body. */
data class ReportMail(val to: String, val body: String)

/** The facts' names, in the page's own words, for the mail body. */
data class ReportFactNames(val version: String, val runningOn: String, val time: String)

@HiltViewModel
class ReportProblemViewModel @Inject constructor(
    private val kept: ReportWords,
    running: RunningVersion,
) : ViewModel() {

    /** The clock `Time` reads; a test pins it. */
    internal var clock: () -> Instant = Instant::now

    /** The reader's own zone; a test pins it. */
    internal var zone: ZoneId = ZoneId.systemDefault()

    private val _state = MutableStateFlow(
        ReportProblemUiState(words = kept.words.value, version = running.name, time = timeLine(clock(), zone)),
    )
    val state: StateFlow<ReportProblemUiState> = _state.asStateFlow()

    fun onWords(words: String) {
        kept.words.value = words
        _state.update { it.copy(words = words) }
    }

    /** Re-reads the clock, so `Time` never stands stale while the page waits. */
    fun onTick() {
        _state.update { it.copy(time = timeLine(clock(), zone)) }
    }

    /**
     * `Send by email` (ReportProblem.md:19-:27): stamps `Time` with the moment
     * of the press and hands back the draft for the reader's own mail. Nothing
     * is sent from here, and the words stay (ReportProblem.md:29).
     */
    fun onSend(runningOn: String, names: ReportFactNames): ReportMail {
        val time = timeLine(clock(), zone)
        val state = _state.updateAndGet { it.copy(time = time) }
        return reportMail(state, runningOn, names)
    }
}

/** `Time`'s form, `01.10.2026, 14:32` (`ReportProblemBody` in `_shared.jsx`). */
private val TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy, HH:mm")

internal fun timeLine(at: Instant, zone: ZoneId): String = TIME.format(at.atZone(zone))

/**
 * The draft's body: the reader's words, then the three facts the address
 * does not already carry, one per line under their own names. Words of only
 * spaces travel as none (ReportProblemEmpty.md:38, :42).
 */
internal fun reportMail(state: ReportProblemUiState, runningOn: String, names: ReportFactNames): ReportMail {
    val facts = listOf(
        "${names.version}: ${state.version}",
        "${names.runningOn}: $runningOn",
        "${names.time}: ${state.time}",
    ).joinToString("\n")
    val words = state.words.trim()
    val body = if (words.isEmpty()) facts else "$words\n\n$facts"
    return ReportMail(to = REPORT_ADDRESS, body = body)
}
