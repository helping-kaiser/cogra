plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    id("cogra.android.module")
}

android {
    namespace = "com.cogra.core.designsystem"

    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    // api: every feature that uses a designsystem component gets the
    // icon set with it (R8 strips the unused bulk in release builds).
    api(libs.androidx.compose.material.icons.extended)
    // api: the 2.0 media components expose Coil's AsyncImage model types on
    // their own signatures, so consumers need the artifact on their compile
    // path too. coil-network-okhttp is what teaches Coil 3 to fetch over
    // HTTP at all — it ships no network fetcher by default.
    api(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    // The key gate: BiometricPrompt needs the hosting FragmentActivity,
    // which LocalActivity supplies.
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.fragment)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.compose.ui.test.manifest)
    // Coil's own test artifact: a fake ImageLoader engine, so a media test
    // asserts layout and semantics without a network or a real decode.
    testImplementation(libs.coil.test)
}
