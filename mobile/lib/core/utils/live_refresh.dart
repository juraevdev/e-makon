import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Ekran ko'rinib turganda [liveRefresh] ni har [liveInterval] da chaqiradi.
///
/// Ilova fonda bo'lsa, boshqa tab tanlangan yoki ustidan boshqa sahifa ochilgan bo'lsa
/// (TickerMode o'chiq) so'rov yuborilmaydi; ekran qayta ko'ringanda darhol yangilanadi.
mixin LiveRefresh<T extends StatefulWidget> on State<T> {
  Timer? _liveTimer;
  AppLifecycleListener? _lifecycle;
  ValueListenable<TickerModeData>? _tickerMode;
  bool _appActive = true;
  bool _liveBusy = false;

  Duration get liveInterval;

  Future<void> liveRefresh();

  /// Masalan, yakunlangan buyurtma uchun so'rovni to'xtatish.
  bool get liveEnabled => true;

  bool get isLiveVisible => _appActive && (_tickerMode?.value.enabled ?? true);

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onStateChange: _onLifecycle);
    _liveTimer = Timer.periodic(liveInterval, (_) => liveTick());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final notifier = TickerMode.getValuesNotifier(context);
    if (!identical(notifier, _tickerMode)) {
      _tickerMode?.removeListener(_onVisibility);
      _tickerMode = notifier..addListener(_onVisibility);
    }
  }

  void _onVisibility() {
    if (isLiveVisible) liveTick();
  }

  void _onLifecycle(AppLifecycleState state) {
    final active = state == AppLifecycleState.resumed || state == AppLifecycleState.inactive;
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
    _tickerMode?.removeListener(_onVisibility);
    super.dispose();
  }
}
