import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// YAYIN İMZASI — anahtar deposu bilgileri `android/key.properties` dosyasından
// okunur. O dosya sürüm kontrolüne GİRMEZ (parola içerir) ve depoda yoktur;
// yoksa aşağıda debug anahtarına düşülür ve derleme sırasında UYARI basılır.
// Böylece "release derledim, mağazaya yükleyeceğim" sanıp debug anahtarıyla
// imzalanmış paket üretmek sessizce olmaz.
val keystoreProperties = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val hasReleaseKey = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "com.emrahanlar.masteranaliz"
    // flutter.compileSdkVersion şu an 36; flutter_secure_storage 37 istiyor.
    // Android SDK'ları geriye dönük uyumludur, bu yüzden en yükseğe derlemek
    // güvenlidir (Flutter'ın kendi uyarısının önerdiği çözüm budur).
    //
    // MINOR SÜRÜM: SDK 37 diske `android-37.0` olarak kuruluyor (Android'in
    // yeni "minor sürüm" adlandırması — 36.1, 37.0 …). Yalnız `compileSdk = 37`
    // yazmak AGP'ye `android-37` arattırıyor ve o klasör YOK:
    //   "Failed to find target with hash string 'android-37'"
    // `compileSdkMinor` ikisini birleştirip doğru hedefi bulur.
    compileSdk = 37
    compileSdkMinor = 0
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // ÇEKİRDEK KİTAPLIK ŞEKER SÖKÜMÜ — flutter_local_notifications ŞART
        // koşuyor. Eklenti zamanlama için java.time kullanır; bu API eski
        // Android sürümlerinde yoktur ve derleme AAR üstverisinde bunu
        // doğrulayarak DURUR (checkDebugAarMetadata). Kapatılırsa bildirim
        // eklentisi hiç derlenmez.
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // KAYNAK: app/app.json → android.package
        applicationId = "com.emrahanlar.masteranaliz"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // KAYNAK: app.json → android.versionCode = 1, expo.version = "1.0.0".
        // Değerler pubspec.yaml'daki `version:` satırından gelir.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = keystoreProperties.getProperty("storeFile")
                    ?.let { rootProject.file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKey) {
                signingConfigs.getByName("release")
            } else {
                // Yayın anahtarı yok → debug anahtarı. Bu paket MAĞAZAYA
                // YÜKLENEMEZ; aşağıdaki uyarı bunu görünür kılar.
                logger.warn(
                    "UYARI: android/key.properties yok — release paketi DEBUG " +
                        "anahtarıyla imzalanıyor. Mağaza yüklemesi için gerçek " +
                        "anahtar deposu gerekir."
                )
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    // isCoreLibraryDesugaringEnabled'ın gerektirdiği kitaplık.
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
