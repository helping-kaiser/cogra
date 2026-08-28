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
    // Android's Bitmap and ExifInterface are the whole dependency surface:
    // no Compose, no domain, no network. The module is the on-device image
    // pipeline and nothing else.
    implementation(libs.androidx.exifinterface)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
