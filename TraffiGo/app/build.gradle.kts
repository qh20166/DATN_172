plugins {
    alias(libs.plugins.android.application)
    id("com.google.gms.google-services")
}

android {
    namespace = "com.example.traffigo"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.traffigo"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    // Android UI & Core
    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.activity)
    implementation(libs.constraintlayout)

    // Firebase & Auth
    implementation("com.google.firebase:firebase-auth:23.0.0")
    implementation("com.google.android.gms:play-services-auth:21.2.0")

    // Map & Location (Đã dọn dẹp trùng lặp)
    implementation("org.osmdroid:osmdroid-android:6.1.16")
    implementation("com.github.MKergall:osmbonuspack:6.7.0")
    implementation("com.google.android.gms:play-services-maps:18.2.0")
    implementation("com.google.android.gms:play-services-location:21.1.0")

    // Utilities & News Screen
    implementation("com.tbuonomo:dotsindicator:5.0")
    implementation("com.github.bumptech.glide:glide:4.16.0")
    annotationProcessor("com.github.bumptech.glide:compiler:4.16.0")

    // THÊM: Thư viện hỗ trợ mạng và parse XML (để lấy tin từ VnExpress)
    implementation("com.squareup.okhttp3:okhttp:4.10.0")

    // Testing
    testImplementation(libs.junit)
    androidTestImplementation(libs.ext.junit)
    androidTestImplementation(libs.espresso.core)

    implementation("com.github.chrisbanes:PhotoView:2.3.0")

    implementation("com.google.maps:google-maps-services:2.1.2")
    implementation("org.slf4j:slf4j-simple:1.7.25")
    implementation("com.google.maps.android:android-maps-utils:3.4.0")
    implementation("com.google.firebase:firebase-database:21.0.0")
    implementation("com.google.firebase:firebase-storage:21.0.1")
    implementation("com.google.android.libraries.places:places:3.3.0")
}