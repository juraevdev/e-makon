import 'dart:math';

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../widgets/gradient_background.dart';

class FallingLeavesAnimation extends StatefulWidget {
  const FallingLeavesAnimation({super.key, this.leafCount = 18});

  final int leafCount;

  @override
  State<FallingLeavesAnimation> createState() => _FallingLeavesAnimationState();
}

class _FallingLeavesAnimationState extends State<FallingLeavesAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final List<_Leaf> _leaves;
  final _random = Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
    _leaves = List.generate(widget.leafCount, (_) => _Leaf.random(_random));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return CustomPaint(
          painter: _LeavesPainter(
            progress: _controller.value,
            leaves: _leaves,
          ),
          size: Size.infinite,
        );
      },
    );
  }
}

class _Leaf {
  _Leaf({
    required this.x,
    required this.startY,
    required this.size,
    required this.speed,
    required this.rotation,
    required this.sway,
    required this.opacity,
  });

  final double x;
  final double startY;
  final double size;
  final double speed;
  final double rotation;
  final double sway;
  final double opacity;

  factory _Leaf.random(Random random) {
    return _Leaf(
      x: random.nextDouble(),
      startY: random.nextDouble(),
      size: 10 + random.nextDouble() * 14,
      speed: 0.3 + random.nextDouble() * 0.7,
      rotation: random.nextDouble() * pi * 2,
      sway: random.nextDouble() * 40 - 20,
      opacity: 0.15 + random.nextDouble() * 0.35,
    );
  }
}

class _LeavesPainter extends CustomPainter {
  _LeavesPainter({required this.progress, required this.leaves});

  final double progress;
  final List<_Leaf> leaves;

  @override
  void paint(Canvas canvas, Size size) {
    for (final leaf in leaves) {
      final t = (progress * leaf.speed + leaf.startY) % 1.0;
      final x = leaf.x * size.width + sin(t * pi * 4) * leaf.sway;
      final y = t * (size.height + 80) - 40;

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(leaf.rotation + t * pi * 2);
      _drawLeaf(
        canvas,
        leaf.size,
        AppColors.mintGreen.withValues(alpha: leaf.opacity),
      );
      canvas.restore();
    }
  }

  void _drawLeaf(Canvas canvas, double s, Color color) {
    final paint = Paint()..color = color;
    final path = Path()
      ..moveTo(0, s / 2)
      ..quadraticBezierTo(s / 2, 0, 0, -s / 2)
      ..quadraticBezierTo(-s / 2, 0, 0, s / 2)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _LeavesPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class LeafRainBackground extends StatelessWidget {
  const LeafRainBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const GradientBackground(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF121212), Color(0xFF1A2E1F)],
          ),
          child: SizedBox.expand(),
        ),
        const FallingLeavesAnimation(),
        child,
      ],
    );
  }
}
