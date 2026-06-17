package com.cogra.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/** Application entry point; roots the Hilt dependency graph. */
@HiltAndroidApp
class CograApp : Application()
