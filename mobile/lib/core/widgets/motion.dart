import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/season_theme.dart';
import 'seasonal_weather.dart';

/// Yashil bog‘ atmosferasi — fasl ranglari + yumshoq orb’lar.
class AmbientBackdrop extends StatelessWidget {
  const AmbientBackdrop({
    super.key,
    this.child,
    this.intensity = 1,
    this.season,
    this.showWeather = false,
  });

  final Widget? child;
  final double intensity;
  final SeasonTheme? season;
  final bool showWeather;

  @override
  Widget build(BuildContext context) {
    final a = intensity.clamp(0.0, 1.5);
    final s = season;
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: AppColors.background),
        Positioned(
          top: -120,
          right: -80,
          child: _GlowBlob(
            size: 280,
            color: (s?.glowA ?? AppColors.primary.withValues(alpha: 0.18)).withValues(alpha: 0.22 * a),
          ),
        ),
        Positioned(
          top: 180,
          left: -100,
          child: _GlowBlob(
            size: 220,
            color: (s?.glowB ?? AppColors.splashStart.withValues(alpha: 0.22)).withValues(alpha: 0.26 * a),
          ),
        ),
        Positioned(
          bottom: -40,
          right: 40,
          child: _GlowBlob(
            size: 180,
            color: (s?.glowC ?? const Color(0xFF4FC3F7).withValues(alpha: 0.1)).withValues(alpha: 0.18 * a),
          ),
        ),
        if (showWeather && s != null) Positioned.fill(child: SeasonalWeather(theme: s)),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  AppColors.background.withValues(alpha: 0.35),
                  AppColors.background,
                ],
                stops: const [0.0, 0.55, 1.0],
              ),
            ),
          ),
        ),
        if (child != null) child!,
      ],
    );
  }
}

class _GlowBlob extends StatelessWidget {
  const _GlowBlob({required this.size, required this.color});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 48, sigmaY: 48),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}

/// Kirish animatsiyasi — fade + slide.
class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({
    super.key,
    required this.animation,
    required this.child,
    this.beginOffset = const Offset(0, 0.08),
  });

  final Animation<double> animation;
  final Widget child;
  final Offset beginOffset;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: beginOffset, end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }
}

/// Bosilganda yumshoq scale.
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.scale = 0.97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Splash / onboarding uchun sekin harakatlanuvchi barg/orb.
class FloatingOrbs extends StatefulWidget {
  const FloatingOrbs({super.key, this.count = 7, this.light = false});

  final int count;
  final bool light;

  @override
  State<FloatingOrbs> createState() => _FloatingOrbsState();
}

class _FloatingOrbsState extends State<FloatingOrbs> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_OrbSpec> _orbs;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(7);
    _orbs = List.generate(widget.count, (i) {
      return _OrbSpec(
        x: rng.nextDouble(),
        y: rng.nextDouble(),
        size: 8 + rng.nextDouble() * 18,
        speed: 0.4 + rng.nextDouble() * 0.8,
        phase: rng.nextDouble() * math.pi * 2,
      );
    });
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 12))..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return CustomPaint(
          painter: _OrbsPainter(
            t: _ctrl.value,
            orbs: _orbs,
            light: widget.light,
          ),
          size: Size.infinite,
        );
      },
    );
  }
}

class _OrbSpec {
  const _OrbSpec({
    required this.x,
    required this.y,
    required this.size,
    required this.speed,
    required this.phase,
  });
  final double x;
  final double y;
  final double size;
  final double speed;
  final double phase;
}

class _OrbsPainter extends CustomPainter {
  _OrbsPainter({required this.t, required this.orbs, required this.light});
  final double t;
  final List<_OrbSpec> orbs;
  final bool light;

  @override
  void paint(Canvas canvas, Size size) {
    for (final o in orbs) {
      final dx = math.sin((t * math.pi * 2 * o.speed) + o.phase) * 18;
      final dy = math.cos((t * math.pi * 2 * o.speed * 0.7) + o.phase) * 22;
      final c = Offset(o.x * size.width + dx, o.y * size.height + dy);
      final paint = Paint()
        ..color = (light ? Colors.white : AppColors.primary).withValues(alpha: light ? 0.22 : 0.14);
      canvas.drawCircle(c, o.size, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _OrbsPainter oldDelegate) => oldDelegate.t != t;
}

/// Bo‘lim sarlavhasi — ikonka + matn.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.icon,
    this.accent,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final IconData? icon;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final tint = accent ?? AppColors.primary;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: tint.withValues(alpha: 0.14),
              ),
              child: Icon(icon, size: 18, color: tint),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 22)),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: tint.withValues(alpha: 0.88),
                        ),
                  ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Fasl chip — bahor / yoz / kuz / qish.
class SeasonChip extends StatelessWidget {
  const SeasonChip({super.key, required this.theme});
  final SeasonTheme theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: theme.accent.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: theme.accent.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(theme.emoji, style: const TextStyle(fontSize: 12)),
          const SizedBox(width: 4),
          Text(
            theme.title,
            style: TextStyle(
              color: theme.accent,
              fontWeight: FontWeight.w700,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
