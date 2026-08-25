package com.cogra.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.fragment.app.FragmentActivity
import com.cogra.app.navigation.CograNavGraph
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.app.ui.theme.CograTheme
import dagger.hilt.android.AndroidEntryPoint

// A FragmentActivity, not a bare ComponentActivity: BiometricPrompt —
// the key gate in core:designsystem — hosts its dialog in a fragment
// and takes a FragmentActivity by contract.
@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // App Links (cold and warm) are the nav graph's concern: the
        // NavController reads the launch intent, and the graph listens
        // for onNewIntent deliveries.
        setContent {
            CograTheme {
                // The shell's snackbar host is the one surface every
                // destination shares, so it is what a leaf component
                // confirms through (core:designsystem's
                // LocalSnackbarHostState; design.md §8.3).
                val snackbar = remember { SnackbarHostState() }
                CompositionLocalProvider(LocalSnackbarHostState provides snackbar) {
                    CograNavGraph(shellSnackbar = snackbar)
                }
            }
        }
    }
}
