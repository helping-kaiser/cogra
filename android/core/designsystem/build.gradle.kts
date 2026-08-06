plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Unit tests run once, on the debug variant: the release variant would
// re-compile and re-run every suite for no extra signal.
androidComponents {
    beforeVariants(selector().withBuildType("release")) {
        it.enableUnitTest = false
    }
}

// Robolectric suites pay a per-class sandbox warmup; run test classes
// in parallel forks instead of one core at a time.
tasks.withType<Test>().configureEach {
    maxParallelForks = maxOf(1, Runtime.getRuntime().availableProcessors() / 2)
}

android {
    namespace = "com.cogra.core.designsystem"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        minSdk = libs.versions.minSdk.get().toInt()
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    // api: every feature that uses a designsystem component gets the
    // icon set with it (R8 strips the unused bulk in release builds).
    api(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.compose.ui.test.manifest)
}
