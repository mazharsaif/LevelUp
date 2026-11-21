plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "de.com.levelup.app"
    compileSdk = 35

    defaultConfig {
        // same id as the TWA in android/, so a signed release can later install over it
        applicationId = "de.com.levelup.app"
        minSdk = 24
        targetSdk = 35
        // higher than every TWA build (they use the calendar version digits, e.g. 2026112001)
        versionCode = 2026112150
        versionName = "2026.11.21-native"
        buildConfigField("String", "SERVER_URL", "\"https://levelrise.org\"")
        manifestPlaceholders["appLabel"] = "LevelUp"
        manifestPlaceholders["cleartext"] = "false"
    }

    buildTypes {
        debug {
            // installs next to the current app; talks to the local test server from the emulator (10.0.2.2 = the Mac)
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            buildConfigField("String", "SERVER_URL", "\"" + (project.findProperty("levelup.server") ?: "http://10.0.2.2:8899") + "\"")
            manifestPlaceholders["appLabel"] = "LevelUp dev"
            manifestPlaceholders["cleartext"] = "true"
        }
        release {
            isMinifyEnabled = false
            // signing: ~/.levelup-android/levelup-release.keystore, configured on the command line when a release is made (not in this file)
        }
    }

    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true      // java.time on Android 7
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources { excludes += setOf("META-INF/*.kotlin_module", "META-INF/versions/9/previous-compilation-data.bin") } }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/webdata"))
    testOptions {
        unitTests.isReturnDefaultValues = true
        unitTests.isIncludeAndroidResources = true      // Robolectric UI tests
        unitTests.all {
            it.systemProperty("robolectric.logging.enabled", "false")
            it.environment("LU_TEST_SERVER", System.getenv("LU_TEST_SERVER") ?: "")
            it.inputs.property("luTestServer", System.getenv("LU_TEST_SERVER") ?: "")
            it.maxHeapSize = "3g"
            it.testLogging { events("failed", "passed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
        }
    }
}

// Bundle the course files from the web app (app/data, read only) so the first start works offline.
// Reading chapters (data/se/…, data/math/…) are NOT bundled: they download on demand and are cached, like the web.
val copyWebData by tasks.registering(Copy::class) {
    from(rootProject.projectDir.parentFile.resolve("app/data")) {
        include("courses.json", "content.json", "fr-a1.json", "se-path.json", "math-path.json", "stories.json")
    }
    into(layout.buildDirectory.dir("generated/webdata/data"))
}
tasks.named("preBuild") { dependsOn(copyWebData) }

dependencies {
    implementation(project(":core"))
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")

    val bom = platform("androidx.compose:compose-bom:2025.04.00")
    implementation(bom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
