plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.apollo)
}

android {
    namespace = "com.cogra.core.network"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        minSdk = libs.versions.minSdk.get().toInt()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

// Apollo generates the typed client from the repo-root schema.graphql — the
// single checked-in backend contract (docs/implementation/android.md). Never
// hand-edit the generated code; regenerate it from the schema instead.
// Operations return with slice 1; until then the module only compiles the
// contract.
apollo {
    service("cogra") {
        packageName.set("com.cogra.network.graphql")
        schemaFiles.from(file("../../../schema.graphql"))
    }
}

dependencies {
    implementation(libs.apollo.runtime)
}
