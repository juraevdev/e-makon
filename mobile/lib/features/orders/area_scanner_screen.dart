import 'dart:async';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/area_math.dart';
import '../../core/widgets/widgets.dart';

enum _Phase { intro, scanning, manual, result }

const _amber = Color(0xFFFFB300);
const _blue = Color(0xFF42A5F5);

/// Hovli maydonini o'lchash.
///
/// Asosiy usul — burchaklar bo'yicha: foydalanuvchi har bir burchakda to'xtab
/// tugmani bosadi, ilova bir necha soniya GPS o'lchovlarini yig'ib o'rtachalaydi.
/// Ko'pburchak faqat shu raqamlangan burchaklardan tuziladi, yurilgan yo'l esa
/// faqat yo'l-yo'riq sifatida chiziladi. Muqobil usul — o'lchamlarni qo'lda kiritish.
///
/// Natija `context.pop(int m2)` orqali qaytariladi.
class AreaScannerScreen extends StatefulWidget {
  const AreaScannerScreen({super.key});

  @override
  State<AreaScannerScreen> createState() => _AreaScannerScreenState();
}

class _AreaScannerScreenState extends State<AreaScannerScreen> with WidgetsBindingObserver {
  /// Shundan yomon aniqlikdagi o'lchovlar burchak uchun ishlatilmaydi (metr).
  static const _maxAccuracy = 15.0;

  /// Shundan yomon o'lchovlar umuman e'tiborga olinmaydi (metr).
  static const _ignoreAccuracy = 30.0;

  /// Bitta burchak uchun yig'iladigan o'lchovlar soni (~1 soniyada bitta).
  static const _cornerSamples = 6;
  static const _cornerTimeout = Duration(seconds: 15);

  /// Ketma-ket burchaklar orasidagi minimal masofa (metr).
  static const _minCornerGap = 2.0;

  _Phase _phase = _Phase.intro;

  CameraController? _camera;
  String? _cameraError;

  StreamSubscription<Position>? _gps;
  String? _gpsError;
  double? _accuracy;
  final _kalman = GeoKalman();
  GeoPoint? _current;
  int _lastFixMs = 0;
  int _rejected = 0;

  GeoPoint? _headingRef;
  double? _heading;

  final List<GeoPoint> _trail = [];
  List<GeoPoint> _corners = [];

  bool _capturing = false;
  final List<GeoPoint> _samples = [];
  Timer? _captureTimer;

