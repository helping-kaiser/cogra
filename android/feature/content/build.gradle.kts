// The content surface (roadmap "Slice 2"): the chronological feed, the
// post composer, and the post detail with its thread — every write
// prepared by the backend and signed on this device.

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    id("cogra.android.module")
}

android {
    namespace = "com.cogra.feature.content"

    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

// `client-constants.json` is read from the repo root at test time
// rather than compiled in, so it belongs to no source set and Gradle
// cannot see it. Undeclared, the up-to-date check and the build cache
// both hand back a pass computed against the previous `make constants`
// output. Declaring a runtime-read file as a task input is Gradle's own
// answer (user manual, "Incremental build"); `workingDir` is stated
// because the test names the file by a path relative to this module.
tasks.withType<Test>().configureEach {
    workingDir = projectDir
    inputs.file(file("../../../client-constants.json"))
        .withPropertyName("clientConstants")
        .withPathSensitivity(PathSensitivity.NONE)
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:domain"))
    // The stance control embeds in post cards and comments (design.md §6).
    implementation(project(":feature:stance"))

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    // The system photo picker and the back handler the wizard's stages
    // need — both are activity-result / activity-compose APIs.
    implementation(libs.androidx.activity.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    testImplementation(testFixtures(project(":core:domain")))
    testImplementation(libs.truth)
    // Reads the repo-root contract artifact; nothing in main parses JSON.
    testImplementation(libs.kotlinx.serialization.json)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.compose.ui.test.manifest)
}
