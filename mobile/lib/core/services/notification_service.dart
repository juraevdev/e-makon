import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Lokal push (FCM keyin ulanadi). Buyurtma/status uchun.
class NotificationService {
  NotificationService._();
  static final instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  int _id = 100;

  Future<void> init() async {
    if (_ready) return;
    const android = AndroidInitializationSettings('@drawable/ic_launcher_foreground');
    const ios = DarwinInitializationSettings();
    const settings = InitializationSettings(android: android, iOS: ios);
    try {
      await _plugin.initialize(settings: settings);
      final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.requestNotificationsPermission();
      _ready = true;
    } catch (e) {
      if (kDebugMode) debugPrint('notifications init: $e');
    }
  }

  Future<void> show({
    required String title,
    required String body,
  }) async {
    if (!_ready) await init();
    if (!_ready) return;
    _id += 1;
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'emakon_orders',
        'Buyurtmalar',
        channelDescription: 'Buyurtma holati va takliflar',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );
    try {
      await _plugin.show(id: _id, title: title, body: body, notificationDetails: details);
    } catch (e) {
      if (kDebugMode) debugPrint('notification show: $e');
    }
  }
}
