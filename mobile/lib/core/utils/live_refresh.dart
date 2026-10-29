import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Ekran ko'rinib turganda [liveRefresh] ni har [liveInterval] da chaqiradi.
///
/// Ilova fonda bo'lsa yoki [TickerMode] o'chiq bo'lsa so'rov yuborilmaydi;
/// ekran qayta faol bo'lganda darhol yangilanadi.
mixin LiveRefresh<T extends StatefulWidget> on State<T> {
  Timer? _liveTimer;
  AppLifecycleListener? _lifecycle;
  bool _appActive = true;
  bool _liveBusy = false;
  bool _tickerEnabled = true;

  Duration get liveInterval;

  Future<void> liveRefresh();

  /// Masalan, yakunlangan buyurtma uchun so'rovni to'xtatish.
  bool get liveEnabled => true;

  bool get isLiveVisible => _appActive && _tickerEnabled;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onStateChange: _onLifecycle);
    _liveTimer = Timer.periodic(liveInterval, (_) => liveTick());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final enabled = TickerMode.of(context);
    if (enabled != _tickerEnabled) {
      _tickerEnabled = enabled;
      if (enabled) liveTick();
    }
  }

  void _onLifecycle(AppLifecycleState state) {
    final active =
        state == AppLifecycleState.resumed || state == AppLifecycleState.inactive;
    final wasActive = _appActive;
    _appActive = active;
    if (active && !wasActive) liveTick();
  }

  /// Darhol bir marta yangilaydi (ko'rinmasa yoki oldingi so'rov tugamagan bo'lsa — o'tkazib yuboradi).
  Future<void> liveTick() async {
    if (!mounted || _liveBusy || !isLiveVisible || !liveEnabled) return;
    _liveBusy = true;
    try {
      await liveRefresh();
    } catch (e) {
      if (kDebugMode) debugPrint('live refresh: $e');
    } finally {
      _liveBusy = false;
    }
  }

  @override
  void dispose() {
    _liveTimer?.cancel();
    _lifecycle?.dispose();
    super.dispose();
  }
}
