import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersion = System.getenv("BF_VERSION") ?: "0.0.0-dev"
val appBuild = System.getenv("BF_BUILD")?.toIntOrNull() ?: 1
val keystore = System.getenv("BF_KEYSTORE")?.let(::file)?.takeIf { it.exists() }

android {

    namespace = "com.betterfenrid.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.betterfenrid.android"
        minSdk = 29
        targetSdk = 35
        versionCode = appBuild
        versionName = appVersion
    }

    signingConfigs {

        if (keystore != null) {
        
            create("release") {
                storeFile = keystore
                storePassword = System.getenv("BF_KEYSTORE_PASSWORD")
                keyAlias = "betterfenrid"
                keyPassword = System.getenv("BF_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
}