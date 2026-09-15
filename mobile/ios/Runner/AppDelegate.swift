import Flutter
import UIKit

@main
<<<<<<< HEAD
@objc class AppDelegate: FlutterAppDelegate {
=======
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
<<<<<<< HEAD
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
=======
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
>>>>>>> 63cd8e2c5ad351605a7b5f99b986ce243e9059a8
}
