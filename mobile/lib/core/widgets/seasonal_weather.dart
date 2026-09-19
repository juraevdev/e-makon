import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/season_theme.dart';

/// Faslga mos zarrachalar: gulbarg, meva, barg, qor.
class SeasonalWeather extends StatefulWidget {
  const SeasonalWeather({
    super.key,
    required this.theme,
    this.count = 22,
  });

  final SeasonTheme theme;
  final int count;

  @override
  State<SeasonalWeather> createState() => _SeasonalWeatherState();
}

class _SeasonalWeatherState extends State<SeasonalWeather> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 14))..repeat();
    _particles = _spawn(widget.theme, widget.count);
  }

  @override
  void didUpdateWidget(covariant SeasonalWeather oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.theme.season != widget.theme.season || oldWidget.count != widget.count) {
      _particles = _spawn(widget.theme, widget.count);
    }
  }

  List<_Particle> _spawn(SeasonTheme theme, int count) {
    final rng = math.Random(theme.season.index * 17 + 3);
    return List.generate(count, (i) {
      return _Particle(
        x: rng.nextDouble(),
        y: rng.nextDouble(),
        size: switch (theme.season) {
          AppSeason.winter => 2.5 + rng.nextDouble() * 4.5,
          AppSeason.spring => 5 + rng.nextDouble() * 7,
          AppSeason.summer => 6 + rng.nextDouble() * 8,
          AppSeason.autumn => 7 + rng.nextDouble() * 9,
        },
        speed: 0.35 + rng.nextDouble() * 0.9,
        sway: 0.4 + rng.nextDouble() * 1.2,
        phase: rng.nextDouble() * math.pi * 2,
        spin: (rng.nextDouble() - 0.5) * 2.4,
        color: theme.particleColors[rng.nextInt(theme.particleColors.length)],
        kind: switch (theme.season) {
          AppSeason.spring => _Kind.petal,
          AppSeason.summer => rng.nextBool() ? _Kind.fruit : _Kind.sunDot,
          AppSeason.autumn => _Kind.leaf,
          AppSeason.winter => _Kind.snow,
        },
      );
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (context, _) {
            return CustomPaint(
              painter: _SeasonPainter(
                t: _ctrl.value,
                particles: _particles,
                season: widget.theme.season,
              ),
              size: Size.infinite,
            );
          },
        ),
      ),
    );
  }
}

enum _Kind { petal, fruit, sunDot, leaf, snow }

class _Particle {
  const _Particle({
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.sway,
    required this.phase,
    required this.spin,
    required this.color,
    required this.kind,
  });

  final double x;
  final double y;
  final double size;
  final double speed;
  final double sway;
  final double phase;
  final double spin;
  final Color color;
  final _Kind kind;
}

class _SeasonPainter extends CustomPainter {
  _SeasonPainter({
    required this.t,
    required this.particles,
    required this.season,
  });

  final double t;
  final List<_Particle> particles;
  final AppSeason season;

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in particles) {
      final fall = (t * p.speed + p.phase / (math.pi * 2)) % 1.0;
      final y = (p.y + fall) % 1.0 * size.height;
      final x = p.x * size.width + math.sin(t * math.pi * 2 * p.sway + p.phase) * (18 + p.size);
      final rot = t * math.pi * 2 * p.spin + p.phase;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(rot);
      switch (p.kind) {
        case _Kind.snow:
          _drawSnow(canvas, p);
        case _Kind.petal:
          _drawPetal(canvas, p);
        case _Kind.leaf:
          _drawLeaf(canvas, p);
        case _Kind.fruit:
          _drawFruit(canvas, p);
        case _Kind.sunDot:
          _drawSunDot(canvas, p);
      }
      canvas.restore();
    }
  }

  void _drawSnow(Canvas canvas, _Particle p) {
    final paint = Paint()..color = p.color.withValues(alpha: 0.85);
    canvas.drawCircle(Offset.zero, p.size, paint);
    canvas.drawCircle(Offset(p.size * 0.35, -p.size * 0.2), p.size * 0.35, paint..color = Colors.white.withValues(alpha: 0.5));
  }

  void _drawPetal(Canvas canvas, _Particle p) {
    final paint = Paint()..color = p.color.withValues(alpha: 0.9);
    final path = Path()
      ..moveTo(0, -p.size)
      ..quadraticBezierTo(p.size * 0.7, -p.size * 0.2, 0, p.size * 0.55)
      ..quadraticBezierTo(-p.size * 0.7, -p.size * 0.2, 0, -p.size)
      ..close();
    canvas.drawPath(path, paint);
  }

  void _drawLeaf(Canvas canvas, _Particle p) {
    final paint = Paint()..color = p.color.withValues(alpha: 0.92);
    final path = Path()
      ..moveTo(0, -p.size)
      ..quadraticBezierTo(p.size, 0, 0, p.size)
      ..quadraticBezierTo(-p.size * 0.55, 0, 0, -p.size)
      ..close();
    canvas.drawPath(path, paint);
    canvas.drawLine(
      Offset(0, -p.size * 0.7),
      Offset(0, p.size * 0.7),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.18)
        ..strokeWidth = 1,
    );
  }

  void _drawFruit(Canvas canvas, _Particle p) {
    final body = Paint()..color = p.color.withValues(alpha: 0.92);
    canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: p.size * 1.5, height: p.size * 1.35), body);
    canvas.drawCircle(Offset(-p.size * 0.25, -p.size * 0.25), p.size * 0.25, Paint()..color = Colors.white.withValues(alpha: 0.35));
    canvas.drawLine(
      Offset(0, -p.size * 0.75),
      Offset(0, -p.size * 1.05),
      Paint()
        ..color = const Color(0xFF5D4037)
        ..strokeWidth = 1.6
        ..strokeCap = StrokeCap.round,
    );
  }

  void _drawSunDot(Canvas canvas, _Particle p) {
    canvas.drawCircle(Offset.zero, p.size * 0.45, Paint()..color = p.color.withValues(alpha: 0.55));
  }

  @override
  bool shouldRepaint(covariant _SeasonPainter oldDelegate) => oldDelegate.t != t || oldDelegate.season != season;
}
