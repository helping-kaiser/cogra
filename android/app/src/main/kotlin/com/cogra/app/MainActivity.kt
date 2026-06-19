package com.cogra.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.cogra.app.navigation.EditProfile
import com.cogra.app.navigation.Login
import com.cogra.app.navigation.PROFILE_UPDATED_RESULT
import com.cogra.app.navigation.Profile
import com.cogra.app.ui.theme.CograTheme
import com.cogra.feature.auth.login.LoginRoute
import com.cogra.feature.auth.profile.EditProfileRoute
import com.cogra.feature.auth.profile.ProfileRoute
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CograTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    CograRoot()
                }
            }
        }
    }
}

/**
 * The app's single NavHost. Auth state drives navigation — login and logout
 * each clear the back stack — so every screen is reached by real navigation
 * and gets a fresh NavBackStackEntry-scoped ViewModel rather than a retained,
 * activity-scoped one (android/CLAUDE.md "Navigation").
 */
@Composable
fun CograRoot(viewModel: RootViewModel = hiltViewModel()) {
    val authState by viewModel.authState.collectAsStateWithLifecycle()
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }

    // Conditional navigation: react to auth changes by moving to the right
    // destination and clearing the back stack. The guard skips the no-op case
    // (already on the target), so a logged-out start doesn't re-create Login.
    LaunchedEffect(authState) {
        val current = navController.currentDestination
        when (authState) {
            AuthUiState.LoggedIn ->
                if (current?.hasRoute<Profile>() != true) {
                    navController.navigate(Profile) {
                        popUpTo(navController.graph.id) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            AuthUiState.LoggedOut ->
                if (current?.hasRoute<Login>() != true) {
                    navController.navigate(Login) {
                        popUpTo(navController.graph.id) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            AuthUiState.Loading -> Unit
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            NavHost(navController = navController, startDestination = Login) {
                composable<Login> { LoginRoute() }

                composable<Profile> { entry ->
                    val profileUpdated by entry.savedStateHandle
                        .getStateFlow(PROFILE_UPDATED_RESULT, false)
                        .collectAsStateWithLifecycle()
                    ProfileRoute(
                        onEditProfile = { navController.navigate(EditProfile) },
                        profileUpdated = profileUpdated,
                        onProfileUpdatedShown = {
                            entry.savedStateHandle[PROFILE_UPDATED_RESULT] = false
                        },
                        snackbarHostState = snackbarHostState,
                    )
                }

                composable<EditProfile> {
                    EditProfileRoute(
                        onSaved = {
                            navController.previousBackStackEntry
                                ?.savedStateHandle?.set(PROFILE_UPDATED_RESULT, true)
                            navController.popBackStack()
                        },
                        onCancel = { navController.popBackStack() },
                    )
                }
            }

            // The stored session is still being read — cover the start frame so
            // a logged-in user never sees the login screen flash past.
            if (authState == AuthUiState.Loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }
    }
}
