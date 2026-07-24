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
        // An App-Link open (auth.md "Link URLs": /join/<id>) carries the
        // invite id into the signed-out root.
        val deepLinkedInviteId = intent?.data
            ?.takeIf { it.pathSegments.firstOrNull() == "join" }
            ?.lastPathSegment
        setContent {
            CograTheme {
                CograNavGraph(deepLinkedInviteId = deepLinkedInviteId)
            }
        }
    }
}
