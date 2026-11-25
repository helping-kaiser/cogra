package com.cogra.feature.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cogra.core.designsystem.v2.atom.LoadingState
import kotlinx.coroutines.delay

/** How long the applicant's check may go unanswered before `Loading…` stands for it. */
internal const val CHECKING_AFTER_MS = 200L

/**
 * The applicant's progress, not yet read: M3's ladder and nothing else
 * (design/readme.md "Loading"; EmptyState.prompt.md) — nothing under 200ms,
 * then `Loading…` in the slot the cards will take, never a spinner.
 *
 * The wait belongs to the read it stands for: this stands only while the
 * progress is unknown, so a read that starts again composes it anew and
 * times its own 200ms, never an older read's clock.
 */
@Composable
internal fun ApplicantChecking() {
    var late by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(CHECKING_AFTER_MS)
        late = true
    }
    if (late) LoadingState(testTag = "home_status_loading")
}
