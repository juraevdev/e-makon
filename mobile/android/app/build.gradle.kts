plugins {
    id("com.android.application")
<<<<<<< HEAD
    id("kotlin-android")
=======
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
<<<<<<< HEAD
    namespace = "uz.mygarden.mygarden_app"
=======
    namespace = "uz.emakon.emakon_app"
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
<<<<<<< HEAD
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
=======
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
<<<<<<< HEAD
        applicationId = "uz.mygarden.mygarden_app"
=======
        applicationId = "uz.emakon.emakon_app"
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
<<<<<<< HEAD

    lint {
        checkReleaseBuilds = false
        abortOnError = false
=======
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
    }
}

flutter {
    source = "../.."
}
