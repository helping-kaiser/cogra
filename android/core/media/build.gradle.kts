plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    id("cogra.android.module")
}

android {
    namespace = "com.cogra.core.media"

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

dependencies {
    // Android's Bitmap and ExifInterface plus the domain's own
    // `MediaProcessor` seam: no Compose, no network, and no DI — the
    // Hilt module that hands this to the app lives in :app, so this
    // module stays a plain library with a constructor.
    api(project(":core:domain"))
    implementation(libs.androidx.exifinterface)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
