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
    // The video half of the pipeline: Transformer re-encodes a picked
    // clip to MP4 / H.264 + AAC, `media3-effect` carries the scaling
    // effect it applies on the way, and `media3-common` the MIME
    // constants both name.
    implementation(libs.media3.transformer)
    implementation(libs.media3.effect)
    implementation(libs.media3.common)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