  final List<(TextEditingController, TextEditingController)> _parts = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _parts.add(_newPart());
    _initCamera();
    _startGps();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _captureTimer?.cancel();
    _gps?.cancel();
    _camera?.dispose();
    for (final (a, b) in _parts) {
      a.dispose();
      b.dispose();
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final cam = _camera;
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      if (cam != null) {
        _camera = null;
        cam.dispose();
        if (mounted) setState(() {});
      }
    } else if (state == AppLifecycleState.resumed && _camera == null && _phase == _Phase.scanning) {
      _initCamera();
    }
  }

  // ---------------------------------------------------------------- camera

  Future<void> _initCamera() async {
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) {
        if (mounted) setState(() => _cameraError = 'Kamera topilmadi — o‘lchash GPS orqali davom etadi');
        return;
      }
      final back = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cams.first);
      final ctrl = CameraController(back, ResolutionPreset.medium, enableAudio: false);
      await ctrl.initialize();
      if (!mounted) {
        await ctrl.dispose();
        return;
      }
      setState(() {
        _camera = ctrl;
        _cameraError = null;
      });
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(
        () => _cameraError = e.code.contains('Denied')
            ? 'Kameraga ruxsat berilmagan — o‘lchash GPS orqali davom etadi'
            : 'Kamerani ochib bo‘lmadi — o‘lchash GPS orqali davom etadi',
      );
    } catch (_) {
      if (mounted) setState(() => _cameraError = 'Kamerani ochib bo‘lmadi — o‘lchash GPS orqali davom etadi');
    }
  }

  // ---------------------------------------------------------------- GPS

  Future<void> _startGps() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      if (mounted) setState(() => _gpsError = 'Telefoningizda joylashuv (GPS) o‘chiq. Uni yoqing.');
      return;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      if (mounted) setState(() => _gpsError = 'Maydonni o‘lchash uchun joylashuvga ruxsat kerak.');
      return;
    }

    final LocationSettings settings = defaultTargetPlatform == TargetPlatform.android
        ? AndroidSettings(
            accuracy: LocationAccuracy.bestForNavigation,
            distanceFilter: 0,
            intervalDuration: const Duration(seconds: 1),
          )
        : const LocationSettings(accuracy: LocationAccuracy.bestForNavigation, distanceFilter: 0);

    await _gps?.cancel();
    if (!mounted) return;
    setState(() => _gpsError = null);
    _gps = Geolocator.getPositionStream(locationSettings: settings).listen(
      _onPosition,
      onError: (_) {
        if (mounted) setState(() => _gpsError = 'GPS signalini olishda xatolik. Ochiq joyga chiqing.');
      },
    );
  }

  void _onPosition(Position p) {
    if (!mounted) return;
    _accuracy = p.accuracy;
    if (p.accuracy > _ignoreAccuracy) {
      setState(() {});
      return;
    }
    final now = p.timestamp.millisecondsSinceEpoch;
    final raw = GeoPoint(p.latitude, p.longitude, accuracy: p.accuracy);

    // Keskin "sakrash" (piyoda yurib bo'lmaydigan tezlik) — GPS xatosi, tashlab yuboramiz.
    final cur = _current;
    if (cur != null && _rejected < 5) {
      final dt = math.max((now - _lastFixMs) / 1000, 1.0);
      if (AreaMath.distance(cur, raw) > 4 * dt + 2 * p.accuracy) {
        _rejected++;
        return;
      }
    }
    if (_rejected >= 5) _kalman.reset();
    _rejected = 0;
    _lastFixMs = now;

    final smooth = _kalman.process(raw, now);
    _current = smooth;

    final ref = _headingRef;
    if (ref == null) {
      _headingRef = smooth;
    } else if (AreaMath.distance(ref, smooth) >= 2.5) {
      _heading = AreaMath.bearing(ref, smooth);
      _headingRef = smooth;
    }

    if (_phase == _Phase.scanning) {
      if (_trail.isEmpty || AreaMath.distance(_trail.last, smooth) >= 1) {
        _trail.add(smooth);
        if (_trail.length > 3000) _trail.removeAt(0);
      }
      if (_capturing && p.accuracy <= _maxAccuracy) {
        _samples.add(raw);
        if (_samples.length >= _cornerSamples) _commitCorner();
      }
    }
    setState(() {});
  }

  bool get _gpsReady => _current != null && (_accuracy ?? 99) <= _maxAccuracy;

  // ---------------------------------------------------------------- corner logic

  void _startScan() {
    setState(() {
      _phase = _Phase.scanning;
      _corners = [];
      _trail.clear();
    });
  }

  void _onCornerPressed() {
    final cur = _current;
    if (cur == null || !_gpsReady) return;
    if (_nearFirst) {
      _finish(closedByReturn: true);
      return;
    }
    if (_corners.isNotEmpty && AreaMath.distance(_corners.last, cur) < _minCornerGap) {
      _toast('Bu joy ${_corners.length}-burchakka juda yaqin. Keyingi burchakka yuring.');
      return;
    }
    HapticFeedback.selectionClick();
    setState(() {
      _capturing = true;
      _samples.clear();
    });
    _captureTimer?.cancel();
    _captureTimer = Timer(_cornerTimeout, () {
      if (!_capturing) return;
      if (_samples.length >= 2) {
        _commitCorner();
      } else {
        setState(() => _capturing = false);
        _toast('GPS signali zaif — ochiqroq joyda qayta urinib ko‘ring');
      }
    });
  }

  void _cancelCapture() {
    _captureTimer?.cancel();
    setState(() {
      _capturing = false;
      _samples.clear();
    });
  }

  void _commitCorner() {
    _captureTimer?.cancel();
    final corner = AreaMath.weightedCenter(_samples);
    _capturing = false;
    _samples.clear();
    if (_corners.isNotEmpty && AreaMath.distance(_corners.last, corner) < _minCornerGap * 0.75) {
      setState(() {});
      _toast('Nuqta oldingi burchak bilan bir xil chiqdi — keyingi burchakka yuring');
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() => _corners = [..._corners, corner]);
    if (AreaMath.selfIntersects(_corners)) {
      _toast(
        'Chiziqlar kesishib qoldi. Burchaklarni bir yo‘nalishda ketma-ket belgilang yoki oxirgisini bekor qiling.',
      );
    }
  }

  void _undo() {
    if (_capturing) {
      _cancelCapture();
      return;
    }
    if (_corners.isEmpty) return;
    setState(() => _corners = _corners.sublist(0, _corners.length - 1));
  }

  void _finish({bool closedByReturn = false}) {
    if (_corners.length < 3) {
      _toast('Kamida 3 ta burchak belgilang');
      return;
    }
    _cancelCapture();
    setState(() => _phase = _Phase.result);
    if (closedByReturn) _toast('1-burchakka qaytdingiz — shakl yopildi');
  }

  void _fixOrder() {
    setState(() => _corners = AreaMath.orderAroundCenter(_corners));
  }

  void _restart() {
    _cancelCapture();
    setState(() {
      _corners = [];
      _trail.clear();
      _phase = _Phase.intro;
    });
    if (_camera == null) _initCamera();
  }

  void _toast(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), behavior: SnackBarBehavior.floating));
  }

  // ---------------------------------------------------------------- manual mode

  (TextEditingController, TextEditingController) _newPart() {
    final a = TextEditingController(), b = TextEditingController();
    a.addListener(() => setState(() {}));
    b.addListener(() => setState(() {}));
    return (a, b);
  }

  void _addPart() => setState(() => _parts.add(_newPart()));

  void _removePart(int i) {
    final (a, b) = _parts.removeAt(i);
    a.dispose();
    b.dispose();
    setState(() {});
  }

  static double _num(TextEditingController c) => double.tryParse(c.text.trim().replaceAll(',', '.')) ?? 0;

  double get _manualArea => _parts.fold(0, (s, p) => s + _num(p.$1) * _num(p.$2));

  // ---------------------------------------------------------------- derived

  double get _area => AreaMath.area(_corners);
  double get _perimeter => AreaMath.perimeter(_corners);
  bool get _crossed => AreaMath.selfIntersects(_corners);

  double? get _toLast {
    final cur = _current;
    return cur == null || _corners.isEmpty ? null : AreaMath.distance(_corners.last, cur);
  }

  double? get _toFirst {
    final cur = _current;
    return cur == null || _corners.length < 2 ? null : AreaMath.distance(_corners.first, cur);
  }

  bool get _nearFirst {
    final d = _toFirst;
    return d != null && _corners.length >= 3 && d <= math.max(3.0, (_accuracy ?? 3) * 0.8);
  }

  static String _fmt(double v, [int digits = 0]) {
    final s = v.toStringAsFixed(digits);
    final parts = s.split('.');
    final whole = parts[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');
    return parts.length > 1 ? '$whole.${parts[1]}' : whole;
  }

  Color _accuracyColor(double? acc) {
    if (acc == null) return AppColors.outline;
    if (acc <= 6) return AppColors.primary;
    if (acc <= _maxAccuracy) return _amber;
    return AppColors.error;
  }

  // ---------------------------------------------------------------- UI

  @override
  Widget build(BuildContext context) {
    final dim = switch (_phase) {
      _Phase.scanning => 0.0,
      _Phase.intro => 0.6,
      _ => 0.88,
    };
    return Scaffold(
      backgroundColor: Colors.black,
      resizeToAvoidBottomInset: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          _preview(),
          if (dim > 0) Container(color: Colors.black.withValues(alpha: dim)),
          SafeArea(
            child: switch (_phase) {
              _Phase.intro => _introView(),
              _Phase.scanning => _scanView(),
              _Phase.manual => _manualView(),
              _Phase.result => _resultView(),
            },
          ),
        ],
      ),
    );
  }

  Widget _preview() {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized) {
      return const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0F2A12), AppColors.background],
          ),
        ),
      );
    }
    final size = cam.value.previewSize;
    if (size == null) return CameraPreview(cam);
    return ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(width: size.height, height: size.width, child: CameraPreview(cam)),
      ),
    );
  }

  Widget _topBar(String title, {VoidCallback? onBack, bool showGps = true}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack ?? () => context.pop(),
            icon: Icon(onBack == null ? Icons.close : Icons.arrow_back, color: Colors.white),
          ),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
            ),
          ),
          if (showGps) _gpsChip(),
        ],
      ),
    );
  }

  Widget _gpsChip() {
    final acc = _accuracy;
    final color = _accuracyColor(acc);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.gps_fixed, size: 15, color: color),
          const SizedBox(width: 6),
          Text(
            acc == null ? 'GPS…' : 'GPS ±${acc.toStringAsFixed(acc < 10 ? 1 : 0)} m',
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ---- intro

  Widget _introView() {
    return Column(
      children: [
        _topBar('Maydonni o‘lchash'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            children: [
              const Text(
                'Qaysi usulda o‘lchaymiz?',
                style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 14),
              _modeCard(
                icon: Icons.directions_walk,
                title: 'Burchaklarni aylanib o‘lchash',
                subtitle: 'Kamera va GPS yordamida. 150 m² dan katta hovlilar uchun tavsiya etiladi.',
                badge: 'Tavsiya',
                onTap: _startScan,
              ),
              const SizedBox(height: 10),
              _modeCard(
                icon: Icons.straighten,
                title: 'O‘lchamlarni kiritish',
                subtitle:
                    'Uzunlik × eni (ruletka yoki qadam bilan). Kichik va to‘g‘ri burchakli hovlilar uchun eng aniq.',
                onTap: () => setState(() => _phase = _Phase.manual),
              ),
              const SizedBox(height: 22),
              const Text(
                'Aylanib o‘lchash qanday ishlaydi',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 10),
              _step(1, Icons.flag_outlined, 'Hovlining istalgan burchagiga boring va «1-burchak» tugmasini bosing.'),
              _step(
                2,
                Icons.pan_tool_alt_outlined,
                'Telefonni ushlab, 5–6 soniya qimirlamay turing — ilova nuqtani aniqlab, tebranadi.',
              ),
              _step(
                3,
                Icons.rotate_right,
                'Devor/to‘siq bo‘ylab keyingi burchakka yuring. Burchaklarni doim bir yo‘nalishda ketma-ket belgilang.',
              ),
              _step(
                4,
                Icons.check_circle_outline,
                'Oxirgi burchakdan keyin «Yakunlash»ni bosing yoki 1-burchakka qaytib tugmani bosing.',
              ),
              const SizedBox(height: 4),
              const Text(
                'Maslahat: daraxt va binolardan uzoqroq, ochiq osmon ostida o‘lchang. '
                'Burchakda to‘xtagan sari natija aniqroq bo‘ladi.',
                style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 12.5, height: 1.4),
              ),
              if (_cameraError != null) ...[
                const SizedBox(height: 10),
                _notice(Icons.videocam_off_outlined, _cameraError!),
              ],
              if (_gpsError != null) ...[
                const SizedBox(height: 10),
                _notice(
                  Icons.location_off_outlined,
                  _gpsError!,
                  action: TextButton(
                    onPressed: () async {
                      if (!await Geolocator.isLocationServiceEnabled()) {
                        await Geolocator.openLocationSettings();
                      } else {
                        await Geolocator.openAppSettings();
                      }
                      if (mounted) _startGps();
                    },
                    child: const Text('Sozlamalar'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _modeCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    String? badge,
  }) {
    return GlassCard(
      borderRadius: 16,
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                      ),
                    ),
                    if (badge != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          badge,
                          style: const TextStyle(color: AppColors.primary, fontSize: 10.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: AppColors.onSurfaceVariant, fontSize: 12.5, height: 1.35)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.primary),
        ],
      ),
    );
  }

  Widget _step(int n, IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 13,
            backgroundColor: AppColors.primary.withValues(alpha: 0.18),
            child: Text(
              '$n',
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12),
            ),
          ),
          const SizedBox(width: 10),
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: const TextStyle(color: Colors.white, height: 1.35, fontSize: 13.5)),
          ),
        ],
      ),
    );
  }

  Widget _notice(IconData icon, String text, {Widget? action}) {
    return GlassCard(
      borderRadius: 12,
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      child: Row(
        children: [
          Icon(icon, color: _amber, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.35)),
          ),
          ?action,
        ],
      ),
    );
  }

  // ---- scanning

  (String, Color, IconData) get _instruction {
    if (_accuracy == null) return ('GPS signali kutilmoqda…', _amber, Icons.satellite_alt_outlined);
    if (!_gpsReady) {
      return (
        'GPS signali zaif (±${_accuracy!.toStringAsFixed(0)} m). Ochiqroq joyga o‘ting.',
        AppColors.error,
        Icons.signal_cellular_connected_no_internet_0_bar,
      );
    }
    if (_capturing) return ('Qimirlamay turing — burchak aniqlanmoqda…', _blue, Icons.pan_tool_alt_outlined);
    if (_crossed) {
      return (
        'Chiziqlar kesishmoqda! Oxirgi burchakni bekor qiling yoki natijada tartibni tuzating.',
        AppColors.error,
        Icons.warning_amber_rounded,
      );
    }
    if (_nearFirst) {
      return ('1-burchakka qaytdingiz — tugmani bosib shaklni yoping.', AppColors.primary, Icons.flag_circle);
    }
    return switch (_corners.length) {
      0 => ('Hovlining bir burchagida turing va «1-burchak» tugmasini bosing.', Colors.white, Icons.flag_outlined),
      1 || 2 => (
        'Devor bo‘ylab ${_corners.length + 1}-burchakka yuring va o‘sha yerda tugmani bosing.',
        Colors.white,
        Icons.directions_walk,
      ),
      _ => (
        'Keyingi burchakka yuring yoki hammasi belgilangan bo‘lsa «Yakunlash»ni bosing.',
        Colors.white,
        Icons.directions_walk,
      ),
    };
  }

  Widget _scanView() {
    final (text, color, icon) = _instruction;
    final progress = _samples.length / _cornerSamples;
    return Column(
      children: [
        _topBar(
          'Burchaklarni belgilash',
          onBack: _corners.isEmpty ? () => setState(() => _phase = _Phase.intro) : null,
        ),
        const SizedBox(height: 8),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: _banner(text, color, icon)),
        Expanded(
          child: Center(
            child: _capturing
                ? _CaptureRing(progress: progress, count: _samples.length, total: _cornerSamples)
                : const _Crosshair(),
          ),
        ),
        Container(
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white12),
          ),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 168,
                    height: 168,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0B1A0D),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: CustomPaint(
                        painter: _ShapePainter(
                          corners: _corners,
                          trail: _trail,
                          current: _current,
                          heading: _heading,
                          accuracy: _accuracy,
                          compact: true,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      children: [
                        _metric('Maydon', _corners.length >= 3 ? '${_fmt(_area)} m²' : '—', highlight: true),
                        const SizedBox(height: 6),
                        _metric(
                          _corners.isEmpty ? 'Burchaklar' : '${_corners.length}-burchakdan',
                          _corners.isEmpty ? '0' : '${_fmt(_toLast ?? 0, 1)} m',
                        ),
                        const SizedBox(height: 6),
                        _metric(
                          '1-burchakkacha',
                          _toFirst == null ? '—' : '${_fmt(_toFirst!, 1)} m',
                          color: _nearFirst ? AppColors.primary : null,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Material(
                    color: Colors.white10,
                    shape: const CircleBorder(),
                    child: IconButton(
                      tooltip: _capturing ? 'To‘xtatish' : 'Oxirgi burchakni o‘chirish',
                      onPressed: _capturing || _corners.isNotEmpty ? _undo : null,
                      icon: Icon(
                        Icons.undo_rounded,
                        color: _capturing || _corners.isNotEmpty ? Colors.white : Colors.white30,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 3,
                    child: _capturing
                        ? OutlinedButton(
                            onPressed: _cancelCapture,
                            style: _outlinedStyle(),
                            child: const Text('Bekor qilish'),
                          )
                        : PrimaryButton(
                            label: _nearFirst ? 'Shaklni yopish' : '${_corners.length + 1}-burchak',
                            icon: _nearFirst ? Icons.check_rounded : Icons.add_location_alt_outlined,
                            onPressed: _gpsReady ? _onCornerPressed : null,
                          ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: OutlinedButton(
                      onPressed: _corners.length >= 3 && !_capturing ? _finish : null,
                      style: _outlinedStyle(),
                      child: const Text('Yakunlash'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  ButtonStyle _outlinedStyle() => OutlinedButton.styleFrom(
    foregroundColor: Colors.white,
    disabledForegroundColor: Colors.white30,
    side: const BorderSide(color: Colors.white38),
    minimumSize: const Size.fromHeight(56),
    padding: const EdgeInsets.symmetric(horizontal: 8),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
  );

  Widget _metric(String label, String value, {bool highlight = false, Color? color}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: highlight ? AppColors.primary.withValues(alpha: 0.6) : Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                color: color ?? (highlight ? AppColors.primary : Colors.white),
                fontWeight: FontWeight.w800,
                fontSize: 17,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _banner(String text, Color color, IconData icon) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.66),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13.5, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  // ---- manual

  Widget _manualView() {
    final total = _manualArea;
    return Column(
      children: [
        _topBar('O‘lchamlarni kiritish', onBack: () => setState(() => _phase = _Phase.intro), showGps: false),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            children: [
              const Text(
                'Hovli to‘g‘ri burchakli bo‘lsa, uzunlik va enini kiriting. «Г» shaklidagi hovlini '
                'bir nechta to‘rtburchakka bo‘lib qo‘shing. Ruletka bo‘lmasa: 1 katta qadam ≈ 0,75 m.',
                style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 14),
              for (final (i, p) in _parts.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GlassCard(
                    borderRadius: 14,
                    padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                    child: Row(
                      children: [
                        Text(
                          '${i + 1}.',
                          style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: _sizeField(p.$1, 'Uzunlik, m')),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 6),
                          child: Text('×', style: TextStyle(color: Colors.white70, fontSize: 18)),
                        ),
                        Expanded(child: _sizeField(p.$2, 'Eni, m')),
                        IconButton(
                          onPressed: _parts.length > 1 ? () => _removePart(i) : null,
                          icon: Icon(Icons.close, color: _parts.length > 1 ? AppColors.error : Colors.white24),
                        ),
                      ],
                    ),
                  ),
                ),
              TextButton.icon(
                onPressed: _addPart,
                icon: const Icon(Icons.add, color: AppColors.primary),
                label: const Text('Yana qism qo‘shish', style: TextStyle(color: AppColors.primary)),
              ),
              const SizedBox(height: 18),
              const Text(
                'Jami maydon',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.onSurfaceVariant),
              ),
              Text(
                '${_fmt(total)} m²',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.primary, fontSize: 38, fontWeight: FontWeight.w900),
              ),
              Text(
                '≈ ${_fmt(total / 100, 2)} sotix',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: PrimaryButton(
            label: 'Maydonni qo‘llash',
            icon: Icons.check_rounded,
            onPressed: total >= 1 ? () => context.pop(total.round()) : null,
          ),
        ),
      ],
    );
  }

  Widget _sizeField(TextEditingController c, String label) {
    return TextField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
      decoration: InputDecoration(labelText: label, isDense: true),
    );
  }

  // ---- result

  Widget _resultView() {
    final area = _area;
    final error = AreaMath.errorEstimate(_corners);
    final crossed = _crossed;
    return Column(
      children: [
        _topBar('Natija', onBack: () => setState(() => _phase = _Phase.scanning), showGps: false),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            children: [
              AspectRatio(
                aspectRatio: 1.15,
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B1A0D),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppColors.glassBorder),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: CustomPaint(painter: _ShapePainter(corners: _corners, closed: true, showLengths: true)),
                  ),
                ),
              ),
              if (crossed) ...[
                const SizedBox(height: 12),
                _banner(
                  'Burchaklar aralash tartibda belgilangan — chiziqlar kesishmoqda, maydon noto‘g‘ri chiqadi.',
                  AppColors.error,
                  Icons.warning_amber_rounded,
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _fixOrder,
                  icon: const Icon(Icons.auto_fix_high),
                  label: const Text('Tartibni avtomatik tuzatish'),
                  style: _outlinedStyle(),
                ),
              ],
              const SizedBox(height: 18),
              const Text(
                'Hovli maydoni',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.onSurfaceVariant),
              ),
              Text(
                '${_fmt(area)} m²',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: crossed ? AppColors.error : AppColors.primary,
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                '≈ ${_fmt(area / 100, 2)} sotix  ·  xatolik ± ${_fmt(error)} m²',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _metric('Perimetr', '${_fmt(_perimeter, 1)} m')),
                  const SizedBox(width: 8),
                  Expanded(child: _metric('Burchaklar', '${_corners.length} ta')),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'Natija GPS asosida hisoblandi. Kerak bo‘lsa, buyurtma formasida qiymatni qo‘lda tuzating — '
                'firma ish joyida aniq o‘lchaydi.',
                style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 12.5, height: 1.4),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _restart,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Qayta'),
                  style: _outlinedStyle(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: PrimaryButton(
                  label: 'Maydonni qo‘llash',
                  icon: Icons.check_rounded,
                  onPressed: crossed ? null : () => context.pop(area.round()),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Crosshair extends StatelessWidget {
  const _Crosshair();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white54, width: 2),
      ),
      child: const Icon(Icons.add, color: Colors.white54),
    );
  }
}

class _CaptureRing extends StatelessWidget {
  const _CaptureRing({required this.progress, required this.count, required this.total});

  final double progress;
  final int count;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      height: 150,
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), shape: BoxShape.circle),
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: 132,
            height: 132,
            child: CircularProgressIndicator(
              value: progress.clamp(0.04, 1.0),
              strokeWidth: 7,
              color: _blue,
              backgroundColor: Colors.white12,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.pan_tool_alt_outlined, color: Colors.white, size: 28),
              const SizedBox(height: 4),
              const Text(
                'Turing',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
              ),
              Text('$count / $total', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Burchaklar, yurilgan yo'l va joriy holatni shimol tepada bo'lgan xaritacha sifatida chizadi.
class _ShapePainter extends CustomPainter {
  _ShapePainter({
    required this.corners,
    this.trail = const [],
    this.current,
    this.heading,
    this.accuracy,
    this.closed = false,
    this.showLengths = false,
    this.compact = false,
  });

  final List<GeoPoint> corners;
  final List<GeoPoint> trail;
  final GeoPoint? current;
  final double? heading;
  final double? accuracy;
  final bool closed;
  final bool showLengths;
  final bool compact;

  @override
  void paint(Canvas canvas, Size size) {
    final cur = current;
    final origin = corners.isNotEmpty ? corners.first : (trail.isNotEmpty ? trail.first : cur);
    if (origin == null) {
      _text(canvas, 'GPS kutilmoqda…', Offset(size.width / 2, size.height / 2), Colors.white54, 11, center: true);
      return;
    }

    final pts = <GeoPoint>[...corners, ...trail, ?cur];
    final local = [for (final p in pts) AreaMath.toLocal(origin, p)];
    var minX = local.first.$1, maxX = minX, minY = local.first.$2, maxY = minY;
    for (final (x, y) in local) {
      minX = math.min(minX, x);
      maxX = math.max(maxX, x);
      minY = math.min(minY, y);
      maxY = math.max(maxY, y);
    }
    // Boshida xarita juda kattalashib ketmasligi uchun kamida 12 m oraliq.
    const minSpan = 12.0;
    final cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    final spanX = math.max(maxX - minX, minSpan), spanY = math.max(maxY - minY, minSpan);
    final pad = compact ? 18.0 : 30.0;
    final scale = math.min((size.width - pad * 2) / spanX, (size.height - pad * 2) / spanY);

    Offset map(GeoPoint g) {
      final (x, y) = AreaMath.toLocal(origin, g);
      return Offset(size.width / 2 + (x - cx) * scale, size.height / 2 - (y - cy) * scale);
    }

    // Yurilgan yo'l (faqat yo'l-yo'riq).
    if (trail.length > 1) {
      final path = Path()..moveTo(map(trail.first).dx, map(trail.first).dy);
      for (final p in trail.skip(1)) {
        final o = map(p);
        path.lineTo(o.dx, o.dy);
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = Colors.white24
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );
    }

    final cornerOffsets = corners.map(map).toList();
    final edge = Paint()
      ..color = AppColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = compact ? 2.2 : 2.6
      ..strokeJoin = StrokeJoin.round;

    if (closed && corners.length >= 3) {
      final poly = Path()..addPolygon(cornerOffsets, true);
      canvas.drawPath(poly, Paint()..color = AppColors.primary.withValues(alpha: 0.22));
    } else if (corners.length >= 3) {
      final poly = Path()..addPolygon(cornerOffsets, true);
      canvas.drawPath(poly, Paint()..color = AppColors.primary.withValues(alpha: 0.12));
    }

    // Belgilangan tomonlar va yurish yo'nalishi strelkalari.
    final edgeCount = closed ? corners.length : corners.length - 1;
    for (var i = 0; i < edgeCount && corners.length >= 2; i++) {
      final a = cornerOffsets[i], b = cornerOffsets[(i + 1) % corners.length];
      canvas.drawLine(a, b, edge);
      _arrow(canvas, a, b, AppColors.primary);
      if (showLengths) {
        final len = AreaMath.distance(corners[i], corners[(i + 1) % corners.length]);
        _label(canvas, '${len.toStringAsFixed(1)} m', (a + b) / 2);
      }
    }

    if (!closed && cur != null) {
      final here = map(cur);
      if (corners.isNotEmpty) _dashed(canvas, cornerOffsets.last, here, Colors.white70, 1.6);
      if (corners.length >= 2) _dashed(canvas, here, cornerOffsets.first, Colors.white24, 1.2);
    }

    // Raqamlangan burchaklar.
    final r = compact ? 7.5 : 11.0;
    for (var i = 0; i < cornerOffsets.length; i++) {
      final o = cornerOffsets[i];
      canvas.drawCircle(o, r + 1.5, Paint()..color = Colors.black);
      canvas.drawCircle(o, r, Paint()..color = i == 0 ? _amber : AppColors.primary);
      _text(canvas, '${i + 1}', o, Colors.black, compact ? 9 : 12, center: true, bold: true);
    }

    // Joriy holat: aniqlik doirasi va yurish yo'nalishi.
    if (!closed && cur != null) {
      final here = map(cur);
      final acc = accuracy;
      if (acc != null) {
        canvas.drawCircle(
          here,
          math.min(acc * scale, size.shortestSide),
          Paint()..color = _blue.withValues(alpha: 0.14),
        );
      }
      final h = heading;
      if (h != null) {
        final rad = h * math.pi / 180;
        final dir = Offset(math.sin(rad), -math.cos(rad));
        final side = Offset(-dir.dy, dir.dx);
        final tip = here + dir * 13;
        final path = Path()
          ..moveTo(tip.dx, tip.dy)
          ..lineTo((here + side * 6 - dir * 2).dx, (here + side * 6 - dir * 2).dy)
          ..lineTo((here - side * 6 - dir * 2).dx, (here - side * 6 - dir * 2).dy)
          ..close();
        canvas.drawPath(path, Paint()..color = _blue);
      }
      canvas.drawCircle(here, 5.5, Paint()..color = Colors.white);
      canvas.drawCircle(here, 4, Paint()..color = _blue);
    }

    _north(canvas, size);
    _scaleBar(canvas, size, scale);
  }

  void _arrow(Canvas canvas, Offset a, Offset b, Color color) {
    final d = b - a;
    final len = d.distance;
    if (len < 22) return;
    final dir = d / len;
    final side = Offset(-dir.dy, dir.dx);
    final m = a + d / 2;
    final tip = m + dir * 5;
    final path = Path()
      ..moveTo(tip.dx, tip.dy)
      ..lineTo((m - dir * 4 + side * 4.5).dx, (m - dir * 4 + side * 4.5).dy)
      ..lineTo((m - dir * 4 - side * 4.5).dx, (m - dir * 4 - side * 4.5).dy)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  void _dashed(Canvas canvas, Offset a, Offset b, Color color, double width) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = width;
    final d = b - a;
    final len = d.distance;
    if (len < 1) return;
    final dir = d / len;
    for (var t = 0.0; t < len; t += 9) {
      canvas.drawLine(a + dir * t, a + dir * math.min(t + 5, len), paint);
    }
  }

  void _north(Canvas canvas, Size size) {
    final c = Offset(size.width - 14, 16);
    final path = Path()
      ..moveTo(c.dx, c.dy - 7)
      ..lineTo(c.dx + 5, c.dy + 5)
      ..lineTo(c.dx, c.dy + 2)
      ..lineTo(c.dx - 5, c.dy + 5)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.white70);
    _text(canvas, 'N', c + const Offset(0, 14), Colors.white70, 9, center: true, bold: true);
  }

  void _scaleBar(Canvas canvas, Size size, double scale) {
    const options = [1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0];
    final maxMeters = size.width * 0.3 / scale;
    final meters = options.lastWhere((m) => m <= maxMeters, orElse: () => options.first);
    final px = meters * scale;
    final y = size.height - 10;
    final paint = Paint()
      ..color = Colors.white60
      ..strokeWidth = 1.5;
    canvas.drawLine(Offset(10, y), Offset(10 + px, y), paint);
    canvas.drawLine(Offset(10, y - 4), Offset(10, y), paint);
    canvas.drawLine(Offset(10 + px, y - 4), Offset(10 + px, y), paint);
    _text(canvas, '${meters.toStringAsFixed(0)} m', Offset(10 + px + 4, y - 6), Colors.white60, 9);
  }

  void _label(Canvas canvas, String text, Offset center) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final r = Rect.fromCenter(center: center, width: tp.width + 10, height: tp.height + 4);
    canvas.drawRRect(RRect.fromRectAndRadius(r, const Radius.circular(6)), Paint()..color = Colors.black87);
    tp.paint(canvas, r.topLeft + const Offset(5, 2));
  }

  void _text(
    Canvas canvas,
    String text,
    Offset at,
    Color color,
    double size, {
    bool center = false,
    bool bold = false,
  }) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(color: color, fontSize: size, fontWeight: bold ? FontWeight.w800 : FontWeight.w500),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center ? at - Offset(tp.width / 2, tp.height / 2) : at);
  }

  @override
  bool shouldRepaint(covariant _ShapePainter old) => true;
}
