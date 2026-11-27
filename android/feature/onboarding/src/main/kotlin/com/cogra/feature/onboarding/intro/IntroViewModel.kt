// The intro's state: which of the five cards is up, and whose face the
// fifth one wears (OnboardingSteps.md, OnboardingVouch.md).
//
// THE FLAG SETS ON THE FIRST SHOW (OnboardingSteps.md:29, `_shared.jsx`'s
// intro block, B6): the write leaves the moment the intro opens on its own,
// never waiting for Skip or Start reading, so an interrupted intro never
// returns by itself. A re-watch from Settings writes nothing — the flag is
// already set.

package com.cogra.feature.onboarding.intro

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.ActorRef
import com.cogra.domain.Outcome
import com.cogra.domain.intro.IntroRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The five cards, in the boards' order (each board's `step`). */
enum class IntroCard { Steps, Shape, Public, Layers, Vouch }

/** The number of cards the dots count. */
val INTRO_STEPS: Int = IntroCard.entries.size

data class IntroUiState(
    val card: IntroCard = IntroCard.Steps,
    /** The fifth card's face: the reader's actual inviter, null while unread or for none. */
    val inviter: ActorRef? = null,
) {
    /** The card's place, 1-based, as the dots speak it. */
    val step: Int get() = card.ordinal + 1
    val isLast: Boolean get() = card == IntroCard.entries.last()
}

@HiltViewModel
class IntroViewModel @Inject constructor(
    private val savedState: SavedStateHandle,
    private val intro: IntroRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(
        IntroUiState(card = IntroCard.entries[savedState.get<Int>(KEY_CARD) ?: 0]),
    )
    val state: StateFlow<IntroUiState> = _state.asStateFlow()

    init {
        // The route's own argument (`Intro.fromSettings`): Navigation's
        // type-safe routes keep each argument under its property's name.
        val fromSettings = savedState.get<Boolean>(KEY_FROM_SETTINGS) == true
        if (!fromSettings && savedState.get<Boolean>(KEY_MARKED) != true) {
            savedState[KEY_MARKED] = true
            viewModelScope.launch { intro.markIntroSeen() }
        }
        viewModelScope.launch {
            val read = intro.introAccount()
            if (read is Outcome.Success) _state.update { it.copy(inviter = read.value?.inviter) }
        }
    }

    /** Next: the following card. The last card's button leaves instead, which the screen routes. */
    fun next() = move(+1)

    /**
     * Android Back: the card before, answered true; on the first card there is
     * none, answered false — the intro then leaves the way Skip leaves.
     */
    fun back(): Boolean {
        if (_state.value.card.ordinal == 0) return false
        move(-1)
        return true
    }

    private fun move(by: Int) {
        val at = (_state.value.card.ordinal + by).coerceIn(0, INTRO_STEPS - 1)
        savedState[KEY_CARD] = at
        _state.update { it.copy(card = IntroCard.entries[at]) }
    }

    private companion object {
        const val KEY_CARD = "introCard"
        const val KEY_MARKED = "introMarked"
        const val KEY_FROM_SETTINGS = "fromSettings"
    }
}
