import com.android.build.api.variant.HasHostTestsBuilder
import com.android.build.api.variant.HostTestBuilder
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

// Resolve the dev GraphQL endpoint: `cogra.graphqlUrl` from local.properties
// (gitignored, per-machine) or a Gradle property, else the emulator default.
val graphqlUrl: String = run {
    val localProperties = Properties().apply {
        rootProject.file("local.properties")
            .takeIf { it.exists() }
            ?.inputStream()
            ?.use(::load)
    }
    localProperties.getProperty("cogra.graphqlUrl")
        ?: project.findProperty("cogra.graphqlUrl") as String?
        ?: "http://10.0.2.2:8080/graphql"
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
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // The GraphQL endpoint, overridable per machine via `cogra.graphqlUrl`
        // (local.properties or a Gradle property) so the same build serves the
        // emulator, a physical device, and CI. The default is the emulator's
        // host loopback. For a physical device, `adb reverse tcp:8080 tcp:8080`
        // and set the value to http://localhost:8080/graphql.
        buildConfigField("String", "GRAPHQL_URL", "\"$graphqlUrl\"")
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

// The root-composable test drives the real Hilt graph through a Compose host
// activity supplied by the debug-only ui-test-manifest, so unit tests run on
// the debug variant only.
androidComponents {
    beforeVariants(selector().withBuildType("release")) { variantBuilder ->
        (variantBuilder as HasHostTestsBuilder).hostTests
            .getValue(HostTestBuilder.UNIT_TEST_TYPE)
            .enable = false
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":core:domain"))
    implementation(project(":core:network"))
    implementation(project(":feature:auth"))

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    implementation(libs.hilt.android)
    implementation(libs.androidx.hilt.navigation.compose)
    ksp(libs.hilt.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.hilt.android.testing)
    kspTest(libs.hilt.compiler)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
