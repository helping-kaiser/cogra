import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    id("cogra.android.module")
}

// Gradle exposes gradle.properties and -P as project properties, but
// reads local.properties only for the SDK location — so the file
// android/README.md points hand testers at has to be loaded by hand.
// A -P on the command line still wins.
val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

fun configured(name: String, default: String): String {
    val fromFile: String? = localProperties.getProperty(name)
    return (findProperty(name) as String?) ?: fromFile ?: default
}

// The backend endpoint (android/README.md "Pointing the app at a
// backend"): `cogra.graphqlUrl` from local.properties or -P, defaulting
// to the emulator's host loopback.
val graphqlUrl: String = configured("cogra.graphqlUrl", "http://10.0.2.2:8080/graphql")

// The per-environment web origin behind every shareable link (auth.md
// "Link URLs"); its host doubles as the App Links host.
val webOrigin: String = configured("cogra.webOrigin", "https://cogra.example")
// The App Links host is the origin's host alone. A port belongs in the
// intent filter's own `android:port`, and leaving that out matches any port —
// which is what a dev origin on :3000 needs.
val webHost: String =
    webOrigin.substringAfter("://").substringBefore("/").substringBefore(":")

// The dev machine's mkcert root CA, staged as a gitignored raw resource by
// `scripts/stamp-net.sh` so a guest's debug app trusts the https web origin it
// talks GraphQL to (development.md "Reaching the web dev server from the
// phone"). Staged: the debug variant gains the source set whose
// network_security_config.xml names that CA as a debug-only trust anchor.
// Absent (CI, a fresh clone): the directory is not a source set at all, and
// the debug build keeps main's config — `make guest-apk` is what demands the
// CA, with the command that produces it.
val devCaRes: File = file("src/devCa/res")
val devCaStaged: Boolean = devCaRes.resolve("raw/cogra_dev_ca.pem").exists()

android {
    namespace = "com.cogra.app"

    defaultConfig {
        applicationId = "com.cogra.app"
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "GRAPHQL_URL", "\"$graphqlUrl\"")
        buildConfigField("String", "WEB_ORIGIN", "\"$webOrigin\"")
        manifestPlaceholders["cograWebHost"] = webHost
    }

    sourceSets {
        if (devCaStaged) {
            getByName("debug").res.srcDir(devCaRes)
        }
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
}

dependencies {
    implementation(project(":core:network"))
    implementation(project(":core:designsystem"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:content"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:home"))
    implementation(project(":feature:invites"))
    implementation(project(":feature:profile"))
    implementation(project(":feature:settings"))
    implementation(project(":feature:stance"))
    implementation(project(":feature:topics"))

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
    // MainActivity is a FragmentActivity — BiometricPrompt's contract.
    implementation(libs.androidx.fragment)

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
