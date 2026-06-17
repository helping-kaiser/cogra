package com.cogra.app

import androidx.activity.ComponentActivity
import dagger.hilt.android.AndroidEntryPoint

/**
 * Empty `@AndroidEntryPoint` host so Robolectric Compose tests can resolve
 * `hiltViewModel()` from the real graph. Lives in the debug source set only and
 * is never shipped to release.
 */
@AndroidEntryPoint
class HiltTestActivity : ComponentActivity()
