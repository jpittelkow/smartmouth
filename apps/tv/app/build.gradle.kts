plugins {
    id("com.android.application")
}

// The Smartmouth server the app opens on first run. Override at build time with
//   gradlew assembleDebug -PsmartmouthServerUrl=http://192.168.1.4:8470
// or at run time (see README.md). 10.0.2.2 is the dev PC as seen from the Android emulator.
val smartmouthServerUrl: String =
    (findProperty("smartmouthServerUrl") as String?)?.trimEnd('/') ?: "http://10.0.2.2:8470"

android {
    namespace = "app.smartmouth.tv"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.smartmouth.tv"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "DEFAULT_SERVER_URL", "\"$smartmouthServerUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
