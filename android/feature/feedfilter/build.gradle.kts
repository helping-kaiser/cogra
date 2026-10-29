// The feed filter's sheet (FeedSheet.md, SettingsReading.md; the master
// `design/components/navigation/FeedFilter.jsx` `FeedFilterSheet`): ONE sheet
// with two hosts — the feed opens it from the band's trigger, Settings' What
// your feed shows row opens it to set the reader's default. Its own module
// because both hosts are features of their own (content, settings) and a
// second drawing of the sheet would be a second filter to keep in step: the
// same reuse-driven split slice 2.2 gave the stance control and slice 2.6 the
// save row (android/CLAUDE.md "Modularity is reuse-driven").

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    id("cogra.android.module")
}

android {
    namespace = "com.cogra.feature.feedfilter"

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
    implementation(project(":core:designsystem"))
    implementation(project(":core:domain"))

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
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
