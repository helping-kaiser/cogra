package com.cogra.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import com.cogra.app.navigation.CograNavGraph
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
                // The graph publishes its own snackbar host, so the
                // surface a leaf confirms through is the one the shell
                // actually draws (design.md §8.3).
                CograNavGraph()
            }
        }
    }
}
