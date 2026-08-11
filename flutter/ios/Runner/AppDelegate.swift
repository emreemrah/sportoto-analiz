import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // UYGULAMA AÇIKKEN DÜŞEN BİLDİRİM — iOS, delege atanmazsa ön plandaki
    // bildirimi HİÇ göstermez. Kullanıcı uygulamayı açık unuttuğunda maç
    // hatırlatması sessizce kaybolurdu; Android'de böyle bir kayıp yok.
    // (flutter_local_notifications iOS kurulum gereği.)
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate =
        self as UNUserNotificationCenterDelegate
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
