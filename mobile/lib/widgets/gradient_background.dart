import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

class GradientBackground extends StatelessWidget {
  const GradientBackground({
    super.key,
    required this.child,
    this.gradient = AppColors.brandGradient,
  });

  final Widget child;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: gradient),
      child: child,
    );
  }
}

class PlantLogo extends StatelessWidget {
  const PlantLogo({super.key, this.size = 80, this.color = AppColors.white});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size(size, size),
      painter: _PlantPainter(color: color),
    );
  }
}

class _PlantPainter extends CustomPainter {
  _PlantPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final cx = size.width / 2;
    final cy = size.height / 2;
    final s = size.width / 80;

    // Stem
    final stem = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx, cy + 8 * s),
        width: 6 * s,
        height: 28 * s,
      ),
      Radius.circular(3 * s),
    );
    canvas.drawRRect(stem, paint);

    // Center leaf
    _drawLeaf(canvas, paint, cx, cy - 4 * s, 0, 22 * s, 14 * s);

    // Left leaf
    _drawLeaf(canvas, paint, cx - 14 * s, cy + 2 * s, -0.5, 18 * s, 12 * s);

    // Right leaf
    _drawLeaf(canvas, paint, cx + 14 * s, cy + 2 * s, 0.5, 18 * s, 12 * s);
  }

  void _drawLeaf(
    Canvas canvas,
    Paint paint,
    double cx,
    double cy,
    double angle,
    double w,
    double h,
  ) {
    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(angle);
    final path = Path()
      ..moveTo(0, h / 2)
      ..quadraticBezierTo(w / 2, 0, 0, -h / 2)
      ..quadraticBezierTo(-w / 2, 0, 0, h / 2)
      ..close();
    canvas.drawPath(path, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
