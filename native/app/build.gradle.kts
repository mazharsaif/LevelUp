plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
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
        versionCode = (project.findProperty("lu.versionCode") as String?)?.toInt() ?: 2026112150
        versionName = (project.findProperty("lu.versionName") as String?) ?: "2026.11.21-native"
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
            // The only Android app from 11-22 (the TWA is parked). Keeps its own id (.native) so installed copies
            // keep updating; named just "LevelUp". Signed by tools/android/build_native.sh.
            applicationIdSuffix = ".native"
            manifestPlaceholders["appLabel"] = "LevelUp"
        }
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true      // java.time on Android 7
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources { excludes += setOf("META-INF/*.kotlin_module", "META-INF/versions/9/previous-compilation-data.bin") } }
}


dependencies {
    implementation(project(":core"))   // ported store/sync logic: for widgets, reminders and alarms later
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.13.0")
}
