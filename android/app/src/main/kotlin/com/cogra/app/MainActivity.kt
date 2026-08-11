package com.cogra.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.cogra.app.navigation.CograNavGraph
import com.cogra.app.ui.theme.CograTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // App Links (cold and warm) are the nav graph's concern: the
        // NavController reads the launch intent, and the graph listens
        // for onNewIntent deliveries.
        setContent {
            CograTheme {
                CograNavGraph()
            }
        }
    }
}
