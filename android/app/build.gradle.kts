plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

// The backend endpoint (android/README.md "Pointing the app at a
// backend"): `cogra.graphqlUrl` from local.properties or -P, defaulting
// to the emulator's host loopback.
val graphqlUrl: String = (findProperty("cogra.graphqlUrl") as String?)
    ?: "http://10.0.2.2:8080/graphql"

// The per-environment web origin behind every shareable link (auth.md
// "Link URLs"); its host doubles as the App Links host.
val webOrigin: String = (findProperty("cogra.webOrigin") as String?)
    ?: "https://cogra.example"
val webHost: String = webOrigin.substringAfter("://").substringBefore("/")

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
    namespace = "com.cogra.app"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.cogra.app"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "GRAPHQL_URL", "\"$graphqlUrl\"")
        buildConfigField("String", "WEB_ORIGIN", "\"$webOrigin\"")
        manifestPlaceholders["cograWebHost"] = webHost
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":core:network"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:home"))
    implementation(project(":feature:invites"))
    implementation(project(":feature:settings"))

    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.hilt.navigation.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.navigation.testing)
    testImplementation(libs.hilt.android.testing)
    kspTest(libs.hilt.compiler)
    testImplementation(testFixtures(project(":core:domain")))
}
