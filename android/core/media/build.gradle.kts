plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
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
    // `MediaProcessor` seam: no Compose, no network. The module is the
    // on-device image pipeline and the binding that hands it to the app
    // behind a plain-Kotlin interface, so the wizard's state machine
    // tests without a Bitmap anywhere near them.
    implementation(project(":core:domain"))
    implementation(libs.androidx.exifinterface)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
