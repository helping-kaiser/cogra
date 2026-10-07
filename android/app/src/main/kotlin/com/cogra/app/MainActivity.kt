package com.cogra.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.app.navigation.CograNavGraph
import com.cogra.app.ui.theme.CograTheme
import com.cogra.domain.store.DevicePreferences
import com.cogra.domain.store.ThemeChoice
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

// A FragmentActivity, not a bare ComponentActivity: BiometricPrompt —
// the key gate in core:designsystem — hosts its dialog in a fragment
// and takes a FragmentActivity by contract.
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    /** The theme the reader picked on this device (Settings.md "Theme"). */
    @Inject
    lateinit var devicePreferences: DevicePreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // App Links (cold and warm) are the nav graph's concern: the
        // NavController reads the launch intent, and the graph listens
        // for onNewIntent deliveries.
        setContent {
            val theme by devicePreferences.theme.collectAsStateWithLifecycle(ThemeChoice.AUTO)
            CograTheme(choice = theme) {
                // The graph publishes its own snackbar host, so the
                // surface a leaf confirms through is the one the shell
                // actually draws (design.md §8.3).
                CograNavGraph()
            }
        }
    }
}
