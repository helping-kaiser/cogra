plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.apollo)
}

android {
    namespace = "com.cogra.core.network"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        minSdk = libs.versions.minSdk.get().toInt()
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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

// Apollo generates the typed client from the repo-root schema.graphql — the
// single checked-in backend contract (docs/implementation/android.md). Never
// hand-edit the generated code; regenerate it from the schema instead.
apollo {
    service("cogra") {
        packageName.set("com.cogra.network.graphql")
        schemaFiles.from(file("../../../schema.graphql"))
        // Custom scalars are carried as their wire form; the domain layer owns
        // any richer typing.
        mapScalar("DateTime", "kotlin.String")
        mapScalar("UUID", "kotlin.String")
    }
}

dependencies {
    // Domain types and contracts are part of this module's public surface.
    api(project(":core:domain"))

    implementation(libs.apollo.runtime)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.tink.android)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.okhttp.mockwebserver)
}
