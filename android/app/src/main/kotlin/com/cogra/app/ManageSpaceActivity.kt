package com.cogra.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import com.cogra.app.navigation.ACTION_MANAGE_SPACE

/**
 * The system storage screen's door (`android:manageSpaceActivity`; the
 * settings-surface spec, seam 166). With it declared, the phone's own
 * "Clear storage" for CoGra becomes "Manage space" and opens OUR settings at
 * Clearing data — so the warning about the key stands in the destructive
 * path itself (Settings.md: "settings opens with settings.clearing in view
 * AND NEVER anything is cleared").
 *
 * A relay, not a screen: it hands the ask to the one activity that hosts
 * the app's single NavHost and leaves. Nothing is cleared here.
 */
class ManageSpaceActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(
            Intent(this, MainActivity::class.java)
                .setAction(ACTION_MANAGE_SPACE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
        finish()
    }
}
