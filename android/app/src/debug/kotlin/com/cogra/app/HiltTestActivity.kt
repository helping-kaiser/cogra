// The empty Hilt host activity Compose tests launch (the documented
// Compose + Hilt testing setup): hiltViewModel() needs an
// @AndroidEntryPoint activity, and MainActivity carries app behavior
// tests don't want. Debug source set so the test manifest can register
// it; never shipped in release.

package com.cogra.app

import android.content.Intent
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.AndroidEntryPoint

// Mirrors MainActivity's base class so tests host what production hosts.
@AndroidEntryPoint
class HiltTestActivity : FragmentActivity() {
    /**
     * Drives the real androidx onNewIntent dispatch (listener fan-out
     * included) from tests — Robolectric has no public driver for the
     * protected method.
     */
    fun dispatchNewIntent(intent: Intent) = onNewIntent(intent)
}
