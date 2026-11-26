package com.cogra.feature.profile

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.RowLineState
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.token.Space
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The profile's reading of [ProfileChanges]: the line under its own head, and
 * the one-shot a change taken after its seal closed raises for the snackbar
 * (ProfileEditSeal.md:45, :75-:81).
 */
@HiltViewModel
class ProfileChangeViewModel @Inject constructor(changes: ProfileChanges) : ViewModel() {

    val line: StateFlow<ProfileChangeLine?> =
        changes.line.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _landed = MutableStateFlow(false)

    /** One-shot: a closed seal's change was taken. */
    val landed: StateFlow<Boolean> = _landed.asStateFlow()

    init {
        viewModelScope.launch { changes.landed.collect { _landed.value = true } }
    }

    fun onLandedConsumed() {
        _landed.value = false
    }
}

/**
 * The line under one's own head (`Profile.jsx`'s `change` chip, the head line
 * padded 8 / 16 / 12): `Signing…` in the pending marker's quiet register once
 * 200ms pass without an answer, then — if it did not sign — `That didn't sign.`
 * in the failure voice with `Retry`. Never the snackbar for the failure;
 * nothing stands here otherwise (Profile.md:99-101, ProfileEditSeal.md:75-81).
 */
@Composable
internal fun ProfileChangeHeadLine(line: ProfileChangeLine?) {
    val waited = rememberParticiple(line == ProfileChangeLine.Signing)
    val reading = when (line) {
        null -> null
        ProfileChangeLine.Signing -> RowLineState.Signing.takeIf { waited }
        is ProfileChangeLine.Failed -> RowLineState.DidntSign(line.retry)
    } ?: return
    RowLine(reading, PROFILE_CHANGE_LINE, Modifier.padding(top = Space.x2, bottom = Space.x3))
}

internal const val PROFILE_CHANGE_LINE = "profile_change_line"
