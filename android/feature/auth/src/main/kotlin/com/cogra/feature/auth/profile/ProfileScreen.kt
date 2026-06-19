package com.cogra.feature.auth.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.domain.model.FieldModerationStatus
import com.cogra.core.domain.model.ModeratedText
import com.cogra.core.domain.model.User

@Composable
fun ProfileRoute(
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // Slice 1 has no NavHost yet, so the edit screen is a local sub-state of the
    // profile. Owning it here keeps the profile ViewModel in scope, so a saved
    // edit can trigger a reload to show the new values.
    var editing by rememberSaveable { mutableStateOf(false) }
    if (editing) {
        EditProfileRoute(
            onDone = { changed ->
                editing = false
                if (changed) viewModel.load()
            },
            modifier = modifier,
        )
    } else {
        ProfileScreen(
            state = state,
            onRetry = viewModel::load,
            onLogout = viewModel::onLogout,
            onEditProfile = { editing = true },
            modifier = modifier,
        )
    }
}

@Composable
fun ProfileScreen(
    state: ProfileUiState,
    onRetry: () -> Unit,
    onLogout: () -> Unit,
    onEditProfile: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isLoading -> CircularProgressIndicator(
                modifier = Modifier.testTag(ProfileTestTags.PROGRESS),
            )

            state.user != null -> ProfileContent(
                user = state.user,
                onEditProfile = onEditProfile,
                onLogout = onLogout,
            )

            else -> ErrorContent(
                message = state.errorMessage ?: "Couldn't load your profile.",
                onRetry = onRetry,
            )
        }
    }
}

@Composable
private fun ProfileContent(user: User, onEditProfile: () -> Unit, onLogout: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = user.displayName.render(),
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.testTag(ProfileTestTags.DISPLAY_NAME),
        )
        Text(
            text = "@${user.handle.render()}",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.testTag(ProfileTestTags.HANDLE),
        )
        if (user.bio.value != null || user.bio.status == FieldModerationStatus.REDACTED) {
            Text(text = user.bio.render(), style = MaterialTheme.typography.bodyLarge)
        }
        if (user.websiteUrl.value != null || user.websiteUrl.status == FieldModerationStatus.REDACTED) {
            Text(text = user.websiteUrl.render(), style = MaterialTheme.typography.bodyMedium)
        }
        Text(
            text = "Role: ${user.networkRole.name.lowercase()}",
            style = MaterialTheme.typography.bodyMedium,
        )

        Button(
            onClick = onEditProfile,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(ProfileTestTags.EDIT),
        ) {
            Text("Edit profile")
        }
        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(ProfileTestTags.LOGOUT),
        ) {
            Text("Log out")
        }
    }
}

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = message,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag(ProfileTestTags.ERROR),
        )
        Button(onClick = onRetry, modifier = Modifier.testTag(ProfileTestTags.RETRY)) {
            Text("Retry")
        }
    }
}

/** Renders moderated text, marking a redaction rather than dropping it
 *  silently (layers.md — redactions always leave a visible mark). */
private fun ModeratedText.render(): String =
    value ?: if (status == FieldModerationStatus.REDACTED) "[redacted]" else ""

object ProfileTestTags {
    const val PROGRESS = "profile_progress"
    const val DISPLAY_NAME = "profile_display_name"
    const val HANDLE = "profile_handle"
    const val EDIT = "profile_edit"
    const val LOGOUT = "profile_logout"
    const val ERROR = "profile_error"
    const val RETRY = "profile_retry"
}
