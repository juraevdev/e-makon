import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Geometric + lettermark logo for **e-makon**.
/// [animate] defaults to false — continuous paint is expensive on low-end devices.
class EmakonLogo extends StatefulWidget {
  const EmakonLogo({
    super.key,
    this.size = 120,
    this.showWordmark = true,
    this.animate = false,
    this.light = false,
    this.wordmarkStyle,
  });

  final double size;
  final bool showWordmark;
  final bool animate;
  final bool light;
  final TextStyle? wordmarkStyle;

  @override
  State<EmakonLogo> createState() => _EmakonLogoState();
}

class _EmakonLogoState extends State<EmakonLogo> with SingleTickerProviderStateMixin {
  AnimationController? _intro;

  @override
  void initState() {
    super.initState();
    if (widget.animate) {
      _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))
        ..forward();
    }
  }

  @override
  void dispose() {
    _intro?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final markColor = widget.light ? Colors.white : AppColors.primary;
    final soft = widget.light
        ? Colors.white.withValues(alpha: 0.18)
        : AppColors.primaryContainer.withValues(alpha: 0.35);

    final mark = RepaintBoundary(
      child: CustomPaint(
        painter: _EmakonMarkPainter(
          rotation: 0.2,
          pulse: 0.5,
          accent: markColor,
          soft: soft,
          light: widget.light,
        ),
        size: Size.square(widget.size),
      ),
    );

    final wordmark = widget.showWordmark
        ? Padding(
            padding: EdgeInsets.only(top: widget.size * 0.14),
            child: Text(
              'e-makon',
              style: (widget.wordmarkStyle ??
                      Theme.of(context).textTheme.headlineLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                            height: 1,
                          ))
                  ?.copyWith(
                color: widget.light ? Colors.white : AppColors.onSurface,
              ),
            ),
          )
        : const SizedBox.shrink();

    final column = Column(
      mainAxisSize: MainAxisSize.min,
      children: [SizedBox(width: widget.size, height: widget.size, child: mark), wordmark],
    );

    if (_intro == null) return column;

    return FadeTransition(
      opacity: CurvedAnimation(parent: _intro!, curve: Curves.easeOut),
      child: ScaleTransition(
        scale: Tween(begin: 0.92, end: 1.0).animate(CurvedAnimation(parent: _intro!, curve: Curves.easeOutBack)),
        child: column,
      ),
    );
  }
}

class _EmakonMarkPainter extends CustomPainter {
  _EmakonMarkPainter({
    required this.rotation,
    required this.pulse,
    required this.accent,
    required this.soft,
    required this.light,
  });

  final double rotation;
  final double pulse;
  final Color accent;
  final Color soft;
  final bool light;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide / 2;

    canvas.drawCircle(c, r * 0.92, Paint()..color = soft);

    final orbit = Paint()
      ..color = accent.withValues(alpha: light ? 0.55 : 0.7)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.035
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(c, r * 0.82, orbit);

    final hexPaint = Paint()
      ..color = accent.withValues(alpha: 0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.05;
    final hexFill = Paint()..color = accent.withValues(alpha: light ? 0.12 : 0.14);
    final hex = _hexagon(c, r * 0.5);
    canvas.drawPath(hex, hexFill);
    canvas.drawPath(hex, hexPaint);

    final homeR = RRect.fromRectAndRadius(
      Rect.fromCenter(center: c, width: r * 0.52, height: r * 0.52),
      Radius.circular(r * 0.12),
    );
    canvas.drawRRect(homeR, Paint()..color = accent.withValues(alpha: light ? 0.2 : 0.22));
    canvas.drawRRect(
      homeR,
      Paint()
        ..color = accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.028,
    );

    final ePaint = Paint()
      ..color = accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.07
      ..strokeCap = StrokeCap.round;
    final er = r * 0.16;
    final eRect = Rect.fromCenter(center: c.translate(0, -r * 0.01), width: er * 2, height: er * 2);
    canvas.drawArc(eRect, math.pi * 0.15, math.pi * 1.55, false, ePaint);
    canvas.drawLine(Offset(c.dx - er * 0.85, c.dy), Offset(c.dx + er * 0.55, c.dy), ePaint);
  }

  Path _hexagon(Offset center, double radius) {
    final path = Path();
    for (var i = 0; i < 6; i++) {
      final a = -math.pi / 2 + i * math.pi / 3;
      final p = Offset(center.dx + math.cos(a) * radius, center.dy + math.sin(a) * radius);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    path.close();
    return path;
  }

  @override
  bool shouldRepaint(covariant _EmakonMarkPainter oldDelegate) {
    return oldDelegate.accent != accent || oldDelegate.light != light || oldDelegate.soft != soft;
  }
}
